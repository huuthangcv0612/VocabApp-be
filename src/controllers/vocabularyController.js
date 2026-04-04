const Vocabulary = require('../models/Vocabulary');

// Lấy tất cả Vocabulary
exports.getAllVocabulary = async (req, res) => {
  try {
    const vocabulary = await Vocabulary.find()
      .populate('lektionId', 'lekttion_name')
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: vocabulary.length,
      data: vocabulary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Vocabulary theo ID
exports.getVocabularyById = async (req, res) => {
  try {
    const vocab = await Vocabulary.findById(req.params.id)
      .populate('lektionId', 'lekttion_name');
    if (!vocab) {
      return res.status(404).json({
        success: false,
        error: 'Vocabulary not found'
      });
    }
    res.status(200).json({
      success: true,
      data: vocab
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy tất cả Vocabulary theo Lektion ID
exports.getVocabularyByLektionId = async (req, res) => {
  try {
    const vocabulary = await Vocabulary.find({ lektionId: req.params.lektionId })
      .populate('lektionId', 'lekttion_name')
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: vocabulary.length,
      data: vocabulary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Tìm Vocabulary theo từ khóa
exports.searchVocabulary = async (req, res) => {
  try {
    const keyword = req.query.q || '';
    const vocabulary = await Vocabulary.find({
      $or: [
        { word: { $regex: keyword, $options: 'i' } },
        { meaning: { $regex: keyword, $options: 'i' } }
      ]
    }).populate('lektionId', 'lekttion_name');
    
    res.status(200).json({
      success: true,
      count: vocabulary.length,
      data: vocabulary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy Vocabulary theo loại (type)
exports.getVocabularyByType = async (req, res) => {
  try {
    const vocabulary = await Vocabulary.find({ type: req.params.type })
      .populate('lektionId', 'lekttion_name');
    res.status(200).json({
      success: true,
      count: vocabulary.length,
      data: vocabulary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
