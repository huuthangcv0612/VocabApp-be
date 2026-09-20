import mongoose from 'mongoose';
import InteractiveLesson from '../models/InteractiveLesson.js';
import Class from '../models/Class.js';
import ClassMember from '../models/ClassMember.js';
import Vocabulary from '../models/Vocabulary.js';
import InteractiveActivity from '../models/InteractiveActivity.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ROLES, SUCCESS_MESSAGES } from '../utils/constants.js';

/**
 * @desc    Create interactive lesson
 * @route   POST /api/interactive-lessons
 * @access  Private (Teacher owner of class / Admin)
 */
export const createInteractiveLesson = asyncHandler(async (req, res) => {
  const { class_id, title, description, level_id, vocabulary_ids, status } = req.body;

  if (!class_id || !mongoose.isValidObjectId(class_id)) {
    throw new AppError('Valid class_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!title || !title.trim()) {
    throw new AppError('Title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(class_id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const teacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    teacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to create lessons for this class', HTTP_STATUS.FORBIDDEN);
  }

  // Validate vocabulary_ids if provided
  let cleanVocabIds = [];
  if (Array.isArray(vocabulary_ids)) {
    for (const vid of vocabulary_ids) {
      if (mongoose.isValidObjectId(vid)) {
        cleanVocabIds.push(vid);
      }
    }
    // Deduplicate IDs
    cleanVocabIds = Array.from(new Set(cleanVocabIds.map(String))).map((id) => new mongoose.Types.ObjectId(id));
  }

  const lesson = await InteractiveLesson.create({
    class_id,
    teacher_id: req.user._id,
    title: title.trim(),
    description: (description || '').trim(),
    level_id: level_id && mongoose.isValidObjectId(level_id) ? level_id : null,
    vocabulary_ids: cleanVocabIds,
    status: status === 'published' ? 'published' : 'draft',
  });

  const populatedLesson = await InteractiveLesson.findById(lesson._id)
    .populate('class_id', 'name class_code status')
    .populate('vocabulary_ids', 'word article meaning difficultyLevel level example')
    .populate('level_id', 'level_name description');

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Interactive lesson created successfully',
    { lesson: populatedLesson }
  );
});

/**
 * @desc    Get interactive lessons (with optional class_id filter)
 * @route   GET /api/interactive-lessons
 * @access  Private (Teacher / Admin / Student of the class)
 */
export const getInteractiveLessons = asyncHandler(async (req, res) => {
  const { class_id, status } = req.query;

  const filter = {};

  if (class_id) {
    if (!mongoose.isValidObjectId(class_id)) {
      throw new AppError('Invalid class_id format', HTTP_STATUS.BAD_REQUEST);
    }

    const targetClass = await Class.findById(class_id);
    if (!targetClass) {
      throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
    }

    const targetClassTeacherId = (targetClass.teacher_id._id || targetClass.teacher_id).toString();
    const isTeacher = targetClassTeacherId === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;

    if (!isTeacher && !isAdmin) {
      // Student must be an active member of this class
      const membership = await ClassMember.findOne({
        class_id,
        user_id: req.user._id,
        status: 'active',
      });

      if (!membership) {
        throw new AppError('You are not a member of this class', HTTP_STATUS.FORBIDDEN);
      }

      // Students can only see published lessons
      filter.status = 'published';
    } else if (status) {
      filter.status = status;
    }

    filter.class_id = class_id;
  } else {
    // If no class_id provided: return lessons taught by the current teacher (or all for admin)
    if (req.user.role !== ROLES.ADMIN) {
      filter.teacher_id = req.user._id;
    }
    if (status) {
      filter.status = status;
    }
  }

  const lessons = await InteractiveLesson.find(filter)
    .populate('class_id', 'name class_code status')
    .populate('vocabulary_ids', 'word article meaning difficultyLevel level')
    .populate('level_id', 'level_name')
    .sort({ createdAt: -1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive lessons fetched successfully',
    { lessons, count: lessons.length }
  );
});

/**
 * @desc    Get interactive lesson by ID
 * @route   GET /api/interactive-lessons/:id
 * @access  Private (Teacher owner, Admin, or Student member of the class)
 */
export const getInteractiveLessonById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid lesson ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await InteractiveLesson.findById(id)
    .populate('class_id', 'name class_code teacher_id status')
    .populate('vocabulary_ids')
    .populate('level_id', 'level_name description');

  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const lessonTeacherId = (lesson.teacher_id._id || lesson.teacher_id).toString();
  const isTeacher = lessonTeacherId === req.user._id.toString();
  const isAdmin = req.user.role === ROLES.ADMIN;

  if (!isTeacher && !isAdmin) {
    const classId = lesson.class_id?._id || lesson.class_id;
    const membership = await ClassMember.findOne({
      class_id: classId,
      user_id: req.user._id,
      status: 'active',
    });

    if (!membership) {
      throw new AppError('You are not authorized to view this lesson', HTTP_STATUS.FORBIDDEN);
    }

    if (lesson.status !== 'published') {
      throw new AppError('Lesson is not published yet', HTTP_STATUS.FORBIDDEN);
    }
  }

  const activities = await InteractiveActivity.find({
    interactive_lesson_id: id,
  }).sort({ order: 1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive lesson fetched successfully',
    {
      lesson,
      activities,
      isTeacher: isTeacher || isAdmin,
    }
  );
});

/**
 * @desc    Update interactive lesson
 * @route   PUT /api/interactive-lessons/:id
 * @access  Private (Teacher owner / Admin)
 */
export const updateInteractiveLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, level_id, vocabulary_ids, status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid lesson ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await InteractiveLesson.findById(id);
  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const updateTeacherId = (lesson.teacher_id._id || lesson.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    updateTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to update this lesson', HTTP_STATUS.FORBIDDEN);
  }

  if (title !== undefined) lesson.title = title.trim();
  if (description !== undefined) lesson.description = description.trim();
  if (level_id !== undefined) {
    lesson.level_id = level_id && mongoose.isValidObjectId(level_id) ? level_id : null;
  }
  if (status !== undefined && ['draft', 'published'].includes(status)) {
    lesson.status = status;
  }

  if (Array.isArray(vocabulary_ids)) {
    const cleanVocabIds = [];
    for (const vid of vocabulary_ids) {
      if (mongoose.isValidObjectId(vid)) {
        cleanVocabIds.push(vid);
      }
    }
    lesson.vocabulary_ids = Array.from(new Set(cleanVocabIds.map(String))).map(
      (vid) => new mongoose.Types.ObjectId(vid)
    );
  }

  await lesson.save();

  const updatedLesson = await InteractiveLesson.findById(id)
    .populate('class_id', 'name class_code status')
    .populate('vocabulary_ids')
    .populate('level_id', 'level_name description');

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive lesson updated successfully',
    { lesson: updatedLesson }
  );
});

/**
 * @desc    Delete interactive lesson
 * @route   DELETE /api/interactive-lessons/:id
 * @access  Private (Teacher owner / Admin)
 */
export const deleteInteractiveLesson = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid lesson ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await InteractiveLesson.findById(id);
  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const deleteTeacherId = (lesson.teacher_id._id || lesson.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    deleteTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to delete this lesson', HTTP_STATUS.FORBIDDEN);
  }

  await InteractiveLesson.findByIdAndDelete(id);
  await InteractiveActivity.deleteMany({ interactive_lesson_id: id });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive lesson deleted successfully',
    { deletedId: id }
  );
});

export default {
  createInteractiveLesson,
  getInteractiveLessons,
  getInteractiveLessonById,
  updateInteractiveLesson,
  deleteInteractiveLesson,
};
