import express from 'express';
import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Require authentication for all question endpoints
router.use(verifyToken);

// User & Admin read endpoints
router.get('/', getQuestions);
router.get('/:id', getQuestionById);

// Admin-only endpoints for question bank management
router.post('/', isAdmin, createQuestion);
router.put('/:id', isAdmin, updateQuestion);
router.delete('/:id', isAdmin, deleteQuestion);

export default router;
