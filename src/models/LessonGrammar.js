import mongoose from 'mongoose';

const lessonGrammarSchema = new mongoose.Schema(
  {
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'Please specify lesson_id'],
      index: true,
    },
    grammar_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grammar',
      required: [true, 'Please specify grammar_id'],
      index: true,
    },
    order: {
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

lessonGrammarSchema.index(
  { lesson_id: 1, grammar_id: 1 },
  { unique: true }
);

lessonGrammarSchema.index({ lesson_id: 1, order: 1 });

export default mongoose.model('LessonGrammar', lessonGrammarSchema);
