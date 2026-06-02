/**
 * Response Handler
 */
export const sendResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: statusCode < 400,
    message,
    statusCode,
  };

  if (data) {
    response.data = data;
  }

  res.status(statusCode).json(response);
};

export default sendResponse;
