/**
 * Order Utilities
 */

/**
 * Generate a short, unique order code.
 * Example format: DU + base36 timestamp + random 5 chars (e.g. DU8A7K2P91)
 * Must be <= 25 characters to fit VietQR addInfo specification.
 */
export const generateOrderCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();

  return `DU${timestamp}${random}`;
};

export default {
  generateOrderCode,
};
