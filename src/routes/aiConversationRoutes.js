import express from 'express';
import {
  startConversation,
  sendMessage,
  completeSession,
  getSession,
  textToSpeech,
} from '../controllers/aiConversationController.js';
import { verifyToken, optionalAuth, requireActiveUser } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/planMiddleware.js';
import { PERMISSIONS } from '../utils/constants.js';

const router = express.Router();

// AI Speech synthesis endpoint (accessible with or without token)
router.post('/tts', optionalAuth, textToSpeech);

// Require authentication and Premium ai_learning permission for AI conversation session endpoints
router.use(verifyToken, requireActiveUser);
router.use(requirePermission(PERMISSIONS.AI_LEARNING));

// Start conversation
router.post('/start', startConversation);

// Send message to active conversation
router.post('/:sessionId/message', sendMessage);

// Complete conversation
router.post('/:sessionId/complete', completeSession);

// Get conversation session details
router.get('/:sessionId', getSession);

export default router;
