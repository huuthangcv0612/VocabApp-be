import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      required: [true, 'Please specify level (A1, A2, B1, B2, C1, C2)'],
      default: 'A1',
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      default: 'General',
    },
    type: {
      type: String,
      enum: ['multiple_choice', 'fill_blank', 'true_false', 'ordering'],
      default: 'multiple_choice',
    },
    question: {
      type: String,
      required: [true, 'Please provide question text'],
      trim: true,
    },
    options: [
      {
        text: {
          type: String,
          required: true,
        },
        isCorrect: {
          type: Boolean,
          default: false,
        },
      },
    ],
    explanation: {
      type: String,
      default: null,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
      index: true,
    },
    skill: {
      type: String,
      enum: ['vocabulary', 'grammar', 'reading', 'listening'],
      default: 'vocabulary',
      index: true,
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

QuestionSchema.index({ level: 1, skill: 1, difficulty: 1, status: 1 });

export default mongoose.model('Question', QuestionSchema);
