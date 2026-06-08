const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Optional: debug / connection
  // debug: true,
  // logger: true
});

const sendVerificationEmail = async (email, verificationToken) => {
  const verificationLink = `http://localhost:${process.env.PORT || 3000}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify Your Email - Shopping Cart App',
    html: `
      <h2>Welcome to Shopping Cart App!</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${verificationLink}" style="padding:10px 20px; background:#007bff; color:white; text-decoration:none;">Verify Email</a>
      <p>Link expires in 24 hours.</p>
      <p>If you didn't sign up, ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    throw new Error('Failed to send verification email');
  }
};

const sendOrderConfirmation = async (email, orderDetails) => {
  // Extend as needed for receipts, etc.
  console.log('Order confirmation sent (placeholder)');
};

module.exports = { sendVerificationEmail, sendOrderConfirmation, transporter };