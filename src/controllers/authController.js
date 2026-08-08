import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import EmailVerification from '../models/EmailVerification.js';
import PasswordReset from '../models/PasswordReset.js';
import RefreshToken from '../models/RefreshToken.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, HTTP_STATUS } from '../utils/constants.js';
import { sendEmail } from '../utils/emailService.js';
import { sendResponse } from '../utils/responseHandler.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'your_jwt_secret';
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

const buildUserPayload = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  isEmailVerified: user.isEmailVerified,
});

const sendVerificationEmail = async (user, token) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  const link = `${baseUrl}/verify-email?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your email',
    html: `<p>Hello ${user.name || user.email},</p><p>Please verify your email by clicking <a href="${link}">here</a>.</p>`,
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
  const link = `${baseUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Hello ${user.name || user.email},</p><p>Click <a href="${link}">here</a> to reset your password.</p>`,
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res, next) => {
  const username = req.body.username?.trim().toLowerCase();
  const name = req.body.name?.trim() || username;
  const email = req.body.email?.trim().toLowerCase();
  const { password, passwordConfirm } = req.body;

  if (!name || !email || !password || !passwordConfirm) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (password !== passwordConfirm) {
    throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
  }

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

  const user = await User.create({
    name,
    username,
    email,
    password,
    isEmailVerified: false,
  });

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await EmailVerification.create({
    userId: user._id,
    tokenHash: hashToken(verificationToken),
    expiresAt,
  });

  await sendVerificationEmail(user, verificationToken);

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  return res.status(201).json({
    success: true,
    message: 'Đăng ký thành công. Vui lòng xác thực email.',
    token,
    user: buildUserPayload(user),
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const identifier = req.body.email?.trim() || req.body.username?.trim();
  const password = req.body.password;

  if (!identifier || !password) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({
      success: false,
      message: 'Email hoặc mật khẩu không đúng',
    });
  }
  // Debugging logs for login
  console.log("===== LOGIN DEBUG =====");
  console.log("Email:", user.email);
  console.log("isEmailVerified:", user.isEmailVerified);
  console.log(user.toObject());

  if (!user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email chưa được xác thực. Vui lòng kiểm tra email của bạn.',
    });
  }

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  const userPayload = buildUserPayload(user);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: userPayload,
    data: {
      token,
      user: userPayload,
    },
  });
});

/**
 * @desc    Resend email verification
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
export const resendVerification = asyncHandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (user.isEmailVerified) {
    return res.status(200).json({ success: true, message: 'Email already verified' });
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await EmailVerification.deleteMany({ userId: user._id });
  await EmailVerification.create({
    userId: user._id,
    tokenHash: hashToken(verificationToken),
    expiresAt,
  });

  await sendVerificationEmail(user, verificationToken);

  return res.status(200).json({ success: true, message: 'Verification email sent' });
});

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const token = req.query.token;

  if (!token) {
    throw new AppError('Verification token is required', HTTP_STATUS.BAD_REQUEST);
  }

  const verificationRecord = await EmailVerification.findOne({
    tokenHash: hashToken(token),
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verificationRecord) {
    throw new AppError('Invalid or expired verification token', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(verificationRecord.userId);
  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  user.isEmailVerified = true;
  await user.save();
  verificationRecord.used = true;
  await verificationRecord.save();

  return res.status(200).json({ success: true, message: 'Email verified successfully' });
});

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await PasswordReset.deleteMany({ userId: user._id });
  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(resetToken),
    expiresAt,
  });

  await sendPasswordResetEmail(user, resetToken);

  return res.status(200).json({ success: true, message: 'If the email exists, a reset link has been sent' });
});

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { token, password } = req.body;
  const confirmPassword = req.body.confirmPassword || req.body.passwordConfirm;

  if (!token || !password || !confirmPassword) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
  }

  const resetRecord = await PasswordReset.findOne({
    tokenHash: hashToken(token),
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    throw new AppError('Invalid or expired reset token', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(resetRecord.userId).select('+password');
  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  user.password = password;
  await user.save();

  resetRecord.used = true;
  await resetRecord.save();

  await RefreshToken.deleteMany({ userId: user._id });

  return res.status(200).json({ success: true, message: 'Password reset successfully' });
});

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match', HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const isMatch = await user.matchPassword(oldPassword);
  if (!isMatch) {
    throw new AppError('Old password is incorrect', HTTP_STATUS.BAD_REQUEST);
  }

  user.password = newPassword;
  await user.save();
  await RefreshToken.deleteMany({ userId: user._id });

  return res.status(200).json({ success: true, message: 'Password updated successfully' });
});

/**
 * @desc    Google login
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleLogin = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  if (!googleClient) {
    throw new AppError('Google OAuth is not configured', HTTP_STATUS.BAD_REQUEST);
  }

  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.email_verified) {
    throw new AppError('Google email is not verified', HTTP_STATUS.BAD_REQUEST);
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    const username = payload.email.split('@')[0].toLowerCase();
    user = await User.create({
      name: payload.name || payload.given_name || 'Google User',
      username,
      email,
      password: crypto.randomBytes(24).toString('hex'),
      isEmailVerified: true,
      avatar: payload.picture || null,
    });
  } else if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    await user.save();
  }

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: buildUserPayload(user),
  });
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const userPayload = user ? buildUserPayload(user) : null;

  return res.status(200).json({
    success: true,
    message: 'User fetched successfully',
    user: userPayload,
    data: {
      user: userPayload,
    },
  });
});

export default {
  register,
  login,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin,
  getMe,
};

