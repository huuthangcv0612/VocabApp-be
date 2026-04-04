const Level = require('../models/Level');

// Lấy tất cả các Level
exports.getAllLevels = async (req, res) => {
  try {
    const levels = await Level.find().sort({ order: 1 });
    res.status(200).json({
      success: true,
      count: levels.length,
      data: levels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Level theo ID
exports.getLevelById = async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);
    if (!level) {
      return res.status(404).json({
        success: false,
        error: 'Level not found'
      });
    }
    res.status(200).json({
      success: true,
      data: level
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Level theo tên
exports.getLevelByName = async (req, res) => {
  try {
    const level = await Level.findOne({ level_name: req.params.name });
    if (!level) {
      return res.status(404).json({
        success: false,
        error: 'Level not found'
      });
    }
    res.status(200).json({
      success: true,
      data: level
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
