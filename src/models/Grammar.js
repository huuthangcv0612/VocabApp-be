import mongoose from 'mongoose';

const grammarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide grammar title'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    rule: {
      type: String,
      trim: true,
      default: '',
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
    },
    examples: [
      {
        german: { type: String, trim: true },
        vietnamese: { type: String, trim: true },
      },
    ],
    level: {
      type: String,
      default: 'A1',
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

grammarSchema.index({ title: 1 });
grammarSchema.index({ level: 1 });
grammarSchema.index({ slug: 1 });

export default mongoose.model('Grammar', grammarSchema);
