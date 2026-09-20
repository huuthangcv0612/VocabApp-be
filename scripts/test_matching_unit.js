import { evaluateMatching, evaluateExerciseAnswer } from '../src/utils/gradingHelper.js';
import { validateMatchingContent } from '../src/validators/adminContentValidator.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('==================================================');
console.log('🧪 RUNNING MATCHING EXERCISE UNIT TESTS');
console.log('==================================================');

const sampleMatchingExercise = {
  type: 'matching',
  content: {
    pairs: [
      { id: 'pair_1', left: 'có chuyện gì vậy', right: 'was ist los' },
      { id: 'pair_2', left: 'không', right: 'nicht' },
      { id: 'pair_3', left: 'tiệc', right: 'Party' },
      { id: 'pair_4', left: 'kỳ lạ', right: 'komisch' },
      { id: 'pair_5', left: 'Xin lỗi', right: 'Entschuldigung' },
    ],
  },
  answer: {
    pairs: [
      { id: 'pair_1', left: 'có chuyện gì vậy', right: 'was ist los' },
      { id: 'pair_2', left: 'không', right: 'nicht' },
      { id: 'pair_3', left: 'tiệc', right: 'Party' },
      { id: 'pair_4', left: 'kỳ lạ', right: 'komisch' },
      { id: 'pair_5', left: 'Xin lỗi', right: 'Entschuldigung' },
    ],
  },
  xp: 2,
};

// TEST 1: Tất cả pair đúng -> correct
console.log('\n--- TEST 1: All pairs correct ---');
const test1Answer = [
  { left: 'có chuyện gì vậy', right: 'was ist los' },
  { left: 'không', right: 'nicht' },
  { left: 'tiệc', right: 'Party' },
  { left: 'kỳ lạ', right: 'komisch' },
  { left: 'Xin lỗi', right: 'Entschuldigung' },
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test1Answer) === true, 'TEST 1: All pairs correct returns true');

// TEST 2: Một pair sai -> incorrect
console.log('\n--- TEST 2: One pair wrong ---');
const test2Answer = [
  { left: 'có chuyện gì vậy', right: 'was ist los' },
  { left: 'không', right: 'Party' }, // wrong
  { left: 'tiệc', right: 'nicht' },
  { left: 'kỳ lạ', right: 'komisch' },
  { left: 'Xin lỗi', right: 'Entschuldigung' },
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test2Answer) === false, 'TEST 2: One pair wrong returns false');

// TEST 3: Thiếu một pair -> incorrect
console.log('\n--- TEST 3: Missing pair ---');
const test3Answer = [
  { left: 'có chuyện gì vậy', right: 'was ist los' },
  { left: 'không', right: 'nicht' },
  { left: 'tiệc', right: 'Party' },
  { left: 'kỳ lạ', right: 'komisch' },
  // missing 5th pair
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test3Answer) === false, 'TEST 3: Missing pair returns false');

// TEST 4: Có pair không tồn tại -> reject/incorrect
console.log('\n--- TEST 4: Non-existent pair ---');
const test4Answer = [
  { left: 'có chuyện gì vậy', right: 'was ist los' },
  { left: 'không', right: 'nicht' },
  { left: 'tiệc', right: 'Party' },
  { left: 'kỳ lạ', right: 'komisch' },
  { left: 'Xin lỗi', right: 'Entschuldigung' },
  { left: 'chào', right: 'hallo' }, // extra non-existent pair
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test4Answer) === false, 'TEST 4: Non-existent pair returns false');

const test4bAnswer = [
  { id: 'pair_999', left: 'có chuyện gì vậy', right: 'was ist los' },
  { left: 'không', right: 'nicht' },
  { left: 'tiệc', right: 'Party' },
  { left: 'kỳ lạ', right: 'komisch' },
  { left: 'Xin lỗi', right: 'Entschuldigung' },
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test4bAnswer) === false, 'TEST 4b: Invalid pair ID returns false');

// TEST 5: Các pair được gửi theo thứ tự khác -> vẫn correct nếu nội dung các pair đều đúng
console.log('\n--- TEST 5: Different pair order ---');
const test5Answer = [
  { left: 'Xin lỗi', right: 'Entschuldigung' },
  { left: 'kỳ lạ', right: 'komisch' },
  { left: 'tiệc', right: 'Party' },
  { left: 'không', right: 'nicht' },
  { left: 'có chuyện gì vậy', right: 'was ist los' },
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, test5Answer) === true, 'TEST 5: Shuffled pair order returns true');

// TEST 6: FE gửi is_correct=true -> backend tự grading qua evaluateExerciseAnswer
console.log('\n--- TEST 6: FE payload wrapper / security check ---');
const test6PayloadWrong = {
  is_correct: true, // FE attempt to spoof correctness
  answer: [
    { left: 'có chuyện gì vậy', right: 'wrong_answer' },
    { left: 'không', right: 'nicht' },
    { left: 'tiệc', right: 'Party' },
    { left: 'kỳ lạ', right: 'komisch' },
    { left: 'Xin lỗi', right: 'Entschuldigung' },
  ],
};
assert(evaluateExerciseAnswer(sampleMatchingExercise, test6PayloadWrong) === false, 'TEST 6: FE is_correct=true with wrong answer returns false');

// TEST 7: Validation - Matching exercise không có pairs -> validation error
console.log('\n--- TEST 7: Validation - Empty pairs array ---');
try {
  validateMatchingContent({ pairs: [] });
  assert(false, 'TEST 7 should have thrown a validation error for empty pairs array');
} catch (err) {
  assert(err.message.includes('non-empty pairs array'), 'TEST 7: Empty pairs array throws AppError correctly');
}

// TEST 8: Validation - Duplicate pair id -> validation error
console.log('\n--- TEST 8: Validation - Duplicate pair ID ---');
try {
  validateMatchingContent({
    pairs: [
      { id: 'pair_1', left: 'có chuyện gì vậy', right: 'was ist los' },
      { id: 'pair_1', left: 'không', right: 'nicht' }, // duplicate id
    ],
  });
  assert(false, 'TEST 8 should have thrown a validation error for duplicate pair id');
} catch (err) {
  assert(err.message.includes('Duplicate pair id found'), 'TEST 8: Duplicate pair ID throws AppError correctly');
}

// Additional Case Insensitive & Whitespace Trimming Test
console.log('\n--- EXTRA TEST: Case Insensitivity and Whitespace Normalization ---');
const extraAnswer = [
  { left: '  có chuyện gì vậy  ', right: 'WAS IST LOS' },
  { left: 'KHÔNG', right: 'nicht  ' },
  { left: 'tiệc', right: 'party' },
  { left: 'kỳ lạ ', right: '  Komisch' },
  { left: 'Xin Lỗi', right: 'entschuldigung' },
];
assert(evaluateExerciseAnswer(sampleMatchingExercise, extraAnswer) === true, 'EXTRA TEST: Padded & case-insensitive matches return true');

console.log('==================================================');
console.log('✅ ALL MATCHING UNIT & VALIDATION TESTS PASSED!');
console.log('==================================================');
