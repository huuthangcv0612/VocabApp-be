const express = require('express');
const router = express.Router();
const vocabularyController = require('../controllers/vocabularyController');

// Lấy tất cả Vocabulary
router.get('/', vocabularyController.getAllVocabulary);

// Tìm kiếm Vocabulary
router.get('/search', vocabularyController.searchVocabulary);

// Lấy Vocabulary theo loại (type)
router.get('/type/:type', vocabularyController.getVocabularyByType);

// Lấy Vocabulary theo ID
router.get('/:id', vocabularyController.getVocabularyById);

// Lấy Vocabulary theo Lektion ID
router.get('/lektion/:lektionId', vocabularyController.getVocabularyByLektionId);

module.exports = router;
