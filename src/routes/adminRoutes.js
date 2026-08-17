import express from 'express';
import {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getStatistics,
  toggleUserStatus,
} from '../controllers/adminController.js';
import adminLevelRoutes from './admin/adminLevelRoutes.js';
import adminTopicRoutes from './admin/adminTopicRoutes.js';
import adminUnitRoutes from './admin/adminUnitRoutes.js';
import adminLessonRoutes from './admin/adminLessonRoutes.js';
import adminExerciseRoutes from './admin/adminExerciseRoutes.js';
import adminVocabularyRoutes from './admin/adminVocabularyRoutes.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(verifyToken, isAdmin);

// User & Dashboard Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', updateUserRole);
router.patch('/users/:id/toggle-status', toggleUserStatus);
router.get('/statistics', getStatistics);

// Content Management Modules
router.use('/levels', adminLevelRoutes);
router.use('/topics', adminTopicRoutes);
router.use('/units', adminUnitRoutes);
router.use('/lessons', adminLessonRoutes);
router.use('/exercises', adminExerciseRoutes);
router.use('/vocabularies', adminVocabularyRoutes);

export default router;
