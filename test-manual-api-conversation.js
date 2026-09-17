import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import app from './src/app.js';
import User from './src/models/User.js';
import Lesson from './src/models/Lesson.js';
import LessonVocabulary from './src/models/LessonVocabulary.js';
import AIConversationSession from './src/models/AIConversationSession.js';

async function runManualAPITest() {
  console.log('🚀 Starting Manual Live API Test for AI Conversation...');

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vocabapp';
    console.log('📡 Connecting to database...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB');

    // 1. Find or create a test user
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: 'Manual API Tester',
        email: `tester_${Date.now()}@example.com`,
        password: 'password123',
      });
    }

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production',
      { expiresIn: '1h' }
    );

    // 2. Find a real Lesson that has LessonVocabulary
    const sampleLV = await LessonVocabulary.findOne({}).populate('lesson_id');
    if (!sampleLV || !sampleLV.lesson_id) {
      console.error('❌ No Lesson with LessonVocabulary records found in database!');
      process.exit(1);
    }

    const realLessonId = sampleLV.lesson_id._id.toString();
    const realLessonTitle = sampleLV.lesson_id.title;
    console.log(`📌 Using Real Lesson: "${realLessonTitle}" (${realLessonId})`);

    // 3. Start express server on dynamic port
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    console.log(`🌐 Server running at ${baseUrl}`);

    // --- STEP 1: START CONVERSATION ---
    console.log('\n--- 1. Testing POST /api/ai/conversations/start ---');
    const startRes = await fetch(`${baseUrl}/api/ai/conversations/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lesson_id: realLessonId }),
    });

    console.log('HTTP Status:', startRes.status);
    const startData = await startRes.json();
    console.log('Response:', JSON.stringify(startData, null, 2));

    if (!startRes.ok || !startData.success) {
      throw new Error(`Start conversation failed: ${startData.message || startRes.statusText}`);
    }

    const sessionId = startData.data.session_id;
    console.log('✅ Session Created:', sessionId);
    console.log('AI Opening Message:', startData.data.ai_message.content);

    // --- STEP 2: SEND MESSAGE ---
    console.log('\n--- 2. Testing POST /api/ai/conversations/:sessionId/message ---');
    const messageRes = await fetch(`${baseUrl}/api/ai/conversations/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'Ich habe einen Bruder.' }),
    });

    console.log('HTTP Status:', messageRes.status);
    const messageData = await messageRes.json();
    console.log('Response:', JSON.stringify(messageData, null, 2));

    if (!messageRes.ok || !messageData.success) {
      throw new Error(`Send message failed: ${messageData.message || messageRes.statusText}`);
    }

    console.log('✅ Message Sent successfully');
    console.log('AI Response:', messageData.data.ai_message.content);
    console.log('AI Feedback:', messageData.data.feedback);
    console.log('Used Vocabulary:', messageData.data.used_vocabulary);

    // --- STEP 3: COMPLETE CONVERSATION ---
    console.log('\n--- 3. Testing POST /api/ai/conversations/:sessionId/complete ---');
    const completeRes = await fetch(`${baseUrl}/api/ai/conversations/${sessionId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    console.log('HTTP Status:', completeRes.status);
    const completeData = await completeRes.json();
    console.log('Response:', JSON.stringify(completeData, null, 2));

    if (!completeRes.ok || !completeData.success) {
      throw new Error(`Complete session failed: ${completeData.message || completeRes.statusText}`);
    }

    console.log('✅ Session Completed successfully');
    console.log('Summary:', completeData.data.summary);

    // --- STEP 4: GET SESSION DETAILS ---
    console.log('\n--- 4. Testing GET /api/ai/conversations/:sessionId ---');
    const getRes = await fetch(`${baseUrl}/api/ai/conversations/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('HTTP Status:', getRes.status);
    const getData = await getRes.json();
    console.log('Response:', JSON.stringify(getData, null, 2));

    if (!getRes.ok || !getData.success) {
      throw new Error(`Get session failed: ${getData.message || getRes.statusText}`);
    }

    console.log('✅ Get Session details verified successfully');

    // Clean up temporary session record
    await AIConversationSession.findByIdAndDelete(sessionId);
    console.log('🧹 Cleaned up test session record from DB');

    server.close();
    await mongoose.disconnect();
    console.log('\n🎉 ALL MANUAL API TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Manual API Test Error:', err);
    process.exit(1);
  }
}

runManualAPITest();
