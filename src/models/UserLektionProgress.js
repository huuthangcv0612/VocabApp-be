import mongoose from 'mongoose';

const userLektionProgressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    lektion_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lektion',
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Một user chỉ có một progress cho một Lektion
userLektionProgressSchema.index(
  {
    user_id: 1,
    lektion_id: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model(
  'UserLektionProgress',
  userLektionProgressSchema
);
