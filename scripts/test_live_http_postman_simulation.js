import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

async function runLiveHttpTest() {
  await connectDB();
  console.log('==================================================');
  console.log('📡 EXECUTING REAL HTTP POSTMAN SIMULATION TEST');
  console.log('==================================================');

  let user = await User.findOne({ email: 'postman_test@example.com' });
  if (!user) {
    user = await User.create({
      name: 'Postman Tester',
      username: 'postman_tester',
      email: 'postman_test@example.com',
      password: 'password123',
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'vocabapp_secret_key_2026';
  const token = jwt.sign({ id: user._id.toString() }, jwtSecret, { expiresIn: '1d' });

  const baseUrl = 'http://localhost:3000';
  const lessonId = '6a82dff7eb76f67f6232a7c1';
  const exerciseId = '6a82e242e79b4bac53b1554a';

  // HTTP CALL 1: POST /api/progress/lessons/:lessonId/submit-exercise with "der Vater"
  console.log('\n--------------------------------------------------');
  console.log('HTTP POST 1: /api/progress/lessons/6a82dff7eb76f67f6232a7c1/submit-exercise');
  console.log('Payload:', JSON.stringify({ exercise_id: exerciseId, answer: 'der Vater' }, null, 2));

  const httpRes1 = await fetch(`${baseUrl}/api/progress/lessons/${lessonId}/submit-exercise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      exercise_id: exerciseId,
      answer: 'der Vater'
    })
  });

  const json1 = await httpRes1.json();
  console.log('HTTP Status:', httpRes1.status);
  console.log('Response Body:', JSON.stringify(json1, null, 2));

  if (httpRes1.status !== 200 || !json1.data?.is_correct || json1.data?.xp_earned !== 2) {
    throw new Error('HTTP POST 1 FAILED! Expected is_correct: true and xp_earned: 2');
  }

  // HTTP CALL 2: POST /api/progress/lessons/:lessonId/submit-exercise with "die Mutter"
  console.log('\n--------------------------------------------------');
  console.log('HTTP POST 2: /api/progress/lessons/6a82dff7eb76f67f6232a7c1/submit-exercise');
  console.log('Payload:', JSON.stringify({ exercise_id: exerciseId, answer: 'die Mutter' }, null, 2));

  const httpRes2 = await fetch(`${baseUrl}/api/progress/lessons/${lessonId}/submit-exercise`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      exercise_id: exerciseId,
      answer: 'die Mutter'
    })
  });

  const json2 = await httpRes2.json();
  console.log('HTTP Status:', httpRes2.status);
  console.log('Response Body:', JSON.stringify(json2, null, 2));

  if (httpRes2.status !== 200 || json2.data?.is_correct !== false || json2.data?.xp_earned !== 0) {
    throw new Error('HTTP POST 2 FAILED! Expected is_correct: false and xp_earned: 0');
  }

  // HTTP CALL 3: Public route POST /api/lessons/:lessonId/exercises/:exerciseId/submit
  console.log('\n--------------------------------------------------');
  console.log('HTTP POST 3: /api/lessons/6a82dff7eb76f67f6232a7c1/exercises/6a82e242e79b4bac53b1554a/submit');
  console.log('Payload:', JSON.stringify({ answer: 'der Vater' }, null, 2));

  const httpRes3 = await fetch(`${baseUrl}/api/lessons/${lessonId}/exercises/${exerciseId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      answer: 'der Vater'
    })
  });

  const json3 = await httpRes3.json();
  console.log('HTTP Status:', httpRes3.status);
  console.log('Response Body:', JSON.stringify(json3, null, 2));

  if (httpRes3.status !== 200 || !json3.data?.is_correct || json3.data?.xp_earned !== 2) {
    throw new Error('HTTP POST 3 FAILED! Expected is_correct: true and xp_earned: 2');
  }

  console.log('\n==================================================');
  console.log('✅ ALL REAL HTTP POSTMAN SIMULATION TESTS PASSED!');
  console.log('==================================================');

  await mongoose.connection.close();
}

runLiveHttpTest().catch(err => {
  console.error('❌ Real HTTP Test Failed:', err);
  process.exit(1);
});
