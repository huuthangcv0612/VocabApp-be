import express from 'express';
import {
  startConversation,
  sendMessage,
  completeSession,
  getSession,
  textToSpeech,
} from '../controllers/aiConversationController.js';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// AI Speech synthesis endpoint (accessible with or without token)
router.post('/tts', optionalAuth, textToSpeech);

// Require authentication for all AI conversation session endpoints
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
