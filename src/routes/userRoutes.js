import express from 'express';
import { getUserProfile, updateUserProfile, changePassword } from '../controllers/userController.js';
import { verifyToken, requireActiveUser } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/profile', verifyToken, getUserProfile);
router.get('/me', verifyToken, getUserProfile);
router.put('/profile', verifyToken, requireActiveUser, updateUserProfile);
router.put('/change-password', verifyToken, requireActiveUser, changePassword);

export default router;
