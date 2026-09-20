/**
 * Grading Helper for Exercises
 * Canonical schema support for multiple_choice exercises.
 */

/**
 * Normalizes text for string comparison (trims leading/trailing whitespace and converts to lowercase).
 * Used for multiple_choice.
 * @param {any} val
 * @returns {string}
 */
export const normalizeAnswerText = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
};

/**
 * Normalizes text for fill_blank comparison (trims whitespace, collapses repeated spaces, converts to lowercase).
 * Preserves German umlauts and special characters.
 * @param {any} val
 * @returns {string}
 */
export const normalizeFillBlankText = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string' && typeof val !== 'number') return '';
  return String(val).trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Normalizes an individual word token for word_arrangement.
 * @param {any} val
 * @returns {string}
 */
export const normalizeWordToken = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string' && typeof val !== 'number') return '';
  return String(val).trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Evaluates fill_blank exercise.
 * @param {Object} answerConfig - exercise.answer
 * @param {any} rawSubmitted - User submitted answer payload
 * @returns {boolean}
 */
export const evaluateFillBlank = (answerConfig, rawSubmitted) => {
  if (!answerConfig || typeof answerConfig !== 'object') return false;

  const target = answerConfig.correct_answer !== undefined 
    ? answerConfig.correct_answer 
    : (answerConfig.value !== undefined ? answerConfig.value : answerConfig.expected_answer);

  if (target === undefined || target === null) return false;

  const normalizedSubmitted = normalizeFillBlankText(rawSubmitted);
  if (!normalizedSubmitted) return false;

  if (Array.isArray(target)) {
    return target.some(item => normalizeFillBlankText(item) === normalizedSubmitted);
  }

  return normalizeFillBlankText(target) === normalizedSubmitted;
};

/**
 * Evaluates word_arrangement exercise.
 * Expects submittedAnswer (or rawSubmitted) to be an Array of tokens.
 * Compares tokens in exact sequence without sorting.
 * @param {Object} answerConfig - exercise.answer
 * @param {any} rawSubmitted - User submitted answer payload (Array of tokens)
 * @returns {boolean}
 */
export const evaluateWordArrangement = (answerConfig, rawSubmitted) => {
  if (!answerConfig || typeof answerConfig !== 'object') return false;

  let target = answerConfig.correct_answer !== undefined
    ? answerConfig.correct_answer
    : (answerConfig.value !== undefined ? answerConfig.value : answerConfig.expected_answer);

  if (target === undefined || target === null) return false;

  if (typeof target === 'string') {
    target = target.trim().split(/\s+/);
  }

  let submittedArray = rawSubmitted;
  if (typeof rawSubmitted === 'object' && rawSubmitted !== null && !Array.isArray(rawSubmitted)) {
    submittedArray = rawSubmitted.correct_answer || rawSubmitted.words || rawSubmitted.tokens || rawSubmitted.value || rawSubmitted;
  }

  if (!Array.isArray(submittedArray) || !Array.isArray(target)) {
    return false;
  }

  if (submittedArray.length !== target.length) {
    return false;
  }

  for (let i = 0; i < target.length; i++) {
    const subToken = normalizeWordToken(submittedArray[i]);
    const expToken = normalizeWordToken(target[i]);

    if (!subToken || subToken !== expToken) {
      return false;
    }
  }

  return true;
};

/**
 * Evaluates matching exercise.
 * Expects submittedAnswer to be an Array of pairs: [{ left, right }] or [{ id, left, right }]
 * or an Object containing pairs: { pairs: [...] }
 * @param {Object} exercise - Exercise document
 * @param {any} submittedAnswer - User submitted answer payload
 * @returns {boolean}
 */
