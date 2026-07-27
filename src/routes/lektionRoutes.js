import express from 'express';
import {
  getAllLektions,
  getLektionById,
  getLektionsByLevelId,
} from '../controllers/lektionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// Lấy tất cả Lektion
router.get('/', getAllLektions);

// Lấy Lektion theo ID
router.get('/:id', getLektionById);

// Lấy Lektion theo Level ID
router.get('/level/:levelId', getLektionsByLevelId);

export default router;
