import express from 'express';
import {
  getAllLevels,
  getLevelById,
  getLevelByName,
} from '../controllers/levelController.js';

const router = express.Router();

// Lấy tất cả các Level
router.get('/', getAllLevels);

// Lấy Level theo ID
router.get('/:id', getLevelById);

// Lấy Level theo tên
router.get('/name/:name', getLevelByName);

export default router;
