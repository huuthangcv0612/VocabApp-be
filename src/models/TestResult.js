import mongoose from 'mongoose';

const TestResultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
    },
    testName: {
      type: String,
      default: 'Quick Test',
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Question',
          required: true,
        },
        selectedOption: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          required: true,
        },
        correctAnswer: String,
        explanation: String,
        skill: String,
        difficulty: String,
      },
    ],
    skillBreakdown: {
      type: Map,
      of: {
        correct: Number,
        total: Number,
        percentage: Number,
      },
      default: {},
    },
    weaknesses: [
      {
        type: String,
      },
    ],
    evaluatedLevel: {
      type: String,
      default: null,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TestResult', TestResultSchema);
