import mongoose from 'mongoose';

const QuizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a quiz title'],
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    topic: {
      type: String,
      required: [true, 'Please provide a topic'],
      trim: true,
    },
    difficultyLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    questions: [
      {
        _id: mongoose.Schema.Types.ObjectId,
        questionText: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ['multipleChoice', 'shortAnswer', 'matching'],
          default: 'multipleChoice',
        },
        options: [
          {
            text: String,
            isCorrect: Boolean,
          },
        ],
        correctAnswer: {
          type: String,
          required: true,
        },
        explanation: {
          type: String,
          default: null,
        },
      },
    ],
    totalQuestions: {
      type: Number,
      default: function () {
        return this.questions.length;
      },
    },
    timeLimit: {
      type: Number,
      default: 60, // in seconds
    },
    passingScore: {
      type: Number,
      default: 70, // percentage
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Quiz', QuizSchema);
