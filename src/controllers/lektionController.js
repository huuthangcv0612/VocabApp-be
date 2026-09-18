import mongoose from 'mongoose';
import Lektion from '../models/Lektion.js';
import Vocabulary from '../models/Vocabulary.js';
import UserLektionProgress from '../models/UserLektionProgress.js';
import UserVocabularyProgress from '../models/UserVocabularyProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

const attachVocabularyCountAndProgress = async (lektion, userId = null) => {
  const vocabularyCount = await Vocabulary.countDocuments({
    $or: [{ lektionId: lektion._id }, { lektion_id: lektion._id }],
  });

  let userProgress = {
    status: 'in_progress',
    percentage: 0,
    learnedWordsCount: 0,
  };

  if (userId) {
    const prog = await UserLektionProgress.findOne({
      user_id: userId,
      lektion_id: lektion._id,
    });
    const learnedWordsCount = await UserVocabularyProgress.countDocuments({
      user_id: userId,
      lektion_id: lektion._id,
      status: 'learned',
    });

    if (prog) {
      userProgress = {
        status: prog.status,
        percentage: prog.progress,
        learnedWordsCount,
      };
    }
  }

  return {
    ...lektion.toObject(),
    vocabularyCount,
    progress: userProgress,
  };
};

// Lấy tất cả các Lektion (có thể lọc theo levelId và topicId)
export const getAllLektions = asyncHandler(async (req, res) => {
  const { levelId, level_id, topicId, topic_id } = req.query;
  const filter = {};

  const targetLevelId = levelId || level_id;
  const targetTopicId = topicId || topic_id;

  if (targetLevelId && mongoose.isValidObjectId(targetLevelId)) {
    filter.level_id = targetLevelId;
  }
  if (targetTopicId && mongoose.isValidObjectId(targetTopicId)) {
    filter.topic_id = targetTopicId;
  }

  const lektions = await Lektion.find(filter)
    .populate('level_id', 'level_name order')
    .populate('topic_id', 'topic_name icon')
    .sort({ order: 1 });

  const userId = req.user ? req.user.id || req.user._id : null;
  const lektionsWithDetails = await Promise.all(
    lektions.map((lektion) => attachVocabularyCountAndProgress(lektion, userId))
  );

  sendResponse(res, HTTP_STATUS.OK, 'Lektions fetched successfully', {
    lektions: lektionsWithDetails,
    count: lektionsWithDetails.length,
    data: lektionsWithDetails, // backward compatibility
  });
});

// Lấy Lektion theo ID
export const getLektionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lektion = await Lektion.findById(id)
    .populate('level_id', 'level_name order')
    .populate('topic_id', 'topic_name icon');

  if (!lektion) {
    throw new AppError('Lektion not found', HTTP_STATUS.NOT_FOUND);
  }

  const userId = req.user ? req.user.id || req.user._id : null;
  const lektionWithDetails = await attachVocabularyCountAndProgress(lektion, userId);

  sendResponse(res, HTTP_STATUS.OK, 'Lektion fetched successfully', {
    lektion: lektionWithDetails,
    data: lektionWithDetails, // backward compatibility
  });
});

// Lấy tất cả Lektion theo Level ID
export const getLektionsByLevelId = asyncHandler(async (req, res) => {
  const { levelId } = req.params;

  if (!mongoose.isValidObjectId(levelId)) {
    throw new AppError('Invalid Level ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lektions = await Lektion.find({ level_id: levelId })
    .populate('level_id', 'level_name order')
    .populate('topic_id', 'topic_name icon')
    .sort({ order: 1 });

  const userId = req.user ? req.user.id || req.user._id : null;
  const lektionsWithDetails = await Promise.all(
    lektions.map((lektion) => attachVocabularyCountAndProgress(lektion, userId))
  );

  sendResponse(res, HTTP_STATUS.OK, 'Lektions fetched successfully', {
    lektions: lektionsWithDetails,
    count: lektionsWithDetails.length,
    data: lektionsWithDetails, // backward compatibility
  });
});

// Lấy tất cả Lektion theo Topic ID
export const getLektionsByTopicId = asyncHandler(async (req, res) => {
  const { topicId } = req.params;
  const levelId = req.query.levelId || req.query.level_id;

  if (!mongoose.isValidObjectId(topicId)) {
    throw new AppError('Invalid Topic ID', HTTP_STATUS.BAD_REQUEST);
  }

  const filter = { topic_id: topicId };
  if (levelId && mongoose.isValidObjectId(levelId)) {
    filter.level_id = levelId;
  }

  const lektions = await Lektion.find(filter)
    .populate('level_id', 'level_name order')
    .populate('topic_id', 'topic_name icon')
    .sort({ order: 1 });

  const userId = req.user ? req.user.id || req.user._id : null;
  const lektionsWithDetails = await Promise.all(
    lektions.map((lektion) => attachVocabularyCountAndProgress(lektion, userId))
  );

  sendResponse(res, HTTP_STATUS.OK, 'Lektions fetched successfully', {
    lektions: lektionsWithDetails,
    count: lektionsWithDetails.length,
    data: lektionsWithDetails,
  });
});

// Create Lektion (Admin)
export const createLektion = asyncHandler(async (req, res) => {
  const { level_id, topic_id, lektion_name, title, description, order } = req.body;
  const actualName = lektion_name || title || req.body.lekttion_name;

  if (!level_id || !mongoose.isValidObjectId(level_id)) {
    throw new AppError('Valid level_id is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!topic_id || !mongoose.isValidObjectId(topic_id)) {
    throw new AppError('Valid topic_id is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!actualName || !actualName.trim()) {
    throw new AppError('Lektion name is required', HTTP_STATUS.BAD_REQUEST);
  }

  const lektion = await Lektion.create({
    level_id,
    topic_id,
    lektion_name: actualName.trim(),
    description: description ? description.trim() : '',
    order: order || 1,
  });

  const populatedLektion = await Lektion.findById(lektion._id)
    .populate('level_id', 'level_name')
    .populate('topic_id', 'topic_name');

  sendResponse(res, HTTP_STATUS.CREATED, 'Lektion created successfully', {
    lektion: populatedLektion,
  });
});

// Update Lektion (Admin)
export const updateLektion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }

  const updateData = { ...req.body };
  if (req.body.title || req.body.lekttion_name) {
    updateData.lektion_name = req.body.lektion_name || req.body.title || req.body.lekttion_name;
  }

  const lektion = await Lektion.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate('level_id', 'level_name')
    .populate('topic_id', 'topic_name');

  if (!lektion) {
    throw new AppError('Lektion not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Lektion updated successfully', { lektion });
});

// Delete Lektion (Admin)
export const deleteLektion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Lektion ID', HTTP_STATUS.BAD_REQUEST);
  }

  const lektion = await Lektion.findById(id);
  if (!lektion) {
    throw new AppError('Lektion not found', HTTP_STATUS.NOT_FOUND);
  }

  await Lektion.findByIdAndDelete(id);
  sendResponse(res, HTTP_STATUS.OK, 'Lektion deleted successfully', { deletedId: id });
});

export default {
  getAllLektions,
  getLektionById,
  getLektionsByLevelId,
  getLektionsByTopicId,
  createLektion,
  updateLektion,
  deleteLektion,
};
