import express from 'express';
import {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '../controllers/planController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getPlans);
router.get('/:id', getPlanById);

// Admin routes
router.post('/', verifyToken, isAdmin, createPlan);
router.put('/:id', verifyToken, isAdmin, updatePlan);
router.delete('/:id', verifyToken, isAdmin, deletePlan);

export default router;
