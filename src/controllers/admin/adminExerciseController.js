import mongoose from 'mongoose';
import Exercise from '../../models/Exercise.js';
import Lesson from '../../models/Lesson.js';
import Vocabulary from '../../models/Vocabulary.js';
import Grammar from '../../models/Grammar.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import {
  validateObjectId,
  validateExerciseType,
  validateReorderItems,
} from '../../validators/adminContentValidator.js';

export const getAdminExercises = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.lesson_id && mongoose.isValidObjectId(req.query.lesson_id)) {
    filter.lesson_id = req.query.lesson_id;
  }
  const exercises = await Exercise.find(filter)
    .populate('lesson_id', 'title slug')
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Exercises fetched successfully', { exercises, count: exercises.length });
});

export const getAdminExerciseById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Exercise ID');
  const exercise = await Exercise.findById(req.params.id)
    .populate('lesson_id', 'title slug')
    .populate('vocabulary_id')
    .populate('grammar_id');

  if (!exercise) throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Exercise fetched successfully', { exercise });
});

export const createAdminExercise = asyncHandler(async (req, res) => {
  const { lesson_id, type, order, content, answer, vocabulary_id, grammar_id, xp } = req.body;

  if (!lesson_id || !mongoose.isValidObjectId(lesson_id)) {
    throw new AppError('Valid lesson_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  validateExerciseType(type);

  if (!content || typeof content !== 'object') {
    throw new AppError('Exercise content must be an object', HTTP_STATUS.BAD_REQUEST);
  }

  if (!answer || typeof answer !== 'object') {
    throw new AppError('Exercise answer must be an object', HTTP_STATUS.BAD_REQUEST);
  }

  const lessonExists = await Lesson.findById(lesson_id);
  if (!lessonExists) {
    throw new AppError('Referenced Lesson not found', HTTP_STATUS.NOT_FOUND);
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

  const populated = await Exercise.findById(exercise._id).populate('vocabulary_id').populate('grammar_id');
  sendResponse(res, HTTP_STATUS.CREATED, 'Exercise created successfully', { exercise: populated });
});

export const updateAdminExercise = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Exercise ID');

  if (req.body.type) {
    validateExerciseType(req.body.type);
  }

  if (req.body.lesson_id) {
    validateObjectId(req.body.lesson_id, 'Lesson ID');
    const lessonExists = await Lesson.findById(req.body.lesson_id);
    if (!lessonExists) throw new AppError('Referenced Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('vocabulary_id').populate('grammar_id');

  if (!exercise) throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Exercise updated successfully', { exercise });
});

export const deleteAdminExercise = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Exercise ID');

  const exercise = await Exercise.findByIdAndDelete(req.params.id);
  if (!exercise) throw new AppError('Exercise not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Exercise deleted successfully', { deletedId: req.params.id });
});

export const reorderExercises = asyncHandler(async (req, res) => {
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Exercise.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Exercises reordered successfully', { items: req.body.items });
});

export default {
  getAdminExercises,
  getAdminExerciseById,
  createAdminExercise,
  updateAdminExercise,
  deleteAdminExercise,
  reorderExercises,
};
