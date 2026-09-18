import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Exercise from '../src/models/Exercise.js';
import Vocabulary from '../src/models/Vocabulary.js';
import { migrateMultipleChoice } from '../migrate_multiple_choice.js';
import { validateMultipleChoiceCollection } from '../validate_multiple_choice.js';

async function executePhase3A3() {
  await connectDB();
  console.log('==================================================');
  console.log('🚀 PART 1: FIXING 2 REVIEW_REQUIRED RECORDS');
  console.log('==================================================');

  // Record 1 Fix
  const ex1Id = '6a82e242e79b4bac53b1554a';
  const ex1 = await Exercise.findById(ex1Id);
  if (!ex1) {
    throw new Error(`Record 1 (${ex1Id}) not found!`);
  }
  const vocab1 = await Vocabulary.findById(ex1.vocabulary_id);
  console.log(`Verifying Record 1 (${ex1Id}):`);
  console.log(`- Lesson ID: ${ex1.lesson_id}`);
  console.log(`- Vocabulary ID: ${ex1.vocabulary_id}`);
  console.log(`- Vocabulary Word: "${vocab1?.word}", Meaning: "${vocab1?.meaning}"`);

  if (vocab1?.word !== 'der Vater') {
    throw new Error(`Record 1 vocabulary word mismatch! Expected "der Vater", got "${vocab1?.word}"`);
  }

  ex1.content = {
    ...(ex1.content || {}),
    question: 'Từ tiếng Đức nào có nghĩa là “Bố”?',
    options: ['die Mutter', 'der Vater', 'der Bruder', 'die Schwester']
  };
  ex1.answer = {
    correct_option: 'der Vater',
    explanation: 'der Vater = Bố'
  };
  ex1.markModified('content');
  ex1.markModified('answer');
  await ex1.save();
  console.log(`✅ Record 1 (${ex1Id}) updated successfully.`);

  // Record 2 Fix
  const ex2Id = 'fd71d4dec6a6904e1cc44e1a';
  const ex2 = await Exercise.findById(ex2Id);
  if (!ex2) {
    throw new Error(`Record 2 (${ex2Id}) not found!`);
  }
  const vocab2 = await Vocabulary.findById(ex2.vocabulary_id);
  console.log(`\nVerifying Record 2 (${ex2Id}):`);
  console.log(`- Lesson ID: ${ex2.lesson_id}`);
  console.log(`- Vocabulary ID: ${ex2.vocabulary_id}`);
  console.log(`- Vocabulary Word: "${vocab2?.word}", Meaning: "${vocab2?.meaning}"`);

  if (vocab2?.word !== 'der Markt') {
    throw new Error(`Record 2 vocabulary word mismatch! Expected "der Markt", got "${vocab2?.word}"`);
  }

  ex2.content = {
    ...(ex2.content || {}),
    question: 'Từ tiếng Đức nào có nghĩa là “Chợ”?',
    options: ['der Markt', 'der Euro', 'teuer', 'die Packung']
  };
  ex2.answer = {
    correct_option: 'der Markt',
    explanation: 'der Markt = Chợ'
  };
  ex2.markModified('content');
  ex2.markModified('answer');
  await ex2.save();
  console.log(`✅ Record 2 (${ex2Id}) updated successfully.`);

  console.log('\n==================================================');
  console.log('🚀 PART 3: MIGRATING 39 AUTO_FIX RECORDS');
  console.log('==================================================');
  const migrationResult = await migrateMultipleChoice();

  console.log('\n==================================================');
  console.log('🚀 PART 4: RUNNING POST-MIGRATION VALIDATION');
  console.log('==================================================');
  const validationResult = await validateMultipleChoiceCollection();

  console.log('\n==================================================');
  console.log('🚀 PART 5: ADDITIONAL QUALITY & SEMANTIC CHECK');
  console.log('==================================================');
  
  const allExercises = await Exercise.find({ type: 'multiple_choice' }).lean();
  const vocabIds = [...new Set(allExercises.map(e => e.vocabulary_id?.toString()).filter(Boolean))];
  const vocabs = await Vocabulary.find({ _id: { $in: vocabIds } }).lean();
  const vocabMap = new Map(vocabs.map(v => [v._id.toString(), v]));

  const semanticIssues = [];

  for (const ex of allExercises) {
    const exId = ex._id.toString();
    const vocab = ex.vocabulary_id ? vocabMap.get(ex.vocabulary_id.toString()) : null;
    const question = ex.content?.question || '';
    const correctOption = ex.answer?.correct_option || '';
    const explanation = ex.answer?.explanation || '';
    const vocabWord = vocab?.word || '';
    const vocabMeaning = vocab?.meaning || '';

    // Check 1: Does correct_option match vocab.word?
    if (vocabWord && correctOption && vocabWord.trim() !== correctOption.trim()) {
      semanticIssues.push({
        exercise_id: exId,
        type: 'WORD_MISMATCH',
        details: `vocab.word ("${vocabWord}") !== answer.correct_option ("${correctOption}")`
      });
    }

    // Check 2: Extract meaning in quotes from question if present (e.g. "Từ tiếng Đức nào có nghĩa là “X”?" or '"X" nghĩa là gì?')
    const quoteMatch = question.match(/[“"']([^”"']+)[”"']/);
    if (quoteMatch && vocabMeaning) {
      const extractedWordOrMeaning = quoteMatch[1].trim().toLowerCase();
      const normVocabMeaning = vocabMeaning.trim().toLowerCase();
      const normVocabWord = vocabWord.trim().toLowerCase();

      // If the question is asking for meaning of German word or German for Vietnamese meaning
      if (extractedWordOrMeaning !== normVocabMeaning && extractedWordOrMeaning !== normVocabWord) {
        semanticIssues.push({
          exercise_id: exId,
          type: 'QUESTION_MEANING_MISMATCH',
          details: `Question quotes "${quoteMatch[1]}", but vocab.meaning is "${vocabMeaning}" and vocab.word is "${vocabWord}"`
        });
      }
    }
  }

  console.log(`Semantic Quality Check completed. Total potential issues found: ${semanticIssues.length}`);
  if (semanticIssues.length > 0) {
    semanticIssues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [${issue.type}] Exercise ID: ${issue.exercise_id} -> ${issue.details}`);
    });
  } else {
    console.log('✅ No semantic mismatches detected across all 161 multiple_choice exercises!');
  }

  await mongoose.connection.close();
}

executePhase3A3().catch(err => {
  console.error('Fatal failure in Phase 3A.3 execution:', err);
  process.exit(1);
});
