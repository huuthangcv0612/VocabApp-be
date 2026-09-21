import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.OPENAI_API_KEY = 'mock_openai_key';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Lesson = (await import('./src/models/Lesson.js')).default;
const Level = (await import('./src/models/Level.js')).default;
const Vocabulary = (await import('./src/models/Vocabulary.js')).default;
const LessonVocabulary = (await import('./src/models/LessonVocabulary.js')).default;
const AIConversationSession = (await import('./src/models/AIConversationSession.js')).default;
const aiService = await import('./src/services/ai.service.js');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('AI Conversation Backend Feature Test Suite', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const userA_Id = new mongoose.Types.ObjectId().toString();
  const userB_Id = new mongoose.Types.ObjectId().toString();
  const tokenA = generateToken(userA_Id);
  const tokenB = generateToken(userB_Id);

  const levelId = new mongoose.Types.ObjectId().toString();
  const validLessonId = new mongoose.Types.ObjectId().toString();
  const emptyLessonId = new mongoose.Types.ObjectId().toString();

  const vocabId1 = new mongoose.Types.ObjectId().toString();
  const vocabId2 = new mongoose.Types.ObjectId().toString();
  const foreignVocabId = new mongoose.Types.ObjectId().toString();

  // Mock User.findById
  const origUserFindById = User.findById;
  User.findById = (id) => {
    const idStr = id?.toString();
    if (idStr === userA_Id) return Promise.resolve({ _id: userA_Id, name: 'User A' });
    if (idStr === userB_Id) return Promise.resolve({ _id: userB_Id, name: 'User B' });
    return Promise.resolve(null);
  };

  // Mock Level.findById
  const origLevelFindById = Level.findById;
  Level.findById = (id) => {
    if (id?.toString() === levelId) return Promise.resolve({ _id: levelId, level_name: 'A1.1' });
    return Promise.resolve(null);
  };

  // Mock Lesson.findById
  const origLessonFindById = Lesson.findById;
  Lesson.findById = (id) => {
    const idStr = id?.toString();
    if (idStr === validLessonId) {
      return Promise.resolve({
        _id: validLessonId,
        title: 'Familienmitglieder',
        level_id: levelId,
      });
    }
    if (idStr === emptyLessonId) {
      return Promise.resolve({
        _id: emptyLessonId,
        title: 'Empty Lesson',
        level_id: levelId,
      });
    }
    return Promise.resolve(null);
  };

  // Mock LessonVocabulary.find
  const origLVFind = LessonVocabulary.find;
  LessonVocabulary.find = (query) => {
    const lessonIdStr = query?.lesson_id?.toString();
    if (lessonIdStr === validLessonId) {
      return {
        sort: () =>
          Promise.resolve([
            { lesson_id: validLessonId, vocabulary_id: vocabId1, order: 1 },
            { lesson_id: validLessonId, vocabulary_id: vocabId2, order: 2 },
          ]),
      };
    }
    return { sort: () => Promise.resolve([]) };
  };

  // Mock Vocabulary.find
  const origVocabFind = Vocabulary.find;
  Vocabulary.find = (query) => {
    const ids = query?._id?.$in || [];
    const strIds = ids.map((id) => id.toString());
    const list = [];
    if (strIds.includes(vocabId1)) {
      list.push({ _id: vocabId1, word: 'mutter', meaning: 'mẹ', part_of_speech: 'noun' });
    }
    if (strIds.includes(vocabId2)) {
      list.push({ _id: vocabId2, word: 'vater', meaning: 'bố', part_of_speech: 'noun' });
    }
    return Promise.resolve(list);
  };

  let activeSession = null;

  // Mock AIConversationSession DB operations
  const origSessionSave = AIConversationSession.prototype.save;
  const origSessionFindById = AIConversationSession.findById;

  const sessionStore = new Map();

  AIConversationSession.prototype.save = function () {
    if (!this._id) {
      this._id = new mongoose.Types.ObjectId();
    }
    sessionStore.set(this._id.toString(), this);
    return Promise.resolve(this);
  };

  AIConversationSession.findById = (id) => {
    const session = sessionStore.get(id?.toString());
    if (!session) {
      const mockQuery = {
        populate: () => mockQuery,
        then: (resolve) => resolve(null),
      };
      return mockQuery;
    }

    const doc = {
      ...session,
      _id: session._id,
      user_id: session.user_id,
      lesson_id: session.lesson_id,
      level_id: session.level_id,
      scenario: session.scenario || '',
      target_vocabulary: session.target_vocabulary,
      messages: session.messages || [],
      used_vocabulary: session.used_vocabulary || [],
      mistakes: session.mistakes || [],
      turn_count: session.turn_count || 0,
      score: session.score,
      status: session.status,
      completedAt: session.completedAt,
      save: function () {
        sessionStore.set(this._id.toString(), this);
        return Promise.resolve(this);
      },
    };

    const mockQuery = {
      populate: function (path) {
        if (path === 'lesson_id') {
          doc.lesson_id = { _id: validLessonId, title: 'Familienmitglieder' };
        }
        if (path === 'target_vocabulary') {
          doc.target_vocabulary = [
            { _id: vocabId1, word: 'mutter', meaning: 'mẹ', part_of_speech: 'noun' },
            { _id: vocabId2, word: 'vater', meaning: 'bố', part_of_speech: 'noun' },
          ];
        }
        return mockQuery;
      },
      then: function (resolve) {
        resolve(doc);
      },
    };

    return mockQuery;
  };

  try {
    const assertSubset = (usedVocab, targetVocab) => {
      const targetStrSet = new Set(targetVocab.map((t) => (t._id || t).toString()));
      for (const item of usedVocab) {
        const itemStr = (item._id || item).toString();
        assert.equal(
          targetStrSet.has(itemStr),
          true,
          `used_vocabulary item ${itemStr} MUST be a subset of target_vocabulary`
        );
      }
    };

    await t.test('CASE 1: Start conversation success', async () => {
      aiService.setMockAIProvider(async () => JSON.stringify({
        scenario: 'Du sprichst mit einer Freundin über deine Familie.',
        message: 'Hallo! Wie geht es deiner Mutter?',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [],
        should_continue: true,
      }));

      const res = await fetch(`${baseUrl}/api/ai/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ lesson_id: validLessonId }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.session_id);
      assert.equal(data.data.lesson.title, 'Familienmitglieder');
      assert.equal(data.data.lesson.level, 'A1.1');
      assert.equal(data.data.target_vocabulary.length, 2);
      assert.equal(data.data.ai_message.role, 'assistant');
      assert.equal(data.data.turn_count, 0);
      assert.equal(data.data.userTurnCount, 0);
      assert.equal(data.data.isCompleted, false);
      assert.ok(data.data.scenario);
      assert.equal(data.data.status, 'active');

      activeSession = data.data;
    });

    await t.test('CASE 2: Invalid lesson_id', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ lesson_id: 'invalid-id' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 3: Lesson not found', async () => {
      const nonExistentLessonId = new mongoose.Types.ObjectId().toString();
      const res = await fetch(`${baseUrl}/api/ai/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ lesson_id: nonExistentLessonId }),
      });

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 4: Lesson has no vocabulary', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ lesson_id: emptyLessonId }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 5: Unauthenticated user', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: validLessonId }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 6: Send message success', async () => {
      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Sehr gut! Und wie heißt dein Vater?',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [vocabId1],
        should_continue: true,
      }));

      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeSession.session_id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Meine Mutter heißt Anna.' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.user_message.content, 'Meine Mutter heißt Anna.');
      assert.equal(data.data.turn_count, 1);
      assert.equal(data.data.status, 'active');

      assertSubset(data.data.used_vocabulary, activeSession.target_vocabulary);
    });

    await t.test('CASE 7: Session not found', async () => {
      const fakeSessionId = new mongoose.Types.ObjectId().toString();
      const res = await fetch(`${baseUrl}/api/ai/conversations/${fakeSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Hallo' }),
      });

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 8: Session belongs to another user', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeSession.session_id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ message: 'Hallo from User B' }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 9: Session completed error check', async () => {
      const compSessionId = new mongoose.Types.ObjectId().toString();
      sessionStore.set(compSessionId, {
        _id: compSessionId,
        user_id: userA_Id,
        lesson_id: validLessonId,
        level_id: levelId,
        target_vocabulary: [vocabId1],
        messages: [],
        used_vocabulary: [],
        mistakes: [],
        turn_count: 5,
        status: 'completed',
        completedAt: new Date(),
      });

      const res = await fetch(`${baseUrl}/api/ai/conversations/${compSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Can I send a message?' }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    await t.test('CASE 10: MAX_TURNS auto-completion at 3 turns and rejection at 4th turn', async () => {
      const maxTurnSessionId = new mongoose.Types.ObjectId().toString();
      sessionStore.set(maxTurnSessionId, {
        _id: maxTurnSessionId,
        user_id: userA_Id,
        lesson_id: validLessonId,
        level_id: levelId,
        scenario: 'Familie Gespräch',
        target_vocabulary: [vocabId1],
        messages: [],
        used_vocabulary: [],
        mistakes: [],
        turn_count: 2,
        status: 'active',
      });

      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Das war der 3. Turn! Danke fürs Sprechen.',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [],
        should_continue: false,
      }));

      const res3 = await fetch(`${baseUrl}/api/ai/conversations/${maxTurnSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: '3rd message' }),
      });

      assert.equal(res3.status, 200);
      const data3 = await res3.json();
      assert.equal(data3.data.turn_count, 3);
      assert.equal(data3.data.userTurnCount, 3);
      assert.equal(data3.data.isCompleted, true);
      assert.equal(data3.data.status, 'completed');

      // 4th turn MUST be rejected
      const res4 = await fetch(`${baseUrl}/api/ai/conversations/${maxTurnSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: '4th message' }),
      });

      assert.equal(res4.status, 409);
      const data4 = await res4.json();
      assert.equal(data4.success, false);
      assert.match(data4.message, /completed/i);
    });

    await t.test('CASE 11: Complete session', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeSession.session_id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, 'completed');
      assert.ok(typeof data.data.summary.score === 'number');
      assert.equal(data.data.summary.target_vocabulary_count, 2);
    });

    await t.test('CASE 12: Get session', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeSession.session_id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.session_id, activeSession.session_id);
      assert.ok(data.data.lesson);
      assert.ok(Array.isArray(data.data.messages));
    });

    await t.test('CASE 13: AI provider returns invalid JSON', async () => {
      const activeTestSessionId = new mongoose.Types.ObjectId().toString();
      sessionStore.set(activeTestSessionId, {
        _id: activeTestSessionId,
        user_id: userA_Id,
        lesson_id: validLessonId,
        level_id: levelId,
        target_vocabulary: [vocabId1],
        messages: [],
        used_vocabulary: [],
        mistakes: [],
        turn_count: 1,
        status: 'active',
      });

      aiService.setMockAIProvider(async () => 'Invalid Non-JSON response text');

      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeTestSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Hello' }),
      });

      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'AI provider returned invalid JSON response');
    });

    await t.test('CASE 14: AI provider error (e.g. rate limit)', async () => {
      const activeTestSessionId = new mongoose.Types.ObjectId().toString();
      sessionStore.set(activeTestSessionId, {
        _id: activeTestSessionId,
        user_id: userA_Id,
        lesson_id: validLessonId,
        level_id: levelId,
        target_vocabulary: [vocabId1],
        messages: [],
        used_vocabulary: [],
        mistakes: [],
        turn_count: 1,
        status: 'active',
      });

      aiService.setMockAIProvider(async () => {
        const err = new Error('Rate limit exceeded');
        err.status = 429;
        err.code = 'rate_limit_exceeded';
        throw err;
      });

      const res = await fetch(`${baseUrl}/api/ai/conversations/${activeTestSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Test rate limit' }),
      });

      assert.equal(res.status, 429);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'AI provider rate limit exceeded');
    });

    await t.test('CASE 15: AI returns vocabulary_id not belonging to Lesson', async () => {
      const testSessionId = new mongoose.Types.ObjectId().toString();
      sessionStore.set(testSessionId, {
        _id: testSessionId,
        user_id: userA_Id,
        lesson_id: validLessonId,
        level_id: levelId,
        target_vocabulary: [vocabId1, vocabId2],
        messages: [],
        used_vocabulary: [],
        mistakes: [],
        turn_count: 1,
        status: 'active',
      });

      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Antwort mit fremdem Wort',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [vocabId1, foreignVocabId, 'random_unrelated_vocab_id'],
        should_continue: true,
      }));

      const res = await fetch(`${baseUrl}/api/ai/conversations/${testSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Ich kenne meine Mutter.' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.deepEqual(data.data.used_vocabulary, [vocabId1]);
      assertSubset(data.data.used_vocabulary, [vocabId1, vocabId2]);
    });

    await t.test('CASE 16: Full 3-Turn Conversation Flow with lessonId alias & 4th reply rejection', async () => {
      // 1. Start conversation using lessonId (camelCase alias)
      aiService.setMockAIProvider(async () => JSON.stringify({
        scenario: 'Du sprichst mit einer neuen Freundin über deine Familie.',
        message: 'Hallo! Hast du Geschwister?',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [],
        should_continue: true,
      }));

      const startRes = await fetch(`${baseUrl}/api/ai/conversation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ lessonId: validLessonId }),
      });

      assert.equal(startRes.status, 200);
      const startData = await startRes.json();
      assert.equal(startData.success, true);
      assert.equal(startData.data.userTurnCount, 0);
      assert.equal(startData.data.turn_count, 0);
      assert.equal(startData.data.isCompleted, false);
      assert.equal(startData.data.status, 'active');
      assert.equal(startData.data.scenario, 'Du sprichst mit einer neuen Freundin über deine Familie.');

      const sessId = startData.data.session_id;

      // 2. User reply #1
      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Schön! Und wie heißt deine Mutter?',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [vocabId1],
        should_continue: true,
      }));

      const reply1Res = await fetch(`${baseUrl}/api/ai/conversation/${sessId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Ja, ich habe einen Bruder.' }),
      });

      assert.equal(reply1Res.status, 200);
      const reply1Data = await reply1Res.json();
      assert.equal(reply1Data.data.userTurnCount, 1);
      assert.equal(reply1Data.data.turn_count, 1);
      assert.equal(reply1Data.data.isCompleted, false);
      assert.equal(reply1Data.data.status, 'active');

      // 3. User reply #2
      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Toll! Was macht dein Vater beruflich?',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [vocabId2],
        should_continue: true,
      }));

      const reply2Res = await fetch(`${baseUrl}/api/ai/conversation/${sessId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Meine Mutter heißt Anna.' }),
      });

      assert.equal(reply2Res.status, 200);
      const reply2Data = await reply2Res.json();
      assert.equal(reply2Data.data.userTurnCount, 2);
      assert.equal(reply2Data.data.turn_count, 2);
      assert.equal(reply2Data.data.isCompleted, false);
      assert.equal(reply2Data.data.status, 'active');

      // 4. User reply #3 (Final User Reply)
      aiService.setMockAIProvider(async () => JSON.stringify({
        message: 'Das war ein tolles Gespräch! Du hast super auf Deutsch geantwortet. Danke fürs Sprechen!',
        feedback: { is_correct: true, correction: null, explanation: null },
        used_vocabulary: [],
        should_continue: false,
      }));

      const reply3Res = await fetch(`${baseUrl}/api/ai/conversation/${sessId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: 'Mein Vater ist Arzt.' }),
      });

      assert.equal(reply3Res.status, 200);
      const reply3Data = await reply3Res.json();
      assert.equal(reply3Data.data.userTurnCount, 3);
      assert.equal(reply3Data.data.turn_count, 3);
      assert.equal(reply3Data.data.isCompleted, true);
      assert.equal(reply3Data.data.status, 'completed');

      // 5. User reply #4 (MUST BE STRICTLY REJECTED WITH HTTP 409)
      const reply4Res = await fetch(`${baseUrl}/api/ai/conversation/${sessId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ message: '4th message attempt - should fail' }),
      });

      assert.equal(reply4Res.status, 409);
      const reply4Data = await reply4Res.json();
      assert.equal(reply4Data.success, false);
      assert.match(reply4Data.message, /completed/i);

      // 6. Verify GET session has metadata
      const getRes = await fetch(`${baseUrl}/api/ai/conversation/${sessId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenA}` },
      });

      assert.equal(getRes.status, 200);
      const getData = await getRes.json();
      assert.equal(getData.data.userTurnCount, 3);
      assert.equal(getData.data.isCompleted, true);
      assert.equal(getData.data.status, 'completed');
      assert.ok(getData.data.scenario);
    });

  } finally {
    User.findById = origUserFindById;
    Level.findById = origLevelFindById;
    Lesson.findById = origLessonFindById;
    LessonVocabulary.find = origLVFind;
    Vocabulary.find = origVocabFind;
    aiService.resetMockAIProvider();
    AIConversationSession.prototype.save = origSessionSave;
    AIConversationSession.findById = origSessionFindById;
    server.close();
  }
});
