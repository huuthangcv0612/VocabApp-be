import express from 'express';
import {
  getAllLevels,
  getLevelById,
  getLevelByName,
  getTopicsByLevel,
} from '../controllers/levelController.js';

const router = express.Router();

// Lấy tất cả các Level
router.get('/', getAllLevels);

// Lấy Level theo tên
router.get('/name/:name', getLevelByName);

// Lấy các Topic thuộc Level
router.get('/:levelId/topics', getTopicsByLevel);

// Lấy Level theo ID hoặc tên
router.get('/:id', getLevelById);

export default router;
