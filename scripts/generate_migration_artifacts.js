import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import connectDB from '../src/config/db.js';
import Exercise from '../src/models/Exercise.js';
import Vocabulary from '../src/models/Vocabulary.js';

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

async function generateArtifacts() {
  await connectDB();
  const exercises = await Exercise.find({ type: 'multiple_choice' }).lean();
  console.log(`Auditing ${exercises.length} multiple_choice exercises...`);

  const vocabIds = [...new Set(exercises.map(e => e.vocabulary_id?.toString()).filter(Boolean))];
  const vocabs = await Vocabulary.find({ _id: { $in: vocabIds } }).lean();
  const vocabMap = new Map(vocabs.map(v => [v._id.toString(), v]));

  const auditRows = [];
  const migrationJsonRecords = [];

  const summary = {
    TOTAL: exercises.length,
    VALID: 0,
    AUTO_FIX: 0,
    REVIEW_REQUIRED: 0,
    INVALID: 0,
  };

  for (const ex of exercises) {
    const exId = ex._id.toString();
    const lessonId = ex.lesson_id ? ex.lesson_id.toString() : '';
    const vocabId = ex.vocabulary_id ? ex.vocabulary_id.toString() : '';
    const question = ex.content?.question || '';
    const rawOptions = ex.content?.options;
    const currentAnswer = ex.answer || {};

    let stringOptions = null;
    let isLegacyOptionsFormat = false;

    if (Array.isArray(rawOptions)) {
      if (rawOptions.every(opt => typeof opt === 'string')) {
        stringOptions = rawOptions.map(o => o.trim());
      } else if (rawOptions.every(opt => opt && typeof opt === 'object' && (typeof opt.text === 'string' || typeof opt.word === 'string'))) {
        stringOptions = rawOptions.map(opt => (opt.text || opt.word || '').trim());
        isLegacyOptionsFormat = true;
      }
    }

    const hasLegacyAnswerFields = ('correct_option_index' in currentAnswer) || ('value' in currentAnswer) || ('expected_answer' in currentAnswer);

    const vocab = vocabId ? vocabMap.get(vocabId) : null;
    const vocabWord = vocab?.word ? vocab.word.trim() : '';
    const vocabMeaning = vocab?.meaning ? vocab.meaning.trim() : '';

    let status = '';
    let confidence = '';
    let reason = '';
    let expectedCorrectOption = vocabWord || '';

    if (!vocabId || !vocab) {
      status = 'INVALID';
      confidence = 'HIGH';
      reason = !vocabId ? 'Missing vocabulary_id' : `Referenced vocabulary_id ${vocabId} not found in database`;
    } else if (!stringOptions || stringOptions.length < 2) {
      status = 'INVALID';
      confidence = 'HIGH';
      reason = 'Options missing, empty, or less than 2 items';
    } else if (!vocabWord) {
      status = 'REVIEW_REQUIRED';
      confidence = 'MEDIUM';
      reason = 'Vocabulary document missing word property';
    } else {
      const optionIndex = stringOptions.findIndex(opt => opt === vocabWord);
      const containsWord = optionIndex !== -1;

      if (!containsWord) {
        status = 'REVIEW_REQUIRED';
        confidence = 'HIGH';
        reason = `Vocabulary word "${vocabWord}" not found in options: ${JSON.stringify(stringOptions)}`;
      } else if (isLegacyOptionsFormat) {
        status = 'AUTO_FIX';
        confidence = 'HIGH';
        reason = `Options were legacy objects but cleanly extracted. Word "${vocabWord}" found in options.`;
      } else {
        const isAlreadyValid = !hasLegacyAnswerFields && 
          currentAnswer.correct_option === vocabWord && 
          typeof currentAnswer.explanation === 'string' && 
          currentAnswer.explanation.length > 0 &&
          !isLegacyOptionsFormat;

        if (isAlreadyValid) {
          status = 'VALID';
          confidence = 'HIGH';
          reason = 'Already adheres to canonical schema';
        } else {
          status = 'AUTO_FIX';
          confidence = 'HIGH';
          reason = `Word "${vocabWord}" found in options. Can standardize answer schema.`;
        }
      }
    }

    summary[status]++;

    auditRows.push({
      exercise_id: exId,
      lesson_id: lessonId,
      vocabulary_id: vocabId,
      question: question,
      current_options: JSON.stringify(rawOptions),
      current_answer: JSON.stringify(currentAnswer),
      vocabulary_word: vocabWord,
      vocabulary_meaning: vocabMeaning,
      expected_correct_option: expectedCorrectOption,
      status: status,
      confidence: confidence,
      reason: reason
    });

    if (status === 'AUTO_FIX') {
      let explanationStr = currentAnswer.explanation;
      if (typeof explanationStr !== 'string' || !explanationStr.trim()) {
        explanationStr = vocabMeaning ? `${vocabWord} = ${vocabMeaning}` : vocabWord;
      } else {
        explanationStr = explanationStr.trim();
      }

      migrationJsonRecords.push({
        _id: exId,
        before: {
          options: rawOptions,
          answer: currentAnswer
        },
        after: {
          options: stringOptions,
          answer: {
            correct_option: vocabWord,
            explanation: explanationStr
          }
        }
      });
    }
  }

  // Write CSV
  const csvHeaders = [
    'exercise_id',
    'lesson_id',
    'vocabulary_id',
    'question',
    'current_options',
    'current_answer',
    'vocabulary_word',
    'vocabulary_meaning',
    'expected_correct_option',
    'status',
    'confidence',
    'reason'
  ];

  const csvLines = [csvHeaders.join(',')];
  for (const row of auditRows) {
    const line = csvHeaders.map(h => escapeCsvField(row[h])).join(',');
    csvLines.push(line);
  }

  const csvContent = csvLines.join('\n');
  const csvPath = path.resolve('multiple_choice_migration_audit.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`Saved audit CSV to ${csvPath} (${auditRows.length} rows)`);

  // Write JSON
  const jsonPath = path.resolve('multiple_choice_migration.json');
  fs.writeFileSync(jsonPath, JSON.stringify(migrationJsonRecords, null, 2), 'utf-8');
  console.log(`Saved migration JSON to ${jsonPath} (${migrationJsonRecords.length} records)`);

  console.log('\n==================================================');
  console.log('AUDIT SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Total Multiple Choice: ${summary.TOTAL}`);
  console.log(`VALID:                 ${summary.VALID}`);
  console.log(`AUTO_FIX:              ${summary.AUTO_FIX}`);
  console.log(`REVIEW_REQUIRED:       ${summary.REVIEW_REQUIRED}`);
  console.log(`INVALID:               ${summary.INVALID}`);
  console.log('==================================================');

  await mongoose.connection.close();
}

generateArtifacts().catch(err => {
  console.error(err);
  process.exit(1);
});
