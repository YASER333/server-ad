const nodemailer = require('nodemailer');

const getTransporter = () => {
  if (!process.env.EMAIL_SMTP_HOST) {
    throw new Error('Missing SMTP configuration');
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS
    }
  });
};

const sendEmail = async ({ to, subject, html }) => {
  if (process.env.NODE_ENV === 'test') return;
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `RVS College <${process.env.EMAIL_SMTP_USER}>`,
    to,
    subject,
    html
  });
};

module.exports = {
  sendEmail
};

