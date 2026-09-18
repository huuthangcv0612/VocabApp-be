import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Level = (await import('./src/models/Level.js')).default;
const Topic = (await import('./src/models/Topic.js')).default;
const Unit = (await import('./src/models/Unit.js')).default;
const Lesson = (await import('./src/models/Lesson.js')).default;
const UserLessonProgress = (await import('./src/models/UserLessonProgress.js')).default;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Learning Path Progression Suite (Source of Truth Verification)', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockLevelId = new mongoose.Types.ObjectId().toString();
  const mockTopicId = new mongoose.Types.ObjectId().toString();

  const mockUnit1Id = new mongoose.Types.ObjectId().toString();
  const mockUnit2Id = new mongoose.Types.ObjectId().toString();

  const mockL1Id = new mongoose.Types.ObjectId().toString();
  const mockL2Id = new mongoose.Types.ObjectId().toString();
  const mockL3Id = new mongoose.Types.ObjectId().toString();

  const userToken = generateToken(mockUserId);

  const origUserFindById = User.findById;
  User.findById = (id) => {
    if (id.toString() === mockUserId) {
      return Promise.resolve({ _id: mockUserId, name: 'Learner User', role: 'user' });
    }
    return Promise.resolve(null);
  };

  try {
    await t.test('CASE 1: New User -> Lesson 1 = current, rest = locked', async () => {
      const origLevelFindById = Level.findById;
      const origTopicFind = Topic.find;
      const origUnitFind = Unit.find;
      const origLessonFind = Lesson.find;
      const origProgressFind = UserLessonProgress.find;

      Level.findById = () => Promise.resolve({ _id: mockLevelId, level_name: 'A1.1' });
      Topic.find = () => Promise.resolve([{ _id: mockTopicId, level_id: mockLevelId }]);

      Unit.find = () => ({
        populate: () => ({
          sort: () => Promise.resolve([
            { _id: mockUnit1Id, title: 'Unit 1', order: 1, toObject: () => ({ _id: mockUnit1Id, title: 'Unit 1', order: 1 }) },
            { _id: mockUnit2Id, title: 'Unit 2', order: 2, toObject: () => ({ _id: mockUnit2Id, title: 'Unit 2', order: 2 }) },
          ]),
        }),
      });

      Lesson.find = () => ({
        sort: () => Promise.resolve([
          { _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20, toObject: () => ({ _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20 }) },
          { _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20, toObject: () => ({ _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20 }) },
          { _id: mockL3Id, unit_id: mockUnit2Id, title: 'L3', order: 1, xp: 20, toObject: () => ({ _id: mockL3Id, unit_id: mockUnit2Id, title: 'L3', order: 1, xp: 20 }) },
        ]),
      });

      UserLessonProgress.find = () => Promise.resolve([]); // 0 progress

      const res = await fetch(`${baseUrl}/api/levels/${mockLevelId}/units`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });

      Level.findById = origLevelFindById;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origProgressFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);

      const units = Array.isArray(body.data) ? body.data : body.data.units;
      assert.equal(units.length, 2);

      const u1Lessons = units[0].lessons;
      assert.equal(u1Lessons[0].status, 'current');
      assert.equal(u1Lessons[1].status, 'locked');

      const u2Lessons = units[1].lessons;
      assert.equal(u2Lessons[0].status, 'locked');
    });

    await t.test('CASE 2: User completed Lesson 1 -> L1 = completed, L2 = current, L3 = locked', async () => {
      const origLevelFindById = Level.findById;
      const origTopicFind = Topic.find;
      const origUnitFind = Unit.find;
      const origLessonFind = Lesson.find;
      const origProgressFind = UserLessonProgress.find;

      Level.findById = () => Promise.resolve({ _id: mockLevelId, level_name: 'A1.1' });
      Topic.find = () => Promise.resolve([{ _id: mockTopicId, level_id: mockLevelId }]);

      Unit.find = () => ({
        populate: () => ({
          sort: () => Promise.resolve([
            { _id: mockUnit1Id, title: 'Unit 1', order: 1, toObject: () => ({ _id: mockUnit1Id, title: 'Unit 1', order: 1 }) },
            { _id: mockUnit2Id, title: 'Unit 2', order: 2, toObject: () => ({ _id: mockUnit2Id, title: 'Unit 2', order: 2 }) },
          ]),
        }),
      });

      Lesson.find = () => ({
        sort: () => Promise.resolve([
          { _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20, toObject: () => ({ _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20 }) },
          { _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20, toObject: () => ({ _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20 }) },
          { _id: mockL3Id, unit_id: mockUnit2Id, title: 'L3', order: 1, xp: 20, toObject: () => ({ _id: mockL3Id, unit_id: mockUnit2Id, title: 'L3', order: 1, xp: 20 }) },
        ]),
      });

      UserLessonProgress.find = () => Promise.resolve([
        { user_id: mockUserId, lesson_id: mockL1Id, status: 'completed', progress: 100 },
      ]);

      const res = await fetch(`${baseUrl}/api/levels/${mockLevelId}/units`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });

      Level.findById = origLevelFindById;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;
      UserLessonProgress.find = origProgressFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      const units = Array.isArray(body.data) ? body.data : body.data.units;

      const u1Lessons = units[0].lessons;
      assert.equal(u1Lessons[0].status, 'completed');
      assert.equal(u1Lessons[1].status, 'current');

      const u2Lessons = units[1].lessons;
      assert.equal(u2Lessons[0].status, 'locked');
    });

    await t.test('CASE 4: Guest User -> Lesson 1 = current, rest = locked', async () => {
      const origLevelFindById = Level.findById;
      const origTopicFind = Topic.find;
      const origUnitFind = Unit.find;
      const origLessonFind = Lesson.find;

      Level.findById = () => Promise.resolve({ _id: mockLevelId, level_name: 'A1.1' });
      Topic.find = () => Promise.resolve([{ _id: mockTopicId, level_id: mockLevelId }]);

      Unit.find = () => ({
        populate: () => ({
          sort: () => Promise.resolve([
            { _id: mockUnit1Id, title: 'Unit 1', order: 1, toObject: () => ({ _id: mockUnit1Id, title: 'Unit 1', order: 1 }) },
          ]),
        }),
      });

      Lesson.find = () => ({
        sort: () => Promise.resolve([
          { _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20, toObject: () => ({ _id: mockL1Id, unit_id: mockUnit1Id, title: 'L1', order: 1, xp: 20 }) },
          { _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20, toObject: () => ({ _id: mockL2Id, unit_id: mockUnit1Id, title: 'L2', order: 2, xp: 20 }) },
        ]),
      });

      const res = await fetch(`${baseUrl}/api/levels/${mockLevelId}/units`); // No token

      Level.findById = origLevelFindById;
      Topic.find = origTopicFind;
      Unit.find = origUnitFind;
      Lesson.find = origLessonFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      const units = Array.isArray(body.data) ? body.data : body.data.units;

      assert.equal(units[0].lessons[0].status, 'current');
      assert.equal(units[0].lessons[1].status, 'locked');
    });

    await t.test('CASE 5: Non-existent Level -> 404 Not Found', async () => {
      const origLevelFindById = Level.findById;
      const origLevelFindOne = Level.findOne;

      Level.findById = () => Promise.resolve(null);
      Level.findOne = () => Promise.resolve(null);

      const invalidId = new mongoose.Types.ObjectId().toString();
      const res = await fetch(`${baseUrl}/api/levels/${invalidId}/units`);

      Level.findById = origLevelFindById;
      Level.findOne = origLevelFindOne;

      assert.equal(res.status, 404);
    });

  } finally {
    User.findById = origUserFindById;
    server.close();
  }
});
