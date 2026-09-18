import express from 'express';
import {
  getAllExercises,
  getExerciseById,
  getExercisesByLesson,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../controllers/exerciseController.js';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public / User read endpoints
router.get('/', optionalAuth, getAllExercises);
router.get('/lesson/:lessonId', optionalAuth, getExercisesByLesson);
router.get('/:id', optionalAuth, getExerciseById);

// Protected Admin routes
router.post('/', verifyToken, isAdmin, createExercise);
router.put('/:id', verifyToken, isAdmin, updateExercise);
router.delete('/:id', verifyToken, isAdmin, deleteExercise);

export default router;
