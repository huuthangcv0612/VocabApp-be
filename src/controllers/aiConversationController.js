import {
  startConversationService,
  sendMessageService,
  completeSessionService,
  getSessionService,
} from '../services/aiConversation.service.js';
import { generateGermanTTS } from '../services/azureTTSService.js';
import { AppError } from '../utils/errorHandler.js';

export const startConversation = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const lessonId = req.body.lessonId || req.body.lesson_id;

    const data = await startConversationService({
      userId,
      lessonId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { sessionId } = req.params;
    const { message } = req.body;

    const data = await sendMessageService({
      userId,
      sessionId,
      message,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const completeSession = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { sessionId } = req.params;

    const data = await completeSessionService({
      userId,
      sessionId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { sessionId } = req.params;

    const data = await getSessionService({
      userId,
      sessionId,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const textToSpeech = async (req, res, next) => {
  try {
    const { text, voice } = req.body;

    if (text === undefined || text === null) {
      throw new AppError('Field "text" is required.', 400);
    }

    if (typeof text !== 'string') {
      throw new AppError('Field "text" must be a string.', 400);
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new AppError('Field "text" cannot be empty.', 400);
    }

    if (trimmedText.length > 2000) {
      throw new AppError('Field "text" exceeds maximum allowed length of 2000 characters.', 400);
    }

    const audioBuffer = await generateGermanTTS(trimmedText, { voice });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400',
    });

    res.status(200).send(audioBuffer);
  } catch (error) {
    next(error);
  }
};
