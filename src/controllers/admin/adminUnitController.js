import mongoose from 'mongoose';
import Unit from '../../models/Unit.js';
import Topic from '../../models/Topic.js';
import Lesson from '../../models/Lesson.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/errorHandler.js';
import { sendResponse } from '../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../utils/constants.js';
import { validateObjectId, validateReorderItems } from '../../validators/adminContentValidator.js';

const generateSlug = (text) => text.trim().toLowerCase().replace(/\s+/g, '-');

export const getAdminUnits = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.topic_id && mongoose.isValidObjectId(req.query.topic_id)) {
    filter.topic_id = req.query.topic_id;
  }
  const units = await Unit.find(filter).populate('topic_id', 'name topic_name slug').sort({ order: 1 });
  sendResponse(res, HTTP_STATUS.OK, 'Units fetched successfully', { units, count: units.length });
});

export const getAdminUnitById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');
  const unit = await Unit.findById(req.params.id).populate('topic_id', 'name topic_name slug');
  if (!unit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  sendResponse(res, HTTP_STATUS.OK, 'Unit fetched successfully', { unit });
});

export const createAdminUnit = asyncHandler(async (req, res) => {
  const { topic_id, title, unit_name, slug, description, order, status } = req.body;
  const actualTitle = (title || unit_name || '').trim();

  if (!topic_id || !mongoose.isValidObjectId(topic_id)) {
    throw new AppError('Valid topic_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!actualTitle) {
    throw new AppError('Unit title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const topicExists = await Topic.findById(topic_id);
  if (!topicExists) {
    throw new AppError('Referenced Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  const actualSlug = slug ? slug.trim().toLowerCase() : generateSlug(actualTitle);
  const existingSlug = await Unit.findOne({ topic_id, slug: actualSlug });
  if (existingSlug) {
    throw new AppError('Unit slug already exists for this topic', HTTP_STATUS.BAD_REQUEST);
  }

  const unit = await Unit.create({
    topic_id,
    title: actualTitle,
    slug: actualSlug,
    description: description ? description.trim() : '',
    order: order || 1,
    status: status || 'published',
  });

  const populatedUnit = await Unit.findById(unit._id).populate('topic_id', 'name topic_name slug');
  sendResponse(res, HTTP_STATUS.CREATED, 'Unit created successfully', { unit: populatedUnit });
});

export const updateAdminUnit = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');

  if (req.body.topic_id) {
    validateObjectId(req.body.topic_id, 'Topic ID');
    const topicExists = await Topic.findById(req.body.topic_id);
    if (!topicExists) throw new AppError('Referenced Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  const currentUnit = await Unit.findById(req.params.id);
  if (!currentUnit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);

  if (req.body.slug) {
    const topicIdToCheck = req.body.topic_id || currentUnit.topic_id;
    const existingSlug = await Unit.findOne({
      topic_id: topicIdToCheck,
      slug: req.body.slug.trim().toLowerCase(),
      _id: { $ne: req.params.id },
    });
    if (existingSlug) {
      throw new AppError('Unit slug already exists for this topic', HTTP_STATUS.BAD_REQUEST);
    }
  }

  const updateData = { ...req.body };
  if (req.body.title || req.body.unit_name) {
    updateData.title = (req.body.title || req.body.unit_name).trim();
  }

  const unit = await Unit.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).populate('topic_id', 'name topic_name slug');

  sendResponse(res, HTTP_STATUS.OK, 'Unit updated successfully', { unit });
});

export const deleteAdminUnit = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'Unit ID');

  const lessonCount = await Lesson.countDocuments({ unit_id: req.params.id });
  if (lessonCount > 0) {
    throw new AppError('Cannot delete unit because it contains lessons.', HTTP_STATUS.BAD_REQUEST);
  }

  const unit = await Unit.findByIdAndDelete(req.params.id);
  if (!unit) throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);

  sendResponse(res, HTTP_STATUS.OK, 'Unit deleted successfully', { deletedId: req.params.id });
});

export const reorderUnits = asyncHandler(async (req, res) => {
  validateReorderItems(req.body.items);

  const bulkOps = req.body.items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Unit.bulkWrite(bulkOps);
  sendResponse(res, HTTP_STATUS.OK, 'Units reordered successfully', { items: req.body.items });
});

export default {
  getAdminUnits,
  getAdminUnitById,
  createAdminUnit,
  updateAdminUnit,
  deleteAdminUnit,
  reorderUnits,
};
