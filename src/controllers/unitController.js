import mongoose from 'mongoose';
import Unit from '../models/Unit.js';
import Topic from '../models/Topic.js';
import Lesson from '../models/Lesson.js';
import Level from '../models/Level.js';
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

/**
 * @desc    Get units by Level ID with populated lessons and user progression status
 * @route   GET /api/levels/:levelId/units
 * @access  Public (with optional user context)
 */
export const getUnitsByLevel = asyncHandler(async (req, res) => {
  const { levelId } = req.params;

  let levelDoc = null;
  if (mongoose.isValidObjectId(levelId)) {
    levelDoc = await Level.findById(levelId);
  }
  if (!levelDoc) {
    levelDoc = await Level.findOne({ level_name: levelId });
  }

  if (!levelDoc) {
    throw new AppError('Level not found', HTTP_STATUS.NOT_FOUND);
  }

  // Find topics belonging to this level
  const topics = await Topic.find({ level_id: levelDoc._id });
  const topicIds = topics.map((t) => t._id);

  // Find units belonging to these topics or directly matching level_id
  const filter = {
    $or: [
      { topic_id: { $in: topicIds } },
      { level_id: levelDoc._id },
    ],
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const units = await Unit.find(filter)
    .populate('topic_id', 'name topic_name slug icon image_url')
    .sort({ order: 1 });

  const userId = req.user ? (req.user.id || req.user._id) : null;

  // Batch fetch lessons for all units
  const unitIds = units.map((u) => u._id);
  const rawLessons = await Lesson.find({ unit_id: { $in: unitIds } }).sort({ order: 1 });

  // Map lessons by unit_id
  const lessonsByUnit = new Map();
  unitIds.forEach((uId) => lessonsByUnit.set(uId.toString(), []));
  rawLessons.forEach((les) => {
    const key = les.unit_id.toString();
    if (!lessonsByUnit.has(key)) {
      lessonsByUnit.set(key, []);
    }
    lessonsByUnit.get(key).push(les);
  });

  // Fetch progress for authenticated user
  const progressMap = new Map();
  if (userId && rawLessons.length > 0) {
    const lessonIds = rawLessons.map((l) => l._id);
    const progressList = await UserLessonProgress.find({
      user_id: userId,
      lesson_id: { $in: lessonIds },
    });
    progressList.forEach((up) => {
      progressMap.set(up.lesson_id.toString(), up);
    });
  }

  // Calculate progression across all lessons in sequential order (Unit.order ASC, Lesson.order ASC)
  let foundFirstIncomplete = false;

  const unitsWithLessons = units.map((unit) => {
    const uObj = unit.toObject();
    const uLessons = lessonsByUnit.get(unit._id.toString()) || [];

    let unitCompletedCount = 0;
    let unitTotalXp = 0;

    const formattedLessons = uLessons.map((les) => {
      const lObj = les.toObject();
      const prog = progressMap.get(les._id.toString());
      const isCompleted = prog && (prog.status === 'completed' || prog.progress >= 100);
      const progressPercent = prog ? prog.progress : (isCompleted ? 100 : 0);

      let status = 'locked';
      if (isCompleted) {
        status = 'completed';
        unitCompletedCount++;
      } else if (!foundFirstIncomplete) {
        status = 'current';
        foundFirstIncomplete = true;
      } else {
        status = 'locked';
      }

      const xp = les.xp || 20;
      unitTotalXp += xp;

      return {
        ...lObj,
        status,
        progressPercentage: progressPercent,
        xp,
      };
    });

    const unitProgressPct = uLessons.length > 0
      ? Math.round((unitCompletedCount / uLessons.length) * 100)
      : 0;

    return {
      ...uObj,
      lessons: formattedLessons,
      lesson_count: uLessons.length,
      completedLessonsCount: unitCompletedCount,
      totalLessonsCount: uLessons.length,
      totalXp: unitTotalXp,
      progressPercentage: unitProgressPct,
    };
  });

  sendResponse(res, HTTP_STATUS.OK, 'Units fetched successfully', {
    level: levelDoc,
    units: unitsWithLessons,
    count: unitsWithLessons.length,
    data: unitsWithLessons,
  });
});

export default {
  getAllUnits,
  getUnitById,
  getUnitsByTopic,
  getUnitsByLevel,
  createUnit,
  updateUnit,
  deleteUnit,
};
