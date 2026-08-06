import mongoose from 'mongoose';
import Vocabulary from '../models/Vocabulary.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS, PAGINATION } from '../utils/constants.js';

/**
 * @desc    Get all vocabularies (Admin Table & Public Pagination with Filters)
 * @route   GET /api/vocabularies
 * @access  Public / Admin
 */
export const getAllVocabularies = asyncHandler(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const { lektionId, difficultyLevel, type, search } = req.query;

  const filter = {};

  // Filter by lektionId
  if (lektionId && String(lektionId).trim() !== '') {
    const cleanLektionId = String(lektionId).trim();
    if (mongoose.isValidObjectId(cleanLektionId)) {
      filter.lektionId = cleanLektionId;
    }
  }

  // Filter by difficultyLevel (A1, A2, B1, etc.)
  if (difficultyLevel && String(difficultyLevel).trim() !== '') {
    filter.difficultyLevel = String(difficultyLevel).trim();
  }

  // Filter by word type (noun, verb, adjective, etc.)
  if (type && String(type).trim() !== '') {
    filter.type = String(type).trim().toLowerCase();
  }

  // Text search query across word, meaning, example
  if (search && String(search).trim() !== '') {
    const searchRegex = new RegExp(String(search).trim(), 'i');
    filter.$or = [
      { word: searchRegex },
      { meaning: searchRegex },
      { example: searchRegex },
    ];
  }

  const vocabularies = await Vocabulary.find(filter)
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name email')
    .populate('lektionId', 'title level')
    .sort({ createdAt: -1 });

  const total = await Vocabulary.countDocuments(filter);

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
 * @desc    Get single vocabulary by ID
 * @route   GET /api/vocabularies/:id
 * @access  Public / Admin
 */
export const getVocabularyById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid vocabulary ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const vocabulary = await Vocabulary.findById(id)
    .populate('createdBy', 'name email')
    .populate('lektionId', 'title level');

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
 * @desc    Create new vocabulary (Admin only)
 * @route   POST /api/vocabularies
 * @access  Private/Admin
 */
export const createVocabulary = asyncHandler(async (req, res, next) => {
  const {
    word,
    article,
    plural,
    type,
    meaning,
    pronunciation,
    example,
    translation,
    audio,
    image,
    lektionId,
    difficultyLevel,
  } = req.body;

  const vocabulary = await Vocabulary.create({
    word,
    article: article || null,
    plural: plural || null,
    type: type || 'noun',
    meaning,
    pronunciation: pronunciation || null,
    example: example || null,
    translation: translation || null,
    audio: audio || null,
    image: image || null,
    lektionId: lektionId || null,
    difficultyLevel: difficultyLevel || 'A1',
    createdBy: req.user.id,
  });

  const populatedVocab = await Vocabulary.findById(vocabulary._id)
    .populate('createdBy', 'name email')
    .populate('lektionId', 'title level');

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    SUCCESS_MESSAGES.RESOURCE_CREATED,
    { vocabulary: populatedVocab }
  );
});

/**
 * @desc    Update vocabulary by ID (Partial & Full Update without losing existing fields like lektionId)
 * @route   PUT /api/vocabularies/:id
 * @access  Private/Admin
 */
export const updateVocabulary = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid vocabulary ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const existingVocabulary = await Vocabulary.findById(id);
  if (!existingVocabulary) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Construct whitelist update object to prevent parameter pollution or overwriting system attributes
  const updateData = {};
  const allowedFields = [
    'word',
    'article',
    'plural',
    'type',
    'meaning',
    'pronunciation',
    'example',
    'translation',
    'audio',
    'image',
    'lektionId',
    'difficultyLevel',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Atomic update using $set to retain fields that were not passed in the request body
  const updatedVocabulary = await Vocabulary.findByIdAndUpdate(
    id,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  )
    .populate('createdBy', 'name email')
    .populate('lektionId', 'title level');

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_UPDATED,
    { vocabulary: updatedVocabulary }
  );
});

/**
 * @desc    Delete vocabulary by ID
 * @route   DELETE /api/vocabularies/:id
 * @access  Private/Admin
 */
export const deleteVocabulary = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid vocabulary ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const vocabulary = await Vocabulary.findById(id);
  if (!vocabulary) {
    throw new AppError(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  await Vocabulary.findByIdAndDelete(id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_DELETED,
    { deletedId: id }
  );
});

/**
 * @desc    Search vocabularies by keyword
 * @route   GET /api/vocabularies/search/:query
 * @access  Public
 */
export const searchVocabularies = asyncHandler(async (req, res, next) => {
  const { query } = req.params;

  if (!query || !query.trim()) {
    throw new AppError('Search query is required', HTTP_STATUS.BAD_REQUEST);
  }

  const searchRegex = new RegExp(query.trim(), 'i');

  const vocabularies = await Vocabulary.find({
    $or: [
      { word: searchRegex },
      { meaning: searchRegex },
      { example: searchRegex },
    ],
  })
    .limit(20)
    .populate('lektionId', 'title level');

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Search results fetched successfully',
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
