import express from 'express';
import {
  createInteractiveLesson,
  getInteractiveLessons,
  getInteractiveLessonById,
  updateInteractiveLesson,
  deleteInteractiveLesson,
} from '../controllers/interactiveLessonController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isTeacherOrAdmin } from '../middlewares/planMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', isTeacherOrAdmin, createInteractiveLesson);
router.get('/', getInteractiveLessons);
router.get('/:id', getInteractiveLessonById);
router.put('/:id', isTeacherOrAdmin, updateInteractiveLesson);
router.delete('/:id', isTeacherOrAdmin, deleteInteractiveLesson);

export default router;
