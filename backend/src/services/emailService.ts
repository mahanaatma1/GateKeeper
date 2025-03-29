// Email and OTP service for verification and authentication
import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import OTP from '../models/otpModel';
import dotenv from 'dotenv';
import User from '../models/userModel';

// Load environment variables
dotenv.config();

// Generate a 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get SMTP credentials from environment variables, with fallbacks
const HOSTINGER_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const HOSTINGER_PORT = parseInt(process.env.SMTP_PORT || '465');
const HOSTINGER_USER = process.env.SMTP_USER || 'testsmtp@sumerudigital.com';
const HOSTINGER_PASSWORD = process.env.SMTP_PASSWORD || 'Smtp##8899';

// Log SMTP configuration (without password)

// Create email transporter with Hostinger SMTP settings
const transporter = nodemailer.createTransport({
  host: HOSTINGER_HOST,
  port: HOSTINGER_PORT,
  secure: true,
  auth: {
    user: HOSTINGER_USER,
    pass: HOSTINGER_PASSWORD,
  },
  tls: {
    rejectUnauthorized: true
  }
} as SMTPTransport.Options);

// Define SMTP error type that includes all necessary properties
interface SMTPError extends Error {
  code?: string;
  responseCode?: number;
  response?: string;
}

// Verify transporter connection on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

// Send verification email with Hostinger branding
export const sendVerificationEmail = async (email: string, otp: string): Promise<boolean> => {
  let retries = 2;
  let lastError: any = null;
  
  // Add an exponential backoff retry mechanism
  while (retries >= 0) {
    try {
      const attemptNumber = 2 - retries;
      console.log(`[Email Service] Attempt ${attemptNumber + 1} to send verification email to ${email} with OTP: ${otp}`);
      
      const mailOptions = {
        from: `"GateKeeper" <${HOSTINGER_USER}>`,
        to: email,
        subject: 'Verify Your Email - GateKeeper',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #673de6;">Email Verification</h2>
            <p>Thank you for registering with GateKeeper. Your verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0; border-left: 4px solid #673de6;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px;">This email was sent from a GateKeeper application.</p>
          </div>
        `,
      };
      
      // Set a timeout for the email sending operation
      const sendMailWithTimeout = async () => {
        return new Promise((resolve, reject) => {
          // Set a timeout of 30 seconds for email sending
          const timeoutId = setTimeout(() => {
            reject(new Error('Email sending operation timed out'));
          }, 30000);
          
          // Attempt to send the email
          transporter.sendMail(mailOptions)
            .then(info => {
              clearTimeout(timeoutId);
              resolve(info);
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
      };

      const info = await sendMailWithTimeout();
      console.log(`[Email Service] Email sent successfully: ${JSON.stringify(info)}`);
      return true;
    } catch (error: any) {
      lastError = error;
      retries--;
      
      // Log the error for this attempt
      console.error(`[Email Service] Attempt failed to send verification email to ${email}:`, error);
      
      // If we have more retries, wait before trying again
      if (retries >= 0) {
        const delay = Math.pow(2, 2 - retries) * 1000; // Exponential backoff: 2s, 4s
        console.log(`[Email Service] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted all retries
  console.error(`[Email Service] Failed to send verification email to ${email} after multiple attempts:`, lastError);
  throw new Error(`Failed to send verification email: ${lastError?.message || 'Unknown error'}`);
};

// Save OTP to database with expiration (10 minutes)
export const saveOTP = async (email: string, otp: string): Promise<void> => {
  try {
    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });
    
    // Create new OTP document
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP valid for 10 minutes
    
    await OTP.create({
      email,
      otp,
      expiresAt
    });
  } catch (error: any) {
    throw new Error('Error saving OTP: ' + error.message);
  }
};

// Verify if OTP is valid
export const verifyOTP = async (email: string, otp: string): Promise<boolean> => {
  try {
    const otpDoc = await OTP.findOne({ 
      email, 
      otp,
      expiresAt: { $gt: new Date() } // Check if OTP is not expired
    });
    
    if (!otpDoc) {
      return false;
    }
    
    // Delete the OTP once verified
    await OTP.deleteOne({ _id: otpDoc._id });
    
    return true;
  } catch (error: any) {
    throw new Error('Error verifying OTP: ' + error.message);
  }
};

// Send password reset email with Hostinger branding
export const sendPasswordResetEmail = async (email: string, resetToken: string): Promise<boolean> => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    const mailOptions = {
      from: `"GateKeeper" <${HOSTINGER_USER}>`,
      to: email,
      subject: 'Reset Your Password - GateKeeper',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #673de6;">Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to reset your password:</p>
          <div style="margin: 20px 0; text-align: center;">
            <a href="${resetUrl}" style="background-color: #673de6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
          <p>This link will expire in 1 hour.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">If the button doesn't work, copy and paste this URL into your browser:</p>
          <p style="font-size: 12px; color: #666; word-break: break-all;">${resetUrl}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">This email was sent from a GateKeeper application.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error: any) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};
