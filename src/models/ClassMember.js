import mongoose from 'mongoose';

const classMemberSchema = new mongoose.Schema(
  {
    class_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Please specify class_id'],
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify user_id'],
      index: true,
    },
    role: {
      type: String,
      enum: ['teacher', 'student'],
      default: 'student',
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'removed'],
      default: 'active',
      index: true,
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unique compound index so a user cannot be added twice to the same class
classMemberSchema.index({ class_id: 1, user_id: 1 }, { unique: true });
classMemberSchema.index({ user_id: 1, status: 1 });

export default mongoose.model('ClassMember', classMemberSchema);
