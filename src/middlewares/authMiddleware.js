import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/errorHandler.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const tokenFromCookie = req.cookies?.token;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
      throw new AppError(ERROR_MESSAGES.TOKEN_REQUIRED, 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(ERROR_MESSAGES.INVALID_TOKEN, 401));
    }
    next(error);
  }
};

export default verifyToken;
