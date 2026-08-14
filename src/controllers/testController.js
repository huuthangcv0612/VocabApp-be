import Test from '../models/Test.js';
import Question from '../models/Question.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Create Test Config (Admin Only)
 * @route   POST /api/tests
 * @access  Private/Admin
 */
export const createTestConfig = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    level,
    totalQuestions,
    config,
    difficultyRatio,
    timeLimit,
    passingScore,
    status,
  } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('Test name is required', HTTP_STATUS.BAD_REQUEST);
  }

  const testConfig = await Test.create({
    name,
    description: description || null,
    level: level || 'A1',
    totalQuestions: totalQuestions || 30,
    config: config || { vocabulary: 10, grammar: 10, reading: 10, listening: 0 },
    difficultyRatio: difficultyRatio || { easy: 40, medium: 40, hard: 20 },
    timeLimit: timeLimit || 30,
    passingScore: passingScore || 70,
    status: status || 'active',
    createdBy: req.user.id,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Test configuration created successfully',
    { test: testConfig }
  );
});

/**
 * @desc    Get all test configs
 * @route   GET /api/tests
 * @access  Private (User/Admin)
 */
export const getTests = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') {
    filter.status = 'active';
  } else if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.level) filter.level = req.query.level;

  const tests = await Test.find(filter).sort({ createdAt: -1 });

  sendResponse(res, HTTP_STATUS.OK, 'Test configurations fetched successfully', { tests });
});

/**
 * @desc    Get test config by ID
 * @route   GET /api/tests/:id
 * @access  Private (User/Admin)
 */
export const getTestById = asyncHandler(async (req, res) => {
  const testConfig = await Test.findById(req.params.id);

  if (!testConfig) {
    throw new AppError('Test configuration not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Test configuration fetched successfully', { test: testConfig });
});

/**
 * @desc    Update test config (Admin Only)
 * @route   PUT /api/tests/:id
 * @access  Private/Admin
 */
export const updateTestConfig = asyncHandler(async (req, res) => {
  const testConfig = await Test.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!testConfig) {
    throw new AppError('Test configuration not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Test configuration updated successfully', { test: testConfig });
});

/**
 * @desc    Delete (deactivate) test config (Admin Only)
 * @route   DELETE /api/tests/:id
 * @access  Private/Admin
 */
export const deleteTestConfig = asyncHandler(async (req, res) => {
  const testConfig = await Test.findById(req.params.id);

  if (!testConfig) {
    throw new AppError('Test configuration not found', HTTP_STATUS.NOT_FOUND);
  }

  testConfig.status = 'inactive';
  await testConfig.save();

  sendResponse(res, HTTP_STATUS.OK, 'Test configuration deactivated successfully', { test: testConfig });
});

/**
 * Helper to shuffle an array
 */
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * @desc    Generate a dynamic test for user from Question Bank
 * @route   GET /api/tests/quick-test or GET /api/tests/:id/start
 * @access  Private (User/Admin)
 */
export const generateUserTest = asyncHandler(async (req, res) => {
  let targetLevel = req.query.level || 'A1';
  let totalReq = parseInt(req.query.total) || 30;
  let testConfigObj = null;

  if (req.params.id && req.params.id !== 'quick-test') {
    testConfigObj = await Test.findById(req.params.id);
    if (testConfigObj && testConfigObj.status === 'active') {
      targetLevel = testConfigObj.level;
      totalReq = testConfigObj.totalQuestions;
    }
  }

  // Fetch all active questions for target level
  const activeQuestions = await Question.find({
    level: targetLevel,
    status: 'active',
  });

  if (activeQuestions.length === 0) {
    // If no active questions for exact level, try finding any active questions
    const fallbackQuestions = await Question.find({ status: 'active' });
    if (fallbackQuestions.length === 0) {
      throw new AppError('No active questions available in Question Bank', HTTP_STATUS.NOT_FOUND);
    }
  }

  let selectedQuestions = [];

  if (testConfigObj && testConfigObj.config) {
    const { vocabulary = 10, grammar = 10, reading = 10, listening = 0 } = testConfigObj.config;

    const skillsMap = { vocabulary, grammar, reading, listening };

    for (const [skillName, count] of Object.entries(skillsMap)) {
      if (count > 0) {
        const skillQuestions = activeQuestions.filter((q) => q.skill === skillName);
        const shuffledSkill = shuffleArray(skillQuestions);
        selectedQuestions.push(...shuffledSkill.slice(0, count));
      }
    }
  }

  // If selected count is less than requested, fill from remaining active questions
  if (selectedQuestions.length < totalReq) {
    const selectedIds = new Set(selectedQuestions.map((q) => q._id.toString()));
    const remaining = activeQuestions.filter((q) => !selectedIds.has(q._id.toString()));
    const shuffledRemaining = shuffleArray(remaining);
    const needed = totalReq - selectedQuestions.length;
    selectedQuestions.push(...shuffledRemaining.slice(0, needed));
  }

  // Final shuffle of selected questions
  selectedQuestions = shuffleArray(selectedQuestions.slice(0, totalReq));

  // CRITICAL SECURITY REQUIREMENT #11: SANITIZE payload!
  // Strip `isCorrect` and `explanation` from response so users cannot inspect DevTools for answers!
  const sanitizedQuestions = selectedQuestions.map((q) => {
    const qObj = q.toObject ? q.toObject() : { ...q };
    return {
      _id: qObj._id,
      level: qObj.level,
      topic: qObj.topic,
      type: qObj.type,
      question: qObj.question,
      difficulty: qObj.difficulty,
      skill: qObj.skill,
      options: (qObj.options || []).map((opt) => opt.text), // Send only option texts!
    };
  });

  sendResponse(res, HTTP_STATUS.OK, 'Test generated successfully', {
    test: {
      testId: testConfigObj ? testConfigObj._id : 'quick-test',
      testName: testConfigObj ? testConfigObj.name : `Quick Test ${targetLevel}`,
      level: targetLevel,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    },
  });
});

export default {
  createTestConfig,
  getTests,
  getTestById,
  updateTestConfig,
  deleteTestConfig,
  generateUserTest,
};
