import express from 'express';
import {
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  togglePublishQuiz,
} from '../controllers/quizController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.get('/', getAllQuizzes);
router.get('/:id', getQuizById);
router.post('/', verifyToken, isAdmin, createQuiz);
router.put('/:id', verifyToken, isAdmin, updateQuiz);
router.delete('/:id', verifyToken, isAdmin, deleteQuiz);
router.patch('/:id/publish', verifyToken, isAdmin, togglePublishQuiz);

export default router;
