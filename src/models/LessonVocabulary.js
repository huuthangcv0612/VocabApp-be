import mongoose from 'mongoose';

const lessonVocabularySchema = new mongoose.Schema(
  {
    lesson_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: [true, 'Please specify lesson_id'],
      index: true,
    },
    vocabulary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary',
      required: [true, 'Please specify vocabulary_id'],
      index: true,
    },
    order: {
      type: Number,
      default: 1,
    },
    is_new: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

lessonVocabularySchema.index(
  { lesson_id: 1, vocabulary_id: 1 },
  { unique: true }
);

lessonVocabularySchema.index({ lesson_id: 1, order: 1 });

export default mongoose.model('LessonVocabulary', lessonVocabularySchema);
