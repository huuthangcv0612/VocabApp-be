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
const Exercise = (await import('./src/models/Exercise.js')).default;
const Vocabulary = (await import('./src/models/Vocabulary.js')).default;
const LessonVocabulary = (await import('./src/models/LessonVocabulary.js')).default;
const Lektion = (await import('./src/models/Lektion.js')).default;
const { migrateLektionsToUnits } = await import('./src/scripts/migrateLektionsToUnits.js');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Duolingo-style Curriculum Architecture & Admin Management System', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockLevelId = new mongoose.Types.ObjectId().toString();
  const mockTopicId = new mongoose.Types.ObjectId().toString();
  const mockUnitId = new mongoose.Types.ObjectId().toString();
  const mockLessonId = new mongoose.Types.ObjectId().toString();
  const mockVocabId = new mongoose.Types.ObjectId().toString();
  const mockExerciseId = new mongoose.Types.ObjectId().toString();

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
    await t.test('1. Reject /api/admin/* requests for Regular User -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ title: 'Test Unit' }),
      });
      assert.equal(res.status, 403);
    });

    await t.test('2. Admin can create Unit with parent Topic check -> 201 Created', async () => {
      const origTopicFindById = Topic.findById;
      const origUnitFindOne = Unit.findOne;
      const origUnitCreate = Unit.create;
      const origUnitFindById = Unit.findById;

      Topic.findById = () => Promise.resolve({ _id: mockTopicId, name: 'Familie' });
      Unit.findOne = () => Promise.resolve(null);
      Unit.create = async (doc) => ({ _id: mockUnitId, ...doc });
      Unit.findById = () => ({
        populate: () => Promise.resolve({
          _id: mockUnitId,
          topic_id: { _id: mockTopicId, name: 'Familie' },
          title: 'Meine Familie',
          slug: 'meine-familie',
          order: 1,
        }),
      });

      const res = await fetch(`${baseUrl}/api/admin/units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          topic_id: mockTopicId,
          title: 'Meine Familie',
          description: 'Học các thành viên trong gia đình',
          order: 1,
        }),
      });

      Topic.findById = origTopicFindById;
      Unit.findOne = origUnitFindOne;
      Unit.create = origUnitCreate;
      Unit.findById = origUnitFindById;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.unit.title, 'Meine Familie');
    });

    await t.test('3. Admin GET /api/admin/lessons/:id/detail returns { lesson, preview: { vocabularies }, exercises } sorted by order', async () => {
      const origLessonFindById = Lesson.findById;
      const origLessonVocabFind = LessonVocabulary.find;
      const origExerciseFind = Exercise.find;

      Lesson.findById = () => ({
        populate: () => Promise.resolve({
          _id: mockLessonId,
          title: 'Familienmitglieder',
          slug: 'familienmitglieder',
          estimated_minutes: 5,
          xp: 20,
        }),
      });

      LessonVocabulary.find = () => ({
        populate: () => ({
          sort: () => Promise.resolve([
            {
              order: 1,
              is_new: true,
              vocabulary_id: {
                _id: mockVocabId,
                word: 'der Vater',
                meaning: 'bố',
                toObject: function () {
                  return { _id: mockVocabId, word: 'der Vater', meaning: 'bố' };
                },
              },
            },
          ]),
        }),
      });

      Exercise.find = () => ({
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([
              {
                _id: mockExerciseId,
                lesson_id: mockLessonId,
                type: 'multiple_choice',
                order: 1,
                content: { question: '"der Vater" nghĩa là gì?' },
                answer: { type: 'single', value: 'B' },
              },
            ]),
          }),
        }),
      });

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}/detail`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      Lesson.findById = origLessonFindById;
      LessonVocabulary.find = origLessonVocabFind;
      Exercise.find = origExerciseFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.lesson, 'Must contain lesson object');
      assert.ok(body.data.preview && Array.isArray(body.data.preview.vocabularies), 'Must contain preview vocabularies array');
      assert.ok(Array.isArray(body.data.exercises), 'Must contain exercises array');
    });

    await t.test('4. Admin Reordering PUT /api/admin/exercises/reorder updates order in batch', async () => {
      const origBulkWrite = Exercise.bulkWrite;
      let bulkOpsReceived = null;

      Exercise.bulkWrite = async (ops) => {
        bulkOpsReceived = ops;
        return { ok: 1 };
      };

      const res = await fetch(`${baseUrl}/api/admin/exercises/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          items: [
            { id: mockExerciseId, order: 2 },
          ],
        }),
      });

      Exercise.bulkWrite = origBulkWrite;

      assert.equal(res.status, 200);
      assert.ok(bulkOpsReceived, 'Must send bulk write operations');
      assert.equal(bulkOpsReceived[0].updateOne.filter._id, mockExerciseId);
      assert.equal(bulkOpsReceived[0].updateOne.update.$set.order, 2);
    });

    await t.test('5. Safe Delete Protection: Reject deleting Unit if lessons exist -> 400 Bad Request', async () => {
      const origLessonCount = Lesson.countDocuments;
      Lesson.countDocuments = () => Promise.resolve(2);

      const res = await fetch(`${baseUrl}/api/admin/units/${mockUnitId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      Lesson.countDocuments = origLessonCount;

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.message.includes('Cannot delete unit because it contains lessons'));
    });

    await t.test('6. Safe Delete Protection: Reject deleting Vocabulary if used in lessons -> 400 Bad Request', async () => {
      const origLvCount = LessonVocabulary.countDocuments;
      const origExCount = Exercise.countDocuments;

      LessonVocabulary.countDocuments = () => Promise.resolve(1);
      Exercise.countDocuments = () => Promise.resolve(0);

      const res = await fetch(`${baseUrl}/api/admin/vocabularies/${mockVocabId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      LessonVocabulary.countDocuments = origLvCount;
      Exercise.countDocuments = origExCount;

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.message.includes('Cannot delete vocabulary because it is being used by lessons or exercises'));
    });

  } finally {
    User.findById = originalUserFindById;
    server.close();
  }
});
