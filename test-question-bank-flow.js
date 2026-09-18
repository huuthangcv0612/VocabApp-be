import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.OPENAI_API_KEY = 'test_openai_key';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Question = (await import('./src/models/Question.js')).default;
const Test = (await import('./src/models/Test.js')).default;
const TestResult = (await import('./src/models/TestResult.js')).default;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Question Bank, Test Generator, Scoring Engine & Admin Dashboard Flow', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockQuestionId1 = new mongoose.Types.ObjectId().toString();
  const mockQuestionId2 = new mongoose.Types.ObjectId().toString();
  const mockTestId = new mongoose.Types.ObjectId().toString();
  const mockResultId = new mongoose.Types.ObjectId().toString();

  const adminToken = generateToken(mockAdminId);
  const userToken = generateToken(mockUserId);

  const originalUserFindById = User.findById;

  User.findById = (id) => {
    const idStr = id.toString();
    if (idStr === mockAdminId) {
      return Promise.resolve({ _id: mockAdminId, name: 'Admin User', role: 'admin' });
    }
    if (idStr === mockUserId) {
      return Promise.resolve({ _id: mockUserId, name: 'Learner User', role: 'user' });
    }
    return Promise.resolve(null);
  };

  try {
    await t.test('1. Reject POST /api/questions for Regular User -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          level: 'A1',
          question: 'Wie heißt du?',
          options: [{ text: 'Ich heiße Anna.', isCorrect: true }, { text: 'Ich bin 20 Jahre.', isCorrect: false }],
        }),
      });
      assert.equal(res.status, 403);
    });

    await t.test('2. Allow POST /api/questions for Admin -> 201 Created', async () => {
      const origCreate = Question.create;
      Question.create = async (doc) => ({
        _id: mockQuestionId1,
        ...doc,
        createdAt: new Date(),
      });

      const res = await fetch(`${baseUrl}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          level: 'A1',
          topic: 'Begrüßung',
          type: 'multiple_choice',
          question: 'Wie heißt du?',
          options: [
            { text: 'Ich heiße Anna.', isCorrect: true },
            { text: 'Ich bin 20 Jahre.', isCorrect: false },
          ],
          explanation: 'Die richtige Antwort ist: Ich heiße Anna.',
          difficulty: 'easy',
          skill: 'vocabulary',
        }),
      });

      Question.create = origCreate;
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.question.question, 'Wie heißt du?');
    });

    await t.test('3. Soft Delete Question DELETE /api/questions/:id -> status set to inactive', async () => {
      let savedQuestion = {
        _id: mockQuestionId1,
        question: 'Wie heißt du?',
        status: 'active',
        save: async function () {
          return this;
        },
      };

      const origFindById = Question.findById;
      Question.findById = () => Promise.resolve(savedQuestion);

      const res = await fetch(`${baseUrl}/api/questions/${mockQuestionId1}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      Question.findById = origFindById;
      assert.equal(res.status, 200);
      assert.equal(savedQuestion.status, 'inactive');
    });

    await t.test('4. Test Generator GET /api/tests/quick-test -> SANITIZE payload (no isCorrect, no explanation)', async () => {
      const mockActiveQuestions = [
        {
          _id: mockQuestionId1,
          level: 'A1',
          topic: 'Begrüßung',
          type: 'multiple_choice',
          question: 'Wie heißt du?',
          options: [
            { text: 'Ich heiße Anna.', isCorrect: true },
            { text: 'Ich bin 20 Jahre.', isCorrect: false },
          ],
          explanation: 'SECRET EXPLANATION',
          difficulty: 'easy',
          skill: 'vocabulary',
          status: 'active',
        },
        {
          _id: mockQuestionId2,
          level: 'A1',
          topic: 'Grammatik',
          type: 'multiple_choice',
          question: 'Wo ___ du?',
          options: [
            { text: 'wohnst', isCorrect: true },
            { text: 'wohnen', isCorrect: false },
          ],
          explanation: 'SECRET EXPLANATION 2',
          difficulty: 'easy',
          skill: 'grammar',
          status: 'active',
        },
      ];

      const origFind = Question.find;
      Question.find = () => Promise.resolve(mockActiveQuestions);

      const res = await fetch(`${baseUrl}/api/tests/quick-test?level=A1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      Question.find = origFind;
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.test.level, 'A1');
      assert.equal(body.data.test.questions.length, 2);

      for (const q of body.data.test.questions) {
        assert.strictEqual(q.isCorrect, undefined, 'isCorrect must be stripped from top level');
        assert.strictEqual(q.explanation, undefined, 'explanation must be stripped from payload');
        assert.ok(Array.isArray(q.options), 'options must be an array');
        assert.ok(typeof q.options[0] === 'string', 'option items must be strings');
      }
    });

    await t.test('5. Submit Test Result POST /api/test-results -> Calculate score, skills & weaknesses', async () => {
      const mockQuestionsDb = [
        {
          _id: mockQuestionId1,
          question: 'Wie heißt du?',
          skill: 'vocabulary',
          difficulty: 'easy',
          options: [
            { text: 'Ich heiße Anna.', isCorrect: true },
            { text: 'Ich bin 20 Jahre.', isCorrect: false },
          ],
          explanation: 'Explain 1',
        },
        {
          _id: mockQuestionId2,
          question: 'Wo ___ du?',
          skill: 'grammar',
          difficulty: 'easy',
          options: [
            { text: 'wohnst', isCorrect: true },
            { text: 'wohnen', isCorrect: false },
          ],
          explanation: 'Explain 2',
        },
      ];

      const origQuestionFind = Question.find;
      Question.find = () => Promise.resolve(mockQuestionsDb);

      const origResultCreate = TestResult.create;
      TestResult.create = async (doc) => ({
        _id: mockResultId,
        ...doc,
      });

      const res = await fetch(`${baseUrl}/api/test-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          testName: 'Quick Test A1',
          level: 'A1',
          answers: [
            { questionId: mockQuestionId1, selectedOption: 0 }, // Correct
            { questionId: mockQuestionId2, selectedOption: 1 }, // Wrong
          ],
        }),
      });

      Question.find = origQuestionFind;
      TestResult.create = origResultCreate;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.result.score, 1);
      assert.equal(body.data.result.total, 2);
      assert.equal(body.data.result.percentage, 50);
      assert.ok(body.data.result.weaknesses.includes('grammar'));
    });

    await t.test('6. Admin Dashboard GET /api/admin/statistics -> Contains question bank stats', async () => {
      const origUserCount = User.countDocuments;
      const origUserFind = User.find;
      const origVocabCount = (await import('./src/models/Vocabulary.js')).default.countDocuments;
      const origQuizCount = (await import('./src/models/Quiz.js')).default.countDocuments;
      const origTestCount = Test.countDocuments;
      const origResultCount = TestResult.countDocuments;
      const origQuestionCount = Question.countDocuments;

      User.countDocuments = () => Promise.resolve(1284);
      User.find = () => ({ sort: () => ({ limit: () => Promise.resolve([]) }) });
      (await import('./src/models/Vocabulary.js')).default.countDocuments = () => Promise.resolve(350);
      (await import('./src/models/Quiz.js')).default.countDocuments = () => Promise.resolve(12);
      Test.countDocuments = () => Promise.resolve(12);
      TestResult.countDocuments = () => Promise.resolve(856);

      Question.countDocuments = async (query) => {
        if (!query || Object.keys(query).length === 0) return 532;
        if (query.level === 'A1') return 120;
        if (query.level === 'A2') return 90;
        if (query.level === 'B1') return 70;
        return 0;
      };

      const res = await fetch(`${baseUrl}/api/admin/statistics`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      User.countDocuments = origUserCount;
      User.find = origUserFind;
      (await import('./src/models/Vocabulary.js')).default.countDocuments = origVocabCount;
      (await import('./src/models/Quiz.js')).default.countDocuments = origQuizCount;
      Test.countDocuments = origTestCount;
      TestResult.countDocuments = origResultCount;
      Question.countDocuments = origQuestionCount;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.totalQuestions, 532);
      assert.equal(body.data.questionsByLevel.A1, 120);
      assert.equal(body.data.questionsByLevel.A2, 90);
      assert.equal(body.data.questionsByLevel.B1, 70);
      assert.equal(body.data.totalTests, 12);
      assert.equal(body.data.totalResults, 856);
    });

  } finally {
    User.findById = originalUserFindById;
    server.close();
  }
});
