import { IUser } from '../models/userModel';
import mongoose from 'mongoose';
import Session, { ISession } from '../models/sessionModel';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

// Session cookie name
export const SESSION_COOKIE = 'gatekeeper_session';
// Session header (for API clients)
export const SESSION_HEADER = 'x-session-id';

// Interface to define the shape of a user session
export interface UserSession {
  userId: string;
  sessionId: string;
  lastActivity: Date;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
}

// Handle OAuth callback and create session
export const handleOAuthCallback = async (req: Request, res: Response, user: IUser): Promise<void> => {
  try {
    // Generate tokens for the user
    const { generateToken, generateRefreshToken } = await import('../utils/jwt');
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Create MongoDB session with lax sameSite for OAuth redirects
    await createAndSetSession(req, res, user, 'lax');
    
    // Prepare user data for the dashboard
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
    
    // Construct dashboard URL with tokens and user data
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const dashboardUrl = `${frontendUrl}/dashboard?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&userData=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`;
    
    // Use standard 302 redirect for maximum compatibility
    res.writeHead(302, {
      'Location': dashboardUrl
    });
    res.end();
  } catch (error) {
    // Redirect to login with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent('Authentication failed')}`;
    res.redirect(redirectUrl);
  }
};

// Redirect user to login page with error message
export const redirectToLogin = (res: Response, errorMessage: string): void => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const redirectUrl = `${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`;
  res.redirect(redirectUrl);
};

//Create session and set cookies/headers
export const createAndSetSession = async (
  req: Request,
  res: Response,
  user: IUser,
  sameSitePolicy: 'strict' | 'lax' | 'none' = 'strict',
  maxInactivityMinutes: number = 30
): Promise<string> => {
  const sessionId = uuidv4();
  
  try {
    // Create session in database
    await createSession(
      sessionId,
      user,
      req.headers['user-agent'] as string,
      req.ip,
      maxInactivityMinutes
    );
    
    // Set cookie
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: maxInactivityMinutes * 60 * 1000,
      sameSite: sameSitePolicy
    });
    
    // Set header for API clients
    res.setHeader(SESSION_HEADER, sessionId);
    
    return sessionId;
  } catch (error) {
    throw new Error('Failed to create and set session');
  }
};

// Check if request has a valid session
export const hasValidSession = async (req: Request): Promise<boolean> => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE] || req.headers[SESSION_HEADER] as string;
    if (!sessionId) return false;
    
    const session = await getSession(sessionId);
    return !!session;
  } catch (error) {
    return false;
  }
};

// Clear session cookies and headers
export const clearSessionCookies = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE);
  res.removeHeader(SESSION_HEADER);
};

//Create a new session in the database
export const createSession = async (
  sessionId: string,
  user: IUser,
  userAgent?: string,
  ip?: string,
  maxInactivityMinutes: number = 30
): Promise<UserSession> => {
  try {
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + maxInactivityMinutes);
    
    // Convert user ID to string if it's an ObjectId
    const userId = user._id instanceof mongoose.Types.ObjectId 
      ? user._id.toString() 
      : typeof user._id === 'string' 
        ? user._id 
        : String(user._id);
    
    // Create the session object
    const sessionData = {
      sessionId,
      userId,
      lastActivity: new Date(),
      userAgent,
      ip,
      expiresAt
    };
    
    // Save session to database - first delete any existing session with same ID
    await Session.deleteOne({ sessionId });
    
    // Create new session
    const session = await Session.create(sessionData);
    
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      lastActivity: session.lastActivity,
      userAgent: session.userAgent,
      ip: session.ip,
      expiresAt: session.expiresAt
    };
  } catch (error) {
    throw new Error('Failed to create session');
  }
};
//Get session by ID if it's still valid
export const getSession = async (sessionId: string): Promise<UserSession | null> => {
  try {
    const session = await Session.findOne({ 
      sessionId, 
      expiresAt: { $gt: new Date() } 
    });
    
    if (!session) return null;
    
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      lastActivity: session.lastActivity,
      userAgent: session.userAgent,
      ip: session.ip,
      expiresAt: session.expiresAt
    };
  } catch (error) {
    return null;
  }
};

// Update session activity timestamp
export const updateSessionActivity = async (
  sessionId: string, 
  maxInactivityMinutes: number = 30
): Promise<boolean> => {
  try {
    const now = new Date();
    
    // Calculate new expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + maxInactivityMinutes);
    
    const result = await Session.updateOne(
      { sessionId },
      { 
        $set: { 
          lastActivity: now,
          expiresAt: expiresAt
        } 
      }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    return false;
  }
};
//Delete a session by ID
export const deleteSession = async (sessionId: string): Promise<boolean> => {
  try {
    const result = await Session.deleteOne({ sessionId });
    return result.deletedCount > 0;
  } catch (error) {
    return false;
  }
};
//Get all valid session IDs for a user
export const getUserSessions = async (userId: string): Promise<string[]> => {
  try {
    const sessions = await Session.find({ 
      userId,
      expiresAt: { $gt: new Date() }
    });
    
    return sessions.map(session => session.sessionId);
  } catch (error) {
    return [];
  }
};
//Delete all sessions for a user
export const deleteUserSessions = async (userId: string): Promise<number> => {
  try {
    const result = await Session.deleteMany({ userId });
    return result.deletedCount;
  } catch (error) {
    return 0;
  }
};
 // Remove expired sessions from the database
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const now = new Date();
    const result = await Session.deleteMany({
      expiresAt: { $lt: now }
    });
    
    return result.deletedCount;
  } catch (error) {
    return 0;
  }
};
// Get session statistics
export const getSessionStats = async (): Promise<{
  totalSessions: number;
  activeUsers: number;
}> => {
  try {
    const now = new Date();
    
    // Count all non-expired sessions
    const totalSessions = await Session.countDocuments({
      expiresAt: { $gt: now }
    });
    
    // Count unique users with active sessions
    const activeUsers = await Session.distinct('userId', { 
      expiresAt: { $gt: now } 
    }).then(users => users.length);
    
    return {
      totalSessions,
      activeUsers
    };
  } catch (error) {
    return {
      totalSessions: 0,
      activeUsers: 0
    };
  }
}; 