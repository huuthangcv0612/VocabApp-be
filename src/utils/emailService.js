import nodemailer from 'nodemailer';

let transporter = null;

export const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn('[EmailService] SMTP credentials not configured. Skipping email delivery to:', to);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured.');
    }
    return { success: false, skipped: true };
  }

  const transport = getTransporter();
  const from = process.env.SMTP_FROM || `DeutschUp <${smtpUser}>`;

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    console.log(`[EmailService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Log safe error details without exposing credentials
    console.error('[EmailService] Failed to send email:', {
      to,
      subject,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      message: error.message,
    });
    throw error;
  }
};

