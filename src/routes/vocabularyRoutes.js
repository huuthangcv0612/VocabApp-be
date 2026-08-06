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
import {
  validateCreateVocabulary,
  validateUpdateVocabulary,
} from '../validators/vocabularyValidator.js';

const router = express.Router();

// Require authentication for all vocabulary operations
router.use(verifyToken);

// Public/User & Admin read endpoints
router.get('/', getAllVocabularies);
router.get('/search/:query', searchVocabularies);
router.get('/:id', getVocabularyById);

// Admin-only CRUD operations
router.post('/', isAdmin, validateCreateVocabulary, createVocabulary);
router.put('/:id', isAdmin, validateUpdateVocabulary, updateVocabulary);
router.delete('/:id', isAdmin, deleteVocabulary);

export default router;
