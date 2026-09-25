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
import { getUserPlanAndPermissions } from '../services/permissionService.js';

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

const getFrontendUrl = () => {
  const url = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:5173';
  return url.replace(/\/+$/, '');
};

const buildUserPayload = (user) => {
  const isLocked = user.status === 'locked' || user.isActive === false;
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    status: isLocked ? 'locked' : (user.status || 'active'),
    lockReason: isLocked ? (user.lockReason || null) : null,
    lockedAt: isLocked ? (user.lockedAt || null) : null,
    isEmailVerified: Boolean(user.isEmailVerified ?? user.emailVerified),
    emailVerified: Boolean(user.emailVerified ?? user.isEmailVerified),
  };
};

const buildUserPayloadWithPlan = async (user) => {
  const basePayload = buildUserPayload(user);
  try {
    const planInfo = await getUserPlanAndPermissions(user);
    return {
      ...basePayload,
      plan: planInfo.plan,
      permissions: planInfo.permissions,
      subscription: planInfo.subscription,
      hasCustomPlan: planInfo.hasCustomPlan,
      canManageClasses: planInfo.canManageClasses,
      can_create_class: planInfo.can_create_class,
      isTeacher: planInfo.isTeacher,
    };
  } catch (err) {
    return basePayload;
  }
};

