import express from 'express';
import {
  getAllUnits,
  getUnitById,
  getUnitsByTopic,
  createUnit,
  updateUnit,
  deleteUnit,
} from '../controllers/unitController.js';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Public / User read endpoints
router.get('/', optionalAuth, getAllUnits);
router.get('/topic/:topicId', optionalAuth, getUnitsByTopic);
router.get('/:id', optionalAuth, getUnitById);

// Protected Admin routes
router.post('/', verifyToken, isAdmin, createUnit);
router.put('/:id', verifyToken, isAdmin, updateUnit);
router.delete('/:id', verifyToken, isAdmin, deleteUnit);

export default router;
