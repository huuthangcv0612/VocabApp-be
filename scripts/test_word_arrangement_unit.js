import { evaluateWordArrangement, evaluateExerciseAnswer } from '../src/utils/gradingHelper.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('==================================================');
console.log('🧪 RUNNING WORD ARRANGEMENT UNIT TESTS');
console.log('==================================================');

const sampleWordArrangement = {
  type: 'word_arrangement',
  content: {
    question: 'Sắp xếp các từ thành câu đúng:',
    words: ['Ich', 'habe', 'einen', 'Bruder']
  },
  answer: {
    correct_answer: ['Ich', 'habe', 'einen', 'Bruder'],
    explanation: 'Ich habe einen Bruder.'
  },
  xp: 2
};

// 1. Exact Correct
assert(evaluateExerciseAnswer(sampleWordArrangement, ['Ich', 'habe', 'einen', 'Bruder']) === true, '1. Exact correct tokens returns true');

// 2. Case Insensitive
assert(evaluateExerciseAnswer(sampleWordArrangement, ['ich', 'habe', 'einen', 'bruder']) === true, '2. Case insensitive tokens returns true');

// 3. Whitespace Normalization
assert(evaluateExerciseAnswer(sampleWordArrangement, ['  Ich ', 'habe', ' einen ', 'Bruder ']) === true, '3. Padded tokens returns true');

// 4. Wrong Order
assert(evaluateExerciseAnswer(sampleWordArrangement, ['Ich', 'habe', 'Bruder', 'einen']) === false, '4. Wrong order returns false');

// 5. Missing Token
assert(evaluateExerciseAnswer(sampleWordArrangement, ['Ich', 'habe', 'Bruder']) === false, '5. Missing token returns false');

// 6. Extra Token
assert(evaluateExerciseAnswer(sampleWordArrangement, ['Ich', 'habe', 'einen', 'Bruder', 'heute']) === false, '6. Extra token returns false');

// 7. Empty Array
assert(evaluateExerciseAnswer(sampleWordArrangement, []) === false, '7. Empty array returns false');

// 8. Invalid Input Types
assert(evaluateExerciseAnswer(sampleWordArrangement, 'Ich habe einen Bruder') === false, '8a. Plain string input returns false');
assert(evaluateExerciseAnswer(sampleWordArrangement, 123) === false, '8b. Number input returns false');
assert(evaluateExerciseAnswer(sampleWordArrangement, null) === false, '8c. null returns false');
assert(evaluateExerciseAnswer(sampleWordArrangement, undefined) === false, '8d. undefined returns false');
assert(evaluateExerciseAnswer(sampleWordArrangement, {}) === false, '8e. Object returns false');

// 9. Duplicate Tokens
const dupExercise = {
  type: 'word_arrangement',
  answer: { correct_answer: ['Ich', 'habe', 'ein', 'ein'] }
};
assert(evaluateExerciseAnswer(dupExercise, ['Ich', 'habe', 'ein', 'ein']) === true, '9a. Exact duplicates match returns true');
assert(evaluateExerciseAnswer(dupExercise, ['Ich', 'habe', 'ein', 'zwei']) === false, '9b. Partial duplicate mismatch returns false');

// 10. Multiple Choice Regression
const mcEx = {
  type: 'multiple_choice',
  answer: { correct_option: 'der Vater' }
};
assert(evaluateExerciseAnswer(mcEx, 'der Vater') === true, '10. Multiple Choice regression "der Vater" returns true');
assert(evaluateExerciseAnswer(mcEx, 'die Mutter') === false, '10. Multiple Choice regression "die Mutter" returns false');

// 11. Fill Blank Regression
const fbEx = {
  type: 'fill_blank',
  answer: { correct_answer: 'Schwester' }
};
assert(evaluateExerciseAnswer(fbEx, 'Schwester') === true, '11. Fill Blank regression "Schwester" returns true');
assert(evaluateExerciseAnswer(fbEx, 'Bruder') === false, '11. Fill Blank regression "Bruder" returns false');

console.log('==================================================');
console.log('✅ ALL WORD ARRANGEMENT UNIT TESTS PASSED!');
console.log('==================================================');
