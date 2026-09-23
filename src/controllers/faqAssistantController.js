import { askFaqAssistant } from '../services/faqAssistant.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errorHandler.js';
import { sendResponse } from '../utils/responseHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';

/**
 * @desc    Chat with DeutschUp AI Support & FAQ Assistant
 * @route   POST /api/ai/assistant/chat
 * @access  Public / Optional Auth
 */
export const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new AppError('ai.input_required', HTTP_STATUS.BAD_REQUEST);
  }

  if (message.length > 500) {
    throw new AppError('Message is too long. Maximum allowed length is 500 characters.', HTTP_STATUS.BAD_REQUEST);
  }

  const result = await askFaqAssistant({
    message: message.trim(),
    history,
    user: req.user || null,
    locale: req.locale || 'vi',
  });

  sendResponse(
    res,
    HTTP_STATUS.OK,
    'Assistant response generated successfully',
    result
  );
});

export default {
  chatWithAssistant,
};
