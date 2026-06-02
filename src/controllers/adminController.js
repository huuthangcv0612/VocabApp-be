import User from '../models/User.js';
import Vocabulary from '../models/Vocabulary.js';
import Quiz from '../models/Quiz.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS, PAGINATION, ROLES } from '../utils/constants.js';

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
export const getAllUsers = asyncHandler(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT
  );
  const skip = (page - 1) * limit;

  const users = await User.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Users fetched successfully',
    {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  );
});

/**
 * @desc    Get user by ID
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
export const getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'User fetched successfully',
    { user }
  );
});

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  // Prevent deleting yourself
  if (user._id.toString() === req.user.id.toString()) {
    throw new AppError('You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
  }

  await User.findByIdAndDelete(req.params.id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    SUCCESS_MESSAGES.RESOURCE_DELETED,
    {}
  );
});

/**
 * @desc    Update user role
 * @route   PUT /api/admin/users/:id/role
 * @access  Private/Admin
 */
export const updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role || ![ROLES.USER, ROLES.ADMIN].includes(role)) {
    throw new AppError('Invalid role', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'User role updated successfully',
    { user }
  );
});

/**
 * @desc    Get statistics
 * @route   GET /api/admin/statistics
 * @access  Private/Admin
 */
export const getStatistics = asyncHandler(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const totalAdmins = await User.countDocuments({ role: ROLES.ADMIN });
  const totalRegularUsers = await User.countDocuments({ role: ROLES.USER });
  const totalVocabularies = await Vocabulary.countDocuments();
  const totalQuizzes = await Quiz.countDocuments();
  const publishedQuizzes = await Quiz.countDocuments({ isPublished: true });

  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Statistics fetched successfully',
    {
      totalUsers,
      totalAdmins,
      totalRegularUsers,
      totalVocabularies,
      totalQuizzes,
      publishedQuizzes,
      recentUsers,
    }
  );
});

/**
 * @desc    Deactivate/Activate user
 * @route   PATCH /api/admin/users/:id/toggle-status
 * @access  Private/Admin
 */
export const toggleUserStatus = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  user.isActive = !user.isActive;
  await user.save();

  sendResponse(
    res,
    HTTP_STATUS.OK,
    `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    { user }
  );
});

export default {
  getAllUsers,
  getUserById,
  deleteUser,
  updateUserRole,
  getStatistics,
  toggleUserStatus,
};
