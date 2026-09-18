import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Exercise from '../src/models/Exercise.js';
import { submitLessonExercise } from '../src/controllers/progressController.js';
import { submitExerciseAnswer } from '../src/controllers/publicCurriculumController.js';

function executeController(controllerFn, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      jsonPayload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonPayload = data;
        resolve(this);
        return this;
      }
    };
    const next = (err) => {
      if (err) reject(err);
    };

    try {
      controllerFn(req, res, next);
    } catch (err) {
      reject(err);
    }
  });
}

async function runApiIntegrationTest() {
  await connectDB();
  console.log('==================================================');
  console.log('🌐 RUNNING FULL CONTROLLER / API INTEGRATION TEST');
  console.log('==================================================');

  // Find or create test user
  let user = await User.findOne({ email: 'test_grading@example.com' });
  if (!user) {
    user = await User.create({
      name: 'Test Grading',
      username: 'test_grading',
      email: 'test_grading@example.com',
      password: 'password123',
    });
  }

  const lessonId = '6a82dff7eb76f67f6232a7c1';
  const exerciseId = '6a82e242e79b4bac53b1554a';

  // Test 1: submitLessonExercise (progressController) with correct answer "der Vater"
  const req1 = {
    user: { id: user._id.toString() },
    params: { lessonId },
    body: {
      exercise_id: exerciseId,
      answer: 'der Vater'
    }
  };

  const res1 = await executeController(submitLessonExercise, req1);

  console.log('\n[TEST 1] progressController submitLessonExercise ("der Vater"):');
  console.log('Status Code:', res1.statusCode);
  console.log('Response Payload:', JSON.stringify(res1.jsonPayload, null, 2));

  if (res1.statusCode !== 200 || !res1.jsonPayload?.data?.is_correct || res1.jsonPayload?.data?.xp_earned <= 0) {
    throw new Error('TEST 1 FAILED! Expected is_correct: true and xp_earned > 0');
  }

  // Test 2: submitLessonExercise (progressController) with incorrect answer "die Mutter"
  const req2 = {
    user: { id: user._id.toString() },
    params: { lessonId },
    body: {
      exercise_id: exerciseId,
      answer: 'die Mutter'
    }
  };
  const res2 = await executeController(submitLessonExercise, req2);

  console.log('\n[TEST 2] progressController submitLessonExercise ("die Mutter"):');
  console.log('Status Code:', res2.statusCode);
  console.log('Response Payload:', JSON.stringify(res2.jsonPayload, null, 2));

  if (res2.statusCode !== 200 || res2.jsonPayload?.data?.is_correct !== false || res2.jsonPayload?.data?.xp_earned !== 0) {
    throw new Error('TEST 2 FAILED! Expected is_correct: false and xp_earned: 0');
  }

  // Test 3: submitExerciseAnswer (publicCurriculumController) with correct answer "der Vater"
  const req3 = {
    user: { id: user._id.toString() },
    params: { lessonId, exerciseId },
    body: {
      answer: 'der Vater'
    }
  };
  const res3 = await executeController(submitExerciseAnswer, req3);

  console.log('\n[TEST 3] publicCurriculumController submitExerciseAnswer ("der Vater"):');
  console.log('Status Code:', res3.statusCode);
  console.log('Response Payload:', JSON.stringify(res3.jsonPayload, null, 2));

  if (res3.statusCode !== 200 || !res3.jsonPayload?.data?.is_correct || res3.jsonPayload?.data?.xp_earned <= 0) {
    throw new Error('TEST 3 FAILED! Expected is_correct: true and xp_earned > 0');
  }

  console.log('\n==================================================');
  console.log('✅ ALL CONTROLLER / API INTEGRATION TESTS PASSED!');
  console.log('==================================================');

  await mongoose.connection.close();
}

runApiIntegrationTest().catch(err => {
  console.error('❌ API Integration Test Failed:', err);
  process.exit(1);
});
