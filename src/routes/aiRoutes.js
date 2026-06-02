import express from 'express';
import {
  evaluateStudentSentence,
  checkGermanSentence,
  generateVocabularyQuestion,
  analyzeCommonErrors,
} from '../controllers/aiController.js';

const router = express.Router();

// Đánh giá câu trả lời của học sinh
router.post('/evaluate-sentence', evaluateStudentSentence);

// Kiểm tra câu tiếng Đức
router.post('/check-german-sentence', checkGermanSentence);

// Tạo câu hỏi cho từ vựng
router.post('/generate-question', generateVocabularyQuestion);

// Phân tích lỗi thường gặp
router.post('/analyze-errors', analyzeCommonErrors);

export default router;
