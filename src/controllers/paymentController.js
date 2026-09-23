import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import Subscription from '../models/Subscription.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * Process successful payment logic and activate/extend user subscription
 */
const processSuccessfulPayment = async ({ order, amount, transactionId, reference, rawData }) => {
  const now = new Date();

  // 1. Atomic Order status update to prevent race conditions
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'PAID' } },
    { $set: { status: 'PAID', paidAt: now } },
    { new: true }
  );

  // If already marked as PAID by another concurrent request, return existing records
  if (!updatedOrder) {
    const existingPayment = await Payment.findOne({ orderId: order._id });
    const existingSub = await Subscription.findOne({ orderId: order._id });
    return { order, payment: existingPayment, subscription: existingSub, alreadyProcessed: true };
  }

  // 2. Update or Create Payment record
  let payment = await Payment.findOne({ orderId: order._id });
  if (payment) {
    payment.status = 'SUCCESS';
    payment.paidAt = now;
    payment.transactionId = transactionId || payment.transactionId;
    payment.reference = reference || payment.reference;
    payment.rawData = rawData || payment.rawData;
    await payment.save();
  } else {
    payment = await Payment.create({
      orderId: order._id,
      userId: order.userId,
      provider: 'VIETQR',
      method: 'BANK_TRANSFER',
      amount: amount || order.amount,
      transactionId: transactionId || null,
      reference: reference || null,
      status: 'SUCCESS',
      paidAt: now,
      rawData: rawData || null,
    });
  }

  // 3. Find Plan details
  const plan = await Plan.findById(order.planId);
  if (!plan) {
    throw new AppError('Associated plan not found', HTTP_STATUS.NOT_FOUND);
  }

  // Check if subscription already exists for this order (idempotency safeguard)
  let subscription = await Subscription.findOne({ orderId: order._id });

  if (!subscription) {
    // 4. Calculate subscription start & end dates
    // Check if user currently has an active subscription
    const currentSub = await Subscription.findOne({
      userId: order.userId,
      status: 'ACTIVE',
      endDate: { $gt: now },
    }).sort({ endDate: -1 });

    let startDate = now;
    if (currentSub && currentSub.endDate > now) {
      startDate = new Date(currentSub.endDate);
    }

    const durationMs = plan.durationDays * 24 * 60 * 60 * 1000;
    const endDate = new Date(startDate.getTime() + durationMs);

    // Deactivate existing active subscriptions
    await Subscription.updateMany(
      { userId: order.userId, status: 'ACTIVE' },
      { status: 'EXPIRED' }
    );

    // Create new active subscription
    subscription = await Subscription.create({
      userId: order.userId,
      planId: plan._id,
      orderId: order._id,
      status: 'ACTIVE',
      startDate,
      endDate,
    });
  }

  return { order: updatedOrder, payment, subscription };
};

/**
 * @desc    Handle payment webhook notification
 * @route   POST /api/payments/webhook
 * @access  Public (Webhook with Secret verification)
 */
export const handlePaymentWebhook = asyncHandler(async (req, res) => {
  // Webhook secret validation
  const configuredSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (configuredSecret && configuredSecret !== 'your_payment_webhook_secret') {
    const incomingSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['x-api-key'] ||
      req.query.secret ||
      req.body?.webhookSecret;

    if (!incomingSecret || incomingSecret !== configuredSecret) {
      throw new AppError('Invalid or missing webhook signature/secret', HTTP_STATUS.UNAUTHORIZED);
    }
  }

  const body = req.body || {};

  // Extract orderCode from body parameters or bank transfer description text
  let orderCode = body.orderCode || body.addInfo || body.content || body.reference || body.orderId;

  // Search for DU... pattern if orderCode is embedded in content string
  if (orderCode && typeof orderCode === 'string') {
    const match = orderCode.match(/DU[A-Z0-9]+/i);
    if (match) {
      orderCode = match[0].toUpperCase();
    }
  }

  if (!orderCode) {
    throw new AppError('Unable to identify orderCode in webhook payload', HTTP_STATUS.BAD_REQUEST);
  }

  const order = await Order.findOne({ orderCode: String(orderCode).toUpperCase() });
  if (!order) {
    throw new AppError(`Order not found with orderCode: ${orderCode}`, HTTP_STATUS.NOT_FOUND);
  }

  // If order is already PAID, return idempotent success
  if (order.status === 'PAID') {
    return sendResponse(res, HTTP_STATUS.OK, 'Payment already processed for this order', {
      orderId: order._id,
      orderCode: order.orderCode,
      status: order.status,
    });
  }

  // Verify amount if passed in payload
  const transferAmount = body.amount || body.transferAmount;
  if (transferAmount !== undefined && Number(transferAmount) < order.amount) {
    throw new AppError(
      `Insufficient payment amount. Required: ${order.amount}, Received: ${transferAmount}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const transactionId = body.transactionId || body.transId || body.id || null;
  const reference = body.reference || body.refNo || null;

  const result = await processSuccessfulPayment({
    order,
    amount: transferAmount || order.amount,
    transactionId,
    reference,
    rawData: body,
  });

  sendResponse(res, HTTP_STATUS.OK, 'Payment webhook processed successfully', {
    orderCode: order.orderCode,
    orderStatus: result.order.status,
    subscriptionStatus: result.subscription?.status || 'ACTIVE',
    expiresAt: result.subscription?.endDate || null,
  });
});

/**
 * @desc    Mock successful payment endpoint for development/testing
 * @route   POST /api/payments/mock-success
 * @access  Private / Admin / Non-Production
 */
export const mockPaymentSuccess = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Mock payment is strictly disabled in production environment', HTTP_STATUS.FORBIDDEN);
  }

  const { orderCode, orderId } = req.body;

  let query = {};
  if (orderCode) {
    query.orderCode = String(orderCode).toUpperCase();
  } else if (orderId) {
    query._id = orderId;
  } else {
    throw new AppError('orderCode or orderId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const order = await Order.findOne(query);
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  if (order.status === 'PAID') {
    return sendResponse(res, HTTP_STATUS.OK, 'Order is already paid', { order });
  }

  const result = await processSuccessfulPayment({
    order,
    amount: order.amount,
    transactionId: `MOCK_TX_${Date.now()}`,
    reference: `MOCK_REF_${Date.now()}`,
    rawData: { mock: true, timestamp: new Date() },
  });

  sendResponse(res, HTTP_STATUS.OK, 'Mock payment completed successfully', {
    order: {
      id: result.order._id,
      orderCode: result.order.orderCode,
      status: result.order.status,
      paidAt: result.order.paidAt,
    },
    payment: {
      status: result.payment?.status || 'SUCCESS',
      transactionId: result.payment?.transactionId || null,
    },
    subscription: {
      id: result.subscription?._id || null,
      status: result.subscription?.status || 'ACTIVE',
      startDate: result.subscription?.startDate || null,
      endDate: result.subscription?.endDate || null,
    },
  });
});

export default {
  handlePaymentWebhook,
  mockPaymentSuccess,
};
