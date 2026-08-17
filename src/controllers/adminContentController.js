import mongoose from 'mongoose';
import Level from '../models/Level.js';
import Topic from '../models/Topic.js';
import Unit from '../models/Unit.js';
import Lesson from '../models/Lesson.js';
import Exercise from '../models/Exercise.js';
import Vocabulary from '../models/Vocabulary.js';
import LessonVocabulary from '../models/LessonVocabulary.js';
import Grammar from '../models/Grammar.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import {
  validateObjectId,
  validateExerciseType,
  validateReorderItems,
} from '../validators/adminContentValidator.js';

// Helper function to generate slug if missing
const generateSlug = (text) => text.trim().toLowerCase().replace(/\s+/g, '-');

// ==================================================
// LEVEL CRUD
// ==================================================
export const getAdminLevels = asyncHandler(async (req, res) => {
  const levels = await Level.find().sort({ order: 1 });
  sendResponse(res, HTTP_STATUS.OK, 'Levels fetched successfully', { levels, count: levels.length });
});

export const getAdminLevelById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Level ID');
  const level = await Level.findById(req.params.id);
  if (!level) throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Level fetched successfully', { level });
});

export const createAdminLevel = asyncHandler(async (req, res) => {
  const { level_name, description, order } = req.body;
  if (!level_name || !level_name.trim()) {
    throw new AppError('Level name is required', HTTP_STATUS.BAD_REQUEST);
  }

  const existing = await Level.findOne({ level_name: level_name.trim() });
  if (existing) {
    throw new AppError('Level name already exists', HTTP_STATUS.BAD_REQUEST);
  }

  const level = await Level.create({
    level_name: level_name.trim(),
    description: description ? description.trim() : '',
    order: order || 1,
  });

  sendResponse(res, HTTP_STATUS.CREATED, 'Level created successfully', { level });
});

export const updateAdminLevel = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Level ID');
  const { level_name, description, order } = req.body;

  if (level_name) {
    const existing = await Level.findOne({
      level_name: level_name.trim(),
      _id: { $ne: req.params.id },
    });
    if (existing) {
      throw new AppError('Level name already exists', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const level = await Level.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!level) throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Level updated successfully', { level });
});

export const deleteAdminLevel = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Level ID');

  // Guard: Check if topic references this level
  const topicCount = await Topic.countDocuments({ level_id: req.params.id });
  if (topicCount > 0) {
    throw new AppError('Cannot delete level because it is referenced by topics.', HTTP_STATUS.BAD_REQUEST);
  }

  const level = await Level.findByIdAndDelete(req.params.id);
  if (!level) throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Level deleted successfully', { deletedId: req.params.id });
});

// ==================================================
// TOPIC CRUD & REORDER
// ==================================================
export const getAdminTopics = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.level_id && mongoose.isValidObjectId(req.query.level_id)) {
    filter.level_id = req.query.level_id;
  }
  const topics = await Topic.find(filter).populate('level_id', 'level_name').sort({ order: 1 });
  sendResponse(res, HTTP_STATUS.OK, 'Topics fetched successfully', { topics, count: topics.length });
});

export const getAdminTopicById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Topic ID');
  const topic = await Topic.findById(req.params.id).populate('level_id', 'level_name');
  if (!topic) throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Topic fetched successfully', { topic });
});

export const createAdminTopic = asyncHandler(async (req, res) => {
  const { name, topic_name, slug, description, image_url, icon, order, status, level_id } = req.body;
  const actualName = (name || topic_name || '').trim();

  if (!actualName) {
    throw new AppError('Topic name is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (level_id && mongoose.isValidObjectId(level_id)) {
    const levelExists = await Level.findById(level_id);
    if (!levelExists) throw new AppError('Referenced Level not found', HTTP_STATUS.NOT_FOUND);
  }

  const actualSlug = slug ? slug.trim().toLowerCase() : generateSlug(actualName);
  const existingSlug = await Topic.findOne({ slug: actualSlug });
  if (existingSlug) {
    throw new AppError('Topic slug already exists', HTTP_STATUS.BAD_REQUEST);
  }

  const topic = await Topic.create({
    level_id: level_id || null,
    name: actualName,
    topic_name: actualName,
    slug: actualSlug,
    description: description ? description.trim() : '',
    image_url: image_url || icon || null,
    icon: icon || image_url || null,
    order: order || 1,
    status: status || 'published',
  });

  sendResponse(res, HTTP_STATUS.CREATED, 'Topic created successfully', { topic });
});

export const updateAdminTopic = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Topic ID');

  if (req.body.slug) {
    const existingSlug = await Topic.findOne({
      slug: req.body.slug.trim().toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingSlug) {
      throw new AppError('Topic slug already exists', HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (req.body.level_id && mongoose.isValidObjectId(req.body.level_id)) {
    const levelExists = await Level.findById(req.body.level_id);
    if (!levelExists) throw new AppError('Referenced Level not found', HTTP_STATUS.NOT_FOUND);
  }

  const updateData = { ...req.body };
  if (req.body.name || req.body.topic_name) {
    const val = (req.body.name || req.body.topic_name).trim();
    updateData.name = val;
    updateData.topic_name = val;
  }

  const topic = await Topic.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!topic) throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Topic updated successfully', { topic });
});

export const deleteAdminTopic = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Topic ID');

  // Guard: Check if unit references this topic
  const unitCount = await Unit.countDocuments({ topic_id: req.params.id });
  if (unitCount > 0) {
    throw new AppError('Cannot delete topic because it contains units.', HTTP_STATUS.BAD_REQUEST);
  }

  const topic = await Topic.findByIdAndDelete(req.params.id);
  if (!topic) throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Topic deleted successfully', { deletedId: req.params.id });
});

