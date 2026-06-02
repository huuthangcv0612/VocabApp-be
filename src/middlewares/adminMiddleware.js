import { ROLES } from '../utils/constants.js';
import { AppError } from '../utils/errorHandler.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError(ERROR_MESSAGES.UNAUTHORIZED, 401));
  }

  if (req.user.role !== ROLES.ADMIN) {
    return next(new AppError(ERROR_MESSAGES.ADMIN_REQUIRED, 403));
  }

  next();
};

export default isAdmin;
