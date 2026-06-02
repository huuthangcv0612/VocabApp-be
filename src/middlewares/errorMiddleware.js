import { sendErrorResponse } from '../utils/errorHandler.js';

/**
 * Global Error Handling Middleware
 */
export const errorMiddleware = (error, req, res, next) => {
  console.error('Error:', error);

  // Set default values
  error.statusCode = error.statusCode || 500;
  error.message = error.message || 'Internal Server Error';

  // Handle MongoDB validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err) => err.message);
    error.statusCode = 400;
    error.message = messages.join(', ');
  }

  // Handle MongoDB duplicate key error
  if (error.code === 11000) {
    error.statusCode = 409;
    error.message = `${Object.keys(error.keyValue)[0]} already exists.`;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid or expired token.';
  }

  sendErrorResponse(error, res);
};

export default errorMiddleware;
