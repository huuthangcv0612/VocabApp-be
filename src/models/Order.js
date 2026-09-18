import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },

    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['BANK_TRANSFER'],
      default: 'BANK_TRANSFER',
    },

    expiresAt: {
      type: Date,
    },

    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Order', orderSchema);
