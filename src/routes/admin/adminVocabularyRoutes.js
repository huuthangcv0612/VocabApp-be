import express from 'express';
import {
  getAdminVocabularies,
  getAdminVocabularyById,
  createAdminVocabulary,
  updateAdminVocabulary,
  deleteAdminVocabulary,
} from '../../controllers/admin/adminVocabularyController.js';

const router = express.Router();

router.get('/', getAdminVocabularies);
router.get('/:id', getAdminVocabularyById);
router.post('/', createAdminVocabulary);
router.put('/:id', updateAdminVocabulary);
router.delete('/:id', deleteAdminVocabulary);

export default router;
