import express from 'express';
import {
  getMySubscription,
  getSubscriptionHistory,
} from '../controllers/subscriptionController.js';
import { verifyToken, requireActiveUser } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(verifyToken, requireActiveUser);

router.get('/current', getMySubscription);
router.get('/history', getSubscriptionHistory);

export default router;
