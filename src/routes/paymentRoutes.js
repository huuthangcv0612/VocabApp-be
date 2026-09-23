import express from 'express';
import {
  handlePaymentWebhook,
  mockPaymentSuccess,
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Webhook callback (Verified by secret token)
router.post('/webhook', handlePaymentWebhook);

// Dev / Testing helper to simulate successful payment - Restricted to Admin & Non-Production
router.post('/mock-success', verifyToken, isAdmin, mockPaymentSuccess);

export default router;
