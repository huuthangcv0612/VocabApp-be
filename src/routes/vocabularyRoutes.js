import express from 'express';
import {
  getAllVocabularies,
  getVocabularyById,
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  searchVocabularies,
} from '../controllers/vocabularyController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.get('/', getAllVocabularies);
router.get('/search/:query', searchVocabularies);
router.get('/:id', getVocabularyById);
router.post('/', verifyToken, isAdmin, createVocabulary);
router.put('/:id', verifyToken, isAdmin, updateVocabulary);
router.delete('/:id', verifyToken, isAdmin, deleteVocabulary);

export default router;

