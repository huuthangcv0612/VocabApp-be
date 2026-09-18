import express from 'express';
import {
  getUserProgressOverview,
  getLessonProgress,
  startLessonProgress,
  submitLessonExercise,
  completeLessonProgress,
  getLektionProgress,
  markWordLearned,
  completeLektion,
} from '../controllers/progressController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Require authentication for all user progress routes
router.use(verifyToken);

router.get('/', getUserProgressOverview);

// Lesson Progress Tracking Endpoints (New Architecture)
router.get('/lessons/:lessonId', getLessonProgress);
router.post('/lessons/:lessonId/start', startLessonProgress);
router.post('/lessons/:lessonId/submit-exercise', submitLessonExercise);
router.post('/lessons/:lessonId/complete', completeLessonProgress);

// Legacy Lektion Progress Endpoints (Backward compatibility)
router.get('/lektion/:lektionId', getLektionProgress);
router.post('/lektion/:lektionId/learn-word', markWordLearned);
router.post('/lektion/:lektionId/complete', completeLektion);

export default router;
