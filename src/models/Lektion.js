import mongoose from 'mongoose';

const lektionSchema = new mongoose.Schema(
  {
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      required: true,
    },
    topic_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    lektion_name: {
      type: String,
      required: true,
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
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },
    level: {
      type: String,
      trim: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    vocabulary_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Backward compatibility virtuals
lektionSchema.virtual('lekttion_name').get(function () {
  return this.lektion_name;
}).set(function (v) {
  this.lektion_name = v;
});

lektionSchema.virtual('title').get(function () {
  return this.lektion_name;
}).set(function (v) {
  this.lektion_name = v;
});

lektionSchema.virtual('vocabularyCount').get(function () {
  return this.vocabulary_count;
}).set(function (v) {
  this.vocabulary_count = v;
});

lektionSchema.index({ level_id: 1, topic_id: 1 });
lektionSchema.index({ slug: 1 });

export default mongoose.model('Lektion', lektionSchema);
