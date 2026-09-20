import mongoose from 'mongoose';
import { EXERCISE_TYPES } from '../models/Exercise.js';
import { AppError } from '../utils/errorHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

export const validateObjectId = (id, paramName = 'ID') => {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(`Invalid ${paramName}`, HTTP_STATUS.BAD_REQUEST);
  }
};

export const validateExerciseType = (type) => {
  if (!type || !EXERCISE_TYPES.includes(type)) {
    throw new AppError(
      `Invalid exercise type. Valid types are: ${EXERCISE_TYPES.join(', ')}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }
};

export const validateReorderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Reorder payload must contain a non-empty items array', HTTP_STATUS.BAD_REQUEST);
  }

  for (const item of items) {
    if (!item.id || !mongoose.isValidObjectId(item.id)) {
      throw new AppError('Each reorder item must have a valid id', HTTP_STATUS.BAD_REQUEST);
    }
    if (typeof item.order !== 'number') {
      throw new AppError('Each reorder item must have a numeric order value', HTTP_STATUS.BAD_REQUEST);
    }
  }
};

export const validateMatchingContent = (content) => {
  if (!content || typeof content !== 'object') {
    throw new AppError('Exercise content must be an object', HTTP_STATUS.BAD_REQUEST);
  }

  if (!Array.isArray(content.pairs) || content.pairs.length === 0) {
    throw new AppError('Matching exercise content must contain a non-empty pairs array', HTTP_STATUS.BAD_REQUEST);
  }

  const seenIds = new Set();
  for (let i = 0; i < content.pairs.length; i++) {
    const pair = content.pairs[i];
    if (!pair || typeof pair !== 'object') {
      throw new AppError(`Matching pair at index ${i} must be an object`, HTTP_STATUS.BAD_REQUEST);
    }
    if (!pair.id || typeof pair.id !== 'string' || !pair.id.trim()) {
      throw new AppError(`Matching pair at index ${i} must have a non-empty string id`, HTTP_STATUS.BAD_REQUEST);
    }
    if (!pair.left || typeof pair.left !== 'string' || !pair.left.trim()) {
      throw new AppError(`Matching pair at index ${i} must have a non-empty left string`, HTTP_STATUS.BAD_REQUEST);
    }
    if (!pair.right || typeof pair.right !== 'string' || !pair.right.trim()) {
      throw new AppError(`Matching pair at index ${i} must have a non-empty right string`, HTTP_STATUS.BAD_REQUEST);
    }
    if (seenIds.has(pair.id.trim())) {
      throw new AppError(`Duplicate pair id found: "${pair.id.trim()}"`, HTTP_STATUS.BAD_REQUEST);
    }
    seenIds.add(pair.id.trim());
  }
};

