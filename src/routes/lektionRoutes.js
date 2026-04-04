const express = require('express');
const router = express.Router();
const lektionController = require('../controllers/lektionController');

// Lấy tất cả Lektion
router.get('/', lektionController.getAllLektions);

// Lấy Lektion theo ID
router.get('/:id', lektionController.getLektionById);

// Lấy Lektion theo Level ID
router.get('/level/:levelId', lektionController.getLektionsByLevelId);

module.exports = router;
