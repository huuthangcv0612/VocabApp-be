import mongoose from 'mongoose';
import Topic from '../models/Topic.js';
import Lektion from '../models/Lektion.js';
import Vocabulary from '../models/Vocabulary.js';
import UserLektionProgress from '../models/UserLektionProgress.js';
import UserVocabularyProgress from '../models/UserVocabularyProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get all topics
 * @route   GET /api/topics
 * @access  Public
 */
export const getAllTopics = asyncHandler(async (req, res) => {
  const topics = await Topic.find({ isActive: { $ne: false } }).sort({ order: 1, name: 1, topic_name: 1 });

  sendResponse(res, HTTP_STATUS.OK, 'Topics fetched successfully', {
    topics,
    count: topics.length,
    data: topics,
  });
});

/**
 * @desc    Get topics by level
 * @route   GET /api/topics/level/:levelId
 * @access  Public
 */
export const getTopicsByLevel = asyncHandler(async (req, res) => {
  const { levelId } = req.params;

  if (!mongoose.isValidObjectId(levelId)) {
    throw new AppError(
      'Invalid Level ID',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  let topics = await Topic.find({
    level_id: levelId,
    isActive: { $ne: false },
  }).sort({
    order: 1,
    name: 1,
    topic_name: 1,
  });

  // Fallback: if topics collection doesn't directly store level_id on topic docs, find via Lektions
  if (topics.length === 0) {
    const topicIds = await Lektion.distinct('topic_id', { level_id: levelId });
    if (topicIds.length > 0) {
      topics = await Topic.find({
        _id: { $in: topicIds },
        isActive: { $ne: false },
      }).sort({
        order: 1,
        name: 1,
        topic_name: 1,
      });
    }
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Topics fetched successfully',
    {
      topics,
      count: topics.length,
      data: topics,
    }
  );
});

/**
 * @desc    Get topic by ID
 * @route   GET /api/topics/:id
 * @access  Public
 */
export const getTopicById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let topic = null;

  if (mongoose.isValidObjectId(id)) {
    topic = await Topic.findById(id);
  }

  if (!topic) {
    topic = await Topic.findOne({ slug: id });
  }

  if (!topic) {
    throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Topic fetched successfully', { topic, data: topic });
});

/**
 * @desc    Get lektions for a specific topic (Step 5 of curriculum flow)
 * @route   GET /api/topics/:topicId/lektions
 * @access  Public (with optional user context for progress)
 */
export const getLektionsByTopic = asyncHandler(async (req, res) => {
  const { topicId } = req.params;
  const levelId = req.query.levelId || req.query.level_id;

  let topicDoc = null;
  if (mongoose.isValidObjectId(topicId)) {
    topicDoc = await Topic.findById(topicId);
  } else {
    topicDoc = await Topic.findOne({ slug: topicId });
  }

  const searchTopicId = topicDoc ? topicDoc._id : topicId;

  const filter = {};
  if (mongoose.isValidObjectId(searchTopicId)) {
    filter.topic_id = searchTopicId;
  }

  if (levelId) {
    if (mongoose.isValidObjectId(levelId)) {
      filter.level_id = levelId;
    } else {
      filter.level = levelId;
    }
  }

  const lektions = await Lektion.find(filter)
    .populate('level_id', 'level_name order')
    .populate('topic_id', 'name topic_name slug icon')
    .sort({ order: 1 });

  // Fetch user progress if authenticated
  const userId = req.user ? req.user.id || req.user._id : null;
  let userProgresses = [];
  const learnedWordsMap = new Map();

  if (userId && lektions.length > 0) {
    const lektionIds = lektions.map((l) => l._id);

    const [progressList, vocabProgresses] = await Promise.all([
      UserLektionProgress.find({
        user_id: userId,
        lektion_id: { $in: lektionIds },
      }),
      UserVocabularyProgress.find({
        user_id: userId,
        lektion_id: { $in: lektionIds },
        status: 'learned',
      }),
    ]);

    userProgresses = progressList;

    vocabProgresses.forEach((vp) => {
      if (vp.lektion_id) {
        const lId = vp.lektion_id.toString();
        learnedWordsMap.set(lId, (learnedWordsMap.get(lId) || 0) + 1);
      }
    });
  }

  const progressMap = new Map();
  userProgresses.forEach((up) => {
    progressMap.set(up.lektion_id.toString(), up);
  });

  let previousCompleted = true; // First lektion is unlocked by default

  const formattedLektions = await Promise.all(
    lektions.map(async (lektion, index) => {
      const vocabCount = await Vocabulary.countDocuments({
        $or: [{ lektionId: lektion._id }, { lektion_id: lektion._id }],
      });

      const prog = progressMap.get(lektion._id.toString());
      const status = prog ? prog.status : 'not_started';
      const progressPercent = prog ? prog.progress : 0;
      const isUnlocked = index === 0 || previousCompleted;

      if (status === 'completed') {
        previousCompleted = true;
      } else {
        previousCompleted = false;
      }

      const learnedWordsCount = userId ? learnedWordsMap.get(lektion._id.toString()) || 0 : 0;

      const obj = lektion.toObject();
      obj.vocabulary_count = vocabCount;
      obj.vocabularyCount = vocabCount;

      return {
        ...obj,
        progress: {
          status,
          percentage: progressPercent,
          learnedWordsCount,
          isUnlocked,
        },
      };
    })
  );

  sendResponse(res, HTTP_STATUS.OK, 'Lektions fetched successfully', {
    lektions: formattedLektions,
    count: formattedLektions.length,
    data: formattedLektions,
  });
});

/**
 * @desc    Create new topic (Admin)
 * @route   POST /api/topics
 * @access  Private/Admin
 */
export const createTopic = asyncHandler(async (req, res) => {
  const { name, topic_name, slug, description, icon, order, isActive, level_id } = req.body;
  const actualName = name || topic_name;

  if (!actualName || !actualName.trim()) {
    throw new AppError('Topic name is required', HTTP_STATUS.BAD_REQUEST);
  }

  const topic = await Topic.create({
    level_id: level_id || null,
    name: actualName.trim(),
    topic_name: actualName.trim(),
    slug: slug ? slug.trim().toLowerCase() : actualName.trim().toLowerCase().replace(/\s+/g, '-'),
    description: description ? description.trim() : '',
    icon: icon || null,
    order: order || 1,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  sendResponse(res, HTTP_STATUS.CREATED, 'Topic created successfully', { topic });
});

/**
 * @desc    Update topic (Admin)
 * @route   PUT /api/topics/:id
 * @access  Private/Admin
 */
export const updateTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Topic ID', HTTP_STATUS.BAD_REQUEST);
  }

  const updateData = { ...req.body };
  if (req.body.name || req.body.topic_name) {
    const val = req.body.name || req.body.topic_name;
    updateData.name = val;
    updateData.topic_name = val;
  }

  const topic = await Topic.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!topic) {
    throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(res, HTTP_STATUS.OK, 'Topic updated successfully', { topic });
});

/**
 * @desc    Delete topic (Admin)
 * @route   DELETE /api/topics/:id
 * @access  Private/Admin
 */
export const deleteTopic = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Invalid Topic ID', HTTP_STATUS.BAD_REQUEST);
  }

  const topic = await Topic.findById(id);
  if (!topic) {
    throw new AppError('Topic not found', HTTP_STATUS.NOT_FOUND);
  }

  await Topic.findByIdAndDelete(id);
  sendResponse(res, HTTP_STATUS.OK, 'Topic deleted successfully', { deletedId: id });
});

export default {
  getAllTopics,
  getTopicById,
  getTopicsByLevel,
  getLektionsByTopic,
  createTopic,
  updateTopic,
  deleteTopic,
};
