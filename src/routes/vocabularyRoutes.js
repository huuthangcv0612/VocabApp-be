import express from 'express';
import {
  getAllVocabularies,
  getVocabularyById,
  getVocabulariesByLektion,
  createVocabulary,
  updateVocabulary,
  deleteVocabulary,
  searchVocabularies,
} from '../controllers/vocabularyController.js';
import { verifyToken, optionalAuth, requireActiveUser } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';
import { isTeacherOrAdmin } from '../middlewares/planMiddleware.js';
import {
  validateCreateVocabulary,
  validateUpdateVocabulary,
} from '../validators/vocabularyValidator.js';

const router = express.Router();

// Public / User read endpoints
router.get('/', optionalAuth, getAllVocabularies);
router.get('/search', optionalAuth, searchVocabularies);
router.get('/search/:query', optionalAuth, searchVocabularies);
router.get('/lektion/:lektionId', optionalAuth, getVocabulariesByLektion);
router.get('/:id', optionalAuth, getVocabularyById);

// Creation allowed for Admin & Teachers with Custom plan
router.post('/', verifyToken, requireActiveUser, isTeacherOrAdmin, validateCreateVocabulary, createVocabulary);

// Admin-only updates and deletions
router.put('/:id', verifyToken, requireActiveUser, isAdmin, validateUpdateVocabulary, updateVocabulary);
router.delete('/:id', verifyToken, requireActiveUser, isAdmin, deleteVocabulary);

export default router;
