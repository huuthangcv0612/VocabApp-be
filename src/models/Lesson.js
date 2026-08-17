import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Please specify a unit_id for the lesson'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide lesson title'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
    estimated_minutes: {
      type: Number,
      default: 5,
    },
    xp: {
      type: Number,
      default: 20,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

lessonSchema.index({ unit_id: 1, order: 1 });
lessonSchema.index({ slug: 1 });

export default mongoose.model('Lesson', lessonSchema);
