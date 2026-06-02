import Vocabulary from '../models/Vocabulary.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Get all vocabularies
 * @route   GET /api/vocabularies
 * @access  Public
 */
export const getAllVocabularies = asyncHandler(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const vocabularies = await Vocabulary.find()
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  const total = await Vocabulary.countDocuments();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Vocabularies fetched successfully',
    {
      vocabularies,
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
 * @desc    Get vocabulary by ID
 * @route   GET /api/vocabularies/:id
 * @access  Public
 */
export const getVocabularyById = asyncHandler(async (req, res, next) => {
  const vocabulary = await Vocabulary.findById(req.params.id).populate('createdBy', 'name email');

  if (!vocabulary) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Vocabulary fetched successfully',
    { vocabulary }
  );
});

/**
 * @desc    Create vocabulary (Admin only)
 * @route   POST /api/vocabularies
 * @access  Private/Admin
 */
export const createVocabulary = asyncHandler(async (req, res, next) => {
  const { germanWord, vietnameseMeaning, exampleSentence, topic, difficultyLevel } = req.body;

  if (!germanWord || !vietnameseMeaning || !topic) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const vocabulary = await Vocabulary.create({
    germanWord,
    vietnameseMeaning,
    exampleSentence,
    topic,
    difficultyLevel,
    createdBy: req.user.id,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    SUCCESS_MESSAGES.RESOURCE_CREATED,
    { vocabulary }
  );
});

/**
 * @desc    Update vocabulary (Admin only)
 * @route   PUT /api/vocabularies/:id
 * @access  Private/Admin
 */
export const updateVocabulary = asyncHandler(async (req, res, next) => {
  let vocabulary = await Vocabulary.findById(req.params.id);

  if (!vocabulary) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  vocabulary = await Vocabulary.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_UPDATED,
    { vocabulary }
  );
});

/**
 * @desc    Delete vocabulary (Admin only)
 * @route   DELETE /api/vocabularies/:id
 * @access  Private/Admin
 */
export const deleteVocabulary = asyncHandler(async (req, res, next) => {
  const vocabulary = await Vocabulary.findById(req.params.id);

  if (!vocabulary) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  await Vocabulary.findByIdAndDelete(req.params.id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_DELETED,
    {}
  );
});

/**
 * @desc    Search vocabularies
 * @route   GET /api/vocabularies/search/:query
 * @access  Public
 */
export const searchVocabularies = asyncHandler(async (req, res, next) => {
  const { query } = req.params;

  if (!query) {
    throw new AppError('Search query is required', HTTP_STATUS.BAD_REQUEST);
  }

  const vocabularies = await Vocabulary.find({
    $or: [
      { germanWord: { $regex: query, $options: 'i' } },
      { vietnameseMeaning: { $regex: query, $options: 'i' } },
      { topic: { $regex: query, $options: 'i' } },
    ],
  }).limit(10);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Search results',
    { vocabularies }
  );
});

export default {
  getAllVocabularies,
  getVocabularyById,
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  searchVocabularies,
};

