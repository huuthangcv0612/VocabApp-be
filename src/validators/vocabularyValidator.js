import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

const VALID_ARTICLES = ['der', 'die', 'das', null, ''];
const VALID_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
const VALID_LEVELS = ['A1', 'A2', 'B1', 'beginner', 'intermediate', 'advanced'];

/**
 * Validate payload when creating a new Vocabulary
 */
export const validateCreateVocabulary = (req, res, next) => {
  const { word, meaning, article, type, lektionId, difficultyLevel } = req.body;
  const errors = [];

  // Required field: word (fallback to germanWord for backward compatibility)
  const actualWord = word || req.body.germanWord;
  if (!actualWord || typeof actualWord !== 'string' || !actualWord.trim()) {
    errors.push('Word (từ tiếng Đức) là bắt buộc và không được để trống.');
  }

  // Required field: meaning (fallback to vietnameseMeaning)
  const actualMeaning = meaning || req.body.vietnameseMeaning;
  if (!actualMeaning || typeof actualMeaning !== 'string' || !actualMeaning.trim()) {
    errors.push('Meaning (nghĩa tiếng Việt) là bắt buộc và không được để trống.');
  }

  // Enum validation: article
  if (article !== undefined && article !== null && !VALID_ARTICLES.includes(article.toLowerCase())) {
    errors.push(`Article không hợp lệ. Giá trị hợp lệ: ${VALID_ARTICLES.filter(Boolean).join(', ')}`);
  }

  // Enum validation: type
  if (type && !VALID_TYPES.includes(type.toLowerCase())) {
    errors.push(`Type (loại từ) không hợp lệ. Giá trị hợp lệ: ${VALID_TYPES.join(', ')}`);
  }

  // Enum validation: difficultyLevel
  if (difficultyLevel && !VALID_LEVELS.includes(difficultyLevel)) {
    errors.push(`DifficultyLevel không hợp lệ. Giá trị hợp lệ: ${VALID_LEVELS.join(', ')}`);
  }

  // Mongo ObjectId validation: lektionId
  if (lektionId && !mongoose.isValidObjectId(lektionId)) {
    errors.push('lektionId không phải là ObjectId hợp lệ.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), HTTP_STATUS.BAD_REQUEST));
  }

  // Normalize normalized payload back into req.body
  req.body.word = actualWord.trim();
  req.body.meaning = actualMeaning.trim();
  if (req.body.article) req.body.article = req.body.article.toLowerCase();
  if (req.body.type) req.body.type = req.body.type.toLowerCase();

  next();
};

/**
 * Validate payload when updating an existing Vocabulary
 */
export const validateUpdateVocabulary = (req, res, next) => {
  const { word, meaning, article, type, lektionId, difficultyLevel } = req.body;
  const errors = [];

  if (word !== undefined && (typeof word !== 'string' || !word.trim())) {
    errors.push('Word không được để trống.');
  }

  if (meaning !== undefined && (typeof meaning !== 'string' || !meaning.trim())) {
    errors.push('Meaning không được để trống.');
  }

  if (article !== undefined && article !== null && article !== '' && !VALID_ARTICLES.includes(article.toLowerCase())) {
    errors.push(`Article không hợp lệ. Giá trị hợp lệ: ${VALID_ARTICLES.filter(Boolean).join(', ')}`);
  }

  if (type !== undefined && type !== null && !VALID_TYPES.includes(type.toLowerCase())) {
    errors.push(`Type (loại từ) không hợp lệ. Giá trị hợp lệ: ${VALID_TYPES.join(', ')}`);
  }

  if (difficultyLevel !== undefined && difficultyLevel !== null && !VALID_LEVELS.includes(difficultyLevel)) {
    errors.push(`DifficultyLevel không hợp lệ. Giá trị hợp lệ: ${VALID_LEVELS.join(', ')}`);
  }

  if (lektionId !== undefined && lektionId !== null && lektionId !== '' && !mongoose.isValidObjectId(lektionId)) {
    errors.push('lektionId không phải là ObjectId hợp lệ.');
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(' | '), HTTP_STATUS.BAD_REQUEST));
  }

  if (req.body.word) req.body.word = req.body.word.trim();
  if (req.body.meaning) req.body.meaning = req.body.meaning.trim();
  if (req.body.article !== undefined && req.body.article !== null) req.body.article = req.body.article.toLowerCase();
  if (req.body.type) req.body.type = req.body.type.toLowerCase();

  next();
};
