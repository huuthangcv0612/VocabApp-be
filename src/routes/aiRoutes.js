const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Đánh giá câu trả lời của học sinh
router.post('/evaluate-sentence', aiController.evaluateStudentSentence);

// Kiểm tra câu tiếng Đức
router.post('/check-german-sentence', aiController.checkGermanSentence);

// Tạo câu hỏi cho từ vựng
router.post('/generate-question', aiController.generateVocabularyQuestion);

// Phân tích lỗi thường gặp
router.post('/analyze-errors', aiController.analyzeCommonErrors);

module.exports = router;
