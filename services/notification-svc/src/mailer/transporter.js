'use strict';

const nodemailer = require('nodemailer');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('notification-svc:mailer');

let transporter;

function getTransporter() {
  if (transporter) { return transporter; }

  if (process.env.NODE_ENV === 'production') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: use Ethereal (catches all emails, nothing actually sent)
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.SMTP_USER || 'ethereal_user',
        pass: process.env.SMTP_PASS || 'ethereal_pass',
      },
    });
    logger.info('Using Ethereal email transport (dev mode) — emails are NOT delivered');
  }

  return transporter;
}

async function sendMail(options) {
  const t = getTransporter();
  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"WiseBiz" <no-reply@wisebiz.online>',
      ...options,
    });
    logger.info('Email sent', { messageId: info.messageId, to: options.to });
    return info;
  } catch (err) {
    logger.error('Failed to send email', { to: options.to, error: err.message });
    // Don't throw — notification failure should never break the order flow
  }
}

module.exports = { sendMail };
