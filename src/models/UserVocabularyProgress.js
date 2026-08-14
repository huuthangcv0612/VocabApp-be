import mongoose from 'mongoose';

const userVocabularyProgressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vocabulary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      required: true,
    },
    lektion_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lektion',
      required: true,
    },
    status: {
      type: String,
      enum: ['learning', 'learned'],
      default: 'learning',
    },
    correct_count: {
      type: Number,
      default: 0,
    },
    wrong_count: {
      type: Number,
      default: 0,
    },
    review_count: {
      type: Number,
      default: 0,
    },
    last_reviewed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Một user chỉ có một progress cho một Vocabulary
userVocabularyProgressSchema.index(
  {
    user_id: 1,
    vocabulary_id: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model(
  'UserVocabularyProgress',
  userVocabularyProgressSchema
);
