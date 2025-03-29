import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  createSession, 
  getSession, 
  updateSessionActivity, 
  deleteSession 
} from '../services/sessionService';
import { AuthRequest } from './authMiddleware';

// Session cookie name
const SESSION_COOKIE = 'gatekeeper_session';
// Session header (for API clients)
const SESSION_HEADER = 'x-session-id';

/**
 * Initialize or validate a user session
 */
export const sessionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip sessions for certain routes
    if (
      req.path === '/' || // Health check
      req.path.startsWith('/api/auth/login') || 
      req.path.startsWith('/api/auth/register') ||
      req.path.startsWith('/api/auth/verify-email') ||
      req.path.startsWith('/api/auth/forgot-password')
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
        res.clearCookie(SESSION_COOKIE);
      }
    }
    
    // Create new session if user is authenticated
    if (authReq.user) {
      sessionId = uuidv4();
      await createSession(
        sessionId, 
        authReq.user,
        req.headers['user-agent'] as string,
        req.ip
      );
      
      // Set session cookie
      res.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      });
      
      // Set header for API clients
      res.setHeader(SESSION_HEADER, sessionId);
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
      res.clearCookie(SESSION_COOKIE);
    }
    
    next();
  } catch (error) {
    console.error('Clear session error:', error);
    next(error);
  }
}; 