import express from 'express';
import {
  createInteractiveActivity,
  getInteractiveActivities,
  getInteractiveActivityById,
  updateInteractiveActivity,
  deleteInteractiveActivity,
} from '../controllers/interactiveActivityController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isTeacherOrAdmin } from '../middlewares/planMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', isTeacherOrAdmin, createInteractiveActivity);
router.get('/', getInteractiveActivities);
router.get('/:id', getInteractiveActivityById);
router.put('/:id', isTeacherOrAdmin, updateInteractiveActivity);
router.delete('/:id', isTeacherOrAdmin, deleteInteractiveActivity);

export default router;
