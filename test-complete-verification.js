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

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Comprehensive 17-Point Verification Suite', async (t) => {
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
    // 1. Admin create Level
    await t.test('1. Admin create Level -> 201 Created', async () => {
      const origLevelFindOne = Level.findOne;
      const origLevelCreate = Level.create;
      Level.findOne = () => Promise.resolve(null);
      Level.create = async (doc) => ({ _id: mockLevelId, ...doc });

      const res = await fetch(`${baseUrl}/api/admin/levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ level_name: 'A1.1', description: 'Beginner', order: 1 }),
      });

      Level.findOne = origLevelFindOne;
      Level.create = origLevelCreate;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.level.level_name, 'A1.1');
    });

    // 2. Admin create Topic
    await t.test('2. Admin create Topic -> 201 Created', async () => {
      const origLevelFindById = Level.findById;
      const origTopicFindOne = Topic.findOne;
      const origTopicCreate = Topic.create;

      Level.findById = () => Promise.resolve({ _id: mockLevelId, level_name: 'A1.1' });
      Topic.findOne = () => Promise.resolve(null);
      Topic.create = async (doc) => ({ _id: mockTopicId, ...doc });

      const res = await fetch(`${baseUrl}/api/admin/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ level_id: mockLevelId, name: 'Familie', slug: 'familie', order: 1 }),
      });

      Level.findById = origLevelFindById;
      Topic.findOne = origTopicFindOne;
      Topic.create = origTopicCreate;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.topic.name, 'Familie');
    });

    // 3. Admin create Unit
    await t.test('3. Admin create Unit -> 201 Created', async () => {
      const origTopicFindById = Topic.findById;
      const origUnitFindOne = Unit.findOne;
      const origUnitCreate = Unit.create;
      const origUnitFindById = Unit.findById;

      Topic.findById = () => Promise.resolve({ _id: mockTopicId, name: 'Familie' });
      Unit.findOne = () => Promise.resolve(null);
      Unit.create = async (doc) => ({ _id: mockUnitId, ...doc });
      Unit.findById = () => ({ populate: () => Promise.resolve({ _id: mockUnitId, title: 'Meine Familie' }) });

      const res = await fetch(`${baseUrl}/api/admin/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ topic_id: mockTopicId, title: 'Meine Familie', slug: 'meine-familie', order: 1 }),
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

    // 4. Admin create Lesson
    await t.test('4. Admin create Lesson -> 201 Created', async () => {
      const origUnitFindById = Unit.findById;
      const origLessonFindOne = Lesson.findOne;
      const origLessonCreate = Lesson.create;
      const origLessonFindById = Lesson.findById;

      Unit.findById = () => Promise.resolve({ _id: mockUnitId, title: 'Meine Familie' });
      Lesson.findOne = () => Promise.resolve(null);
      Lesson.create = async (doc) => ({ _id: mockLessonId, ...doc });
      Lesson.findById = () => ({ populate: () => Promise.resolve({ _id: mockLessonId, title: 'Familienmitglieder' }) });

      const res = await fetch(`${baseUrl}/api/admin/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ unit_id: mockUnitId, title: 'Familienmitglieder', slug: 'familienmitglieder', order: 1 }),
      });

      Unit.findById = origUnitFindById;
      Lesson.findOne = origLessonFindOne;
      Lesson.create = origLessonCreate;
      Lesson.findById = origLessonFindById;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.lesson.title, 'Familienmitglieder');
    });

    // 5. Admin create Vocabulary
    await t.test('5. Admin create Vocabulary -> 201 Created', async () => {
      const origVocabCreate = Vocabulary.create;
      Vocabulary.create = async (doc) => ({ _id: mockVocabId, ...doc });

      const res = await fetch(`${baseUrl}/api/admin/vocabularies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ word: 'der Vater', meaning: 'bố', part_of_speech: 'noun', level: 'A1.1' }),
      });

      Vocabulary.create = origVocabCreate;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.vocabulary.word, 'der Vater');
    });

    // 6. Admin attach Vocabulary to Lesson
    await t.test('6. Admin attach Vocabulary to Lesson -> 201 Created', async () => {
      const origLessonFindById = Lesson.findById;
      const origVocabFindById = Vocabulary.findById;
      const origLvFindOneAndUpdate = LessonVocabulary.findOneAndUpdate;

      Lesson.findById = () => Promise.resolve({ _id: mockLessonId, title: 'Familienmitglieder' });
      Vocabulary.findById = () => Promise.resolve({ _id: mockVocabId, word: 'der Vater' });
      LessonVocabulary.findOneAndUpdate = () => ({
        populate: () => Promise.resolve({ lesson_id: mockLessonId, vocabulary_id: { word: 'der Vater' }, order: 1 }),
      });

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}/vocabularies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ vocabulary_id: mockVocabId, order: 1, is_new: true }),
      });

      Lesson.findById = origLessonFindById;
      Vocabulary.findById = origVocabFindById;
      LessonVocabulary.findOneAndUpdate = origLvFindOneAndUpdate;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    // 7. Admin create Exercise
    await t.test('7. Admin create Exercise -> 201 Created', async () => {
      const origLessonFindById = Lesson.findById;
      const origExCreate = Exercise.create;
      const origExFindById = Exercise.findById;

      Lesson.findById = () => Promise.resolve({ _id: mockLessonId, title: 'Familienmitglieder' });
      Exercise.create = async (doc) => ({ _id: mockExerciseId, ...doc });
      Exercise.findById = () => ({
        populate: () => ({ populate: () => Promise.resolve({ _id: mockExerciseId, type: 'multiple_choice' }) }),
      });

      const res = await fetch(`${baseUrl}/api/admin/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          lesson_id: mockLessonId,
          type: 'multiple_choice',
          order: 1,
          content: { question: '"der Vater" nghĩa là gì?' },
          answer: { value: 'B' },
        }),
      });

      Lesson.findById = origLessonFindById;
      Exercise.create = origExCreate;
      Exercise.findById = origExFindById;

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    // 8. Admin reorder Exercise
    await t.test('8. Admin reorder Exercise -> 200 OK', async () => {
      const origBulkWrite = Exercise.bulkWrite;
      Exercise.bulkWrite = async () => ({ ok: 1 });

      const res = await fetch(`${baseUrl}/api/admin/exercises/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ items: [{ id: mockExerciseId, order: 2 }] }),
      });

      Exercise.bulkWrite = origBulkWrite;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    // 9. Admin reorder Vocabulary Preview
    await t.test('9. Admin reorder Vocabulary Preview -> 200 OK', async () => {
      const origBulkWrite = LessonVocabulary.bulkWrite;
      LessonVocabulary.bulkWrite = async () => ({ ok: 1 });

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}/vocabularies/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ items: [{ id: mockVocabId, order: 2 }] }),
      });

      LessonVocabulary.bulkWrite = origBulkWrite;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    // 10. Admin get Lesson Detail (contains answer)
    await t.test('10. Admin get Lesson Detail -> returns answers for Admin', async () => {
      const origLessonFindById = Lesson.findById;
      const origLvFind = LessonVocabulary.find;
      const origExFind = Exercise.find;

      Lesson.findById = () => ({ populate: () => Promise.resolve({ _id: mockLessonId, title: 'Familienmitglieder' }) });
      LessonVocabulary.find = () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) });
      Exercise.find = () => ({
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([{ _id: mockExerciseId, answer: { value: 'B' } }]),
          }),
        }),
      });

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}/detail`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      Lesson.findById = origLessonFindById;
      LessonVocabulary.find = origLvFind;
      Exercise.find = origExFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.exercises[0].answer, 'Admin Lesson Detail MUST contain answer object');
    });

    // 11. User get Public Lesson (strips answer!)
    await t.test('11. User get Public Lesson -> STRIPS answer for public learner security', async () => {
      const origLessonFindById = Lesson.findById;
      const origLvFind = LessonVocabulary.find;
      const origExFind = Exercise.find;

      Lesson.findById = () => ({ populate: () => Promise.resolve({ _id: mockLessonId, title: 'Familienmitglieder' }) });
      LessonVocabulary.find = () => ({ populate: () => ({ sort: () => Promise.resolve([]) }) });
      Exercise.find = () => ({
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([
              {
                _id: mockExerciseId,
                answer: { value: 'B' },
                toObject: function () {
                  return { _id: mockExerciseId, answer: { value: 'B' } };
                },
              },
            ]),
          }),
        }),
      });

      const res = await fetch(`${baseUrl}/api/lessons/${mockLessonId}`);

      Lesson.findById = origLessonFindById;
      LessonVocabulary.find = origLvFind;
      Exercise.find = origExFind;

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.strictEqual(body.data.exercises[0].answer, undefined, 'Public GET Lesson MUST strip answer object');
    });

    // 12. User cannot CRUD (403 Forbidden)
    await t.test('12. User cannot CRUD -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/admin/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ title: 'Test Unit' }),
      });
      assert.equal(res.status, 403);
    });

    // 13. Cannot create Exercise with non-existent Lesson
    await t.test('13. Cannot create Exercise with non-existent Lesson -> 404 Not Found', async () => {
      const origLessonFindById = Lesson.findById;
      Lesson.findById = () => Promise.resolve(null);

      const res = await fetch(`${baseUrl}/api/admin/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          lesson_id: mockLessonId,
          type: 'multiple_choice',
          content: {},
          answer: {},
        }),
      });

      Lesson.findById = origLessonFindById;
      assert.equal(res.status, 404);
    });

    // 14. Cannot attach non-existent Vocabulary
    await t.test('14. Cannot attach non-existent Vocabulary -> 404 Not Found', async () => {
      const origLessonFindById = Lesson.findById;
      const origVocabFindById = Vocabulary.findById;

      Lesson.findById = () => Promise.resolve({ _id: mockLessonId });
      Vocabulary.findById = () => Promise.resolve(null);

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}/vocabularies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ vocabulary_id: mockVocabId }),
      });

      Lesson.findById = origLessonFindById;
      Vocabulary.findById = origVocabFindById;

      assert.equal(res.status, 404);
    });

    // 15. Cannot delete Vocabulary in use
    await t.test('15. Cannot delete Vocabulary in use -> 400 Bad Request', async () => {
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
      assert.ok(body.message.includes('Cannot delete vocabulary'));
    });

    // 16. Cannot delete Lesson with Exercises
    await t.test('16. Cannot delete Lesson with Exercises -> 400 Bad Request', async () => {
      const origExCount = Exercise.countDocuments;
      const origLvCount = LessonVocabulary.countDocuments;
      Exercise.countDocuments = () => Promise.resolve(1);
      LessonVocabulary.countDocuments = () => Promise.resolve(0);

      const res = await fetch(`${baseUrl}/api/admin/lessons/${mockLessonId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });

      Exercise.countDocuments = origExCount;
      LessonVocabulary.countDocuments = origLvCount;

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.message.includes('Cannot delete lesson'));
    });

    // 17. Cannot create duplicate slug
    await t.test('17. Cannot create duplicate slug -> 400 Bad Request', async () => {
      const origLevelFindById = Level.findById;
      const origTopicFindOne = Topic.findOne;

      Level.findById = () => Promise.resolve({ _id: mockLevelId });
      Topic.findOne = () => Promise.resolve({ _id: mockTopicId, slug: 'familie' });

      const res = await fetch(`${baseUrl}/api/admin/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ level_id: mockLevelId, name: 'Familie', slug: 'familie' }),
      });

      Level.findById = origLevelFindById;
      Topic.findOne = origTopicFindOne;

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.message.includes('slug already exists'));
    });

  } finally {
    User.findById = originalUserFindById;
    server.close();
  }
});
