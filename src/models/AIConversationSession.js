import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const mistakeSchema = new mongoose.Schema(
  {
    vocabulary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      default: null,
    },
    user_text: {
      type: String,
      default: '',
    },
    correction: {
      type: String,
      default: '',
    },
    explanation: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const aiConversationSessionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify user_id'],
      index: true,
    },
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'Please specify lesson_id'],
      index: true,
    },
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      required: [true, 'Please specify level_id'],
    },
    scenario: {
      type: String,
      default: '',
      trim: true,
    },
    target_vocabulary: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary',
      },
    ],
    messages: [messageSchema],
    used_vocabulary: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary',
      },
    ],
    mistakes: [mistakeSchema],
    turn_count: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    completedAt: {
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

aiConversationSessionSchema.index({ user_id: 1, lesson_id: 1 });
aiConversationSessionSchema.index({ user_id: 1, status: 1 });

export default mongoose.model('AIConversationSession', aiConversationSessionSchema, 'ai_conversation_sessions');
