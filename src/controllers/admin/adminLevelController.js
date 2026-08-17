import Level from '../../models/Level.js';
import Topic from '../../models/Topic.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import { validateObjectId } from '../../validators/adminContentValidator.js';

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
  const { level_name } = req.body;

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

  const topicCount = await Topic.countDocuments({ level_id: req.params.id });
  if (topicCount > 0) {
    throw new AppError('Cannot delete level because it is referenced by topics.', HTTP_STATUS.BAD_REQUEST);
  }

  const level = await Level.findByIdAndDelete(req.params.id);
  if (!level) throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Level deleted successfully', { deletedId: req.params.id });
});

export default {
  getAdminLevels,
  getAdminLevelById,
  createAdminLevel,
  updateAdminLevel,
  deleteAdminLevel,
};
