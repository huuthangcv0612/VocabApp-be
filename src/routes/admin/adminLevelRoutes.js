import express from 'express';
import {
  getAdminLevels,
  getAdminLevelById,
  createAdminLevel,
  updateAdminLevel,
  deleteAdminLevel,
} from '../../controllers/admin/adminLevelController.js';

const router = express.Router();

router.get('/', getAdminLevels);
router.get('/:id', getAdminLevelById);
router.post('/', createAdminLevel);
router.put('/:id', updateAdminLevel);
router.delete('/:id', deleteAdminLevel);

export default router;
