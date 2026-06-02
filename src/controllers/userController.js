import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getUserProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Profile fetched successfully',
    { user }
  );
});

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateUserProfile = asyncHandler(async (req, res, next) => {
  const { name, avatar } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, avatar },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.PROFILE_UPDATED,
    { user }
  );
});

/**
 * @desc    Change password
 * @route   PUT /api/users/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, passwordConfirm } = req.body;

  if (!currentPassword || !newPassword || !passwordConfirm) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (newPassword !== passwordConfirm) {
    throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    throw new AppError('Current password is incorrect', HTTP_STATUS.UNAUTHORIZED);
  }

  user.password = newPassword;
  await user.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.PASSWORD_UPDATED,
    {}
  );
});

export default { getUserProfile, updateUserProfile, changePassword };
