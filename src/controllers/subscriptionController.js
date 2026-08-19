import Subscription from '../models/Subscription.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get user's current active subscription
 * @route   GET /api/subscriptions/current
 * @access  Private
 */
export const getMySubscription = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const now = new Date();

  // Find active subscription
  let subscription = await Subscription.findOne({
    userId,
    status: 'ACTIVE',
  }).populate('planId', 'name code durationDays price description features');

  // Check if active subscription has expired
  if (subscription && subscription.endDate < now) {
    subscription.status = 'EXPIRED';
    await subscription.save();
    subscription = null;
  }

  const isPremium = Boolean(subscription && subscription.status === 'ACTIVE');

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Current subscription retrieved successfully',
    {
      isPremium,
      subscription: subscription || null,
    }
  );
});

/**
 * @desc    Get user's subscription history
 * @route   GET /api/subscriptions/history
 * @access  Private
 */
export const getSubscriptionHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const subscriptions = await Subscription.find({ userId })
    .populate('planId', 'name code durationDays price')
    .populate('orderId', 'orderCode amount status paidAt')
    .sort({ createdAt: -1 });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Subscription history retrieved successfully',
    { subscriptions }
  );
});

export default {
  getMySubscription,
  getSubscriptionHistory,
};
