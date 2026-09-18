import express from 'express';
import {
  getAdminExercises,
  getAdminExerciseById,
  createAdminExercise,
  updateAdminExercise,
  deleteAdminExercise,
  reorderExercises,
} from '../../controllers/admin/adminExerciseController.js';

const router = express.Router();

router.get('/', getAdminExercises);
router.put('/reorder', reorderExercises);
router.get('/:id', getAdminExerciseById);
router.post('/', createAdminExercise);
router.put('/:id', updateAdminExercise);
router.delete('/:id', deleteAdminExercise);

export default router;
