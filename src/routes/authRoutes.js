import express from 'express';
import {
  register,
  login,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin,
  getMe,
} from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/resend-verification', resendVerification);
router.get('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password', (req, res) => {
  const token = req.query.token || '';
  const frontendUrl = process.env.BASE_URL || 'http://localhost:5173';
  return res.redirect(`${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`);
});
router.post('/reset-password', resetPassword);
router.post('/change-password', verifyToken, changePassword);
router.post('/google', googleLogin);
router.get('/me', verifyToken, getMe);

export default router;

