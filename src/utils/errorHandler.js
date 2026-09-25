/**
 * Custom Error Class
 */
export class AppError extends Error {
  constructor(message, statusCode, errors = [], code = null, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.data = data;
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

  const response = {
    success: false,
    message,
  };

  if (error.code) {
    response.code = error.code;
  }

  if (error.data !== undefined && error.data !== null) {
    response.data = error.data;
  }

  response.errors = errors;

  res.status(statusCode).json(response);
};

export default sendErrorResponse;
