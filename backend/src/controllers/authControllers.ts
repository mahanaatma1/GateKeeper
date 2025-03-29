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

// Common error response handler
const handleError = (res: Response, error: any, defaultMessage: string) => {
  res.status(400).json({
    success: false,
    message: error.message || defaultMessage
  });
};

// Send OTP for registration process
export const sendRegistrationOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, isResend } = req.body;

    // Basic validation
    if (!email) {
      res.status(400).json({ 
        success: false, 
        message: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
      return;
    }

    // Validate email format
    const validation = validateEmail(email);
    if (!validation.valid) {
      res.status(400).json({ 
        success: false, 
        message: validation.error || 'Please provide a valid email address',
        code: 'INVALID_EMAIL'
      });
      return;
    }
    
    try {
      // Call service function to handle login logic 
      const result = await sendOTPService(email, isResend);
      
      // Respond based on environment
      if (process.env.NODE_ENV === 'development') {
        res.status(200).json({ 
          success: true, 
          message: isResend ? 'Verification code resent successfully' : 'Verification code sent successfully',
          otp: result.otp,
          isNewUser: result.isNewUser,
          code: 'OTP_SENT'
        });
      } else {
        res.status(200).json({ 
          success: true, 
          message: isResend ? 'Verification code resent successfully' : 'Verification code sent successfully',
          otp: 'sent',  // Just indicate it was sent without revealing the actual code
          isNewUser: result.isNewUser,
          code: 'OTP_SENT'
        });
      }
    } catch (error: any) {
      // Map service errors to appropriate responses
      if (error.code === 'ALREADY_VERIFIED') {
        res.status(400).json({
          success: false,
          message: error.message || 'This email is already verified. Please login instead.',
          code: error.code
        });
      } else if (error.code === 'EMAIL_SEND_FAILED') {
        res.status(500).json({
          success: false,
          message: error.message || 'Unable to send verification email at this time. Please try again later.',
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Error processing verification code. Please try again.',
          code: error.code || 'OTP_SERVICE_ERROR'
        });
      }
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
      code: 'SERVER_ERROR'
    });
  }
};

// Register controller
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ success: false, message: 'Please provide all required fields' });
      return;
    }

    // Validate email address
    const validation = validateEmail(email);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    const { user, token } = await registerUser({ firstName, lastName, email, password });
    
    // Generate refresh token
    const refreshToken = generateRefreshToken(user);
    
    res.status(200).json({
      success: true,
      message: 'User registered successfully',
      data: { user, token, refreshToken }
    });
  } catch (error: any) {
    handleError(res, error, 'Error during registration');
  }
};

// Login controller
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Basic validation 
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password' });
      return;
    }

    try {
      // Call service function to handle login logic
      const { user, token, refreshToken } = await loginUser(email, password);
      
      // Return successful response with user and tokens
      res.status(200).json({
        success: true,
        message: 'User logged in successfully',
        data: { user, token, refreshToken }
      });
    } catch (error: any) {
      // Handle specific error cases
      if (error.code === 'NEEDS_VERIFICATION') {
        res.status(403).json({
          success: false,
          message: error.message || 'Please verify your email before logging in',
          needsVerification: true,
          email: email,
          code: error.code
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message || 'Invalid credentials',
          code: error.code || 'AUTH_ERROR'
        });
      }
    }
  } catch (error: any) {
    handleError(res, error, 'Error logging in');
  }
};

// Verify email controller
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    // Basic validation
    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Please provide email and verification code' });
      return;
    }
    
    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ success: false, message: 'Verification code should be a 6-digit number' });
      return;
    }

    try {
      // Delegate verification logic to service
      const { user, token, refreshToken } = await verifyOTPService(email, otp);
  
      // Send successful response
      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: { redirectTo: '/dashboard', user, token, refreshToken }
      });
    } catch (error: any) {
      // Map service error codes to appropriate responses
      const errorMapping: Record<string, { status: number, message: string }> = {
        'OTP_EXPIRED': { status: 400, message: 'Verification code has expired. Please request a new one.' },
        'OTP_INVALID': { status: 400, message: 'Invalid verification code. Please check and try again.' },
        'USER_NOT_FOUND': { status: 404, message: 'User not found with this email. Please register first.' }
      };
      
      const errorInfo = errorMapping[error.code] || { 
        status: 400, 
        message: error.message || 'Error verifying email' 
      };
      
      res.status(errorInfo.status).json({ 
        success: false, 
        message: errorInfo.message,
        code: error.code || 'VERIFICATION_ERROR'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during verification. Please try again.',
      code: 'SERVER_ERROR'
    });
  }
};

