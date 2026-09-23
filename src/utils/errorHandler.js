/**
 * Custom Error Class
 */
export class AppError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error Response Formatter
 */
export const sendErrorResponse = (error, res) => {
  const statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  if (res.req?.t && typeof message === 'string' && message.includes('.')) {
    message = res.req.t(message, message);
  }

  // Prevent leaking internal stack/DB error messages to client in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = res.req?.t
      ? res.req.t('common.server_error', 'Internal Server Error')
      : 'Internal Server Error';
  }

  const errors = Array.isArray(error.errors) ? error.errors : [];

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

export default sendErrorResponse;
