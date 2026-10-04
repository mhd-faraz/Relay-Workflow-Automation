const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    family: 4,
    connectionTimeout: 10000,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
};
const sendEmail = async ({ to, subject, body }) => {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
  }

  const t = getTransporter();

  const info = await t.sendMail({
    from: `"Relay Workflow" <${env.GMAIL_USER}>`,
    to,
    subject,
    text: body,
  });

  return {
    sent: true,
    messageId: info.messageId,
    to,
    subject,
  };
};

module.exports = { sendEmail };