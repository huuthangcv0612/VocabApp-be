import express from 'express';
import {
  getAllLektions,
  getLektionById,
  getLektionsByLevelId,
  getLektionsByTopicId,
  createLektion,
  updateLektion,
  deleteLektion,
} from '../controllers/lektionController.js';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public / User read endpoints with optional user context for progress
router.get('/', optionalAuth, getAllLektions);
router.get('/level/:levelId', optionalAuth, getLektionsByLevelId);
router.get('/topic/:topicId', optionalAuth, getLektionsByTopicId);
router.get('/:id', optionalAuth, getLektionById);

// Admin-only management endpoints
router.post('/', verifyToken, isAdmin, createLektion);
router.put('/:id', verifyToken, isAdmin, updateLektion);
router.delete('/:id', verifyToken, isAdmin, deleteLektion);

export default router;
