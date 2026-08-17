import mongoose from 'mongoose';
import Lesson from '../../models/Lesson.js';
import Unit from '../../models/Unit.js';
import Exercise from '../../models/Exercise.js';
import LessonVocabulary from '../../models/LessonVocabulary.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import { validateObjectId, validateReorderItems } from '../../validators/adminContentValidator.js';

const generateSlug = (text) => text.trim().toLowerCase().replace(/\s+/g, '-');

export const getAdminLessons = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.unit_id && mongoose.isValidObjectId(req.query.unit_id)) {
    filter.unit_id = req.query.unit_id;
  }
  const lessons = await Lesson.find(filter)
    .populate({
      path: 'unit_id',
      select: 'title slug topic_id',
      populate: { path: 'topic_id', select: 'name topic_name slug' },
    })
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lessons fetched successfully', { lessons, count: lessons.length });
});

export const getAdminLessonById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Lesson ID');
  const lesson = await Lesson.findById(req.params.id).populate({
    path: 'unit_id',
    select: 'title slug topic_id',
    populate: { path: 'topic_id', select: 'name topic_name slug' },
  });
  if (!lesson) throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Lesson fetched successfully', { lesson });
});

export const getAdminLessonDetail = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Lesson ID');

  const lesson = await Lesson.findById(req.params.id).populate({
    path: 'unit_id',
    select: 'title slug topic_id order',
    populate: { path: 'topic_id', select: 'name topic_name slug' },
  });

  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  // Preview vocabularies sorted by order
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

  // Exercises sorted by order (Includes answer for Admin)
  const exercises = await Exercise.find({ lesson_id: lesson._id })
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lesson detail fetched successfully', {
    lesson,
    preview: {
      vocabularies,
    },
    exercises,
  });
});

export const createAdminLesson = asyncHandler(async (req, res) => {
  const { unit_id, title, slug, description, order, status, estimated_minutes, xp } = req.body;

  if (!unit_id || !mongoose.isValidObjectId(unit_id)) {
    throw new AppError('Valid unit_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!title || !title.trim()) {
    throw new AppError('Lesson title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const unitExists = await Unit.findById(unit_id);
  if (!unitExists) {
    throw new AppError('Referenced Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  const actualSlug = slug ? slug.trim().toLowerCase() : generateSlug(title);
  const existingSlug = await Lesson.findOne({ unit_id, slug: actualSlug });
  if (existingSlug) {
    throw new AppError('Lesson slug already exists for this unit', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await Lesson.create({
    unit_id,
    title: title.trim(),
    slug: actualSlug,
    description: description ? description.trim() : '',
    order: order || 1,
    status: status || 'published',
    estimated_minutes: estimated_minutes || 5,
    xp: xp || 20,
  });

  const populatedLesson = await Lesson.findById(lesson._id).populate('unit_id', 'title slug');
  sendResponse(res, HTTP_STATUS.CREATED, 'Lesson created successfully', { lesson: populatedLesson });
});

export const updateAdminLesson = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Lesson ID');

  if (req.body.unit_id) {
    validateObjectId(req.body.unit_id, 'Unit ID');
    const unitExists = await Unit.findById(req.body.unit_id);
    if (!unitExists) throw new AppError('Referenced Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  const currentLesson = await Lesson.findById(req.params.id);
  if (!currentLesson) throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);

  if (req.body.slug) {
    const unitIdToCheck = req.body.unit_id || currentLesson.unit_id;
    const existingSlug = await Lesson.findOne({
      unit_id: unitIdToCheck,
      slug: req.body.slug.trim().toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingSlug) {
      throw new AppError('Lesson slug already exists for this unit', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('unit_id', 'title slug');

  sendResponse(res, HTTP_STATUS.OK, 'Lesson updated successfully', { lesson });
});

export const deleteAdminLesson = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Lesson ID');

  const [exerciseCount, vocabCount] = await Promise.all([
    Exercise.countDocuments({ lesson_id: req.params.id }),
    LessonVocabulary.countDocuments({ lesson_id: req.params.id }),
  ]);

  if (exerciseCount > 0 || vocabCount > 0) {
    throw new AppError('Cannot delete lesson because it contains exercises or vocabularies.', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (!lesson) throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Lesson deleted successfully', { deletedId: req.params.id });
});

export const reorderLessons = asyncHandler(async (req, res) => {
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Lesson.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Lessons reordered successfully', { items: req.body.items });
});

export default {
  getAdminLessons,
  getAdminLessonById,
  getAdminLessonDetail,
  createAdminLesson,
  updateAdminLesson,
  deleteAdminLesson,
  reorderLessons,
};
