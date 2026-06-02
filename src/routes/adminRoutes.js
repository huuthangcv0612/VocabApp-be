import express from 'express';
import {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getStatistics,
  toggleUserStatus,
} from '../controllers/adminController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(verifyToken, isAdmin);

router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', updateUserRole);
router.patch('/users/:id/toggle-status', toggleUserStatus);
router.get('/statistics', getStatistics);

export default router;
