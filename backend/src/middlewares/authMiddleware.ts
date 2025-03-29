import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/userModel';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

// Auth request type with user property
export interface AuthRequest extends Request {
  user?: IUser;
}

// Helper function for auth errors
const sendAuthError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

// Authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendAuthError(res, 401, 'No token provided, authorization denied');
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      sendAuthError(res, 401, 'Token is invalid or expired');
      return;
    }

    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      sendAuthError(res, 404, 'User not found');
      return;
    }

    // Cast req to AuthRequest to add the user property
    (req as AuthRequest).user = user as IUser;
    next();
  } catch (error) {
    sendAuthError(res, 500, 'Server error in authentication');
  }
};

// Export a RequestHandler-compatible version for use in Express routes
export const authMiddleware: RequestHandler = (req, res, next) => {
  return authenticate(req, res, next);
};