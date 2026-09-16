import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Exercise from '../src/models/Exercise.js';

async function runHttpTest() {
  await connectDB();
  console.log('==================================================');
  console.log('📡 EXECUTING FILL BLANK REAL HTTP INTEGRATION TEST');
  console.log('==================================================');

  const lessonId = '6a82dff7eb76f67f6232a7c1';

  // 1. Find or create 1 minimal fill_blank exercise for testing
  let fillBlankEx = await Exercise.findOne({ type: 'fill_blank', lesson_id: lessonId });
  if (!fillBlankEx) {
    fillBlankEx = await Exercise.create({
      lesson_id: lessonId,
      type: 'fill_blank',
      order: 99,
      content: {
        question: 'Ich habe eine ___ .',
        hint: 'Em gái',
        sentence_translation: 'Tôi có một em gái.'
      },
      answer: {
        correct_answer: 'Schwester',
        explanation: 'die Schwester = chị/em gái'
      },
      vocabulary_id: '6a82e139e79b4bac53b15539',
      grammar_id: null,
      xp: 2
    });
    console.log(`Created 1 minimal test fill_blank exercise in DB: ${fillBlankEx._id}`);
  } else {
    console.log(`Found existing fill_blank exercise in DB: ${fillBlankEx._id}`);
  }

  // 2. User & Auth Token
  let user = await User.findOne({ email: 'fill_blank_tester@example.com' });
  if (!user) {
    user = await User.create({
      name: 'FillBlank Tester',
      username: 'fillblank_tester',
      email: 'fill_blank_tester@example.com',
      password: 'password123',
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'vocabapp_secret_key_2026';
  const token = jwt.sign({ id: user._id.toString() }, jwtSecret, { expiresIn: '1d' });
  const baseUrl = 'http://localhost:3000';
  const fillBlankId = fillBlankEx._id.toString();

  const sendSubmit = async (exId, ans) => {
    const res = await fetch(`${baseUrl}/api/progress/lessons/${lessonId}/submit-exercise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ exercise_id: exId, answer: ans })
    });
    const json = await res.json();
    return { status: res.status, json };
  };

  // CASE 1 — CORRECT: "Schwester"
  console.log('\n--- CASE 1: Correct Answer "Schwester" ---');
  const res1 = await sendSubmit(fillBlankId, 'Schwester');
  console.log('Status:', res1.status, 'Payload:', JSON.stringify(res1.json, null, 2));
  if (res1.status !== 200 || !res1.json.data?.is_correct || res1.json.data?.xp_earned !== 2) {
    throw new Error('CASE 1 FAILED!');
  }

  // CASE 2 — CASE INSENSITIVE: "schwester"
  console.log('\n--- CASE 2: Case-insensitive Answer "schwester" ---');
  const res2 = await sendSubmit(fillBlankId, 'schwester');
  console.log('Status:', res2.status, 'is_correct:', res2.json.data?.is_correct);
  if (res2.status !== 200 || !res2.json.data?.is_correct) {
    throw new Error('CASE 2 FAILED!');
  }

  // CASE 3 — WHITESPACE: "  Schwester  "
  console.log('\n--- CASE 3: Whitespace Padded Answer "  Schwester  " ---');
  const res3 = await sendSubmit(fillBlankId, '  Schwester  ');
  console.log('Status:', res3.status, 'is_correct:', res3.json.data?.is_correct);
  if (res3.status !== 200 || !res3.json.data?.is_correct) {
    throw new Error('CASE 3 FAILED!');
  }

  // CASE 4 — WRONG: "Bruder"
  console.log('\n--- CASE 4: Wrong Answer "Bruder" ---');
  const res4 = await sendSubmit(fillBlankId, 'Bruder');
  console.log('Status:', res4.status, 'is_correct:', res4.json.data?.is_correct, 'xp_earned:', res4.json.data?.xp_earned);
  if (res4.status !== 200 || res4.json.data?.is_correct !== false || res4.json.data?.xp_earned !== 0) {
    throw new Error('CASE 4 FAILED!');
  }

  // CASE 5 — EMPTY: ""
  console.log('\n--- CASE 5: Empty Answer "" ---');
  const res5 = await sendSubmit(fillBlankId, '');
  console.log('Status:', res5.status, 'is_correct:', res5.json.data?.is_correct);
  if (res5.status !== 200 || res5.json.data?.is_correct !== false) {
    throw new Error('CASE 5 FAILED!');
  }

  // CASE 6 — INVALID TYPE: 123
  console.log('\n--- CASE 6: Invalid Type Answer 123 ---');
  const res6 = await sendSubmit(fillBlankId, 123);
  console.log('Status:', res6.status, 'is_correct:', res6.json.data?.is_correct);
  if (res6.status !== 200 || res6.json.data?.is_correct !== false) {
    throw new Error('CASE 6 FAILED!');
  }

  // MULTIPLE CHOICE REGRESSION TEST
  const mcId = '6a82e242e79b4bac53b1554a';
  console.log('\n--- MULTIPLE CHOICE REGRESSION: "der Vater" ---');
  const resMC1 = await sendSubmit(mcId, 'der Vater');
  console.log('Status:', resMC1.status, 'is_correct:', resMC1.json.data?.is_correct, 'xp_earned:', resMC1.json.data?.xp_earned);
  if (resMC1.status !== 200 || !resMC1.json.data?.is_correct || resMC1.json.data?.xp_earned !== 2) {
    throw new Error('MC REGRESSION 1 FAILED!');
  }

  console.log('\n--- MULTIPLE CHOICE REGRESSION WRONG: "die Mutter" ---');
  const resMC2 = await sendSubmit(mcId, 'die Mutter');
  console.log('Status:', resMC2.status, 'is_correct:', resMC2.json.data?.is_correct, 'xp_earned:', resMC2.json.data?.xp_earned);
  if (resMC2.status !== 200 || resMC2.json.data?.is_correct !== false || resMC2.json.data?.xp_earned !== 0) {
    throw new Error('MC REGRESSION 2 FAILED!');
  }

  console.log('\n==================================================');
  console.log('✅ ALL REAL HTTP FILL BLANK & REGRESSION TESTS PASSED!');
  console.log('==================================================');

  await mongoose.connection.close();
}

runHttpTest().catch(err => {
  console.error('❌ HTTP Test Failed:', err);
  process.exit(1);
});
