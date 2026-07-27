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

router.use(verifyToken);

router.get('/', getAllQuizzes);
router.get('/:id', getQuizById);
router.post('/', isAdmin, createQuiz);
router.put('/:id', isAdmin, updateQuiz);
router.delete('/:id', isAdmin, deleteQuiz);
router.patch('/:id/publish', isAdmin, togglePublishQuiz);

export default router;
