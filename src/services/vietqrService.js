/**
 * VietQR Service
 */

/**
 * Generate VietQR Quick Link URL for an order
 * @param {Object} params
 * @param {number} params.amount - Amount in VND
 * @param {string} params.orderCode - Unique order code (addInfo)
 * @returns {string} - VietQR Image URL
 */
export const generateVietQR = ({ amount, orderCode }) => {
  const bankId = process.env.PAYMENT_BANK_ID || '970407';
  const accountNo = process.env.PAYMENT_ACCOUNT_NO || '0123456789';
  const accountName = process.env.PAYMENT_ACCOUNT_NAME || 'DEUTSCHUP';
  const template = process.env.VIETQR_TEMPLATE || 'compact2';

  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: orderCode,
    accountName: accountName,
  });

  return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?${params.toString()}`;
};

export default {
  generateVietQR,
};
