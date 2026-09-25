import express from 'express';
import {
  evaluateStudentSentence,
  checkGermanSentence,
  generateVocabularyQuestion,
  analyzeCommonErrors,
} from '../controllers/aiController.js';
import { chatWithAssistant } from '../controllers/faqAssistantController.js';
import aiConversationRoutes from './aiConversationRoutes.js';
import { verifyToken, optionalAuth, requireActiveUser } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/planMiddleware.js';
import { PERMISSIONS } from '../utils/constants.js';

const router = express.Router();

// AI Assistant FAQ chatbot (available to both guests & registered users)
router.post('/assistant/chat', optionalAuth, chatWithAssistant);

// Mount AI Conversations sub-router (support both /conversations and /conversation)
router.use(['/conversations', '/conversation'], aiConversationRoutes);

// Protected learning AI features require Authentication & Premium (ai_learning permission)
router.use(verifyToken, requireActiveUser);
router.use(requirePermission(PERMISSIONS.AI_LEARNING));

// Đánh giá câu trả lời của học sinh
router.post('/evaluate-sentence', evaluateStudentSentence);

// Kiểm tra câu tiếng Đức
router.post('/check-german-sentence', checkGermanSentence);

// Tạo câu hỏi cho từ vựng
router.post('/generate-question', generateVocabularyQuestion);

// Phân tích lỗi thường gặp
router.post('/analyze-errors', analyzeCommonErrors);

export default router;