const sendVerificationEmail = async (user, token) => {
  const frontendUrl = getFrontendUrl();
  const link = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const displayName = user.name || user.username || user.email;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f8fafc; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { margin-bottom: 24px; text-align: center; }
    .title { font-size: 24px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .content { font-size: 16px; color: #334155; margin-bottom: 32px; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; }
    .footer { font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .link-alt { font-size: 13px; color: #94a3b8; word-break: break-all; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">DeutschUp</h1>
    </div>
    <div class="content">
      <p>Xin chào ${displayName},</p>
      <p>Cảm ơn bạn đã đăng ký DeutschUp.</p>
      <p>Bạn vui lòng ấn vào nút bên dưới để xác nhận đăng ký tài khoản:</p>
      <div class="button-container">
        <a href="${link}" class="button" target="_blank">Xác nhận đăng ký</a>
      </div>
      <p>Nếu bạn không thực hiện đăng ký tài khoản này, bạn có thể bỏ qua email này.</p>
      <p class="link-alt">Nếu nút trên không hoạt động, bạn có thể copy link sau vào trình duyệt:<br><a href="${link}">${link}</a></p>
    </div>
    <div class="footer">
      <p>Trân trọng,<br>DeutschUp</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `Xin chào ${displayName},

Cảm ơn bạn đã đăng ký DeutschUp.

Bạn vui lòng ấn vào nút bên dưới để xác nhận đăng ký tài khoản:
${link}

Nếu bạn không thực hiện đăng ký tài khoản này, bạn có thể bỏ qua email này.

Trân trọng,
DeutschUp`;

  await sendEmail({
    to: user.email,
    subject: 'Xác nhận đăng ký tài khoản DeutschUp',
    html,
    text,
  });
};

const sendPasswordResetEmail = async (user, token) => {
  const frontendUrl = getFrontendUrl();
  const link = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  return await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Hello ${user.name || user.email},</p><p>Click <a href="${link}">here</a> to reset your password.</p>`,
    text: `Hello ${user.name || user.email},\n\nClick the link to reset your password: ${link}`,
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

  let user;
  let verificationToken;

  try {
    user = await User.create({
      name,
      username,
      email,
      password,
      isEmailVerified: false,
      emailVerified: false,
    });

    verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await EmailVerification.create({
      userId: user._id,
      tokenHash: hashToken(verificationToken),
      expiresAt,
    });

    await sendVerificationEmail(user, verificationToken);
  } catch (error) {
    // Rollback user and token if verification email could not be sent
    if (user && user._id) {
      await User.findByIdAndDelete(user._id).catch(() => {});
      await EmailVerification.deleteMany({ userId: user._id }).catch(() => {});
    }
    throw error;
  }

  // Do not issue JWT immediately upon registration
  return res.status(201).json({
    success: true,
    message: req.t
      ? req.t('auth.register_success', 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.')
      : 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.',
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
      message: req.t
        ? req.t('auth.invalid_credentials', 'Email hoặc mật khẩu không đúng')
        : 'Email hoặc mật khẩu không đúng',
    });
  }
  const isVerified = Boolean(user.isEmailVerified ?? user.emailVerified);
  if (!isVerified) {
    return res.status(403).json({
      success: false,
      message: req.t
        ? req.t('auth.email_not_verified', 'Vui lòng xác nhận email trước khi đăng nhập.')
        : 'Vui lòng xác nhận email trước khi đăng nhập.',
    });
  }

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  const userPayload = await buildUserPayloadWithPlan(user);

  return res.status(200).json({
    success: true,
    message: req.t ? req.t('auth.login_success', 'Đăng nhập thành công') : 'Đăng nhập thành công',
    token,
    user: userPayload,
    data: {
      token,
      user: userPayload,
      subscription: userPayload.subscription,
      plan: userPayload.plan,
      permissions: userPayload.permissions,
      hasCustomPlan: userPayload.hasCustomPlan,
      canManageClasses: userPayload.canManageClasses,
      can_create_class: userPayload.can_create_class,
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
    return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
  }

  if (user.isEmailVerified || user.emailVerified) {
    return res.status(400).json({ success: false, message: 'Email này đã được xác thực. Bạn có thể đăng nhập ngay.' });
  }

  // Cooldown check: prevent sending more than once every 60 seconds
  const lastVerification = await EmailVerification.findOne({ userId: user._id }).sort({ createdAt: -1 });
  if (lastVerification) {
    const timeSinceLast = Date.now() - new Date(lastVerification.createdAt).getTime();
    const COOLDOWN_MS = 60 * 1000;
    if (timeSinceLast < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
      return res.status(429).json({
        success: false,
        message: `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại email xác thực.`,
      });
    }
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

  return res.status(200).json({
    success: true,
    message: req.t
      ? req.t('auth.resend_verification_success', 'Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư của bạn.')
      : 'Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư của bạn.',
  });
});

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

  if (!token) {
    throw new AppError('Verification token is required', HTTP_STATUS.BAD_REQUEST);
  }

  const hashed = hashToken(token);
  const verificationRecord = await EmailVerification.findOne({ tokenHash: hashed });

  if (!verificationRecord) {
    throw new AppError(
      req.t ? req.t('auth.verify_email_invalid', 'Link xác thực không hợp lệ hoặc không tồn tại.') : 'Link xác thực không hợp lệ hoặc không tồn tại.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (verificationRecord.used) {
    throw new AppError(
      req.t ? req.t('auth.verify_email_used', 'Link xác thực này đã được sử dụng.') : 'Link xác thực này đã được sử dụng.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Date(verificationRecord.expiresAt) <= new Date()) {
    throw new AppError(
      req.t ? req.t('auth.verify_email_expired', 'Link xác thực đã hết hạn. Vui lòng yêu cầu gửi lại link mới.') : 'Link xác thực đã hết hạn. Vui lòng yêu cầu gửi lại link mới.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const user = await User.findById(verificationRecord.userId);
  if (!user) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  user.isEmailVerified = true;
  user.emailVerified = true;
  await user.save();

  verificationRecord.used = true;
  await verificationRecord.save();

  // Invalidate any other tokens for this user
  await EmailVerification.deleteMany({ userId: user._id, _id: { $ne: verificationRecord._id } });

  return res.status(200).json({
    success: true,
    message: req.t
      ? req.t('auth.verify_email_success', 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.')
      : 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.',
  });
});

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const email = req.body.email?.trim().toLowerCase();

  console.log('[Forgot Password] Request received:', email);

  if (!email) {
    throw new AppError(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST);
  }

  const user = await User.findOne({ email });
  console.log('[Forgot Password] User found:', !!user);

  if (!user) {
    console.warn(`[Forgot Password] User not found for email: ${email}. No reset email will be sent.`);
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
  console.log('[Forgot Password] Reset token created');

  console.log('[Forgot Password] Sending reset email...');
  try {
    const info = await sendPasswordResetEmail(user, resetToken);
    console.log('[Forgot Password] Email sent successfully');
  } catch (error) {
    console.error('[Forgot Password] Email sending failed:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    throw error;
  }

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
      emailVerified: true,
      avatar: payload.picture || null,
    });
  } else if (!user.isEmailVerified || !user.emailVerified) {
    user.isEmailVerified = true;
    user.emailVerified = true;
    await user.save();
  }

  const token = generateToken(user._id);
  setAuthCookie(res, token);

  const userPayload = await buildUserPayloadWithPlan(user);

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: userPayload,
    data: {
      token,
      user: userPayload,
      subscription: userPayload.subscription,
      plan: userPayload.plan,
      permissions: userPayload.permissions,
      hasCustomPlan: userPayload.hasCustomPlan,
      canManageClasses: userPayload.canManageClasses,
      can_create_class: userPayload.can_create_class,
    },
  });
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id || req.user._id);
  const userPayload = user ? await buildUserPayloadWithPlan(user) : null;

  return res.status(200).json({
    success: true,
    message: 'User fetched successfully',
    user: userPayload,
    data: {
      user: userPayload,
      subscription: userPayload?.subscription || null,
      plan: userPayload?.plan || 'FREE',
      permissions: userPayload?.permissions || [],
      hasCustomPlan: userPayload?.hasCustomPlan || false,
      canManageClasses: userPayload?.canManageClasses || false,
      can_create_class: userPayload?.can_create_class || false,
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

