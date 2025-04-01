import { Request, Response } from 'express';
import { 
  registerUser,
  sendRegistrationOTP as sendOTPService,
  verifyEmail as verifyOTPService, 
  resendVerificationOTP as resendOTP
} from '../services/registrationService';
import { loginUser } from '../services/loginService';
import { 
  requestPasswordReset,
  resetPassword
} from '../services/passwordService';
import { clearSession } from '../middlewares/sessionMiddleware';
import User, { IUser } from '../models/userModel';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/authMiddleware';
import { validateEmail } from '../utils/emailValidator';
import OTP from '../models/otpModel';
import { v4 as uuidv4 } from 'uuid';

// Define a custom request type with user property
interface RequestWithUser extends Request {
  user?: IUser;
}

// ----- UTILITY FUNCTIONS -----

// Standard response format
type ApiResponse = {
  success: boolean;
  message: string;
  code?: string;
  [key: string]: any;
};

// Common validation utilities
const validateRequired = (res: Response, field: string, value: any): boolean => {
  if (!value) {
    res.status(400).json({
      success: false,
      message: `${field} is required`,
      code: `MISSING_${field.toUpperCase()}`
    });
    return false;
  }
  return true;
};

const validateEmailField = (res: Response, email: string): boolean => {
  if (!validateRequired(res, 'Email', email)) return false;
  
  const validation = validateEmail(email);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      message: validation.error || 'Please provide a valid email address',
      code: 'INVALID_EMAIL'
    });
    return false;
  }
  return true;
};

// Response helpers
const errorResponse = (res: Response, status: number, message: string, code?: string, extras?: object) => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(code && { code }),
    ...extras
  };
  res.status(status).json(response);
};

const successResponse = (res: Response, message: string, data?: object, code?: string) => {
  const response: ApiResponse = {
    success: true,
    message,
    ...(code && { code }),
    ...(data && { data })
  };
  res.status(200).json(response);
};

// ----- CONTROLLER FUNCTIONS -----

// Send OTP for registration process
export const sendRegistrationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, isResend } = req.body;
    
    if (!validateEmailField(res, email)) return;
    
    try {
      const result = await sendOTPService(email, isResend);
      const successMsg = isResend ? 'Verification code resent successfully' : 'Verification code sent successfully';
      
      if (process.env.NODE_ENV === 'development') {
        successResponse(res, successMsg, { otp: result.otp, isNewUser: result.isNewUser }, 'OTP_SENT');
      } else {
        successResponse(res, successMsg, { otp: 'sent', isNewUser: result.isNewUser }, 'OTP_SENT');
      }
    } catch (error: any) {
      const errorMappings: Record<string, { status: number, message: string }> = {
        'ALREADY_VERIFIED': { status: 400, message: 'This email is already verified. Please login instead.' },
        'EMAIL_SEND_FAILED': { status: 500, message: 'Unable to send verification email at this time. Please try again later.' }
      };
      
      const errorInfo = errorMappings[error.code] || { 
        status: 500, 
        message: error.message || 'Error processing verification code. Please try again.'
      };
      
      errorResponse(res, errorInfo.status, errorInfo.message, error.code || 'OTP_SERVICE_ERROR');
    }
  } catch (error: any) {
    errorResponse(res, 500, 'An unexpected error occurred. Please try again later.', 'SERVER_ERROR');
  }
};

// Register controller
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!validateRequired(res, 'First name', firstName)) return;
    if (!validateRequired(res, 'Last name', lastName)) return;
    if (!validateEmailField(res, email)) return;
    if (!validateRequired(res, 'Password', password)) return;

    const { user, token } = await registerUser({ firstName, lastName, email, password });
    const refreshToken = generateRefreshToken(user);
    
    successResponse(res, 'User registered successfully', { user, token, refreshToken });
  } catch (error: any) {
    errorResponse(res, 400, error.message || 'Error during registration');
  }
};

// Login controller
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt received:', { 
      email: email ? `${email.substring(0, 3)}...${email.includes('@') ? email.substring(email.indexOf('@')) : ''}` : 'undefined',
      password: password ? '[MASKED]' : 'undefined'
    });

    if (!validateRequired(res, 'Email', email)) return;
    if (!validateRequired(res, 'Password', password)) return;
    
    if (!email.includes('@')) {
      console.log('Login failed: Invalid email format');
      errorResponse(res, 400, 'Please provide a valid email address', 'INVALID_EMAIL_FORMAT');
      return;
    }

    try {
      console.log('Attempting to authenticate user...');
      const { user, token, refreshToken } = await loginUser(email, password);
      
      console.log('User logged in successfully:', {
        userId: user._id,
        email: user.email
      });
      
      const userData = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified,
        profileImage: user.profileImage
      };
      
      successResponse(res, 'User logged in successfully', { user: userData, token, refreshToken });
    } catch (error: any) {
      console.error('Login service error:', error.code, error.message);
      
      const errorResponses = {
        'NEEDS_VERIFICATION': { status: 403, message: 'Please verify your email before logging in', extras: { needsVerification: true, email } },
        'USER_NOT_FOUND': { status: 404, message: 'No account found with this email address', extras: {} },
        'INVALID_CREDENTIALS': { status: 401, message: 'Invalid email or password', extras: {} }
      };
      
      const errorType = error.code as keyof typeof errorResponses;
      const errorInfo = errorResponses[errorType] || { status: 400, message: error.message || 'Invalid credentials', extras: {} };
      
      errorResponse(res, errorInfo.status, errorInfo.message, error.code || 'AUTH_ERROR', errorInfo.extras);
    }
  } catch (error: any) {
    console.error('Unexpected error in login controller:', error);
    errorResponse(res, 500, error.message || 'Error logging in');
  }
};

