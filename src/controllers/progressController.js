import mongoose from 'mongoose';
import UserLektionProgress from '../models/UserLektionProgress.js';
import UserVocabularyProgress from '../models/UserVocabularyProgress.js';
import Lektion from '../models/Lektion.js';
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

  const lektionProgresses = await UserLektionProgress.find({ user_id: userId })
    .populate({
      path: 'lektion_id',
      select: 'lektion_name level_id topic_id order',
      populate: [
        { path: 'level_id', select: 'level_name order' },
        { path: 'topic_id', select: 'name topic_name icon order' },
      ],
    });

  const completedLektionsCount = await UserLektionProgress.countDocuments({
    user_id: userId,
    status: 'completed',
  });

  const totalLearnedWordsCount = await UserVocabularyProgress.countDocuments({
    user_id: userId,
    status: 'learned',
  });

  sendResponse(res, HTTP_STATUS.OK, 'User progress fetched successfully', {
    lektionProgresses,
    stats: {
      completedLektionsCount,
      totalLearnedWordsCount,
    },
  });
});

/**
 * @desc    Get progress for a specific lektion
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
 * @desc    Mark a vocabulary as learned in a lektion
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
 * @desc    Mark lektion as completed (Step 7 flow: completed -> unlock next Lektion)
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
  getLektionProgress,
  markWordLearned,
  completeLektion,
};
