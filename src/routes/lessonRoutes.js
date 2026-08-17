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
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllLessons);
router.get('/unit/:unitId', optionalAuth, getLessonsByUnit);
router.get('/:id', optionalAuth, getLessonById);
router.post('/:lessonId/exercises/:exerciseId/submit', optionalAuth, submitExerciseAnswer);
router.post('/:lessonId/submit', optionalAuth, submitExerciseAnswer);

// Protected Admin routes
router.post('/', verifyToken, isAdmin, createLesson);
router.put('/:id', verifyToken, isAdmin, updateLesson);
router.delete('/:id', verifyToken, isAdmin, deleteLesson);

// Admin routes for Lesson Vocabularies
router.post('/:id/vocabularies', verifyToken, isAdmin, addVocabularyToLesson);
router.delete('/:id/vocabularies/:vocabularyId', verifyToken, isAdmin, removeVocabularyFromLesson);

export default router;