export const evaluateMatching = (exercise, submittedAnswer) => {
  if (!exercise) return false;

  const answerConfig = exercise.answer || {};
  const contentConfig = exercise.content || {};

  // Extract expected pairs array from exercise.answer or exercise.content
  let expectedPairs = null;
  if (Array.isArray(answerConfig.pairs) && answerConfig.pairs.length > 0) {
    expectedPairs = answerConfig.pairs;
  } else if (Array.isArray(contentConfig.pairs) && contentConfig.pairs.length > 0) {
    expectedPairs = contentConfig.pairs;
  }

  if (!Array.isArray(expectedPairs) || expectedPairs.length === 0) {
    return false;
  }

  // Extract submitted pairs
  let submittedPairs = submittedAnswer;
  if (typeof submittedAnswer === 'object' && submittedAnswer !== null && !Array.isArray(submittedAnswer)) {
    submittedPairs = submittedAnswer.pairs || submittedAnswer.answer || submittedAnswer.submitted_pairs;
  }

  if (!Array.isArray(submittedPairs)) {
    return false;
  }

  // 1. Length check: Must have exact same number of pairs (no missing, no extra)
  if (submittedPairs.length !== expectedPairs.length) {
    return false;
  }

  // Helper for text normalization
  const norm = (str) => (str !== null && str !== undefined ? String(str).trim().toLowerCase() : '');

  // 2. Track matched submitted pair indices to ensure 1-to-1 matching
  const usedSubmittedIndices = new Set();

  for (const expPair of expectedPairs) {
    if (!expPair || typeof expPair !== 'object') return false;

    const expLeft = norm(expPair.left);
    const expRight = norm(expPair.right);
    const expId = expPair.id ? String(expPair.id) : null;

    let matchedIndex = -1;

    for (let i = 0; i < submittedPairs.length; i++) {
      if (usedSubmittedIndices.has(i)) continue;

      const subPair = submittedPairs[i];
      if (!subPair || typeof subPair !== 'object') continue;

      const subLeft = norm(subPair.left);
      const subRight = norm(subPair.right);
      const subId = subPair.id ? String(subPair.id) : null;

      // If submitted pair contains an ID, verify ID match if present
      if (subId && expId) {
        if (subId === expId) {
          if (subLeft === expLeft && subRight === expRight) {
            matchedIndex = i;
            break;
          } else {
            // ID matches but content doesn't match
            return false;
          }
        }
      } else {
        // Match by content
        if (subLeft === expLeft && subRight === expRight) {
          matchedIndex = i;
          break;
        }
      }
    }

    if (matchedIndex === -1) {
      return false; // Expected pair was not matched
    }

    usedSubmittedIndices.add(matchedIndex);
  }

  return usedSubmittedIndices.size === expectedPairs.length;
};

/**
 * Evaluates whether a user's submitted answer for an exercise is correct.
 * @param {Object} exercise - The exercise document from database
 * @param {any} submittedAnswer - The answer submitted in request body
 * @returns {boolean} isCorrect
 */
export const evaluateExerciseAnswer = (exercise, submittedAnswer) => {
  if (!exercise) return false;

  const type = exercise.type;
  const answerConfig = exercise.answer || {};

  // Branch 0: Matching exercise (type === 'matching')
  if (type === 'matching') {
    return evaluateMatching(exercise, submittedAnswer);
  }

  // Extract raw payload if submittedAnswer is an object
  let rawSubmitted = submittedAnswer;
  if (typeof submittedAnswer === 'object' && submittedAnswer !== null && !Array.isArray(submittedAnswer)) {
    rawSubmitted = submittedAnswer.correct_answer || submittedAnswer.correct_option || submittedAnswer.text || submittedAnswer.value || submittedAnswer;
  }

  // Branch 1: Canonical Multiple Choice (or exercises containing answer.correct_option)
  if (type === 'multiple_choice' || (answerConfig && answerConfig.correct_option !== undefined)) {
    const correctAnswer = answerConfig.correct_option;
    if (correctAnswer === undefined || correctAnswer === null) {
      return false;
    }
    return normalizeAnswerText(rawSubmitted) === normalizeAnswerText(correctAnswer);
  }

  // Branch 2: Word Arrangement (type === 'word_arrangement')
  if (type === 'word_arrangement') {
    return evaluateWordArrangement(answerConfig, rawSubmitted);
  }

  // Branch 3: Fill Blank (type === 'fill_blank' or exercises containing answer.correct_answer)
  if (type === 'fill_blank' || (answerConfig && answerConfig.correct_answer !== undefined)) {
    return evaluateFillBlank(answerConfig, rawSubmitted);
  }

  // Branch 4: Legacy or non-multiple_choice exercises
  if (answerConfig && typeof answerConfig === 'object') {
    if (answerConfig.value !== undefined) {
      if (typeof rawSubmitted === 'string' && typeof answerConfig.value === 'string') {
        return normalizeAnswerText(rawSubmitted) === normalizeAnswerText(answerConfig.value);
      }
      return JSON.stringify(submittedAnswer) === JSON.stringify(answerConfig.value);
    }
    if (answerConfig.expected_answer !== undefined) {
      if (typeof rawSubmitted === 'string' && typeof answerConfig.expected_answer === 'string') {
        return normalizeAnswerText(rawSubmitted) === normalizeAnswerText(answerConfig.expected_answer);
      }
      return JSON.stringify(submittedAnswer) === JSON.stringify(answerConfig.expected_answer);
    }
    return JSON.stringify(submittedAnswer) === JSON.stringify(answerConfig);
  }

  if (answerConfig !== undefined) {
    return normalizeAnswerText(rawSubmitted) === normalizeAnswerText(answerConfig);
  }

  return false;
};

