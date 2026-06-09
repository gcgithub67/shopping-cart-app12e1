const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Helpful for some SMTP providers during dev
  }
});

// Test transporter on startup (optional but useful)
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Transporter Error:', error);
  } else {
    console.log('✅ SMTP Server is ready to send emails');
  }
});

const sendVerificationEmail = async (email, verificationToken) => {
  const verificationLink = `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 3000}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify Your Email - Shopping Cart App',
    html: `
      <h2>Welcome!</h2>
      <p>Click below to verify your email:</p>
      <a href="${verificationLink}" style="padding:12px 24px; background:#007bff; color:white; text-decoration:none; border-radius:4px;">Verify Email</a>
      <p>Link expires in 24 hours.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Email send failed for', email, ':', error.message);
    throw new Error('Failed to send verification email');
  }
};

const sendOrderConfirmation = async (email, orderDetails) => {
  // Extend as needed for receipts, etc.
  console.log('Order confirmation sent (placeholder)');
};

module.exports = { sendVerificationEmail, sendOrderConfirmation, transporter };