export const reorderTopics = asyncHandler(async (req, res) => {
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Topic.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Topics reordered successfully', { items: req.body.items });
});

// ==================================================
// UNIT CRUD & REORDER
// ==================================================
export const getAdminUnits = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.topic_id && mongoose.isValidObjectId(req.query.topic_id)) {
    filter.topic_id = req.query.topic_id;
  }
  const units = await Unit.find(filter).populate('topic_id', 'name topic_name slug').sort({ order: 1 });
  sendResponse(res, HTTP_STATUS.OK, 'Units fetched successfully', { units, count: units.length });
});

export const getAdminUnitById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');
  const unit = await Unit.findById(req.params.id).populate('topic_id', 'name topic_name slug');
  if (!unit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Unit fetched successfully', { unit });
});

export const createAdminUnit = asyncHandler(async (req, res) => {
  const { topic_id, title, unit_name, slug, description, order, status } = req.body;
  const actualTitle = (title || unit_name || '').trim();

  if (!topic_id || !mongoose.isValidObjectId(topic_id)) {
    throw new AppError('Valid topic_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!actualTitle) {
    throw new AppError('Unit title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const topicExists = await Topic.findById(topic_id);
  if (!topicExists) {
    throw new AppError('Referenced Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  const actualSlug = slug ? slug.trim().toLowerCase() : generateSlug(actualTitle);
  const existingSlug = await Unit.findOne({ topic_id, slug: actualSlug });
  if (existingSlug) {
    throw new AppError('Unit slug already exists for this topic', HTTP_STATUS.BAD_REQUEST);
  }

  const unit = await Unit.create({
    topic_id,
    title: actualTitle,
    slug: actualSlug,
    description: description ? description.trim() : '',
    order: order || 1,
    status: status || 'published',
  });

  const populatedUnit = await Unit.findById(unit._id).populate('topic_id', 'name topic_name slug');
  sendResponse(res, HTTP_STATUS.CREATED, 'Unit created successfully', { unit: populatedUnit });
});

export const updateAdminUnit = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');

  if (req.body.topic_id) {
    validateObjectId(req.body.topic_id, 'Topic ID');
    const topicExists = await Topic.findById(req.body.topic_id);
    if (!topicExists) throw new AppError('Referenced Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  const currentUnit = await Unit.findById(req.params.id);
  if (!currentUnit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);

  if (req.body.slug) {
    const topicIdToCheck = req.body.topic_id || currentUnit.topic_id;
    const existingSlug = await Unit.findOne({
      topic_id: topicIdToCheck,
      slug: req.body.slug.trim().toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingSlug) {
      throw new AppError('Unit slug already exists for this topic', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const updateData = { ...req.body };
  if (req.body.title || req.body.unit_name) {
    updateData.title = (req.body.title || req.body.unit_name).trim();
  }

  const unit = await Unit.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).populate('topic_id', 'name topic_name slug');

  sendResponse(res, HTTP_STATUS.OK, 'Unit updated successfully', { unit });
});

export const deleteAdminUnit = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');

  // Guard: Check if lesson references this unit
  const lessonCount = await Lesson.countDocuments({ unit_id: req.params.id });
  if (lessonCount > 0) {
    throw new AppError('Cannot delete unit because it contains lessons.', HTTP_STATUS.BAD_REQUEST);
  }

  const unit = await Unit.findByIdAndDelete(req.params.id);
  if (!unit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Unit deleted successfully', { deletedId: req.params.id });
});

export const reorderUnits = asyncHandler(async (req, res) => {
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Unit.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Units reordered successfully', { items: req.body.items });
});

// ==================================================
// LESSON CRUD, DETAIL & REORDER
// ==================================================
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

  // Exercises sorted by order
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

  // Guard: Check if exercises or lessonVocabularies reference this lesson
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

// ==================================================
// VOCABULARY CRUD
// ==================================================
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

  // Guard: Check if lessonVocabulary or exercise references this vocabulary
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

// ==================================================
// EXERCISE CRUD & REORDER
// ==================================================
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

// ==================================================
// LESSON VOCABULARY & REORDER
// ==================================================
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
