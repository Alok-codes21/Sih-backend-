import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

export const isEmailConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

export const getTransporter = () => {
  if (transporter) return transporter;

  if (isEmailConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    logger.info('Nodemailer SMTP transporter initialized');
  }
  return transporter;
};

/**
 * Section 13 Master Spec: Sends an email notification.
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    logger.info(`[Email Notification Skipped - SMTP credentials not in .env] To: ${to}, Subject: ${subject}`);
    return { skipped: true, reason: 'SMTP credentials missing from .env' };
  }

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || '"AthletIQ / AthleteConnect" <notifications@athleteiq.com>',
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`
    });

    logger.info(`Email sent successfully to ${to}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email notification', { error: error.message, to, subject });
    return { success: false, error: error.message };
  }
};
