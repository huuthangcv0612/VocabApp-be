import mongoose from 'mongoose';
import Lesson from '../models/Lesson.js';
import Unit from '../models/Unit.js';
import Exercise from '../models/Exercise.js';
import LessonVocabulary from '../models/LessonVocabulary.js';
import Vocabulary from '../models/Vocabulary.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get all lessons
 * @route   GET /api/lessons
 * @access  Public
 */
export const getAllLessons = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.unit_id || req.query.unitId) {
    const unitId = req.query.unit_id || req.query.unitId;
    if (mongoose.isValidObjectId(unitId)) {
      filter.unit_id = unitId;
    }
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const lessons = await Lesson.find(filter)
    .populate({
      path: 'unit_id',
      select: 'title slug topic_id order',
      populate: { path: 'topic_id', select: 'name topic_name slug' },
    })
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lessons fetched successfully', {
    lessons,
    count: lessons.length,
    data: lessons,
  });
});

/**
 * @desc    Get lesson by ID or slug with preview vocabularies & exercises
 * @route   GET /api/lessons/:id
 * @access  Public
 */
export const getLessonById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let lesson = null;

  if (mongoose.isValidObjectId(id)) {
    lesson = await Lesson.findById(id).populate({
      path: 'unit_id',
      select: 'title slug topic_id order',
      populate: { path: 'topic_id', select: 'name topic_name slug' },
    });
  }

  if (!lesson) {
    lesson = await Lesson.findOne({ slug: id }).populate({
      path: 'unit_id',
      select: 'title slug topic_id order',
      populate: { path: 'topic_id', select: 'name topic_name slug' },
    });
  }

  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  // 1. Fetch preview vocabularies attached to this lesson
  const lessonVocabs = await LessonVocabulary.find({ lesson_id: lesson._id })
    .populate('vocabulary_id')
    .sort({ order: 1 });

  const vocabularies = lessonVocabs
    .filter((lv) => lv.vocabulary_id)
    .map((lv) => {
      const vObj = lv.vocabulary_id.toObject();
      return {
        ...vObj,
        order: lv.order,
        is_new: lv.is_new,
      };
    });

  // 2. Fetch exercises attached to this lesson (STRIP ANSWER OBJECT FOR PUBLIC SECURITY)
  const exercisesRaw = await Exercise.find({ lesson_id: lesson._id })
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  const exercises = exercisesRaw.map((ex) => {
    const exObj = ex.toObject();
    delete exObj.answer; // DO NOT EXPOSE ANSWER TO FRONTEND LEARNERS
    return exObj;
  });

  sendResponse(res, HTTP_STATUS.OK, 'Lesson fetched successfully', {
    lesson,
    preview: {
      vocabularies,
    },
    exercises,
  });
});

/**
 * @desc    Get lessons by Unit ID
 * @route   GET /api/units/:unitId/lessons
 * @access  Public
 */
export const getLessonsByUnit = asyncHandler(async (req, res) => {
  const { unitId } = req.params;

  let unitDoc = null;
  if (mongoose.isValidObjectId(unitId)) {
    unitDoc = await Unit.findById(unitId);
  } else {
    unitDoc = await Unit.findOne({ slug: unitId });
  }

  const searchUnitId = unitDoc ? unitDoc._id : unitId;

  if (!mongoose.isValidObjectId(searchUnitId)) {
    throw new AppError('Invalid Unit ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lessons = await Lesson.find({ unit_id: searchUnitId }).sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lessons fetched successfully', {
    lessons,
    count: lessons.length,
    data: lessons,
  });
});

/**
 * @desc    Create lesson (Admin)
 * @route   POST /api/lessons
 * @access  Private/Admin
 */
export const createLesson = asyncHandler(async (req, res) => {
  const { unit_id, title, slug, description, order, status, estimated_minutes, xp } = req.body;

  if (!unit_id || !mongoose.isValidObjectId(unit_id)) {
    throw new AppError('Valid unit_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!title || !title.trim()) {
    throw new AppError('Lesson title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const unitExists = await Unit.findById(unit_id);
  if (!unitExists) {
    throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  const lesson = await Lesson.create({
    unit_id,
    title: title.trim(),
    slug: slug ? slug.trim().toLowerCase() : title.trim().toLowerCase().replace(/\s+/g, '-'),
    description: description ? description.trim() : '',
    order: order || 1,
    status: status || 'published',
    estimated_minutes: estimated_minutes || 5,
    xp: xp || 20,
  });

  const populatedLesson = await Lesson.findById(lesson._id).populate('unit_id', 'title slug');

  sendResponse(res, HTTP_STATUS.CREATED, 'Lesson created successfully', {
    lesson: populatedLesson,
  });
});

/**
 * @desc    Update lesson (Admin)
 * @route   PUT /api/lessons/:id
 * @access  Private/Admin
 */
export const updateLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  const updateData = { ...req.body };

  const lesson = await Lesson.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('unit_id', 'title slug');

  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Lesson updated successfully', { lesson });
});

/**
 * @desc    Delete lesson (Admin)
 * @route   DELETE /api/lessons/:id
 * @access  Private/Admin
 */
export const deleteLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await Lesson.findById(id);
  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  await Lesson.findByIdAndDelete(id);
  await LessonVocabulary.deleteMany({ lesson_id: id });
  await Exercise.deleteMany({ lesson_id: id });

  sendResponse(res, HTTP_STATUS.OK, 'Lesson deleted successfully', { deletedId: id });
});

/**
 * @desc    Add vocabulary to lesson (Admin)
 * @route   POST /api/lessons/:id/vocabularies
 * @access  Private/Admin
 */
export const addVocabularyToLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vocabulary_id, order, is_new } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  if (!vocabulary_id || !mongoose.isValidObjectId(vocabulary_id)) {
    throw new AppError('Valid vocabulary_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  const [lessonExists, vocabExists] = await Promise.all([
    Lesson.findById(id),
    Vocabulary.findById(vocabulary_id),
  ]);

  if (!lessonExists) throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  if (!vocabExists) throw new AppError('Vocabulary not found', HTTP_STATUS.NOT_FOUND);

  const lessonVocab = await LessonVocabulary.findOneAndUpdate(
    { lesson_id: id, vocabulary_id },
    {
      order: order !== undefined ? order : 1,
      is_new: is_new !== undefined ? Boolean(is_new) : true,
    },
    { upsert: true, new: true, runValidators: true }
  ).populate('vocabulary_id');

  sendResponse(res, HTTP_STATUS.CREATED, 'Vocabulary added to lesson successfully', {
    lessonVocabulary: lessonVocab,
  });
});

/**
 * @desc    Remove vocabulary from lesson (Admin)
 * @route   DELETE /api/lessons/:id/vocabularies/:vocabularyId
 * @access  Private/Admin
 */
export const removeVocabularyFromLesson = asyncHandler(async (req, res) => {
  const { id, vocabularyId } = req.params;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(vocabularyId)) {
    throw new AppError('Invalid Lesson ID or Vocabulary ID', HTTP_STATUS.BAD_REQUEST);
  }

  await LessonVocabulary.findOneAndDelete({
    lesson_id: id,
    vocabulary_id: vocabularyId,
  });

  sendResponse(res, HTTP_STATUS.OK, 'Vocabulary removed from lesson successfully', {
    lesson_id: id,
    vocabulary_id: vocabularyId,
  });
});

export default {
  getAllLessons,
  getLessonById,
  getLessonsByUnit,
  createLesson,
  updateLesson,
  deleteLesson,
  addVocabularyToLesson,
  removeVocabularyFromLesson,
};
