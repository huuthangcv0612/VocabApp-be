import express from 'express';
import {
  getAdminTopics,
  getAdminTopicById,
  createAdminTopic,
  updateAdminTopic,
  deleteAdminTopic,
  reorderTopics,
} from '../../controllers/admin/adminTopicController.js';

const router = express.Router();

router.get('/', getAdminTopics);
router.put('/reorder', reorderTopics);
router.get('/:id', getAdminTopicById);
router.post('/', createAdminTopic);
router.put('/:id', updateAdminTopic);
router.delete('/:id', deleteAdminTopic);

export default router;
