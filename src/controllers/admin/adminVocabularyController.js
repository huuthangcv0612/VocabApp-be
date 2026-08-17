import mongoose from 'mongoose';
import Vocabulary from '../../models/Vocabulary.js';
import LessonVocabulary from '../../models/LessonVocabulary.js';
import Lesson from '../../models/Lesson.js';
import Exercise from '../../models/Exercise.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import { validateObjectId, validateReorderItems } from '../../validators/adminContentValidator.js';

export const getAdminVocabularies = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.level) {
    filter.level = req.query.level;
  }
  const vocabularies = await Vocabulary.find(filter).sort({ createdAt: -1 });
  sendResponse(res, HTTP_STATUS.OK, 'Vocabularies fetched successfully', { vocabularies, count: vocabularies.length });
});

export const getAdminVocabularyById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Vocabulary ID');
  const vocabulary = await Vocabulary.findById(req.params.id);
  if (!vocabulary) throw new AppError('Vocabulary not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Vocabulary fetched successfully', { vocabulary });
});

export const createAdminVocabulary = asyncHandler(async (req, res) => {
  const { word, meaning, part_of_speech, type, example, example_translation, audio_url, image_url, level, tags } = req.body;

  if (!word || !word.trim()) throw new AppError('Word is required', HTTP_STATUS.BAD_REQUEST);
  if (!meaning || !meaning.trim()) throw new AppError('Meaning is required', HTTP_STATUS.BAD_REQUEST);

  const vocab = await Vocabulary.create({
    word: word.trim(),
    meaning: meaning.trim(),
    part_of_speech: part_of_speech || type || 'noun',
    type: part_of_speech || type || 'noun',
    example: example ? example.trim() : null,
    example_translation: example_translation ? example_translation.trim() : null,
    audio_url: audio_url || null,
    image_url: image_url || null,
    level: level || 'A1.1',
    tags: Array.isArray(tags) ? tags : [],
    createdBy: req.user ? req.user.id || req.user._id : null,
  });

  sendResponse(res, HTTP_STATUS.CREATED, 'Vocabulary created successfully', { vocabulary: vocab });
});

export const updateAdminVocabulary = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Vocabulary ID');

  const vocabulary = await Vocabulary.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!vocabulary) throw new AppError('Vocabulary not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Vocabulary updated successfully', { vocabulary });
});

export const deleteAdminVocabulary = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Vocabulary ID');

  const [lvCount, exCount] = await Promise.all([
    LessonVocabulary.countDocuments({ vocabulary_id: req.params.id }),
    Exercise.countDocuments({ vocabulary_id: req.params.id }),
  ]);

  if (lvCount > 0 || exCount > 0) {
    throw new AppError('Cannot delete vocabulary because it is being used by lessons or exercises.', HTTP_STATUS.BAD_REQUEST);
  }

  const vocabulary = await Vocabulary.findByIdAndDelete(req.params.id);
  if (!vocabulary) throw new AppError('Vocabulary not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Vocabulary deleted successfully', { deletedId: req.params.id });
});

// Lesson Vocabulary Attachment & Reorder
export const addAdminLessonVocabulary = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { vocabulary_id, order, is_new } = req.body;

  validateObjectId(lessonId, 'Lesson ID');
  if (!vocabulary_id || !mongoose.isValidObjectId(vocabulary_id)) {
    throw new AppError('Valid vocabulary_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  const [lessonExists, vocabExists] = await Promise.all([
    Lesson.findById(lessonId),
    Vocabulary.findById(vocabulary_id),
  ]);

  if (!lessonExists) throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  if (!vocabExists) throw new AppError('Vocabulary not found', HTTP_STATUS.NOT_FOUND);

  const lessonVocab = await LessonVocabulary.findOneAndUpdate(
    { lesson_id: lessonId, vocabulary_id },
    {
      order: order !== undefined ? order : 1,
      is_new: is_new !== undefined ? Boolean(is_new) : true,
    },
    { upsert: true, new: true, runValidators: true }
  ).populate('vocabulary_id');

  sendResponse(res, HTTP_STATUS.CREATED, 'Vocabulary attached to lesson successfully', { lessonVocabulary: lessonVocab });
});

export const removeAdminLessonVocabulary = asyncHandler(async (req, res) => {
  const { lessonId, vocabularyId } = req.params;
  validateObjectId(lessonId, 'Lesson ID');
  validateObjectId(vocabularyId, 'Vocabulary ID');

  await LessonVocabulary.findOneAndDelete({
    lesson_id: lessonId,
    vocabulary_id: vocabularyId,
  });

  sendResponse(res, HTTP_STATUS.OK, 'Vocabulary removed from lesson successfully', { lessonId, vocabularyId });
});

export const reorderAdminLessonVocabularies = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  validateObjectId(lessonId, 'Lesson ID');
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { lesson_id: lessonId, vocabulary_id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await LessonVocabulary.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Lesson vocabularies reordered successfully', { items: req.body.items });
});

export default {
  getAdminVocabularies,
  getAdminVocabularyById,
  createAdminVocabulary,
  updateAdminVocabulary,
  deleteAdminVocabulary,
  addAdminLessonVocabulary,
  removeAdminLessonVocabulary,
  reorderAdminLessonVocabularies,
};
