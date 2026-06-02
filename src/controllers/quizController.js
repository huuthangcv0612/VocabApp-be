import Quiz from '../models/Quiz.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Get all quizzes
 * @route   GET /api/quizzes
 * @access  Public
 */
export const getAllQuizzes = asyncHandler(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const quizzes = await Quiz.find({ isPublished: true })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  const total = await Quiz.countDocuments({ isPublished: true });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Quizzes fetched successfully',
    {
      quizzes,
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
 * @desc    Get quiz by ID
 * @route   GET /api/quizzes/:id
 * @access  Public
 */
export const getQuizById = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id).populate('createdBy', 'name email');

  if (!quiz) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Quiz fetched successfully',
    { quiz }
  );
});

/**
 * @desc    Create quiz (Admin only)
 * @route   POST /api/quizzes
 * @access  Private/Admin
 */
export const createQuiz = asyncHandler(async (req, res, next) => {
  const { title, description, topic, difficultyLevel, questions, timeLimit, passingScore } = req.body;

  if (!title || !topic || !questions || questions.length === 0) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const quiz = await Quiz.create({
    title,
    description,
    topic,
    difficultyLevel,
    questions,
    timeLimit,
    passingScore,
    createdBy: req.user.id,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    SUCCESS_MESSAGES.RESOURCE_CREATED,
    { quiz }
  );
});

/**
 * @desc    Update quiz (Admin only)
 * @route   PUT /api/quizzes/:id
 * @access  Private/Admin
 */
export const updateQuiz = asyncHandler(async (req, res, next) => {
  let quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_UPDATED,
    { quiz }
  );
});

/**
 * @desc    Delete quiz (Admin only)
 * @route   DELETE /api/quizzes/:id
 * @access  Private/Admin
 */
export const deleteQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  await Quiz.findByIdAndDelete(req.params.id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_DELETED,
    {}
  );
});

/**
 * @desc    Publish/Unpublish quiz (Admin only)
 * @route   PATCH /api/quizzes/:id/publish
 * @access  Private/Admin
 */
export const togglePublishQuiz = asyncHandler(async (req, res, next) => {
  let quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  quiz.isPublished = !quiz.isPublished;
  await quiz.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    `Quiz ${quiz.isPublished ? 'published' : 'unpublished'} successfully`,
    { quiz }
  );
});

export default {
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  togglePublishQuiz,
};
