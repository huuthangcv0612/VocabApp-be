/**
 * Response Handler
 */
export const sendResponse = (res, statusCode, message, data = null) => {
  let finalMessage = message;
  if (res.req?.t && typeof message === 'string' && message.includes('.')) {
    finalMessage = res.req.t(message, message);
  }

  const response = {
    success: statusCode < 400,
    message: finalMessage,
    statusCode,
  };

  if (data) {
    response.data = data;
  }

  res.status(statusCode).json(response);
};

export default sendResponse;
