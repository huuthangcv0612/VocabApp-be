import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema(
  {
    topic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: [true, 'Please specify a topic_id for the unit'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide unit title'],
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Backward compatibility virtual: unit_name <-> title
unitSchema.virtual('unit_name').get(function () {
  return this.title;
}).set(function (v) {
  this.title = v;
});

unitSchema.index({ topic_id: 1, order: 1 });
unitSchema.index({ slug: 1 });

export default mongoose.model('Unit', unitSchema);
