import mongoose from 'mongoose';

const TestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide test name'],
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      required: [true, 'Please specify target level'],
      default: 'A1',
      index: true,
    },
    totalQuestions: {
      type: Number,
      default: 30,
    },
    config: {
      vocabulary: { type: Number, default: 10 },
      grammar: { type: Number, default: 10 },
      reading: { type: Number, default: 10 },
      listening: { type: Number, default: 0 },
    },
    difficultyRatio: {
      easy: { type: Number, default: 40 },
      medium: { type: Number, default: 40 },
      hard: { type: Number, default: 20 },
    },
    timeLimit: {
      type: Number,
      default: 30, // in minutes
    },
    passingScore: {
      type: Number,
      default: 70, // percentage
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Test', TestSchema);
