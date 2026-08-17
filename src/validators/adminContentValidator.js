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
