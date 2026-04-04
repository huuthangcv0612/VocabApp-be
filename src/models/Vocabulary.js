const mongoose = require('mongoose');

const vocabularySchema = new mongoose.Schema(
  {
    lektionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lektion',
      required: true
    },
    word: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['noun', 'verb', 'adjective', 'adverb', 'other'],
      default: 'other'
    },
    meaning: {
      type: String,
      required: true,
      trim: true
    },
    example: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Vocabulary', vocabularySchema);
