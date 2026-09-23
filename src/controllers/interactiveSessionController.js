import mongoose from 'mongoose';
import InteractiveSession from '../models/InteractiveSession.js';
import InteractiveLesson from '../models/InteractiveLesson.js';
import InteractiveActivity from '../models/InteractiveActivity.js';
import Class from '../models/Class.js';
import ClassMember from '../models/ClassMember.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ROLES } from '../utils/constants.js';
import { emitSessionEvent } from '../realtime/socketHandler.js';
import { getOnlineStudents } from '../realtime/sessionPresence.js';
import { evaluateQuizAnswer } from '../services/interactiveQuizService.js';

/**
 * Verify user access to interactive session
 */
const verifySessionAccess = async (session, user) => {
  const teacherId = (session.teacher_id?._id || session.teacher_id).toString();
  const isTeacher = teacherId === user._id.toString();
  const isAdmin = user.role === ROLES.ADMIN;

  if (isTeacher || isAdmin) {
    return { isTeacher: true, isAdmin };
  }

  const classId = session.class_id?._id || session.class_id;
  const membership = await ClassMember.findOne({
    class_id: classId,
    user_id: user._id,
    status: 'active',
  });

  if (!membership) {
    throw new AppError('You are not authorized to access this live session', HTTP_STATUS.FORBIDDEN);
  }

  return { isTeacher: false, isAdmin: false };
};

/**
 * @desc    Start / create interactive live session
 * @route   POST /api/interactive-sessions
 * @access  Private (Teacher owner of class / Admin)
 */
export const startInteractiveSession = asyncHandler(async (req, res) => {
  const { class_id, interactive_lesson_id, lesson_id, activity_id } = req.body;
  const targetLessonId = interactive_lesson_id || lesson_id;

  if (!class_id || !mongoose.isValidObjectId(class_id)) {
    throw new AppError('Valid class_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!targetLessonId || !mongoose.isValidObjectId(targetLessonId)) {
    throw new AppError('Valid interactive_lesson_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  const targetClass = await Class.findById(class_id);
  if (!targetClass) {
    throw new AppError('Class not found', HTTP_STATUS.NOT_FOUND);
  }

  const classTeacherId = (targetClass.teacher_id?._id || targetClass.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    classTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to start a session for this class', HTTP_STATUS.FORBIDDEN);
  }

  const lesson = await InteractiveLesson.findById(targetLessonId);
  if (!lesson) {
    throw new AppError('Interactive lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  let finalActivityId = null;
  if (activity_id && mongoose.isValidObjectId(activity_id)) {
    finalActivityId = activity_id;
  } else {
    // Pick the first activity of the lesson by default if available
    const firstActivity = await InteractiveActivity.findOne({
      interactive_lesson_id: targetLessonId,
    }).sort({ order: 1 });
    if (firstActivity) {
      finalActivityId = firstActivity._id;
    }
  }

  const session = await InteractiveSession.create({
    class_id,
    interactive_lesson_id: targetLessonId,
    teacher_id: req.user._id,
    activity_id: finalActivityId,
    status: 'active',
    started_at: new Date(),
    responses: [],
  });

  const populatedSession = await InteractiveSession.findById(session._id)
    .populate('class_id', 'name class_code')
    .populate({
      path: 'interactive_lesson_id',
      populate: { path: 'vocabulary_ids' },
    })
    .populate('activity_id');

  emitSessionEvent(session._id.toString(), 'session:started', {
    session_id: session._id,
    class_id,
    lesson_title: lesson.title,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Live session started successfully',
    { session: populatedSession }
  );
});

/**
 * @desc    Get live session status and details
 * @route   GET /api/interactive-sessions/:id
 * @access  Private (Teacher, Admin, or Student member of class)
 */
export const getInteractiveSessionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid session ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id)
    .populate('class_id', 'name class_code status')
    .populate({
      path: 'interactive_lesson_id',
      populate: { path: 'vocabulary_ids' },
    })
    .populate('activity_id')
    .populate('responses.user_id', 'name username avatar');

  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  const { isTeacher } = await verifySessionAccess(session, req.user);

  let responseData = session.toObject();

  if (!isTeacher) {
    // Filter responses to only include current student's own responses
    responseData.responses = responseData.responses.filter(
      (r) => r.user_id?._id?.toString() === req.user._id.toString()
    );

    // If current_item contains a quiz question with correct_answer, mask it
    if (responseData.current_item && responseData.current_item.correct_answer) {
      delete responseData.current_item.correct_answer;
      delete responseData.current_item.explanation;
      if (Array.isArray(responseData.current_item.options)) {
        responseData.current_item.options = responseData.current_item.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
        }));
      }
    }
  }

  const onlineStudents = getOnlineStudents(id.toString());
  responseData.connected_students = onlineStudents;
  responseData.connected_students_count = onlineStudents.length;

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Live session fetched successfully',
    {
      session: responseData,
      connected_students: onlineStudents,
      connected_students_count: onlineStudents.length,
      isTeacher,
    }
  );
});

/**
 * @desc    Switch active activity during live session
 * @route   PUT /api/interactive-sessions/:id/activity
 * @access  Private (Teacher owner / Admin)
 */
export const setSessionActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { activity_id } = req.body;

  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(activity_id)) {
    throw new AppError('Valid session ID and activity_id are required', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id);
  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  const activityTeacherId = (session.teacher_id?._id || session.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    activityTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to manage this session', HTTP_STATUS.FORBIDDEN);
  }

  const activity = await InteractiveActivity.findById(activity_id);
  if (!activity) {
    throw new AppError('Activity not found', HTTP_STATUS.NOT_FOUND);
  }

  session.activity_id = activity_id;
  session.current_item = null;
  await session.save();

  emitSessionEvent(session._id.toString(), 'activity:started', {
    activity_id,
    type: activity.type,
    config: activity.config,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Session activity updated successfully',
    { session, activity }
  );
});

