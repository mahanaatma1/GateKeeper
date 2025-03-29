import User, { IUser } from '../models/userModel';
import OTP from '../models/otpModel';
import { hashPassword } from '../utils/password';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { generateOTP, saveOTP, sendVerificationEmail } from './emailService';

// Register a new user
export const registerUser = async (userData: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ user: any; token: string }> => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Create new user with isVerified = false
    const user = await User.create({
      ...userData,
      password: hashedPassword,
      isVerified: false
    });

    // Generate token
    const token = generateToken(user);

    // Return user data without password and token
    const userWithoutPassword = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.isVerified,
    };

    return { user: userWithoutPassword, token };
  } catch (error) {
    throw error;
  }
};

// Define OTP expiry time constant
const OTP_EXPIRY_MINUTES = 10; // OTP valid for 10 minutes

// Send OTP for registration or verification
export const sendRegistrationOTP = async (email: string, isResend: boolean = false): Promise<{otp: string, isNewUser: boolean}> => {
  try {
    // Check if user already verified
    const user = await User.findOne({ email });
    const isNewUser = !user;
    
    if (user && user.isVerified && !isResend) {
      const error: any = new Error('This email is already verified. Please login instead.');
      error.code = 'ALREADY_VERIFIED';
      throw error;
    }

    // Check if there's an existing OTP and if it's still valid
    let otpRecord = await OTP.findOne({ email });
    let otpCode = otpRecord?.otp;
    
    // For resend requests or if no OTP exists, create a new one
    if (isResend || !otpRecord) {
      // Generate a new 6-digit OTP
      otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
      
      // If this is a resend, delete any existing OTP first
      if (otpRecord) {
        await OTP.deleteOne({ email });
      }
      
      // Create a new OTP record
      otpRecord = new OTP({
        email,
        otp: otpCode,
        expiresAt
      });
      
      await otpRecord.save();
    }
    
    // Send the verification email using the existing function
    try {
      await sendVerificationEmail(email, otpCode as string);
      return { otp: otpCode as string, isNewUser };
    } catch (emailError: any) {
      const error: any = new Error('Failed to send verification email. Please try again later.');
      error.code = 'EMAIL_SEND_FAILED';
      throw error;
    }
  } catch (error: any) {
    // Add a code property to errors that don't have one
    if (!error.code) {
      error.code = 'OTP_SERVICE_ERROR';
    }
    throw error;
  }
};

// Verify email with OTP
export const verifyEmail = async (email: string, otp: string): Promise<{ 
  user: IUser, 
  token: string, 
  refreshToken: string 
}> => {
  try {
    // Find the OTP record
    const otpRecord = await OTP.findOne({ email, otp });
    
    // Check if OTP exists
    if (!otpRecord) {
      const error: any = new Error('Invalid verification code. Please check and try again.');
      error.code = 'OTP_INVALID';
      throw error;
    }
    
    // Check if OTP has expired
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      const error: any = new Error('Verification code has expired. Please request a new one.');
      error.code = 'OTP_EXPIRED';
      throw error;
    }
    
    // Find the user with this email
    const user = await User.findOne({ email }).select('-password');
    if (!user) {
      const error: any = new Error('User not found with this email. Please register first.');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    
    // Mark user as verified
    user.isVerified = true;
    await user.save();
    
    // Delete the used OTP
    await OTP.deleteOne({ _id: otpRecord._id });
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Return the user and tokens
    return { user, token, refreshToken };
  } catch (error: any) {
    // Add error code if missing
    if (!error.code) {
      error.code = 'VERIFICATION_ERROR';
    }
    throw error;
  }
};

// Resend OTP for verification
export const resendVerificationOTP = async (email: string): Promise<boolean> => {
  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    // Use the same function as regular OTP send but with isResend=true
    await sendRegistrationOTP(email, true);
    
    return true;
  } catch (error) {
    throw error;
  }
}; 