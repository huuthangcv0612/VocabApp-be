import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    provider: {
      type: String,
      enum: ['VIETQR', 'PAYOS'],
      default: 'VIETQR',
    },

    method: {
      type: String,
      enum: ['BANK_TRANSFER'],
      default: 'BANK_TRANSFER',
    },

    amount: {
      type: Number,
      required: true,
    },

    transactionId: {
      type: String,
      default: null,
      index: true,
    },

    reference: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
    },

    paidAt: {
      type: Date,
      default: null,
    },

    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Payment', paymentSchema);
