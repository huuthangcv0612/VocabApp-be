import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/errorHandler.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

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
