/**
 * Application Constants
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Email or password is invalid.',
  EMAIL_ALREADY_EXISTS: 'Email already exists.',
  USER_NOT_FOUND: 'User not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  INVALID_TOKEN: 'Invalid or expired token.',
  TOKEN_REQUIRED: 'Authorization token is required.',
  ADMIN_REQUIRED: 'Admin privileges are required.',
  VALIDATION_ERROR: 'Validation error.',
  NOT_FOUND: 'Resource not found.',
  INTERNAL_ERROR: 'Internal server error.',
};

export const SUCCESS_MESSAGES = {
  REGISTERED: 'User registered successfully.',
  LOGGED_IN: 'Logged in successfully.',
  LOGOUT: 'Logged out successfully.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  PASSWORD_UPDATED: 'Password updated successfully.',
  RESOURCE_CREATED: 'Resource created successfully.',
  RESOURCE_UPDATED: 'Resource updated successfully.',
  RESOURCE_DELETED: 'Resource deleted successfully.',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};
