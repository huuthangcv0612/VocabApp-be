// Test script for AI API using built-in fetch
async function testAI() {
  try {
    console.log('🚀 Testing AI API...');

    // Test basic endpoint
    console.log('1. 📡 Testing basic endpoint...');
    const basicResponse = await fetch('http://localhost:3001/');
    const basicData = await basicResponse.json();
    console.log('✅ Basic endpoint working:', basicData);

    // Test AI evaluation
    console.log('2. 🤖 Testing AI evaluation...');
    const aiResponse = await fetch('http://localhost:3001/api/ai/evaluate-sentence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sentence: 'I am happy today',
        vocabulary: {
          word: 'happy',
          meaning: 'vui vẻ',
          type: 'adjective'
        }
      })
    });

    console.log('Response status:', aiResponse.status);

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      console.log('✅ AI evaluation successful!');
      console.log('📊 Score:', aiData.data?.evaluation?.score || 'N/A');
      console.log('💬 Feedback:', aiData.data?.evaluation?.feedback || 'N/A');
      console.log('📝 Full response:', JSON.stringify(aiData, null, 2));
    } else {
      console.log('❌ AI evaluation failed with status:', aiResponse.status);
      const errorText = await aiResponse.text();
      console.log('📄 Error details:', errorText);
    }

    // Test German sentence check
    console.log('3. 🇩🇪 Testing German sentence check...');
    const germanResponse = await fetch('http://localhost:3001/api/ai/check-german-sentence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sentence: 'Ich habe ein groß Haus'
      })
    });

    console.log('German check response status:', germanResponse.status);

    if (germanResponse.ok) {
      const germanData = await germanResponse.json();
      console.log('✅ German check successful!');
      console.log('📊 Correct:', germanData.data?.correct);
      console.log('🔧 Corrected:', germanData.data?.corrected);
      console.log('❌ Errors:', germanData.data?.errors);
      console.log('📝 Full response:', JSON.stringify(germanData, null, 2));
    } else {
      console.log('❌ German check failed with status:', germanResponse.status);
      const errorText = await germanResponse.text();
      console.log('📄 Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAI();