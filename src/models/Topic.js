import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    level_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level',
      default: null,
    },
    name: {
      type: String,
      trim: true,
    },
    topic_name: {
      type: String,
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
    image_url: {
      type: String,
      default: null,
      trim: true,
    },
    icon: {
      type: String,
      default: null,
      trim: true,
    },
    order: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
    isActive: {
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

// Virtual alias: topic_name <-> name
topicSchema.virtual('displayName').get(function () {
  return this.name || this.topic_name;
});

// Pre-save hook to ensure both name and topic_name are populated & sync image_url/icon/status/isActive
topicSchema.pre('save', function (next) {
  if (this.name && !this.topic_name) {
    this.topic_name = this.name;
  } else if (this.topic_name && !this.name) {
    this.name = this.topic_name;
  }

  if (this.image_url && !this.icon) {
    this.icon = this.image_url;
  } else if (this.icon && !this.image_url) {
    this.image_url = this.icon;
  }

  if (this.status === 'draft') {
    this.isActive = false;
  } else if (this.status === 'published') {
    this.isActive = true;
  }
  next();
});

topicSchema.index({ level_id: 1 });
topicSchema.index({ name: 1 });
topicSchema.index({ topic_name: 1 });
topicSchema.index({ slug: 1 });
topicSchema.index({ status: 1 });

export default mongoose.model('Topic', topicSchema);
