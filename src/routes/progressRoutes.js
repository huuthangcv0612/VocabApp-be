import express from 'express';
import {
  getUserProgressOverview,
  getLektionProgress,
  markWordLearned,
  completeLektion,
} from '../controllers/progressController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Require authentication for all user progress routes
router.use(verifyToken);

router.get('/', getUserProgressOverview);
router.get('/lektion/:lektionId', getLektionProgress);
router.post('/lektion/:lektionId/learn-word', markWordLearned);
router.post('/lektion/:lektionId/complete', completeLektion);

export default router;
