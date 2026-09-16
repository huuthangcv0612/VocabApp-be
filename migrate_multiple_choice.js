import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import connectDB from './src/config/db.js';
import Exercise from './src/models/Exercise.js';

/**
 * Migration Script for Multiple Choice Exercises (PHASE C)
 * Note: Do not run automatically. Run manually when ready.
 */
export const migrateMultipleChoice = async () => {
  console.log('==================================================');
  console.log('🚀 Starting Multiple Choice Canonical Schema Migration');
  console.log('==================================================');

  const migrationFilePath = path.resolve('multiple_choice_migration.json');
  if (!fs.existsSync(migrationFilePath)) {
    throw new Error(`Migration file not found at ${migrationFilePath}`);
  }

  const migrationRecords = JSON.parse(fs.readFileSync(migrationFilePath, 'utf-8'));
  console.log(`Loaded ${migrationRecords.length} record(s) from ${migrationFilePath}`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of migrationRecords) {
    const { _id, before, after } = record;
    try {
      const exercise = await Exercise.findById(_id);

      if (!exercise) {
        console.warn(`❌ [FAILED] Exercise ${_id}: Record not found in database.`);
        failed++;
        continue;
      }

      // Check if current DB state matches "before" state
      const currentOptionsStr = JSON.stringify(exercise.content?.options || null);
      const expectedBeforeOptionsStr = JSON.stringify(before.options || null);

      const currentAnswerStr = JSON.stringify(exercise.answer || null);
      const expectedBeforeAnswerStr = JSON.stringify(before.answer || null);

      const isOptionsMatching = currentOptionsStr === expectedBeforeOptionsStr;
      const isAnswerMatching = currentAnswerStr === expectedBeforeAnswerStr;

      if (!isOptionsMatching || !isAnswerMatching) {
        console.warn(`⚠️ [SKIPPED] Exercise ${_id}: Current DB state differs from expected "before" state.`);
        if (!isOptionsMatching) {
          console.warn(`   Options mismatch -> Current: ${currentOptionsStr} vs Expected: ${expectedBeforeOptionsStr}`);
        }
        if (!isAnswerMatching) {
          console.warn(`   Answer mismatch -> Current: ${currentAnswerStr} vs Expected: ${expectedBeforeAnswerStr}`);
        }
        skipped++;
        continue;
      }

      // Perform atomic update per record (no updateMany)
      exercise.content = {
        ...(exercise.content || {}),
        options: after.options,
      };
      exercise.answer = after.answer;

      exercise.markModified('content');
      exercise.markModified('answer');

      await exercise.save();
      updated++;
      console.log(`✅ [UPDATED] Exercise ${_id} | correct_option: "${after.answer.correct_option}" | explanation: "${after.answer.explanation}"`);

    } catch (err) {
      console.error(`❌ [FAILED] Exercise ${_id}: ${err.message}`);
      failed++;
    }
  }

  console.log('==================================================');
  console.log('📊 Migration Execution Summary:');
  console.log(`- Total records in file: ${migrationRecords.length}`);
  console.log(`- Updated: ${updated}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Failed:  ${failed}`);
  console.log('==================================================');

  return { updated, skipped, failed };
};

// Standalone execution wrapper (Not executed automatically during Phase 3A.2 setup)
if (process.argv[1] && process.argv[1].endsWith('migrate_multiple_choice.js')) {
  (async () => {
    try {
      await connectDB();
      await migrateMultipleChoice();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('Fatal migration failure:', err);
      process.exit(1);
    }
  })();
}
