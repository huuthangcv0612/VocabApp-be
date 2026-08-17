import mongoose from 'mongoose';
import Topic from '../../models/Topic.js';
import Level from '../../models/Level.js';
import Unit from '../../models/Unit.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import { validateObjectId, validateReorderItems } from '../../validators/adminContentValidator.js';

const generateSlug = (text) => text.trim().toLowerCase().replace(/\s+/g, '-');

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

export default {
  getAdminTopics,
  getAdminTopicById,
  createAdminTopic,
  updateAdminTopic,
  deleteAdminTopic,
  reorderTopics,
};
