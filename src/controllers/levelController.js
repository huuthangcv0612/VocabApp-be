import mongoose from 'mongoose';
import Level from '../models/Level.js';
import Topic from '../models/Topic.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

// Lấy tất cả các Level
export const getAllLevels = asyncHandler(async (req, res) => {
  const levels = await Level.find().sort({ order: 1 });
  sendResponse(res, HTTP_STATUS.OK, 'Levels fetched successfully', {
    levels,
    count: levels.length,
    data: levels, // backward compatibility
  });
});

// Lấy Level theo ID hoặc tên (e.g. GET /api/levels/A1.1 hoặc GET /api/levels/65a...)
export const getLevelById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let level = null;

  if (mongoose.isValidObjectId(id)) {
    level = await Level.findById(id);
  }

  if (!level) {
    level = await Level.findOne({ level_name: id });
  }

  if (!level) {
    throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Level fetched successfully', {
    level,
    data: level, // backward compatibility
  });
});

// Lấy Level theo tên
export const getLevelByName = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const level = await Level.findOne({ level_name: name });

  if (!level) {
    throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Level fetched successfully', {
    level,
    data: level,
  });
});

// Lấy các Topic thuộc một Level (Step 4 flow: GET /api/levels/:levelId/topics)
export const getTopicsByLevel = asyncHandler(async (req, res) => {
  const { levelId } = req.params;
  let level = null;

  if (mongoose.isValidObjectId(levelId)) {
    level = await Level.findById(levelId);
  } else {
    level = await Level.findOne({ level_name: levelId });
  }

  if (!level) {
    throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  }

  const topics = await Topic.find({ level_id: level._id }).sort({ order: 1, topic_name: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Topics for level fetched successfully', {
    level,
    topics,
    count: topics.length,
  });
});

export default {
  getAllLevels,
  getLevelById,
  getLevelByName,
  getTopicsByLevel,
};
