import nodemailer from 'nodemailer';

let transporter = null;

export const getTransporter = () => {
  if (!transporter) {
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const isSecure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS
      ? process.env.SMTP_PASS.trim().replace(/\s+/g, '')
      : undefined;
      
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      family: 4,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
};

export const verifyTransporter = async () => {
  const smtpUser = process.env.SMTP_USER?.trim();
  const rawPass = process.env.SMTP_PASS;
  const smtpPass = rawPass ? rawPass.trim().replace(/\s+/g, '') : null;

  if (!smtpUser || !smtpPass) {
    console.warn('[SMTP] Missing SMTP credentials (SMTP_USER or SMTP_PASS not set).');
    return false;
  }

  const transport = getTransporter();
  try {
    await transport.verify();
    console.log('[SMTP] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[SMTP] Connection failed:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
    });
    return false;
  }
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const smtpUser = process.env.SMTP_USER?.trim();
  const rawPass = process.env.SMTP_PASS;
  const smtpPass = rawPass ? rawPass.trim().replace(/\s+/g, '') : null;

  if (!smtpUser || !smtpPass) {
    const errorMsg = 'SMTP credentials not configured (SMTP_USER or SMTP_PASS is missing)';
    console.warn('[EmailService]', errorMsg, 'Skipping email delivery to:', to);
    const err = new Error(errorMsg);
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  const transport = getTransporter();
  const from = process.env.SMTP_FROM?.trim() || `DeutschUp <${smtpUser}>`;

  // Verify transporter before sending to validate connection and credentials
  try {
    await transport.verify();
    console.log('[SMTP] SMTP connection verified');
  } catch (verifyError) {
    console.error('[SMTP] Connection failed:', {
      message: verifyError.message,
      code: verifyError.code,
      command: verifyError.command,
      response: verifyError.response,
    });
    throw verifyError;
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EmailService] Email sent successfully. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Log safe error details without exposing credentials
    console.error('[EmailService] Failed to send email:', {
      to,
      subject,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      response: error.response,
      message: error.message,
    });
    throw error;
  }
};

