const Lektion = require('../models/Lektion');

// Lấy tất cả các Lektion
exports.getAllLektions = async (req, res) => {
  try {
    const lektions = await Lektion.find()
      .populate('level_id', 'level_name')
      .sort({ order: 1 });
    res.status(200).json({
      success: true,
      count: lektions.length,
      data: lektions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Lektion theo ID
exports.getLektionById = async (req, res) => {
  try {
    const lektion = await Lektion.findById(req.params.id)
      .populate('level_id', 'level_name');
    if (!lektion) {
      return res.status(404).json({
        success: false,
        error: 'Lektion not found'
      });
    }
    res.status(200).json({
      success: true,
      data: lektion
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy tất cả Lektion theo Level ID
exports.getLektionsByLevelId = async (req, res) => {
  try {
    const lektions = await Lektion.find({ level_id: req.params.levelId })
      .populate('level_id', 'level_name')
      .sort({ order: 1 });
    res.status(200).json({
      success: true,
      count: lektions.length,
      data: lektions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
