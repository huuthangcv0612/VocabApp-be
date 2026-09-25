import express from 'express';
import {
  getAllLessons,
  getLessonById,
  getLessonsByUnit,
  createLesson,
  updateLesson,
  deleteLesson,
  addVocabularyToLesson,
  removeVocabularyFromLesson,
} from '../controllers/lessonController.js';
import { submitExerciseAnswer } from '../controllers/publicCurriculumController.js';
import { verifyToken, optionalAuth, requireActiveUser } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllLessons);
router.get('/unit/:unitId', optionalAuth, getLessonsByUnit);
router.get('/:id', optionalAuth, getLessonById);
router.post('/:lessonId/exercises/:exerciseId/submit', optionalAuth, submitExerciseAnswer);
router.post('/:lessonId/submit', optionalAuth, submitExerciseAnswer);

// Protected Admin routes
router.post('/', verifyToken, requireActiveUser, isAdmin, createLesson);
router.put('/:id', verifyToken, requireActiveUser, isAdmin, updateLesson);
router.delete('/:id', verifyToken, requireActiveUser, isAdmin, deleteLesson);

// Admin routes for Lesson Vocabularies
router.post('/:id/vocabularies', verifyToken, requireActiveUser, isAdmin, addVocabularyToLesson);
router.delete('/:id/vocabularies/:vocabularyId', verifyToken, requireActiveUser, isAdmin, removeVocabularyFromLesson);

export default router;
