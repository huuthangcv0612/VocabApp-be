/**
 * Interactive Quiz Generator & Grader Service
 * Generates dynamic quiz questions from vocabulary lists and sanitizes them for students.
 */

// Fisher-Yates array shuffle utility
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Fallback distractors for German article and meaning questions
const FALLBACK_DISTRACTORS = [
  'học tập',
  'làm việc',
  'gia đình',
  'người bạn',
  'trường học',
  'bữa ăn',
  'cuộc sống',
  'thành phố',
  'thời gian',
  'sách vở',
];

/**
 * Generate multiple choice quiz questions from a list of vocabularies
 *
 * @param {Array} vocabularies - List of populated Vocabulary objects
 * @param {Object} [config] - Quiz configuration (question_count, shuffle, time_limit)
 * @returns {Array} Array of full question objects with answers
 */
export const generateQuizFromVocabularies = (vocabularies = [], config = {}) => {
  if (!Array.isArray(vocabularies) || vocabularies.length === 0) {
    return [];
  }

  const allMeanings = Array.from(
    new Set(vocabularies.map((v) => v.meaning).filter(Boolean))
  );

  const questions = [];

  vocabularies.forEach((vocab, index) => {
    const vocabId = vocab._id ? vocab._id.toString() : `vocab_${index}`;
    const word = vocab.word;
    const meaning = vocab.meaning;

    // 1. Vocabulary Meaning Question
    if (meaning) {
      // Pick 3 distractors
      const otherMeanings = allMeanings.filter((m) => m !== meaning);
      const distractors = shuffleArray(
        otherMeanings.length >= 3 ? otherMeanings : [...otherMeanings, ...FALLBACK_DISTRACTORS]
      ).slice(0, 3);

      const options = shuffleArray([
        { id: 'opt_correct', text: meaning, isCorrect: true },
        ...distractors.map((d, i) => ({ id: `opt_distractor_${i}`, text: d, isCorrect: false })),
      ]);

      questions.push({
        id: `q_meaning_${vocabId}`,
        vocabulary_id: vocabId,
        question_type: 'meaning',
        question_text: `Nghĩa tiếng Việt của từ "${word}" là gì?`,
        options,
        correct_answer: meaning,
        time_limit: config.time_limit || 30,
        explanation: vocab.example ? `Ví dụ: ${vocab.example}` : null,
      });
    }

    // 2. German Article Question (if noun and article is known: der, die, das)
    if (vocab.article && ['der', 'die', 'das'].includes(vocab.article.toLowerCase())) {
      const correctArticle = vocab.article.toLowerCase();
      const articles = ['der', 'die', 'das'];
      const options = articles.map((art) => ({
        id: `opt_art_${art}`,
        text: art,
        isCorrect: art === correctArticle,
      }));

      questions.push({
        id: `q_article_${vocabId}`,
        vocabulary_id: vocabId,
        question_type: 'article',
        question_text: `Quán từ đúng của danh từ "${word}" là gì?`,
        options,
        correct_answer: correctArticle,
        time_limit: config.time_limit || 30,
        explanation: `Quán từ đúng là "${correctArticle} ${word}".`,
      });
    }
  });

  let result = config.shuffle !== false ? shuffleArray(questions) : questions;

  if (config.question_count && config.question_count > 0) {
    result = result.slice(0, config.question_count);
  }

  return result;
};

/**
 * Mask quiz questions for students to prevent exposing correct answers
 *
 * @param {Array} questions - Questions generated with correct answers
 * @returns {Array} Sanitized questions safe for client transmission
 */
export const maskQuizAnswersForStudent = (questions = []) => {
  return questions.map((q) => ({
    id: q.id,
    vocabulary_id: q.vocabulary_id,
    question_type: q.question_type,
    question_text: q.question_text,
    time_limit: q.time_limit,
    options: (q.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
      // Intentionally omit isCorrect
    })),
    // Intentionally omit correct_answer and explanation
  }));
};

/**
 * Evaluate a student's answer against a question
 *
 * @param {Object} question - Full question object
 * @param {String} studentAnswer - Text or option ID provided by student
 * @returns {{ isCorrect: Boolean, correctAnswer: String, explanation: String|null }}
 */
export const evaluateQuizAnswer = (question, studentAnswer) => {
  if (!question || !studentAnswer) {
    return { isCorrect: false, correctAnswer: question?.correct_answer || '', explanation: null };
  }

  const normalizedStudent = String(studentAnswer).trim().toLowerCase();
  const normalizedCorrect = String(question.correct_answer || '').trim().toLowerCase();

  // Check direct text match
  let isCorrect = normalizedStudent === normalizedCorrect;

  // Check option ID match if option ID was submitted
  if (!isCorrect && Array.isArray(question.options)) {
    const selectedOption = question.options.find(
      (opt) => opt.id === studentAnswer || opt.text?.toLowerCase() === normalizedStudent
    );
    if (selectedOption && selectedOption.isCorrect) {
      isCorrect = true;
    }
  }

  return {
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation || null,
  };
};

export default {
  generateQuizFromVocabularies,
  maskQuizAnswersForStudent,
  evaluateQuizAnswer,
};
