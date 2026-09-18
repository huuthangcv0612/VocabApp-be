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
  const message = error.message || 'Internal Server Error';
  const errors = Array.isArray(error.errors) ? error.errors : [];

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

export default sendErrorResponse;
