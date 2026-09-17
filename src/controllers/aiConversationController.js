import {
  startConversationService,
  sendMessageService,
  completeSessionService,
  getSessionService,
} from '../services/aiConversation.service.js';

export const startConversation = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { lesson_id } = req.body;

    const data = await startConversationService({
      userId,
      lessonId: lesson_id,
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
