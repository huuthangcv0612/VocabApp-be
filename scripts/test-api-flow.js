import app from '../src/app.js';
import mongoose from 'mongoose';
import Level from '../src/models/Level.js';
import Lesson from '../src/models/Lesson.js';
import Unit from '../src/models/Unit.js';
import Exercise from '../src/models/Exercise.js';
import Vocabulary from '../src/models/Vocabulary.js';
import { getAllLessons, createLesson } from '../src/controllers/lessonController.js';
import { getAllExercises } from '../src/controllers/exerciseController.js';

console.log('--------------------------------------------------');
console.log('🧪 RUNNING COMPREHENSIVE BACKEND UNIT & ROUTE TESTS');
console.log('--------------------------------------------------');

// Helper to mock req/res and wrap controller call into a Promise that rejects on next(err)
function callController(fn, options = {}) {
  const req = {
    query: options.query || {},
    params: options.params || {},
    body: options.body || {},
    user: options.user || { id: new mongoose.Types.ObjectId() },
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
  };

  return new Promise((resolve, reject) => {
    const next = (err) => {
      if (err) reject({ err, statusCode, responseData });
      else resolve({ statusCode, responseData });
    };

    try {
      const p = fn(req, res, next);
      if (p && typeof p.then === 'function') {
        p.then(() => resolve({ statusCode, responseData })).catch(next);
      }
    } catch (e) {
      reject({ err: e, statusCode, responseData });
    }
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Schema Checks
  console.log('\n--- TEST 1: Schema Verification ---');
  assert(Lesson.schema.path('level_id') !== undefined, 'Lesson schema has level_id field');
  assert(Lesson.schema.path('unit_id') !== undefined, 'Lesson schema retains unit_id field');
  assert(Vocabulary.schema.path('level_id') !== undefined, 'Vocabulary schema has level_id field');
  assert(Vocabulary.schema.path('lektion_id') === undefined, 'Vocabulary schema removed lektion_id field');
  assert(Vocabulary.schema.path('lektionId') === undefined, 'Vocabulary schema removed lektionId field');

  // TEST 2: GET Lessons with invalid level_id -> HTTP 400
  console.log('\n--- TEST 2: Invalid level_id handling ---');
  try {
    await callController(getAllLessons, { query: { level_id: 'invalid-id-format' } });
    assert(false, 'Should throw error for invalid level_id');
  } catch ({ err }) {
    assert(err.statusCode === 400, 'Invalid level_id throws HTTP 400');
    assert(err.message === 'Invalid Level ID', 'Error message is "Invalid Level ID"');
  }

  // TEST 3: GET Exercises with invalid lesson_id -> HTTP 400
  console.log('\n--- TEST 3: Invalid lesson_id in Exercises handling ---');
  try {
    await callController(getAllExercises, { query: { lesson_id: 'invalid-lesson-id' } });
    assert(false, 'Should throw error for invalid lesson_id');
  } catch ({ err }) {
    assert(err.statusCode === 400, 'Invalid lesson_id throws HTTP 400');
    assert(err.message === 'Invalid Lesson ID', 'Error message is "Invalid Lesson ID"');
  }

  // TEST 4: CREATE Lesson with invalid level_id -> HTTP 400
  console.log('\n--- TEST 4: CREATE Lesson validation ---');
  try {
    await callController(createLesson, { body: { title: 'Test Lesson', unit_id: new mongoose.Types.ObjectId() } });
    assert(false, 'Should throw error when level_id is missing');
  } catch ({ err }) {
    assert(err.statusCode === 400, 'Missing level_id throws HTTP 400');
    assert(err.message === 'Invalid Level ID', 'Error message is "Invalid Level ID"');
  }

  console.log('\n--------------------------------------------------');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('--------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
