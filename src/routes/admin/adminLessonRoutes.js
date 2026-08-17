import express from 'express';
import {
  getAdminLessons,
  getAdminLessonById,
  getAdminLessonDetail,
  createAdminLesson,
  updateAdminLesson,
  deleteAdminLesson,
  reorderLessons,
} from '../../controllers/admin/adminLessonController.js';
import {
  addAdminLessonVocabulary,
  removeAdminLessonVocabulary,
  reorderAdminLessonVocabularies,
} from '../../controllers/admin/adminVocabularyController.js';

const router = express.Router();

router.get('/', getAdminLessons);
router.put('/reorder', reorderLessons);
router.get('/:id/detail', getAdminLessonDetail);
router.get('/:id', getAdminLessonById);
router.post('/', createAdminLesson);
router.put('/:id', updateAdminLesson);
router.delete('/:id', deleteAdminLesson);

// Lesson Vocabularies
router.post('/:lessonId/vocabularies', addAdminLessonVocabulary);
router.delete('/:lessonId/vocabularies/:vocabularyId', removeAdminLessonVocabulary);
router.put('/:lessonId/vocabularies/order', reorderAdminLessonVocabularies);

export default router;
