import express from 'express';
import {
  startInteractiveSession,
  getInteractiveSessionById,
  setSessionActivity,
  nextSessionItem,
  spinSessionWheel,
  submitSessionResponse,
  endInteractiveSession,
} from '../controllers/interactiveSessionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isTeacherOrAdmin } from '../middlewares/planMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// Teacher live session control
router.post('/', isTeacherOrAdmin, startInteractiveSession);
router.put('/:id/activity', isTeacherOrAdmin, setSessionActivity);
router.put('/:id/next', isTeacherOrAdmin, nextSessionItem);
router.post('/:id/spin', isTeacherOrAdmin, spinSessionWheel);
router.put('/:id/end', isTeacherOrAdmin, endInteractiveSession);

// Shared and student endpoints
router.get('/:id', getInteractiveSessionById);
router.post('/:id/response', submitSessionResponse);

export default router;
