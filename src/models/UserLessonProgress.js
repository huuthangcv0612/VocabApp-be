import mongoose from 'mongoose';

const userLessonProgressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    xp_earned: {
      type: Number,
      default: 0,
    },
    started_at: {
      type: Date,
      default: Date.now,
    },
    completed_at: {
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

userLessonProgressSchema.index(
  { user_id: 1, lesson_id: 1 },
  { unique: true }
);

export default mongoose.model('UserLessonProgress', userLessonProgressSchema);
