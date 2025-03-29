import { Response, Request, RequestHandler } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';
import { sendRegistrationOTP } from '../services/registrationService';

// Common error response handler
const handleError = (res: Response, error: any, defaultMessage: string, statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message: error.message || defaultMessage
  });
};

// Get current user - modified to be compatible with Express RequestHandler
export const getCurrentUser = (req: Request, res: Response): Promise<void> => {
  return (async () => {
    try {
      // Cast Request to AuthRequest to access the user property
      const authReq = req as AuthRequest;
      
      if (!authReq.user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, data: { user: authReq.user } });
    } catch (error: any) {
      handleError(res, error, 'Error retrieving user');
    }
  })();
};

// Type-safe wrapper for getCurrentUser
export const getCurrentUserHandler: RequestHandler = (req, res, next) => {
  return getCurrentUser(req, res);
};

// Send OTP to user
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Please enter a valid email' });
      return;
    }

    const user = await User.findOne({ email });
    
    // Use the centralized sendRegistrationOTP function that handles both OTP generation and email sending
    const otp = await sendRegistrationOTP(email);
    
    // In development mode, return OTP in response (remove in production)
    res.status(200).json({ 
      success: true, 
      message: 'OTP sent successfully',
      otp, // Only for development/testing
      isNewUser: !user
    });
  } catch (error: any) {
    handleError(res, error, 'Error sending OTP', 400);
  }
};