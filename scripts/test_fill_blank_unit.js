import { evaluateFillBlank, evaluateExerciseAnswer, normalizeFillBlankText } from '../src/utils/gradingHelper.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('==================================================');
console.log('🧪 RUNNING FILL BLANK UNIT TESTS');
console.log('==================================================');

const sampleFillBlankExercise = {
  type: 'fill_blank',
  content: {
    question: 'Ich habe eine ___ .',
    hint: 'Em gái',
    sentence_translation: 'Tôi có một em gái.'
  },
  answer: {
    correct_answer: 'Schwester',
    explanation: 'die Schwester = chị/em gái'
  },
  xp: 2
};

// 1. Exact Match
assert(evaluateExerciseAnswer(sampleFillBlankExercise, 'Schwester') === true, 'Exact match "Schwester" returns true');

// 2. Case Insensitive
assert(evaluateExerciseAnswer(sampleFillBlankExercise, 'schwester') === true, 'Case insensitive "schwester" returns true');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, 'SCHWESTER') === true, 'Uppercase "SCHWESTER" returns true');

// 3. Whitespace handling
assert(evaluateExerciseAnswer(sampleFillBlankExercise, '  Schwester  ') === true, 'Padded whitespace "  Schwester  " returns true');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, ' schwester \n') === true, 'Padded newline/spaces returns true');

// 4. Umlaut preservation
const umlautExercise = {
  type: 'fill_blank',
  answer: { correct_answer: 'Ärzte' }
};
assert(evaluateExerciseAnswer(umlautExercise, 'ärzte') === true, 'Umlaut match "ärzte" returns true');
assert(evaluateExerciseAnswer(umlautExercise, 'Arzte') === false, 'Non-umlaut "Arzte" for "Ärzte" returns false');

// 5. Wrong Answer
assert(evaluateExerciseAnswer(sampleFillBlankExercise, 'Bruder') === false, 'Wrong answer "Bruder" returns false');

// 6. Empty & Whitespace Only
assert(evaluateExerciseAnswer(sampleFillBlankExercise, '') === false, 'Empty string returns false');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, '   ') === false, 'Whitespace only returns false');

// 7. Invalid Inputs
assert(evaluateExerciseAnswer(sampleFillBlankExercise, null) === false, 'null returns false');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, undefined) === false, 'undefined returns false');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, 123) === false, 'Number 123 returns false');
assert(evaluateExerciseAnswer(sampleFillBlankExercise, {}) === false, 'Empty object returns false');

// 8. Multiple Choice Regression
const sampleMC = {
  type: 'multiple_choice',
  answer: { correct_option: 'der Vater' }
};
assert(evaluateExerciseAnswer(sampleMC, 'der Vater') === true, 'MC correct option "der Vater" returns true');
assert(evaluateExerciseAnswer(sampleMC, ' DER VATER ') === true, 'MC padded option " DER VATER " returns true');
assert(evaluateExerciseAnswer(sampleMC, 'die Mutter') === false, 'MC wrong option "die Mutter" returns false');

console.log('==================================================');
console.log('✅ ALL FILL BLANK UNIT TESTS PASSED!');
console.log('==================================================');
