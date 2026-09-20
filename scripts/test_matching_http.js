import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_matching_12345';

const app = (await import('../src/app.js')).default;
const User = (await import('../src/models/User.js')).default;
const Lesson = (await import('../src/models/Lesson.js')).default;
const Exercise = (await import('../src/models/Exercise.js')).default;
const UserExerciseProgress = (await import('../src/models/UserExerciseProgress.js')).default;
const UserLessonProgress = (await import('../src/models/UserLessonProgress.js')).default;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Matching Exercise HTTP Endpoint & Security Verification Suite', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockLessonId = new mongoose.Types.ObjectId().toString();
  const mockExerciseId = new mongoose.Types.ObjectId().toString();

  const adminToken = generateToken(mockAdminId);
  const userToken = generateToken(mockUserId);

  // Setup mock returns
  User.findById = (id) => {
    const idStr = id ? id.toString() : '';
    if (idStr === mockAdminId) {
      return Promise.resolve({ _id: mockAdminId, name: 'Admin User', role: 'admin' });
    }
    return Promise.resolve({ _id: mockUserId, name: 'Learner User', role: 'user' });
  };

  const sampleMatchingDoc = {
    _id: mockExerciseId,
    lesson_id: mockLessonId,
    type: 'matching',
    order: 1,
    xp: 2,
    content: {
      pairs: [
        { id: 'pair_1', left: 'có chuyện gì vậy', right: 'was ist los' },
        { id: 'pair_2', left: 'không', right: 'nicht' },
        { id: 'pair_3', left: 'tiệc', right: 'Party' },
        { id: 'pair_4', left: 'kỳ lạ', right: 'komisch' },
        { id: 'pair_5', left: 'Xin lỗi', right: 'Entschuldigung' },
      ],
    },
    answer: {
      pairs: [
        { id: 'pair_1', left: 'có chuyện gì vậy', right: 'was ist los' },
        { id: 'pair_2', left: 'không', right: 'nicht' },
        { id: 'pair_3', left: 'tiệc', right: 'Party' },
        { id: 'pair_4', left: 'kỳ lạ', right: 'komisch' },
        { id: 'pair_5', left: 'Xin lỗi', right: 'Entschuldigung' },
      ],
    },
  };

  await t.test('1. Submit Matching Exercise - Correct Answer -> 200 OK & is_correct=true & xp=2', async () => {
    Exercise.findOne = () => Promise.resolve(sampleMatchingDoc);
    Exercise.countDocuments = () => Promise.resolve(1);

    UserExerciseProgress.findOne = () => Promise.resolve(null);
    UserExerciseProgress.create = (doc) => Promise.resolve({ _id: 'ex_prog_1', ...doc });
    UserExerciseProgress.countDocuments = () => Promise.resolve(1);

    const mockLessonProg = {
      user_id: mockUserId,
      lesson_id: mockLessonId,
      status: 'in_progress',
      progress: 0,
      xp_earned: 0,
      save: () => Promise.resolve(),
    };
    UserLessonProgress.findOne = () => Promise.resolve(mockLessonProg);

    const submittedAnswer = [
      { left: 'có chuyện gì vậy', right: 'was ist los' },
      { left: 'không', right: 'nicht' },
      { left: 'tiệc', right: 'Party' },
      { left: 'kỳ lạ', right: 'komisch' },
      { left: 'Xin lỗi', right: 'Entschuldigung' },
    ];

    const res = await fetch(`${baseUrl}/api/progress/lessons/${mockLessonId}/submit-exercise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ exercise_id: mockExerciseId, answer: submittedAnswer }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.is_correct, true);
    assert.equal(body.data.xp_earned, 2);
  });

  await t.test('2. Submit Matching Exercise - Wrong Pair -> 200 OK & is_correct=false & xp=0', async () => {
    Exercise.findOne = () => Promise.resolve(sampleMatchingDoc);
    Exercise.countDocuments = () => Promise.resolve(1);

    const mockExProg = {
      is_correct: false,
      attempts: 1,
      save: () => Promise.resolve(),
    };
    UserExerciseProgress.findOne = () => Promise.resolve(mockExProg);
    UserExerciseProgress.countDocuments = () => Promise.resolve(0);

    const mockLessonProg = {
      user_id: mockUserId,
      lesson_id: mockLessonId,
      status: 'in_progress',
      progress: 0,
      xp_earned: 0,
      save: () => Promise.resolve(),
    };
    UserLessonProgress.findOne = () => Promise.resolve(mockLessonProg);

    const submittedWrongAnswer = [
      { left: 'có chuyện gì vậy', right: 'was ist los' },
      { left: 'không', right: 'Party' }, // wrong pair
      { left: 'tiệc', right: 'nicht' },
      { left: 'kỳ lạ', right: 'komisch' },
      { left: 'Xin lỗi', right: 'Entschuldigung' },
    ];

    const res = await fetch(`${baseUrl}/api/progress/lessons/${mockLessonId}/submit-exercise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ exercise_id: mockExerciseId, answer: submittedWrongAnswer }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.is_correct, false);
    assert.equal(body.data.xp_earned, 0);
  });

  await t.test('3. Submit Matching Exercise - Client spoofs is_correct=true -> Backend ignores and evaluates correctly', async () => {
    Exercise.findOne = () => Promise.resolve(sampleMatchingDoc);
    Exercise.countDocuments = () => Promise.resolve(1);

    const mockExProg = {
      is_correct: false,
      attempts: 1,
      save: () => Promise.resolve(),
    };
    UserExerciseProgress.findOne = () => Promise.resolve(mockExProg);
    UserExerciseProgress.countDocuments = () => Promise.resolve(0);

    const mockLessonProg = {
      user_id: mockUserId,
      lesson_id: mockLessonId,
      status: 'in_progress',
      progress: 0,
      xp_earned: 0,
      save: () => Promise.resolve(),
    };
    UserLessonProgress.findOne = () => Promise.resolve(mockLessonProg);

    const res = await fetch(`${baseUrl}/api/progress/lessons/${mockLessonId}/submit-exercise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        exercise_id: mockExerciseId,
        is_correct: true, // Client trying to cheat
        answer: [
          { left: 'có chuyện gì vậy', right: 'wrong_pair' },
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.is_correct, false, 'Backend must not trust is_correct from client body');
    assert.equal(body.data.xp_earned, 0);
  });

  await t.test('4. Admin Create Matching Exercise - Invalid pairs array -> 400 Bad Request', async () => {
    Lesson.findById = () => Promise.resolve({ _id: mockLessonId, title: 'Test Lesson' });

    const res = await fetch(`${baseUrl}/api/admin/exercises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        lesson_id: mockLessonId,
        type: 'matching',
        order: 1,
        content: { pairs: [] }, // Invalid: empty pairs
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /non-empty pairs array/i);
  });

  server.close();
});
