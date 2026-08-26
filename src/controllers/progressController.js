import mongoose from 'mongoose';
import UserLektionProgress from '../models/UserLektionProgress.js';
import UserLessonProgress from '../models/UserLessonProgress.js';
import UserExerciseProgress from '../models/UserExerciseProgress.js';
import UserVocabularyProgress from '../models/UserVocabularyProgress.js';
import Lektion from '../models/Lektion.js';
import Lesson from '../models/Lesson.js';
import Exercise from '../models/Exercise.js';
import Vocabulary from '../models/Vocabulary.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get overall user progress across curriculum
 * @route   GET /api/progress
 * @access  Private
 */
export const getUserProgressOverview = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const lessonProgresses = await UserLessonProgress.find({ user_id: userId })
    .populate({
      path: 'lesson_id',
      select: 'title level_id unit_id order xp estimated_minutes',
      populate: [
        { path: 'level_id', select: 'level_name order' },
        { path: 'unit_id', select: 'title topic_id order' },
      ],
    });

  const completedLessonsCount = await UserLessonProgress.countDocuments({
    user_id: userId,
    status: 'completed',
  });

  const totalLearnedWordsCount = await UserVocabularyProgress.countDocuments({
    user_id: userId,
    status: 'learned',
  });

  sendResponse(res, HTTP_STATUS.OK, 'User progress fetched successfully', {
    lessonProgresses,
    stats: {
      completedLessonsCount,
      totalLearnedWordsCount,
    },
  });
});

/**
 * @desc    Get tracking progress for a specific lesson
 * @route   GET /api/progress/lessons/:lessonId
 * @access  Private
 */
export const getLessonProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lessonId } = req.params;

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  let lessonProgress = await UserLessonProgress.findOne({
    user_id: userId,
    lesson_id: lessonId,
  });

  const exerciseProgresses = await UserExerciseProgress.find({
    user_id: userId,
    lesson_id: lessonId,
  }).populate('exercise_id');

  if (!lessonProgress) {
    lessonProgress = {
      user_id: userId,
      lesson_id: lessonId,
      status: 'not_started',
      progress: 0,
      xp_earned: 0,
      started_at: null,
      completed_at: null,
    };
  }

  sendResponse(res, HTTP_STATUS.OK, 'Lesson progress fetched successfully', {
    lessonProgress,
    exerciseProgresses,
  });
});

/**
 * @desc    Start learning a lesson
 * @route   POST /api/progress/lessons/:lessonId/start
 * @access  Private
 */
export const startLessonProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lessonId } = req.params;

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  let lessonProgress = await UserLessonProgress.findOne({
    user_id: userId,
    lesson_id: lessonId,
  });

  if (!lessonProgress) {
    lessonProgress = await UserLessonProgress.create({
      user_id: userId,
      lesson_id: lessonId,
      status: 'in_progress',
      progress: 0,
      started_at: new Date(),
    });
  }

  sendResponse(res, HTTP_STATUS.OK, 'Lesson learning started', {
    lessonProgress,
  });
});

/**
 * @desc    Submit an exercise answer and update lesson progress
 * @route   POST /api/progress/lessons/:lessonId/submit-exercise
 * @access  Private
 */
