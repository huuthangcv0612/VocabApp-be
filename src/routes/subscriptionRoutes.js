import express from 'express';
import {
  getMySubscription,
  getSubscriptionHistory,
} from '../controllers/subscriptionController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/current', getMySubscription);
router.get('/history', getSubscriptionHistory);

export default router;
