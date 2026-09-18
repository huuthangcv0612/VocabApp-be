import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Exercise from '../src/models/Exercise.js';

async function runHttpTest() {
  await connectDB();
  console.log('==================================================');
  console.log('📡 EXECUTING WORD ARRANGEMENT REAL HTTP TEST');
  console.log('==================================================');

  const lessonId = '6a82dff7eb76f67f6232a7c1';

  // 1. Find or create 1 minimal word_arrangement exercise in DB
  let wordArrEx = await Exercise.findOne({ type: 'word_arrangement', lesson_id: lessonId });
  if (!wordArrEx) {
    wordArrEx = await Exercise.create({
      lesson_id: lessonId,
      type: 'word_arrangement',
      order: 100,
      content: {
        question: 'Sắp xếp các từ thành câu đúng:',
        words: ['Ich', 'habe', 'einen', 'Bruder']
      },
      answer: {
        correct_answer: ['Ich', 'habe', 'einen', 'Bruder'],
        explanation: 'Ich habe einen Bruder.'
      },
      vocabulary_id: '6a82e139e79b4bac53b15539',
      grammar_id: null,
      xp: 2
    });
    console.log(`Created 1 minimal test word_arrangement exercise in DB: ${wordArrEx._id}`);
  } else {
    console.log(`Found existing word_arrangement exercise in DB: ${wordArrEx._id}`);
  }

  // 2. User & Auth Token
  let user = await User.findOne({ email: 'word_arr_tester@example.com' });
  if (!user) {
    user = await User.create({
      name: 'WordArrangement Tester',
      username: 'word_arr_tester',
      email: 'word_arr_tester@example.com',
      password: 'password123',
    });
  }

  const jwtSecret = process.env.JWT_SECRET || 'vocabapp_secret_key_2026';
  const token = jwt.sign({ id: user._id.toString() }, jwtSecret, { expiresIn: '1d' });
  const baseUrl = 'http://localhost:3000';
  const wordArrId = wordArrEx._id.toString();

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

  // CASE 1: Correct tokens ["Ich", "habe", "einen", "Bruder"]
  console.log('\n--- CASE 1: Correct Tokens ["Ich", "habe", "einen", "Bruder"] ---');
  const res1 = await sendSubmit(wordArrId, ['Ich', 'habe', 'einen', 'Bruder']);
  console.log('Status:', res1.status, 'Payload:', JSON.stringify(res1.json, null, 2));
  if (res1.status !== 200 || !res1.json.data?.is_correct || res1.json.data?.xp_earned !== 2) {
    throw new Error('CASE 1 FAILED!');
  }

  // CASE 2: Case variation ["ich", "habe", "einen", "bruder"]
  console.log('\n--- CASE 2: Case Variation ["ich", "habe", "einen", "bruder"] ---');
  const res2 = await sendSubmit(wordArrId, ['ich', 'habe', 'einen', 'bruder']);
  console.log('Status:', res2.status, 'is_correct:', res2.json.data?.is_correct);
  if (res2.status !== 200 || !res2.json.data?.is_correct) {
    throw new Error('CASE 2 FAILED!');
  }

  // CASE 3: Whitespace ["  Ich ", "habe", " einen ", "Bruder "]
  console.log('\n--- CASE 3: Whitespace Padded Tokens ["  Ich ", "habe", " einen ", "Bruder "] ---');
  const res3 = await sendSubmit(wordArrId, ['  Ich ', 'habe', ' einen ', 'Bruder ']);
  console.log('Status:', res3.status, 'is_correct:', res3.json.data?.is_correct);
  if (res3.status !== 200 || !res3.json.data?.is_correct) {
    throw new Error('CASE 3 FAILED!');
  }

  // CASE 4: Wrong order ["Ich", "habe", "Bruder", "einen"]
  console.log('\n--- CASE 4: Wrong Order ["Ich", "habe", "Bruder", "einen"] ---');
  const res4 = await sendSubmit(wordArrId, ['Ich', 'habe', 'Bruder', 'einen']);
  console.log('Status:', res4.status, 'is_correct:', res4.json.data?.is_correct, 'xp_earned:', res4.json.data?.xp_earned);
  if (res4.status !== 200 || res4.json.data?.is_correct !== false || res4.json.data?.xp_earned !== 0) {
    throw new Error('CASE 4 FAILED!');
  }

  // CASE 5: Missing token ["Ich", "habe", "Bruder"]
  console.log('\n--- CASE 5: Missing Token ["Ich", "habe", "Bruder"] ---');
  const res5 = await sendSubmit(wordArrId, ['Ich', 'habe', 'Bruder']);
  console.log('Status:', res5.status, 'is_correct:', res5.json.data?.is_correct);
  if (res5.status !== 200 || res5.json.data?.is_correct !== false) {
    throw new Error('CASE 5 FAILED!');
  }

  // CASE 6: Invalid type string "Ich habe einen Bruder"
  console.log('\n--- CASE 6: Invalid Type String "Ich habe einen Bruder" ---');
  const res6 = await sendSubmit(wordArrId, 'Ich habe einen Bruder');
  console.log('Status:', res6.status, 'is_correct:', res6.json.data?.is_correct);
  if (res6.status !== 200 || res6.json.data?.is_correct !== false) {
    throw new Error('CASE 6 FAILED!');
  }

  // REGRESSION TEST 1: Multiple Choice ("der Vater")
  const mcId = '6a82e242e79b4bac53b1554a';
  console.log('\n--- MC REGRESSION: "der Vater" ---');
  const resMC1 = await sendSubmit(mcId, 'der Vater');
  console.log('Status:', resMC1.status, 'is_correct:', resMC1.json.data?.is_correct, 'xp_earned:', resMC1.json.data?.xp_earned);
  if (resMC1.status !== 200 || !resMC1.json.data?.is_correct || resMC1.json.data?.xp_earned !== 2) {
    throw new Error('MC REGRESSION 1 FAILED!');
  }

  console.log('\n--- MC REGRESSION WRONG: "die Mutter" ---');
  const resMC2 = await sendSubmit(mcId, 'die Mutter');
  console.log('Status:', resMC2.status, 'is_correct:', resMC2.json.data?.is_correct, 'xp_earned:', resMC2.json.data?.xp_earned);
  if (resMC2.status !== 200 || resMC2.json.data?.is_correct !== false || resMC2.json.data?.xp_earned !== 0) {
    throw new Error('MC REGRESSION 2 FAILED!');
  }

  // REGRESSION TEST 2: Fill Blank ("Schwester")
  const fillBlankEx = await Exercise.findOne({ type: 'fill_blank', lesson_id: lessonId });
  if (fillBlankEx) {
    const fbId = fillBlankEx._id.toString();
    console.log('\n--- FILL BLANK REGRESSION: "Schwester" ---');
    const resFB1 = await sendSubmit(fbId, 'Schwester');
    console.log('Status:', resFB1.status, 'is_correct:', resFB1.json.data?.is_correct, 'xp_earned:', resFB1.json.data?.xp_earned);
    if (resFB1.status !== 200 || !resFB1.json.data?.is_correct || resFB1.json.data?.xp_earned !== 2) {
      throw new Error('FILL BLANK REGRESSION 1 FAILED!');
    }

    console.log('\n--- FILL BLANK REGRESSION WRONG: "Bruder" ---');
    const resFB2 = await sendSubmit(fbId, 'Bruder');
    console.log('Status:', resFB2.status, 'is_correct:', resFB2.json.data?.is_correct, 'xp_earned:', resFB2.json.data?.xp_earned);
    if (resFB2.status !== 200 || resFB2.json.data?.is_correct !== false || resFB2.json.data?.xp_earned !== 0) {
      throw new Error('FILL BLANK REGRESSION 2 FAILED!');
    }
  }

  console.log('\n==================================================');
  console.log('✅ ALL REAL HTTP WORD ARRANGEMENT & REGRESSION TESTS PASSED!');
  console.log('==================================================');

  await mongoose.connection.close();
}

runHttpTest().catch(err => {
  console.error('❌ HTTP Test Failed:', err);
  process.exit(1);
});
