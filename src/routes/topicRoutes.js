import express from 'express';
import {
  getAllTopics,
  getTopicById,
  getTopicsByLevel,
  getLektionsByTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../controllers/topicController.js';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllTopics);
router.get('/level/:levelId', getTopicsByLevel);
router.get('/:id', getTopicById);
router.get('/:topicId/lektions', optionalAuth, getLektionsByTopic);

// Admin-only routes
router.post('/', verifyToken, isAdmin, createTopic);
router.put('/:id', verifyToken, isAdmin, updateTopic);
router.delete('/:id', verifyToken, isAdmin, deleteTopic);

export default router;
