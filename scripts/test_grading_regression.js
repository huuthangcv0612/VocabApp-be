import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Exercise from '../src/models/Exercise.js';
import Vocabulary from '../src/models/Vocabulary.js';
import { evaluateExerciseAnswer } from '../src/utils/gradingHelper.js';

async function runRegressionTest() {
  await connectDB();
  console.log('==================================================');
  console.log('🧪 RUNNING GRADING REGRESSION TEST');
  console.log('==================================================');

  // Target Exercise: 6a82e242e79b4bac53b1554a ("der Vater")
  const targetId = '6a82e242e79b4bac53b1554a';
  const ex = await Exercise.findById(targetId);
  if (!ex) {
    throw new Error(`Target exercise ${targetId} not found!`);
  }

  console.log(`Target Exercise ID: ${targetId}`);
  console.log(`Correct option in DB: "${ex.answer?.correct_option}"`);

  // CASE 1: answer = "der Vater"
  const res1 = evaluateExerciseAnswer(ex, 'der Vater');
  console.log(`\n[CASE 1] answer = "der Vater" -> is_correct: ${res1} (Expected: true)`);
  if (!res1) throw new Error('CASE 1 FAILED!');

  // CASE 2: answer = "die Mutter"
  const res2 = evaluateExerciseAnswer(ex, 'die Mutter');
  console.log(`[CASE 2] answer = "die Mutter" -> is_correct: ${res2} (Expected: false)`);
  if (res2) throw new Error('CASE 2 FAILED!');

  // CASE 3: answer = " der Vater "
  const res3 = evaluateExerciseAnswer(ex, ' der Vater ');
  console.log(`[CASE 3] answer = " der Vater " -> is_correct: ${res3} (Expected: true)`);
  if (!res3) throw new Error('CASE 3 FAILED!');

  // CASE 4: Test 3 other random multiple_choice exercises from DB
  console.log('\n[CASE 4] Testing 3 other distinct Multiple Choice exercises:');
  const otherExercises = await Exercise.find({
    type: 'multiple_choice',
    _id: { $ne: targetId }
  }).limit(5);

  for (let i = 0; i < 3; i++) {
    const oEx = otherExercises[i];
    const correctOpt = oEx.answer?.correct_option;
    const options = oEx.content?.options || [];
    const wrongOpt = options.find(opt => opt !== correctOpt) || 'WrongOptionTest';

    const testCorrect = evaluateExerciseAnswer(oEx, correctOpt);
    const testWrong = evaluateExerciseAnswer(oEx, wrongOpt);
    const testPadded = evaluateExerciseAnswer(oEx, ` ${correctOpt} `);

    console.log(`\n  Sub-test 4.${i+1} [ID: ${oEx._id}]`);
    console.log(`   Question: "${oEx.content?.question}"`);
    console.log(`   Correct option: "${correctOpt}"`);
    console.log(`   Correct submission ("${correctOpt}") -> is_correct: ${testCorrect} (Expected: true)`);
    console.log(`   Wrong submission ("${wrongOpt}")   -> is_correct: ${testWrong} (Expected: false)`);
    console.log(`   Padded submission (" ${correctOpt} ") -> is_correct: ${testPadded} (Expected: true)`);

    if (!testCorrect || testWrong || !testPadded) {
      throw new Error(`CASE 4 sub-test 4.${i+1} FAILED!`);
    }
  }

  console.log('\n==================================================');
  console.log('✅ ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');

  await mongoose.connection.close();
}

runRegressionTest().catch(err => {
  console.error('❌ Regression Test Failed:', err);
  process.exit(1);
});
