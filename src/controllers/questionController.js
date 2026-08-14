import Question from '../models/Question.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Create a new question (Admin Only)
 * @route   POST /api/questions
 * @access  Private/Admin
 */
export const createQuestion = asyncHandler(async (req, res) => {
  const {
    level,
    topic,
    type,
    question,
    options,
    explanation,
    difficulty,
    skill,
    status,
  } = req.body;

  if (!question || !question.trim()) {
    throw new AppError('Question text is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (type === 'multiple_choice') {
    if (!Array.isArray(options) || options.length < 2) {
      throw new AppError('Multiple choice questions require at least 2 options', HTTP_STATUS.BAD_REQUEST);
    }
    const hasCorrect = options.some((opt) => opt.isCorrect === true);
    if (!hasCorrect) {
      throw new AppError('At least one option must be marked as correct', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const newQuestion = await Question.create({
    level: level || 'A1',
    topic: topic || 'General',
    type: type || 'multiple_choice',
    question,
    options: options || [],
    explanation: explanation || null,
    difficulty: difficulty || 'easy',
    skill: skill || 'vocabulary',
    status: status || 'active',
    createdBy: req.user.id,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Question created successfully',
    { question: newQuestion }
  );
});

/**
 * @desc    Get questions list with filtering & pagination
 * @route   GET /api/questions
 * @access  Private (User/Admin)
 */
export const getQuestions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const filter = {};

  // Non-admins can only see active questions
  if (req.user.role !== 'admin') {
    filter.status = 'active';
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.level) filter.level = req.query.level;
  if (req.query.skill) filter.skill = req.query.skill;
  if (req.query.difficulty) filter.difficulty = req.query.difficulty;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.topic) filter.topic = { $regex: req.query.topic, $options: 'i' };
  if (req.query.q) {
    filter.question = { $regex: req.query.q, $options: 'i' };
  }

  const questions = await Question.find(filter)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Question.countDocuments(filter);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Questions fetched successfully',
    {
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  );
});

/**
 * @desc    Get question by ID
 * @route   GET /api/questions/:id
 * @access  Private (User/Admin)
 */
export const getQuestionById = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id).populate('createdBy', 'name email');

  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  // Non-admins cannot access inactive/draft questions
  if (req.user.role !== 'admin' && question.status !== 'active') {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Question fetched successfully',
    { question }
  );
});

/**
 * @desc    Update question (Admin Only)
 * @route   PUT /api/questions/:id
 * @access  Private/Admin
 */
export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  const {
    level,
    topic,
    type,
    question: questionText,
    options,
    explanation,
    difficulty,
    skill,
    status,
  } = req.body;

  if (type === 'multiple_choice' || (question.type === 'multiple_choice' && options)) {
    const optsToCheck = options || question.options;
    if (!Array.isArray(optsToCheck) || optsToCheck.length < 2) {
      throw new AppError('Multiple choice questions require at least 2 options', HTTP_STATUS.BAD_REQUEST);
    }
    const hasCorrect = optsToCheck.some((opt) => opt.isCorrect === true);
    if (!hasCorrect) {
      throw new AppError('At least one option must be marked as correct', HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (level !== undefined) question.level = level;
  if (topic !== undefined) question.topic = topic;
  if (type !== undefined) question.type = type;
  if (questionText !== undefined) question.question = questionText;
  if (options !== undefined) question.options = options;
  if (explanation !== undefined) question.explanation = explanation;
  if (difficulty !== undefined) question.difficulty = difficulty;
  if (skill !== undefined) question.skill = skill;
  if (status !== undefined) question.status = status;

  await question.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Question updated successfully',
    { question }
  );
});

/**
 * @desc    Soft Delete Question (Set status to 'inactive') (Admin Only)
 * @route   DELETE /api/questions/:id
 * @access  Private/Admin
 */
export const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);

  if (!question) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND);
  }

  // Soft delete by setting status = 'inactive'
  question.status = 'inactive';
  await question.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Question soft deleted (status set to inactive)',
    { question }
  );
});

export default {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
