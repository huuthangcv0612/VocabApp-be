import mongoose from 'mongoose';
import Unit from '../models/Unit.js';
import Topic from '../models/Topic.js';
import Lesson from '../models/Lesson.js';
import UserLessonProgress from '../models/UserLessonProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get all units
 * @route   GET /api/units
 * @access  Public
 */
export const getAllUnits = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.topic_id || req.query.topicId) {
    const topicId = req.query.topic_id || req.query.topicId;
    if (mongoose.isValidObjectId(topicId)) {
      filter.topic_id = topicId;
    }
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const units = await Unit.find(filter)
    .populate('topic_id', 'name topic_name slug icon image_url')
    .sort({ order: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Units fetched successfully', {
    units,
    count: units.length,
    data: units,
  });
});

/**
 * @desc    Get unit by ID or slug
 * @route   GET /api/units/:id
 * @access  Public
 */
export const getUnitById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let unit = null;

  if (mongoose.isValidObjectId(id)) {
    unit = await Unit.findById(id).populate('topic_id', 'name topic_name slug icon image_url');
  }

  if (!unit) {
    unit = await Unit.findOne({ slug: id }).populate('topic_id', 'name topic_name slug icon image_url');
  }

  if (!unit) {
    throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Unit fetched successfully', {
    unit,
    data: unit,
  });
});

/**
 * @desc    Get units by Topic ID
 * @route   GET /api/topics/:topicId/units
 * @access  Public (with optional user context for progress)
 */
export const getUnitsByTopic = asyncHandler(async (req, res) => {
  const { topicId } = req.params;

  let topicDoc = null;
  if (mongoose.isValidObjectId(topicId)) {
    topicDoc = await Topic.findById(topicId);
  } else {
    topicDoc = await Topic.findOne({ slug: topicId });
  }

  const searchTopicId = topicDoc ? topicDoc._id : topicId;

  if (!mongoose.isValidObjectId(searchTopicId)) {
    throw new AppError('Invalid Topic ID', HTTP_STATUS.BAD_REQUEST);
  }

  const units = await Unit.find({ topic_id: searchTopicId })
    .populate('topic_id', 'name topic_name slug')
    .sort({ order: 1 });

  const userId = req.user ? req.user.id || req.user._id : null;

  // Enrich units with lessons and user progress if available
  const unitsWithLessons = await Promise.all(
    units.map(async (unit) => {
      const lessons = await Lesson.find({ unit_id: unit._id }).sort({ order: 1 });
      
      let lessonsWithProgress = lessons.map((l) => l.toObject());

      if (userId && lessons.length > 0) {
        const lessonIds = lessons.map((l) => l._id);
        const progressList = await UserLessonProgress.find({
          user_id: userId,
          lesson_id: { $in: lessonIds },
        });

        const progressMap = new Map();
        progressList.forEach((up) => {
          progressMap.set(up.lesson_id.toString(), up);
        });

        let previousCompleted = true;
        lessonsWithProgress = lessons.map((lesson, idx) => {
          const lObj = lesson.toObject();
          const prog = progressMap.get(lesson._id.toString());
          const status = prog ? prog.status : 'not_started';
          const progressPercent = prog ? prog.progress : 0;
          const isUnlocked = idx === 0 || previousCompleted;

          if (status === 'completed') {
            previousCompleted = true;
          } else {
            previousCompleted = false;
          }

          return {
            ...lObj,
            progress: {
              status,
              percentage: progressPercent,
              isUnlocked,
            },
          };
        });
      }

      const unitObj = unit.toObject();
      unitObj.lessons = lessonsWithProgress;
      unitObj.lesson_count = lessons.length;
      return unitObj;
    })
  );

  sendResponse(res, HTTP_STATUS.OK, 'Units fetched successfully', {
    units: unitsWithLessons,
    count: unitsWithLessons.length,
    data: unitsWithLessons,
  });
});

/**
 * @desc    Create unit (Admin)
 * @route   POST /api/units
 * @access  Private/Admin
 */
export const createUnit = asyncHandler(async (req, res) => {
  const { topic_id, title, unit_name, slug, description, order, status } = req.body;
  const actualTitle = title || unit_name;

  if (!topic_id || !mongoose.isValidObjectId(topic_id)) {
    throw new AppError('Valid topic_id is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (!actualTitle || !actualTitle.trim()) {
    throw new AppError('Unit title is required', HTTP_STATUS.BAD_REQUEST);
  }

  const topicExists = await Topic.findById(topic_id);
  if (!topicExists) {
    throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  const unit = await Unit.create({
    topic_id,
    title: actualTitle.trim(),
    slug: slug ? slug.trim().toLowerCase() : actualTitle.trim().toLowerCase().replace(/\s+/g, '-'),
    description: description ? description.trim() : '',
    order: order || 1,
    status: status || 'published',
  });

  const populatedUnit = await Unit.findById(unit._id).populate('topic_id', 'name topic_name slug');

  sendResponse(res, HTTP_STATUS.CREATED, 'Unit created successfully', {
    unit: populatedUnit,
  });
});

/**
 * @desc    Update unit (Admin)
 * @route   PUT /api/units/:id
 * @access  Private/Admin
 */
export const updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Unit ID', HTTP_STATUS.BAD_REQUEST);
  }

  const updateData = { ...req.body };
  if (req.body.title || req.body.unit_name) {
    updateData.title = req.body.title || req.body.unit_name;
  }

  const unit = await Unit.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('topic_id', 'name topic_name slug');

  if (!unit) {
    throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Unit updated successfully', { unit });
});

/**
 * @desc    Delete unit (Admin)
 * @route   DELETE /api/units/:id
 * @access  Private/Admin
 */
export const deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Unit ID', HTTP_STATUS.BAD_REQUEST);
  }

  const unit = await Unit.findById(id);
  if (!unit) {
    throw new AppError('Unit not found', HTTP_STATUS.NOT_FOUND);
  }

  await Unit.findByIdAndDelete(id);
  sendResponse(res, HTTP_STATUS.OK, 'Unit deleted successfully', { deletedId: id });
});

export default {
  getAllUnits,
  getUnitById,
  getUnitsByTopic,
  createUnit,
  updateUnit,
  deleteUnit,
};
