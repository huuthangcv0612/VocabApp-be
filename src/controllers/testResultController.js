import TestResult from '../models/TestResult.js';
import Question from '../models/Question.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Submit user test answers & calculate score (Scoring Engine)
 * @route   POST /api/test-results
 * @access  Private (User/Admin)
 */
export const submitTestResult = asyncHandler(async (req, res) => {
  const { testId, testName, level, answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new AppError('Answers array is required', HTTP_STATUS.BAD_REQUEST);
  }

  const questionIds = answers.map((a) => a.questionId);
  const questionsMap = new Map();

  const questionsFromDb = await Question.find({ _id: { $in: questionIds } });
  questionsFromDb.forEach((q) => questionsMap.set(q._id.toString(), q));

  let score = 0;
  const total = answers.length;
  const processedAnswers = [];
  const skillStats = {};

  for (const ans of answers) {
    const qDoc = questionsMap.get(ans.questionId.toString());
    if (!qDoc) continue;

    const skill = qDoc.skill || 'vocabulary';
    if (!skillStats[skill]) {
      skillStats[skill] = { correct: 0, total: 0, percentage: 0 };
    }
    skillStats[skill].total += 1;

    let isCorrect = false;
    let correctAnswerText = '';

    // Find correct option in question
    const correctOpt = (qDoc.options || []).find((opt) => opt.isCorrect === true);
    if (correctOpt) {
      correctAnswerText = correctOpt.text;
    }

    // Evaluate user answer
    if (typeof ans.selectedOption === 'number') {
      // If selectedOption is an index (0-based)
      const userOpt = qDoc.options[ans.selectedOption];
      if (userOpt && userOpt.isCorrect) {
        isCorrect = true;
      }
    } else if (typeof ans.selectedOption === 'string') {
      // If selectedOption is string text
      if (correctOpt && correctOpt.text.trim().toLowerCase() === ans.selectedOption.trim().toLowerCase()) {
        isCorrect = true;
      }
    }

    if (isCorrect) {
      score += 1;
      skillStats[skill].correct += 1;
    }

    processedAnswers.push({
      questionId: qDoc._id,
      selectedOption: ans.selectedOption,
      isCorrect,
      correctAnswer: correctAnswerText,
      explanation: qDoc.explanation || null,
      skill: qDoc.skill,
      difficulty: qDoc.difficulty,
    });
  }

  // Calculate percentages for each skill
  const weaknesses = [];
  for (const [sName, stat] of Object.entries(skillStats)) {
    stat.percentage = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    if (stat.percentage < 60) {
      weaknesses.push(sName);
    }
  }

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const evaluatedLevel = percentage >= 80 ? level || 'A1' : `Under ${level || 'A1'}`;

  const testResult = await TestResult.create({
    userId: req.user.id,
    testId: testId && testId !== 'quick-test' ? testId : null,
    testName: testName || `Quick Test ${level || 'A1'}`,
    level: level || 'A1',
    score,
    total,
    percentage,
    answers: processedAnswers,
    skillBreakdown: skillStats,
    weaknesses,
    evaluatedLevel,
    completedAt: new Date(),
  });

  sendResponse(res, HTTP_STATUS.CREATED, 'Test result calculated and submitted successfully', {
    result: {
      _id: testResult._id,
      score,
      total,
      percentage,
      evaluatedLevel,
      skillBreakdown: skillStats,
      weaknesses,
      answers: processedAnswers,
      completedAt: testResult.completedAt,
    },
  });
});

/**
 * @desc    Get test history of logged-in user
 * @route   GET /api/test-results/my-results
 * @access  Private (User/Admin)
 */
export const getUserTestHistory = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const results = await TestResult.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await TestResult.countDocuments({ userId: req.user.id });

  sendResponse(res, HTTP_STATUS.OK, 'User test history fetched successfully', {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Get all test results (Admin Only)
 * @route   GET /api/test-results
 * @access  Private/Admin
 */
export const getAllTestResults = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.level) filter.level = req.query.level;

  const results = await TestResult.find(filter)
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await TestResult.countDocuments(filter);

  sendResponse(res, HTTP_STATUS.OK, 'All test results fetched successfully', {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export default {
  submitTestResult,
  getUserTestHistory,
  getAllTestResults,
};