export const submitLessonExercise = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lessonId } = req.params;
  const { exercise_id, exerciseId, answer } = req.body;
  const targetExerciseId = exercise_id || exerciseId;

  if (!mongoose.isValidObjectId(lessonId) || !mongoose.isValidObjectId(targetExerciseId)) {
    throw new AppError('Invalid Lesson ID or Exercise ID', HTTP_STATUS.BAD_REQUEST);
  }

  const exercise = await Exercise.findOne({ _id: targetExerciseId, lesson_id: lessonId });
  if (!exercise) {
    throw new AppError('Exercise not found for this lesson', HTTP_STATUS.NOT_FOUND);
  }

  // Grade answer
  let isCorrect = false;
  const expectedAnswer = exercise.answer;
  if (expectedAnswer && typeof expectedAnswer === 'object') {
    if (expectedAnswer.value !== undefined) {
      if (typeof answer === 'string' && typeof expectedAnswer.value === 'string') {
        isCorrect = answer.trim().toLowerCase() === expectedAnswer.value.trim().toLowerCase();
      } else {
        isCorrect = JSON.stringify(answer) === JSON.stringify(expectedAnswer.value);
      }
    } else {
      isCorrect = JSON.stringify(answer) === JSON.stringify(expectedAnswer);
    }
  } else if (expectedAnswer !== undefined) {
    isCorrect = String(answer).trim().toLowerCase() === String(expectedAnswer).trim().toLowerCase();
  }

  const xpEarned = isCorrect ? exercise.xp || 2 : 0;

  // 1. Upsert UserExerciseProgress
  let exProgress = await UserExerciseProgress.findOne({
    user_id: userId,
    exercise_id: targetExerciseId,
  });

  if (!exProgress) {
    exProgress = await UserExerciseProgress.create({
      user_id: userId,
      exercise_id: targetExerciseId,
      lesson_id: lessonId,
      is_correct: isCorrect,
      attempts: 1,
    });
  } else {
    exProgress.is_correct = isCorrect;
    exProgress.attempts += 1;
    await exProgress.save();
  }

  // 2. Recalculate UserLessonProgress
  const totalExercises = await Exercise.countDocuments({ lesson_id: lessonId });
  const correctExercisesCount = await UserExerciseProgress.countDocuments({
    user_id: userId,
    lesson_id: lessonId,
    is_correct: true,
  });

  const percentage = totalExercises > 0 ? Math.min(100, Math.round((correctExercisesCount / totalExercises) * 100)) : 100;

  let lessonProgress = await UserLessonProgress.findOne({
    user_id: userId,
    lesson_id: lessonId,
  });

  if (!lessonProgress) {
    lessonProgress = new UserLessonProgress({
      user_id: userId,
      lesson_id: lessonId,
      status: percentage >= 100 ? 'completed' : 'in_progress',
      progress: percentage,
      xp_earned: isCorrect ? xpEarned : 0,
      started_at: new Date(),
      completed_at: percentage >= 100 ? new Date() : null,
    });
  } else {
    lessonProgress.progress = percentage;
    if (isCorrect) {
      lessonProgress.xp_earned += xpEarned;
    }
    if (percentage >= 100) {
      lessonProgress.status = 'completed';
      if (!lessonProgress.completed_at) {
        lessonProgress.completed_at = new Date();
      }
    } else {
      lessonProgress.status = 'in_progress';
    }
  }

  await lessonProgress.save();

  sendResponse(res, HTTP_STATUS.OK, 'Exercise answer evaluated and progress updated', {
    is_correct: isCorrect,
    xp_earned: xpEarned,
    exerciseProgress: exProgress,
    lessonProgress,
  });
});

/**
 * @desc    Mark a lesson as completed and fetch next lesson
 * @route   POST /api/progress/lessons/:lessonId/complete
 * @access  Private
 */
export const completeLessonProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lessonId } = req.params;

  if (!mongoose.isValidObjectId(lessonId)) {
    throw new AppError('Invalid Lesson ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new AppError('Lesson not found', HTTP_STATUS.NOT_FOUND);
  }

  let lessonProgress = await UserLessonProgress.findOne({
    user_id: userId,
    lesson_id: lessonId,
  });

  if (!lessonProgress) {
    lessonProgress = new UserLessonProgress({
      user_id: userId,
      lesson_id: lessonId,
    });
  }

  lessonProgress.status = 'completed';
  lessonProgress.progress = 100;
  if (!lessonProgress.started_at) lessonProgress.started_at = new Date();
  lessonProgress.completed_at = new Date();
  lessonProgress.xp_earned = lessonProgress.xp_earned || lesson.xp || 20;

  await lessonProgress.save();

  // Find next lesson in the same level
  const nextLesson = await Lesson.findOne({
    level_id: lesson.level_id,
    order: { $gt: lesson.order },
  }).sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lesson marked as completed', {
    lessonProgress,
    nextLesson: nextLesson
      ? { _id: nextLesson._id, title: nextLesson.title, order: nextLesson.order, level_id: nextLesson.level_id }
      : null,
  });
});

/**
 * @desc    Get progress for a specific lektion (Legacy compatibility)
 * @route   GET /api/progress/lektion/:lektionId
 * @access  Private
 */
export const getLektionProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lektionId } = req.params;

  if (!mongoose.isValidObjectId(lektionId)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }

  let lektionProgress = await UserLektionProgress.findOne({
    user_id: userId,
    lektion_id: lektionId,
  });

  const vocabularyProgresses = await UserVocabularyProgress.find({
    user_id: userId,
    lektion_id: lektionId,
  }).populate('vocabulary_id');

  if (!lektionProgress) {
    lektionProgress = {
      user_id: userId,
      lektion_id: lektionId,
      status: 'in_progress',
      progress: 0,
      started_at: null,
      completed_at: null,
    };
  }

  sendResponse(res, HTTP_STATUS.OK, 'Lektion progress fetched successfully', {
    lektionProgress,
    vocabularyProgresses,
  });
});

/**
 * @desc    Mark a vocabulary as learned in a lektion (Legacy compatibility)
 * @route   POST /api/progress/lektion/:lektionId/learn-word
 * @access  Private
 */
