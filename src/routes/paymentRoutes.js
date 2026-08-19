import express from 'express';
import {
  handlePaymentWebhook,
  mockPaymentSuccess,
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Webhook callback (No auth required as it is called by external payment processor)
router.post('/webhook', handlePaymentWebhook);

// Dev / Testing helper to simulate successful payment
router.post('/mock-success', verifyToken, mockPaymentSuccess);

export default router;
