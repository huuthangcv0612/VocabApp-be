import mongoose from 'mongoose';

const interactiveActivitySchema = new mongoose.Schema(
  {
    interactive_lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InteractiveLesson',
      required: [true, 'Please specify interactive_lesson_id'],
      index: true,
    },
    type: {
      type: String,
      enum: ['flashcard', 'quiz', 'spin', 'matching', 'listening', 'speaking'],
      required: [true, 'Please specify activity type'],
    },
    order: {
      type: Number,
      default: 1,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interactiveActivitySchema.index({ interactive_lesson_id: 1, order: 1 });

export default mongoose.model('InteractiveActivity', interactiveActivitySchema);
