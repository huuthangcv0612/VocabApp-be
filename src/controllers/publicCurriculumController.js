import mongoose from 'mongoose';
import Lesson from '../models/Lesson.js';
import Exercise from '../models/Exercise.js';
import LessonVocabulary from '../models/LessonVocabulary.js';
import UserExerciseProgress from '../models/UserExerciseProgress.js';
import UserLessonProgress from '../models/UserLessonProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get public lesson by ID or slug (STRIPS EXERCISE ANSWERS FOR SECURITY)
 * @route   GET /api/lessons/:id
 * @access  Public
 */
export const getPublicLessonById = asyncHandler(async (req, res) => {
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

  // 1. Preview vocabularies sorted by order
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

  // 2. Exercises sorted by order - STRIP ANSWER OBJECT FOR PUBLIC SECURITY
  const exercisesRaw = await Exercise.find({ lesson_id: lesson._id })
    .populate('vocabulary_id')
    .populate('grammar_id')
    .sort({ order: 1 });

  const exercises = exercisesRaw.map((ex) => {
    const exObj = ex.toObject();
    delete exObj.answer; // DO NOT EXPOSE ANSWER TO FRONTEND LEARNERS
    return exObj;
  });

  sendResponse(res, HTTP_STATUS.OK, 'Public lesson fetched successfully', {
    lesson,
    preview: {
      vocabularies,
    },
    exercises,
  });
});

/**
 * @desc    Submit exercise answer for server-side evaluation
 * @route   POST /api/lessons/:lessonId/exercises/:exerciseId/submit
 * @access  Public (Optional User Auth)
 */
export const submitExerciseAnswer = asyncHandler(async (req, res) => {
  const { lessonId, exerciseId } = req.params;
  const { answer } = req.body;

  if (!mongoose.isValidObjectId(lessonId) || !mongoose.isValidObjectId(exerciseId)) {
    throw new AppError('Invalid Lesson ID or Exercise ID', HTTP_STATUS.BAD_REQUEST);
  }

  if (answer === undefined || answer === null) {
    throw new AppError('Answer payload is required', HTTP_STATUS.BAD_REQUEST);
  }

  const exercise = await Exercise.findOne({ _id: exerciseId, lesson_id: lessonId });
  if (!exercise) {
    throw new AppError('Exercise not found for this lesson', HTTP_STATUS.NOT_FOUND);
  }

  let isCorrect = false;
  const expectedAnswer = exercise.answer;

  // Grade answer according to exercise type structure
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
  const userId = req.user ? req.user.id || req.user._id : null;

  if (userId) {
    await UserExerciseProgress.findOneAndUpdate(
      { user_id: userId, exercise_id: exerciseId },
      {
        lesson_id: lessonId,
        is_correct: isCorrect,
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true }
    );
  }

  sendResponse(res, HTTP_STATUS.OK, 'Exercise answer evaluated', {
    exercise_id: exerciseId,
    is_correct: isCorrect,
    xp_earned: xpEarned,
    explanation: exercise.content ? exercise.content.explanation || null : null,
  });
});

export default {
  getPublicLessonById,
  submitExerciseAnswer,
};