export const markWordLearned = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lektionId } = req.params;
  const { vocabulary_id, vocabularyId, isCorrect } = req.body;

  const targetVocabId = vocabulary_id || vocabularyId;

  if (!mongoose.isValidObjectId(lektionId)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }
  if (!targetVocabId || !mongoose.isValidObjectId(targetVocabId)) {
    throw new AppError('Valid vocabulary_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  const lektion = await Lektion.findById(lektionId);
  if (!lektion) {
    throw new AppError('Lektion not found', HTTP_STATUS.NOT_FOUND);
  }

  // 1. Upsert UserVocabularyProgress
  let vocabProg = await UserVocabularyProgress.findOne({
    user_id: userId,
    vocabulary_id: targetVocabId,
  });

  if (!vocabProg) {
    vocabProg = new UserVocabularyProgress({
      user_id: userId,
      vocabulary_id: targetVocabId,
      lektion_id: lektionId,
      status: 'learned',
      correct_count: isCorrect !== false ? 1 : 0,
      wrong_count: isCorrect === false ? 1 : 0,
      review_count: 1,
      last_reviewed_at: new Date(),
    });
  } else {
    vocabProg.status = 'learned';
    vocabProg.review_count += 1;
    if (isCorrect === true) vocabProg.correct_count += 1;
    if (isCorrect === false) vocabProg.wrong_count += 1;
    vocabProg.last_reviewed_at = new Date();
  }

  await vocabProg.save();

  // 2. Recalculate UserLektionProgress
  const totalVocabs = await Vocabulary.countDocuments({
    $or: [{ lektionId: lektionId }, { lektion_id: lektionId }],
  });

  const learnedCount = await UserVocabularyProgress.countDocuments({
    user_id: userId,
    lektion_id: lektionId,
    status: 'learned',
  });

  const percentage = totalVocabs > 0 ? Math.min(100, Math.round((learnedCount / totalVocabs) * 100)) : 100;

  let lektionProg = await UserLektionProgress.findOne({
    user_id: userId,
    lektion_id: lektionId,
  });

  if (!lektionProg) {
    lektionProg = new UserLektionProgress({
      user_id: userId,
      level_id: lektion.level_id,
      topic_id: lektion.topic_id,
      lektion_id: lektionId,
      status: percentage >= 100 ? 'completed' : 'in_progress',
      progress: percentage,
      started_at: new Date(),
      completed_at: percentage >= 100 ? new Date() : null,
    });
  } else {
    lektionProg.progress = percentage;
    if (!lektionProg.started_at) {
      lektionProg.started_at = new Date();
    }
    if (percentage >= 100) {
      lektionProg.status = 'completed';
      if (!lektionProg.completed_at) {
        lektionProg.completed_at = new Date();
      }
    } else {
      lektionProg.status = 'in_progress';
    }
  }

  await lektionProg.save();

  sendResponse(res, HTTP_STATUS.OK, 'Word marked as learned', {
    vocabularyProgress: vocabProg,
    lektionProgress: lektionProg,
  });
});

/**
 * @desc    Mark lektion as completed (Legacy compatibility)
 * @route   POST /api/progress/lektion/:lektionId/complete
 * @access  Private
 */
export const completeLektion = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { lektionId } = req.params;

  if (!mongoose.isValidObjectId(lektionId)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lektion = await Lektion.findById(lektionId);
  if (!lektion) {
    throw new AppError('Lektion not found', HTTP_STATUS.NOT_FOUND);
  }

  let lektionProg = await UserLektionProgress.findOne({
    user_id: userId,
    lektion_id: lektionId,
  });

  if (!lektionProg) {
    lektionProg = new UserLektionProgress({
      user_id: userId,
      level_id: lektion.level_id,
      topic_id: lektion.topic_id,
      lektion_id: lektionId,
    });
  }

  lektionProg.status = 'completed';
  lektionProg.progress = 100;
  if (!lektionProg.started_at) lektionProg.started_at = new Date();
  lektionProg.completed_at = new Date();
  await lektionProg.save();

  // Also mark all vocabularies in this lektion as learned for this user
  const vocabs = await Vocabulary.find({
    $or: [{ lektionId: lektionId }, { lektion_id: lektionId }],
  });

  for (const v of vocabs) {
    await UserVocabularyProgress.findOneAndUpdate(
      { user_id: userId, vocabulary_id: v._id },
      {
        $set: {
          lektion_id: lektionId,
          status: 'learned',
          last_reviewed_at: new Date(),
        },
        $inc: { review_count: 1 },
      },
      { upsert: true, new: true }
    );
  }

  // Find next lektion in the same level & topic
  const nextLektion = await Lektion.findOne({
    level_id: lektion.level_id,
    topic_id: lektion.topic_id,
    order: { $gt: lektion.order },
  }).sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Lektion marked as completed', {
    lektionProgress: lektionProg,
    nextLektion: nextLektion
      ? { _id: nextLektion._id, lektion_name: nextLektion.lektion_name, order: nextLektion.order }
      : null,
  });
});

export default {
  getUserProgressOverview,
  getLessonProgress,
  startLessonProgress,
  submitLessonExercise,
  completeLessonProgress,
  getLektionProgress,
  markWordLearned,
  completeLektion,
};
