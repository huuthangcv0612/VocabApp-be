import mongoose from 'mongoose';
import InteractiveActivity from '../models/InteractiveActivity.js';
import InteractiveLesson from '../models/InteractiveLesson.js';
import ClassMember from '../models/ClassMember.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ROLES } from '../utils/constants.js';
import {
  generateQuizFromVocabularies,
  maskQuizAnswersForStudent,
} from '../services/interactiveQuizService.js';

/**
 * Check whether a user is the teacher owner or student member of the lesson
 */
const verifyLessonAccess = async (lesson, user) => {
  const teacherId = (lesson.teacher_id._id || lesson.teacher_id).toString();
  const isTeacher = teacherId === user._id.toString();
  const isAdmin = user.role === ROLES.ADMIN;

  if (isTeacher || isAdmin) {
    return { isTeacher: true, isAdmin };
  }

  const classId = lesson.class_id?._id || lesson.class_id;
  const membership = await ClassMember.findOne({
    class_id: classId,
    user_id: user._id,
    status: 'active',
  });

  if (!membership) {
    throw new AppError('You are not authorized to access this activity', HTTP_STATUS.FORBIDDEN);
  }

  return { isTeacher: false, isAdmin: false };
};

/**
 * @desc    Create interactive activity
 * @route   POST /api/interactive-activities
 * @access  Private (Teacher owner of lesson / Admin)
 */
export const createInteractiveActivity = asyncHandler(async (req, res) => {
  const { interactive_lesson_id, lesson_id, type, order, config } = req.body;
  const targetLessonId = interactive_lesson_id || lesson_id;

  if (!targetLessonId || !mongoose.isValidObjectId(targetLessonId)) {
    throw new AppError('Valid interactive_lesson_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  const validTypes = ['flashcard', 'quiz', 'spin', 'matching', 'listening', 'speaking'];
  if (!type || !validTypes.includes(type)) {
    throw new AppError(
      `Activity type is invalid. Valid types: ${validTypes.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const lesson = await InteractiveLesson.findById(targetLessonId);
  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const lessonTeacherId = (lesson.teacher_id._id || lesson.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    lessonTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to add activities to this lesson', HTTP_STATUS.FORBIDDEN);
  }

  const activity = await InteractiveActivity.create({
    interactive_lesson_id: targetLessonId,
    type,
    order: typeof order === 'number' ? order : 1,
    config: config || {},
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Interactive activity created successfully',
    { activity }
  );
});

/**
 * @desc    Get all activities for a lesson
 * @route   GET /api/interactive-activities
 * @access  Private (Teacher, Admin, or Student member of class)
 */
export const getInteractiveActivities = asyncHandler(async (req, res) => {
  const targetLessonId = req.query.interactive_lesson_id || req.query.lesson_id;

  if (!targetLessonId || !mongoose.isValidObjectId(targetLessonId)) {
    throw new AppError('Valid lesson_id query parameter is required', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await InteractiveLesson.findById(targetLessonId);
  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  const { isTeacher } = await verifyLessonAccess(lesson, req.user);

  const activities = await InteractiveActivity.find({
    interactive_lesson_id: targetLessonId,
  }).sort({ order: 1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Activities fetched successfully',
    { activities, count: activities.length, isTeacher }
  );
});

/**
 * @desc    Get single interactive activity details (with vocabulary or questions payload)
 * @route   GET /api/interactive-activities/:id
 * @access  Private (Teacher, Admin, or Student member of class)
 */
export const getInteractiveActivityById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid activity ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const activity = await InteractiveActivity.findById(id).populate({
    path: 'interactive_lesson_id',
    populate: { path: 'vocabulary_ids' },
  });

  if (!activity) {
    throw new AppError('Interactive activity not found', HTTP_STATUS.NOT_FOUND);
  }

  const lesson = activity.interactive_lesson_id;
  const { isTeacher } = await verifyLessonAccess(lesson, req.user);

  const vocabularies = lesson.vocabulary_ids || [];
  let dynamicPayload = {};

  if (activity.type === 'flashcard') {
    let items = vocabularies;
    if (activity.config?.shuffle) {
      items = [...vocabularies].sort(() => Math.random() - 0.5);
    }
    dynamicPayload = {
      type: 'flashcard',
      items,
      count: items.length,
    };
  } else if (activity.type === 'quiz') {
    const rawQuestions = generateQuizFromVocabularies(vocabularies, activity.config);
    // Secure quiz answers: mask answers for students to prevent cheating
    const questions = isTeacher ? rawQuestions : maskQuizAnswersForStudent(rawQuestions);
    dynamicPayload = {
      type: 'quiz',
      questions,
      count: questions.length,
      time_limit: activity.config?.time_limit || 30,
    };
  } else if (activity.type === 'spin') {
    dynamicPayload = {
      type: 'spin',
      wheel_items: vocabularies.map((v) => ({
        id: v._id,
        word: v.word,
        article: v.article,
        meaning: v.meaning,
      })),
      allow_repeat: activity.config?.allow_repeat !== false,
      count: vocabularies.length,
    };
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Activity details fetched successfully',
    {
      activity,
      payload: dynamicPayload,
      isTeacher,
    }
  );
});

/**
 * @desc    Update interactive activity
 * @route   PUT /api/interactive-activities/:id
 * @access  Private (Teacher owner / Admin)
 */
export const updateInteractiveActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { order, config, type } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid activity ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const activity = await InteractiveActivity.findById(id).populate('interactive_lesson_id');
  if (!activity) {
    throw new AppError('Interactive activity not found', HTTP_STATUS.NOT_FOUND);
  }

  const lesson = activity.interactive_lesson_id;
  const lessonTeacherId = (lesson.teacher_id?._id || lesson.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    lessonTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to update this activity', HTTP_STATUS.FORBIDDEN);
  }

  if (order !== undefined) activity.order = order;
  if (config !== undefined) activity.config = { ...activity.config, ...config };
  if (type !== undefined) activity.type = type;

  await activity.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive activity updated successfully',
    { activity }
  );
});

/**
 * @desc    Delete interactive activity
 * @route   DELETE /api/interactive-activities/:id
 * @access  Private (Teacher owner / Admin)
 */
export const deleteInteractiveActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid activity ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const activity = await InteractiveActivity.findById(id).populate('interactive_lesson_id');
  if (!activity) {
    throw new AppError('Interactive activity not found', HTTP_STATUS.NOT_FOUND);
  }

  const lesson = activity.interactive_lesson_id;
  const deleteTeacherId = (lesson.teacher_id?._id || lesson.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    deleteTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to delete this activity', HTTP_STATUS.FORBIDDEN);
  }

  await InteractiveActivity.findByIdAndDelete(id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Interactive activity deleted successfully',
    { deletedId: id }
  );
});

export default {
  createInteractiveActivity,
  getInteractiveActivities,
  getInteractiveActivityById,
  updateInteractiveActivity,
  deleteInteractiveActivity,
};
