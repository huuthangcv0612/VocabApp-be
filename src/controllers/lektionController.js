import Lektion from '../models/Lektion.js';
import Vocabulary from '../models/Vocabulary.js';

const attachVocabularyCount = async (lektion) => {
  const vocabularyCount = await Vocabulary.countDocuments({ lektionId: lektion._id });
  return {
    ...lektion.toObject(),
    vocabularyCount,
  };
};

// Lấy tất cả các Lektion
export const getAllLektions = async (req, res) => {
  try {
    const lektions = await Lektion.find()
      .populate('level_id', 'level_name')
      .sort({ order: 1 });

    const lektionsWithCount = await Promise.all(
      lektions.map((lektion) => attachVocabularyCount(lektion))
    );

    res.status(200).json({
      success: true,
      count: lektionsWithCount.length,
      data: lektionsWithCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Lektion theo ID
export const getLektionById = async (req, res) => {
  try {
    const lektion = await Lektion.findById(req.params.id)
      .populate('level_id', 'level_name');
    if (!lektion) {
      return res.status(404).json({
        success: false,
        error: 'Lektion not found'
      });
    }

    const lektionWithCount = await attachVocabularyCount(lektion);

    res.status(200).json({
      success: true,
      data: lektionWithCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy tất cả Lektion theo Level ID
export const getLektionsByLevelId = async (req, res) => {
  try {
    const lektions = await Lektion.find({ level_id: req.params.levelId })
      .populate('level_id', 'level_name')
      .sort({ order: 1 });

    const lektionsWithCount = await Promise.all(
      lektions.map((lektion) => attachVocabularyCount(lektion))
    );

    res.status(200).json({
      success: true,
      count: lektionsWithCount.length,
      data: lektionsWithCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
