import express from 'express';
import {
  getAllLevels,
  getLevelById,
  getLevelByName,
  getTopicsByLevel,
} from '../controllers/levelController.js';
import { getUnitsByLevel } from '../controllers/unitController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Lấy tất cả các Level
router.get('/', getAllLevels);

// Lấy Level theo tên
router.get('/name/:name', getLevelByName);

// Lấy các Topic thuộc Level
router.get('/:levelId/topics', getTopicsByLevel);

// Lấy các Unit thuộc Level (Learning Path)
router.get('/:levelId/units', optionalAuth, getUnitsByLevel);

// Lấy Level theo ID hoặc tên
router.get('/:id', getLevelById);

export default router;
