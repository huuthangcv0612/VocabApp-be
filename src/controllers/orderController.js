import Order from '../models/Order.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import { generateOrderCode } from '../utils/orderUtils.js';
import { generateVietQR } from '../services/vietqrService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS, ROLES } from '../utils/constants.js';

/**
 * @desc    Create new order for a plan
 * @route   POST /api/orders
 * @access  Private
 */
export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { planId } = req.body;

  if (!planId) {
    throw new AppError('planId is required', HTTP_STATUS.BAD_REQUEST);
  }

  const plan = await Plan.findOne({
    _id: planId,
    isActive: true,
  });

  if (!plan) {
    throw new AppError('Plan not found or inactive', HTTP_STATUS.NOT_FOUND);
  }

  const orderCode = generateOrderCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiration

  const order = await Order.create({
    userId,
    planId: plan._id,
    orderCode,
    amount: plan.price,
    status: 'PENDING',
    paymentMethod: 'BANK_TRANSFER',
    expiresAt,
  });

  await Payment.create({
    orderId: order._id,
    userId,
    provider: 'VIETQR',
    method: 'BANK_TRANSFER',
    amount: plan.price,
    status: 'PENDING',
  });

  const qrCodeUrl = generateVietQR({
    amount: plan.price,
    orderCode,
  });

  sendResponse(
    res,
    HTTP_STATUS.CREATED,
    'Order created successfully',
    {
      order: {
        id: order._id,
        orderCode: order.orderCode,
        amount: order.amount,
        status: order.status,
        expiresAt: order.expiresAt,
      },
      payment: {
        method: 'BANK_TRANSFER',
        qrCodeUrl,
        accountName: process.env.PAYMENT_ACCOUNT_NAME || 'DEUTSCHUP',
        accountNumber: process.env.PAYMENT_ACCOUNT_NO || '0123456789',
        bankId: process.env.PAYMENT_BANK_ID || '970407',
        transferContent: order.orderCode,
      },
    }
  );
});

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const userRole = req.user.role;

  const order = await Order.findById(req.params.id).populate('planId', 'name code durationDays');

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (order.userId.toString() !== userId.toString() && userRole !== ROLES.ADMIN) {
    throw new AppError('Not authorized to access this order', HTTP_STATUS.FORBIDDEN);
  }

  // Auto-expire order if PENDING and past expiresAt
  if (order.status === 'PENDING' && order.expiresAt && new Date() > order.expiresAt) {
    order.status = 'EXPIRED';
    await order.save();
    await Payment.findOneAndUpdate(
      { orderId: order._id, status: 'PENDING' },
      { status: 'FAILED' }
    );
  }

  const qrCodeUrl = generateVietQR({
    amount: order.amount,
    orderCode: order.orderCode,
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Order retrieved successfully',
    {
      order: {
        id: order._id,
        orderCode: order.orderCode,
        amount: order.amount,
        status: order.status,
        expiresAt: order.expiresAt,
        paidAt: order.paidAt,
        plan: order.planId,
        createdAt: order.createdAt,
      },
      payment: {
        qrCodeUrl,
        accountName: process.env.PAYMENT_ACCOUNT_NAME || 'DEUTSCHUP',
        accountNumber: process.env.PAYMENT_ACCOUNT_NO || '0123456789',
        bankId: process.env.PAYMENT_BANK_ID || '970407',
        transferContent: order.orderCode,
      },
    }
  );
});

/**
 * @desc    Get authenticated user's orders
 * @route   GET /api/orders
 * @access  Private
 */
export const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const orders = await Order.find({ userId })
    .populate('planId', 'name code durationDays price')
    .sort({ createdAt: -1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Orders fetched successfully',
    { orders }
  );
});

/**
 * @desc    Cancel a pending order
 * @route   POST /api/orders/:id/cancel
 * @access  Private
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  if (order.userId.toString() !== userId.toString() && req.user.role !== ROLES.ADMIN) {
    throw new AppError('Not authorized to cancel this order', HTTP_STATUS.FORBIDDEN);
  }

  if (order.status !== 'PENDING') {
    throw new AppError(`Cannot cancel order with status ${order.status}`, HTTP_STATUS.BAD_REQUEST);
  }

  order.status = 'CANCELLED';
  await order.save();

  await Payment.findOneAndUpdate(
    { orderId: order._id, status: 'PENDING' },
    { status: 'FAILED' }
  );

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Order cancelled successfully',
    { order }
  );
});

/**
 * @desc    Get all orders (Admin)
 * @route   GET /api/orders/admin/all
 * @access  Private/Admin
 */
export const getAllOrdersAdmin = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate('userId', 'name email')
    .populate('planId', 'name code price')
    .sort({ createdAt: -1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'All orders fetched successfully',
    { orders }
  );
});

export default {
  createOrder,
  getOrderById,
  getUserOrders,
  cancelOrder,
  getAllOrdersAdmin,
};
