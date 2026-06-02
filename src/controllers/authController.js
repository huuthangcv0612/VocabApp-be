import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS } from '../utils/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  console.log('REGISTER BODY:', req.body);
  const username = req.body.username?.trim().toLowerCase();
  const name = req.body.name?.trim() || username;
  const email = req.body.email?.trim().toLowerCase();
  const { password, passwordConfirm } = req.body;

  // Validation
  if (!name || !email || !password || !passwordConfirm) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (password !== passwordConfirm) {
    throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  if (username) {
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      throw new AppError('Username already exists.', HTTP_STATUS.CONFLICT);
    }
  }

  // Create user
  const user = await User.create({
    name,
    username,
    email,
    password,
  });

  const token = generateToken(user._id);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  console.log('LOGIN BODY:', req.body);
  const identifier = req.body.email?.trim() || req.body.username?.trim();
  const password = req.body.password;

  // Validation
  if (!identifier || !password) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  }).select('+password');

  console.log('FOUND USER:', user ? { id: user._id, email: user.email, username: user.username } : null);
  console.log('DB PASSWORD:', user?.password);

  const isMatch = user ? await user.matchPassword(password) : false;
  console.log('COMPARE RESULT:', isMatch);

  if (!user || !isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Email hoặc mật khẩu không đúng',
    });
  }

  const token = generateToken(user._id);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'User fetched successfully',
    { user }
  );
});

export default { register, login, getMe };

