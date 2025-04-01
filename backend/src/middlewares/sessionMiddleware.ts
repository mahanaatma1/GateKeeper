import { Request, Response, NextFunction } from 'express';
import { 
  getSession, 
  updateSessionActivity, 
  createAndSetSession,
  hasValidSession,
  clearSessionCookies,
  deleteSession,
  SESSION_COOKIE,
  SESSION_HEADER
} from '../services/sessionService';
import { AuthRequest } from './authMiddleware';

/**
 * Initialize or validate a user session for JWT authentication
 * 
 * IMPORTANT: This middleware handles our custom MongoDB-based sessions,
 * which are separate from the Express sessions used for OAuth flows.
 * - Express sessions (managed by express-session): Used ONLY for OAuth
 * - MongoDB sessions (managed here): Used for all other authenticated routes
 */
export const sessionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip sessions for OAuth routes - these use Express sessions instead
    if (
      req.path === '/' || // Health check
      req.path.startsWith('/api/auth/login') || 
      req.path.startsWith('/api/auth/register') ||
      req.path.startsWith('/api/auth/verify-email') ||
      req.path.startsWith('/api/auth/forgot-password') ||
      req.path.startsWith('/api/auth/google') ||
      req.path.startsWith('/api/auth/facebook') ||
      req.path.startsWith('/api/auth/github') ||
      req.path.startsWith('/api/auth/linkedin')
    ) {
      return next();
    }

    // Check for existing session
    let sessionId = req.cookies?.[SESSION_COOKIE] || req.headers[SESSION_HEADER] as string;
    const authReq = req as AuthRequest;
    
    if (sessionId) {
      // Session exists, validate it
      const session = await getSession(sessionId);
      
      if (session) {
        // Update session activity timestamp
        await updateSessionActivity(sessionId);
        return next();
      } else {
        // Invalid session, clear cookie
        clearSessionCookies(res);
      }
    }
    
    // Create new session if user is authenticated
    if (authReq.user) {
      try {
        await createAndSetSession(req, res, authReq.user, 'strict');
      } catch (err) {
        console.error('Error creating session in middleware:', err);
        // Continue even if session creation fails
      }
    }
    
    next();
  } catch (error) {
    console.error('Session middleware error:', error);
    next(error);
  }
};

/**
 * Clear user session on logout
 */
export const clearSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE] || req.headers[SESSION_HEADER] as string;
    
    if (sessionId) {
      await deleteSession(sessionId);
      clearSessionCookies(res);
    }
    
    next();
  } catch (error) {
    console.error('Clear session error:', error);
    next(error);
  }
}; 