// Verify email controller
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!validateEmailField(res, email)) return;
    if (!validateRequired(res, 'Verification code', otp)) return;
    
    if (!/^\d{6}$/.test(otp)) {
      errorResponse(res, 400, 'Verification code should be a 6-digit number');
      return;
    }

    try {
      const { user, token, refreshToken } = await verifyOTPService(email, otp);
      successResponse(res, 'Email verified successfully', { redirectTo: '/dashboard', user, token, refreshToken });
    } catch (error: any) {
      const errorMapping: Record<string, { status: number, message: string }> = {
        'OTP_EXPIRED': { status: 400, message: 'Verification code has expired. Please request a new one.' },
        'OTP_INVALID': { status: 400, message: 'Invalid verification code. Please check and try again.' },
        'USER_NOT_FOUND': { status: 404, message: 'User not found with this email. Please register first.' }
      };
      
      const errorInfo = errorMapping[error.code] || { 
        status: 400, 
        message: error.message || 'Error verifying email' 
      };
      
      errorResponse(res, errorInfo.status, errorInfo.message, error.code || 'VERIFICATION_ERROR');
    }
  } catch (error: any) {
    errorResponse(res, 500, 'An unexpected error occurred during verification. Please try again.', 'SERVER_ERROR');
  }
};

// Refresh token controller
export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!validateRequired(res, 'Refresh token', refreshToken)) return;
    
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      errorResponse(res, 401, 'Invalid or expired refresh token');
      return;
    }
    
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      errorResponse(res, 404, 'User not found');
      return;
    }
    
    const newAccessToken = generateToken(user);
    successResponse(res, 'Token refreshed successfully', { token: newAccessToken });
  } catch (error: any) {
    errorResponse(res, 400, error.message || 'Error refreshing token');
  }
};

// Resend OTP controller
export const resendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!validateEmailField(res, email)) return;

    await resendOTP(email);
    successResponse(res, 'Verification code sent successfully');
  } catch (error: any) {
    errorResponse(res, 400, error.message || 'Error sending verification code');
  }
};

// OAuth callback handler for all providers
export const oAuthCallback = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      throw new Error('Authentication failed - No user data received');
    }
    
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.isVerified,
      profileImage: user.profileImage,
      providerUsername: (user as any).providerUsername || null,
      provider: (user as any).provider || null,
      useProviderUsername: (user as any).useProviderUsername || false
    };
    
    const cookieOptions = {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const
    };
    
    res.cookie('token', token, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/dashboard?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&userData=${encodeURIComponent(JSON.stringify(userData))}`;
    
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorUrl = `${frontendUrl}/login?error=${encodeURIComponent(error.message || 'Authentication failed')}`;
    res.redirect(errorUrl);
  }
};

// For backwards compatibility
export const googleAuthCallback = oAuthCallback;

// Request password reset controller
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!validateEmailField(res, email)) return;

    const result = await requestPasswordReset(email);
    successResponse(res, result.message);
  } catch (error: any) {
    console.error('Error in forgotPassword controller:', error);
    
    if (error.message && error.message.includes('Failed to send')) {
      errorResponse(res, 500, 'Unable to send email at this time. Please try again later.');
    } else {
      errorResponse(res, 400, error.message || 'Error processing password reset request');
    }
  }
};

// Reset password with token controller
export const resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token, newPassword } = req.body;

    if (!validateEmailField(res, email)) return;
    if (!validateRequired(res, 'Token', token)) return;
    if (!validateRequired(res, 'New password', newPassword)) return;

    if (newPassword.length < 8) {
      errorResponse(res, 400, 'Password must be at least 8 characters');
      return;
    }

    await resetPassword(email, token, newPassword);
    successResponse(res, 'Password reset successful. You can now log in with your new password.');
  } catch (error: any) {
    errorResponse(res, 400, error.message || 'Error resetting password');
  }
};

// Logout controller
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    clearSession(req, res, () => {
      successResponse(res, 'Logged out successfully');
    });
  } catch (error: any) {
    console.error('Error in logout:', error);
    errorResponse(res, 500, 'Error logging out');
  }
};