// Refresh token controller
export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token is required' });
      return;
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Generate new access token
    const newAccessToken = generateToken(user);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { token: newAccessToken }
    });
  } catch (error: any) {
    handleError(res, error, 'Error refreshing token');
  }
};

// Resend OTP controller
export const resendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Please provide email' });
      return;
    }

    await resendOTP(email);
    res.status(200).json({ success: true, message: 'Verification code sent successfully' });
  } catch (error: any) {
    handleError(res, error, 'Error sending verification code');
  }
};

// OAuth callback handler for all providers
export const oAuthCallback = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    // Validate user exists
    const user = req.user;
    if (!user) {
      throw new Error('Authentication failed');
    }
    
    // Generate authentication tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Create MongoDB session
    await createUserSession(req, res, user);
    
    // Redirect user to frontend
    redirectToDashboard(res, token, refreshToken, user);
  } catch (error: any) {
    redirectToLogin(res, error.message || 'Authentication failed');
  }
};

// Helper function to create a user session
async function createUserSession(req: RequestWithUser, res: Response, user: IUser): Promise<void> {
  const sessionId = uuidv4();
  try {
    const { createSession } = await import('../services/sessionService');
    
    await createSession(
      sessionId,
      user,
      req.headers['user-agent'] as string,
      req.ip
    );
    
    res.cookie('gatekeeper_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // More permissive for redirects
    });
  } catch (sessionError) {
    // Continue even if session creation fails - tokens will still work
  }
}

// Helper function to prepare user data and redirect to dashboard
function redirectToDashboard(res: Response, token: string, refreshToken: string, user: IUser): void {
  const userWithoutPassword = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    isVerified: user.isVerified,
    providerUsername: (user as any).providerUsername || null,
    provider: (user as any).provider || null,
    useProviderUsername: (user as any).useProviderUsername || false
  };
  
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const dashboardUrl = `${frontendUrl}/dashboard?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&userData=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`;
  
  res.redirect(dashboardUrl);
}

// Helper function to redirect to login with error
function redirectToLogin(res: Response, errorMessage: string): void {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`;
  res.redirect(redirectUrl);
}

// For backwards compatibility
export const googleAuthCallback = oAuthCallback;

// Request password reset controller
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Please provide email' });
      return;
    }

    // Validate email
    const validation = validateEmail(email);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    const result = await requestPasswordReset(email);
    
    // Return standard response without tokens
    res.status(200).json({ 
      success: true, 
      message: result.message
    });
  } catch (error: any) {
    console.error('Error in forgotPassword controller:', error);
    
    // Be careful not to expose sensitive error details
    if (error.message && error.message.includes('Failed to send')) {
      res.status(500).json({ 
        success: false, 
        message: 'Unable to send email at this time. Please try again later.'
      });
    } else {
      handleError(res, error, 'Error processing password reset request');
    }
  }
};

// Reset password with token controller
export const resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      res.status(400).json({ 
        success: false, 
        message: 'Please provide email, token, and new password' 
      });
      return;
    }

    // Validate password
    if (newPassword.length < 8) {
      res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters' 
      });
      return;
    }

    await resetPassword(email, token, newPassword);
    res.status(200).json({ 
      success: true, 
      message: 'Password reset successful. You can now log in with your new password.' 
    });
  } catch (error: any) {
    handleError(res, error, 'Error resetting password');
  }
};

// Logout controller
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // The clearSession middleware will handle removing the session
    clearSession(req, res, () => {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error: any) {
    console.error('Error in logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out'
    });
  }
};

