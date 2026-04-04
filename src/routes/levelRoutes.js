const express = require('express');
const router = express.Router();
const levelController = require('../controllers/levelController');

// Lấy tất cả Level
router.get('/', levelController.getAllLevels);

// Lấy Level theo ID
router.get('/:id', levelController.getLevelById);

// Lấy Level theo tên
router.get('/name/:name', levelController.getLevelByName);

module.exports = router;
