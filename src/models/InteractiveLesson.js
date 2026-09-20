import mongoose from 'mongoose';

const interactiveLessonSchema = new mongoose.Schema(
  {
    class_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Please specify class_id'],
      index: true,
    },
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify teacher_id'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide interactive lesson title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      default: null,
      index: true,
    },
    vocabulary_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vocabulary',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

interactiveLessonSchema.index({ class_id: 1, status: 1 });
interactiveLessonSchema.index({ teacher_id: 1 });

export default mongoose.model('InteractiveLesson', interactiveLessonSchema);
