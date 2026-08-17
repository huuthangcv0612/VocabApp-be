import express from 'express';
import {
  getAdminUnits,
  getAdminUnitById,
  createAdminUnit,
  updateAdminUnit,
  deleteAdminUnit,
  reorderUnits,
} from '../../controllers/admin/adminUnitController.js';

const router = express.Router();

router.get('/', getAdminUnits);
router.put('/reorder', reorderUnits);
router.get('/:id', getAdminUnitById);
router.post('/', createAdminUnit);
router.put('/:id', updateAdminUnit);
router.delete('/:id', deleteAdminUnit);

export default router;
