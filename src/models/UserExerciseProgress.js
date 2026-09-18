import mongoose from 'mongoose';

const userExerciseProgressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    exercise_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
      index: true,
    },
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    is_correct: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userExerciseProgressSchema.index(
  { user_id: 1, exercise_id: 1 },
  { unique: true }
);

export default mongoose.model(
  'UserExerciseProgress',
  userExerciseProgressSchema
);
