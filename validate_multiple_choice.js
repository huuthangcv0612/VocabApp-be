import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from './src/config/db.js';
import Exercise from './src/models/Exercise.js';
import Vocabulary from './src/models/Vocabulary.js';

export const validateMultipleChoiceCollection = async () => {
  console.log('==================================================');
  console.log('🔍 Running Post-Migration Validator for multiple_choice');
  console.log('==================================================');

  await connectDB();
  const exercises = await Exercise.find({ type: 'multiple_choice' }).lean();
  console.log(`Total multiple_choice exercises to validate: ${exercises.length}`);

  const vocabIds = [...new Set(exercises.map(e => e.vocabulary_id?.toString()).filter(Boolean))];
  const vocabs = await Vocabulary.find({ _id: { $in: vocabIds } }).lean();
  const vocabMap = new Map(vocabs.map(v => [v._id.toString(), v]));

  const validationResults = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const ex of exercises) {
    const exId = ex._id.toString();
    const failures = [];

    // Rule 1: type = multiple_choice
    if (ex.type !== 'multiple_choice') {
      failures.push('Rule 1: type is not "multiple_choice"');
    }

    // Rule 2: content.question is string
    if (typeof ex.content?.question !== 'string' || !ex.content.question.trim()) {
      failures.push('Rule 2: content.question is missing or not a string');
    }

    // Rule 3: content.options is string[]
    const options = ex.content?.options;
    const isStringArray = Array.isArray(options) && options.every(o => typeof o === 'string');
    if (!isStringArray) {
      failures.push('Rule 3: content.options is not an array of strings');
    }

    // Rule 4: options.length >= 2
    if (!Array.isArray(options) || options.length < 2) {
      failures.push('Rule 4: content.options length is less than 2');
    }

    // Rule 5: answer.correct_option exists (string)
    const correctOption = ex.answer?.correct_option;
    if (typeof correctOption !== 'string' || !correctOption.trim()) {
      failures.push('Rule 5: answer.correct_option missing or not a string');
    }

    // Rule 6: correct_option must exist in options
    if (isStringArray && typeof correctOption === 'string' && !options.includes(correctOption)) {
      failures.push(`Rule 6: correct_option "${correctOption}" not found in options`);
    }

    // Rule 7: vocabulary_id exists
    const vocabId = ex.vocabulary_id?.toString();
    const vocab = vocabId ? vocabMap.get(vocabId) : null;
    if (!vocabId || !vocab) {
      failures.push(`Rule 7: vocabulary_id missing or reference not found in DB`);
    }

    // Rule 8: vocabulary.word must match correct_option
    if (vocab && typeof correctOption === 'string') {
      const vocabWord = (vocab.word || '').trim();
      if (correctOption !== vocabWord) {
        failures.push(`Rule 8: vocabulary.word "${vocabWord}" does not match correct_option "${correctOption}"`);
      }
    }

    // Rule 9: no correct_option_index
    if ('correct_option_index' in (ex.answer || {})) {
      failures.push('Rule 9: legacy field "correct_option_index" still present in answer');
    }

    // Rule 10: no answer.value
    if ('value' in (ex.answer || {})) {
      failures.push('Rule 10: legacy field "value" still present in answer');
    }

    const isValid = failures.length === 0;
    if (isValid) {
      passedCount++;
    } else {
      failedCount++;
    }

    validationResults.push({
      exercise_id: exId,
      isValid,
      failures
    });
  }

  console.log('==================================================');
  console.log('📊 Validation Summary Report');
  console.log('==================================================');
  console.log(`Total Evaluated: ${exercises.length}`);
  console.log(`Passed (Canonical): ${passedCount}`);
  console.log(`Failed (Non-Canonical): ${failedCount}`);
  console.log('==================================================');

  if (failedCount > 0) {
    console.log('\nFailed Exercises Detail:');
    validationResults.filter(r => !r.isValid).forEach(r => {
      console.log(`- Exercise ID: ${r.exercise_id}`);
      r.failures.forEach(f => console.log(`  * ${f}`));
    });
  }

  return { total: exercises.length, passedCount, failedCount, validationResults };
};

if (process.argv[1] && process.argv[1].endsWith('validate_multiple_choice.js')) {
  (async () => {
    try {
      const res = await validateMultipleChoiceCollection();
      await mongoose.connection.close();
      process.exit(res.failedCount === 0 ? 0 : 1);
    } catch (err) {
      console.error('Validation failure:', err);
      process.exit(1);
    }
  })();
}
