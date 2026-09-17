import express from 'express';
import {
  startConversation,
  sendMessage,
  completeSession,
  getSession,
} from '../controllers/aiConversationController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Require authentication for all AI conversation endpoints
router.use(verifyToken);

// Start conversation
router.post('/start', startConversation);

// Send message to active conversation
router.post('/:sessionId/message', sendMessage);

// Complete conversation
router.post('/:sessionId/complete', completeSession);

// Get conversation session details
router.get('/:sessionId', getSession);

export default router;
