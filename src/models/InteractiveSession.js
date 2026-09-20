import mongoose from 'mongoose';

const responseItemSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activity_type: {
      type: String,
      required: true,
    },
    item_id: {
      type: String,
      default: null,
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    is_correct: {
      type: Boolean,
      default: null,
    },
    submitted_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const interactiveSessionSchema = new mongoose.Schema(
  {
    class_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Please specify class_id'],
      index: true,
    },
    interactive_lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InteractiveLesson',
      required: [true, 'Please specify interactive_lesson_id'],
      index: true,
    },
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify teacher_id'],
      index: true,
    },
    activity_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InteractiveActivity',
      default: null,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'paused', 'ended'],
      default: 'waiting',
      index: true,
    },
    current_item: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    started_at: {
      type: Date,
      default: null,
    },
    ended_at: {
      type: Date,
      default: null,
    },
    responses: {
      type: [responseItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interactiveSessionSchema.index({ class_id: 1, status: 1 });
interactiveSessionSchema.index({ teacher_id: 1, status: 1 });

export default mongoose.model('InteractiveSession', interactiveSessionSchema);