/**
 * @desc    Move to next item in live session
 * @route   PUT /api/interactive-sessions/:id/next
 * @access  Private (Teacher owner / Admin)
 */
export const nextSessionItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { current_item } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid session ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id);
  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  const nextTeacherId = (session.teacher_id?._id || session.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    nextTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to manage this session', HTTP_STATUS.FORBIDDEN);
  }

  session.current_item = current_item || null;
  await session.save();

  // Broadcast sanitized version to students
  const sanitizedItem = { ...current_item };
  if (sanitizedItem.correct_answer) {
    delete sanitizedItem.correct_answer;
    delete sanitizedItem.explanation;
    if (Array.isArray(sanitizedItem.options)) {
      sanitizedItem.options = sanitizedItem.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
      }));
    }
  }

  emitSessionEvent(session._id.toString(), 'session:next-item', {
    current_item: sanitizedItem,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Session item advanced successfully',
    { session }
  );
});

/**
 * @desc    Spin wheel and select vocabulary
 * @route   POST /api/interactive-sessions/:id/spin
 * @access  Private (Teacher owner / Admin)
 */
export const spinSessionWheel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid session ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id).populate({
    path: 'interactive_lesson_id',
    populate: { path: 'vocabulary_ids' },
  });

  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  const spinTeacherId = (session.teacher_id?._id || session.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    spinTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to manage this session', HTTP_STATUS.FORBIDDEN);
  }

  const vocabularies = session.interactive_lesson_id?.vocabulary_ids || [];
  if (vocabularies.length === 0) {
    throw new AppError('Lesson has no vocabulary to spin', HTTP_STATUS.BAD_REQUEST);
  }

  const randomIndex = Math.floor(Math.random() * vocabularies.length);
  const selectedVocab = vocabularies[randomIndex];

  const spinResult = {
    vocabulary_id: selectedVocab._id,
    word: selectedVocab.word,
    article: selectedVocab.article,
    meaning: selectedVocab.meaning,
    example: selectedVocab.example,
    selected_at: new Date(),
  };

  session.current_item = spinResult;
  await session.save();

  emitSessionEvent(session._id.toString(), 'session:spun', {
    selected_item: spinResult,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Spin completed successfully',
    { selected_item: spinResult }
  );
});

/**
 * @desc    Student submits response during live session
 * @route   POST /api/interactive-sessions/:id/response
 * @access  Private (Student member of class)
 */
export const submitSessionResponse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { item_id, activity_type, answer } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid session ID format', HTTP_STATUS.BAD_REQUEST);
  }

  if (answer === undefined || answer === null || String(answer).trim() === '') {
    throw new AppError('Answer is required', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id);
  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  if (session.status !== 'active') {
    throw new AppError('Session is not active', HTTP_STATUS.BAD_REQUEST);
  }

  // Check student membership
  const responseClassId = session.class_id?._id || session.class_id;
  const membership = await ClassMember.findOne({
    class_id: responseClassId,
    user_id: req.user._id,
    status: 'active',
  });

  if (!membership && req.user.role !== ROLES.ADMIN) {
    throw new AppError('You are not a member of this class', HTTP_STATUS.FORBIDDEN);
  }

  let isCorrect = null;

  // Grade answer if current item is a quiz question
  if (session.current_item && session.current_item.correct_answer) {
    const evaluation = evaluateQuizAnswer(session.current_item, answer);
    isCorrect = evaluation.isCorrect;
  }

  const newResponse = {
    user_id: req.user._id,
    activity_type: activity_type || 'activity',
    item_id: item_id || session.current_item?.id || null,
    answer,
    is_correct: isCorrect,
    submitted_at: new Date(),
  };

  session.responses.push(newResponse);
  await session.save();

  // Broadcast to teacher's live dashboard
  emitSessionEvent(session._id.toString(), 'student:answered', {
    user_id: req.user._id,
    name: req.user.name,
    avatar: req.user.avatar,
    item_id: newResponse.item_id,
    answer,
    is_correct: isCorrect,
    submitted_at: newResponse.submitted_at,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Response submitted successfully',
    { response: newResponse }
  );
});

/**
 * @desc    End interactive live session
 * @route   PUT /api/interactive-sessions/:id/end
 * @access  Private (Teacher owner / Admin)
 */
export const endInteractiveSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid session ID format', HTTP_STATUS.BAD_REQUEST);
  }

  const session = await InteractiveSession.findById(id);
  if (!session) {
    throw new AppError('Interactive session not found', HTTP_STATUS.NOT_FOUND);
  }

  const endTeacherId = (session.teacher_id?._id || session.teacher_id).toString();
  if (
    req.user.role !== ROLES.ADMIN &&
    endTeacherId !== req.user._id.toString()
  ) {
    throw new AppError('You are not authorized to end this session', HTTP_STATUS.FORBIDDEN);
  }

  session.status = 'ended';
  session.ended_at = new Date();
  await session.save();

  emitSessionEvent(session._id.toString(), 'session:ended', {
    session_id: id,
    ended_at: session.ended_at,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Live session ended successfully',
    { session }
  );
});

export default {
  startInteractiveSession,
  getInteractiveSessionById,
  setSessionActivity,
  nextSessionItem,
  spinSessionWheel,
  submitSessionResponse,
  endInteractiveSession,
};
