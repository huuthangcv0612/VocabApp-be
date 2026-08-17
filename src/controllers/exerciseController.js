import mongoose from 'mongoose';
import Exercise, { EXERCISE_TYPES } from '../models/Exercise.js';
import Lesson from '../models/Lesson.js';
import Vocabulary from '../models/Vocabulary.js';
import Grammar from '../models/Grammar.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get all exercises
 * @route   GET /api/exercises
 * @access  Public
 */
export const getAllExercises = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.lesson_id || req.query.lessonId) {
    const lessonId = req.query.lesson_id || req.query.lessonId;
    if (mongoose.isValidObjectId(lessonId)) {
      filter.lesson_id = lessonId;
    }
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  const exercises = await Exercise.find(filter)
    .populate('lesson_id', 'title slug')
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Exercises fetched successfully', {
    exercises,
    count: exercises.length,
    data: exercises,
  });
});

/**
 * @desc    Get exercise by ID
 * @route   GET /api/exercises/:id
 * @access  Public
 */
export const getExerciseById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Exercise ID', HTTP_STATUS.BAD_REQUEST);
  }

  const exercise = await Exercise.findById(id)
    .populate('lesson_id', 'title slug')
    .populate('vocabulary_id')
    .populate('grammar_id');

  if (!exercise) {
    throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Exercise fetched successfully', {
    exercise,
    data: exercise,
  });
});

/**
 * @desc    Get exercises by Lesson ID
 * @route   GET /api/lessons/:lessonId/exercises
 * @access  Public
 */
export const getExercisesByLesson = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  const exercises = await Exercise.find({ lesson_id: lessonId })
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Exercises fetched successfully', {
    exercises,
    count: exercises.length,
    data: exercises,
  });
});

/**
 * @desc    Create exercise (Admin)
 * @route   POST /api/exercises
 * @access  Private/Admin
 */
export const createExercise = asyncHandler(async (req, res) => {
  const { lesson_id, type, order, content, answer, vocabulary_id, grammar_id, xp } = req.body;

  if (!lesson_id || !mongoose.isValidObjectId(lesson_id)) {
    throw new AppError('Valid lesson_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!type || !EXERCISE_TYPES.includes(type)) {
    throw new AppError(
      `Invalid exercise type. Valid types are: ${EXERCISE_TYPES.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (!content || typeof content !== 'object') {
    throw new AppError('Exercise content must be an object', HTTP_STATUS.BAD_REQUEST);
  }

  if (!answer || typeof answer !== 'object') {
    throw new AppError('Exercise answer must be an object', HTTP_STATUS.BAD_REQUEST);
  }

  const lessonExists = await Lesson.findById(lesson_id);
  if (!lessonExists) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  if (vocabulary_id && mongoose.isValidObjectId(vocabulary_id)) {
    const vocabExists = await Vocabulary.findById(vocabulary_id);
    if (!vocabExists) throw new AppError('Referenced vocabulary not found', HTTP_STATUS.NOT_FOUND);
  }

  if (grammar_id && mongoose.isValidObjectId(grammar_id)) {
    const grammarExists = await Grammar.findById(grammar_id);
    if (!grammarExists) throw new AppError('Referenced grammar not found', HTTP_STATUS.NOT_FOUND);
  }

  const exercise = await Exercise.create({
    lesson_id,
    type,
    order: order || 1,
    content,
    answer,
    vocabulary_id: vocabulary_id || null,
    grammar_id: grammar_id || null,
    xp: xp !== undefined ? xp : 2,
  });

  const populatedExercise = await Exercise.findById(exercise._id)
    .populate('vocabulary_id')
    .populate('grammar_id');

  sendResponse(res, HTTP_STATUS.CREATED, 'Exercise created successfully', {
    exercise: populatedExercise,
  });
});

/**
 * @desc    Update exercise (Admin)
 * @route   PUT /api/exercises/:id
 * @access  Private/Admin
 */
export const updateExercise = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Exercise ID', HTTP_STATUS.BAD_REQUEST);
  }

  if (req.body.type && !EXERCISE_TYPES.includes(req.body.type)) {
    throw new AppError(
      `Invalid exercise type. Valid types are: ${EXERCISE_TYPES.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const exercise = await Exercise.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate('vocabulary_id')
    .populate('grammar_id');

  if (!exercise) {
    throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Exercise updated successfully', { exercise });
});

/**
 * @desc    Delete exercise (Admin)
 * @route   DELETE /api/exercises/:id
 * @access  Private/Admin
 */
export const deleteExercise = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Exercise ID', HTTP_STATUS.BAD_REQUEST);
  }

  const exercise = await Exercise.findById(id);
  if (!exercise) {
    throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);
  }

  await Exercise.findByIdAndDelete(id);
  sendResponse(res, HTTP_STATUS.OK, 'Exercise deleted successfully', { deletedId: id });
});

export default {
  getAllExercises,
  getExerciseById,
  getExercisesByLesson,
  createExercise,
  updateExercise,
  deleteExercise,
};
