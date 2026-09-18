import mongoose from 'mongoose';

const userVocabularyProgressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vocabulary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      required: true,
      index: true,
    },
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      default: null,
    },
    lektion_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lektion',
      default: null,
    },
    status: {
      type: String,
      enum: ['new', 'learning', 'review', 'mastered', 'learned'],
      default: 'new',
    },
    mastery_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    correct_count: {
      type: Number,
      default: 0,
    },
    wrong_count: {
      type: Number,
      default: 0,
    },
    streak: {
      type: Number,
      default: 0,
    },
    interval: {
      type: Number,
      default: 1, // in days
    },
    last_reviewed_at: {
      type: Date,
      default: null,
    },
    next_review_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

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
