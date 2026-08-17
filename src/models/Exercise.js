import mongoose from 'mongoose';

export const EXERCISE_TYPES = [
  'multiple_choice',
  'listening',
  'translation',
  'fill_blank',
  'word_arrangement',
  'matching',
  'image_choice',
  'speaking',
  'sentence',
];

const exerciseSchema = new mongoose.Schema(
  {
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'Please specify a lesson_id for the exercise'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Please specify exercise type'],
      enum: {
        values: EXERCISE_TYPES,
        message: '{VALUE} is not a valid exercise type',
      },
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    vocabulary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      default: null,
    },
    grammar_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grammar',
      default: null,
    },
    xp: {
      type: Number,
      default: 2,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

exerciseSchema.index({ lesson_id: 1, order: 1 });
exerciseSchema.index({ type: 1 });

export default mongoose.model('Exercise', exerciseSchema);
