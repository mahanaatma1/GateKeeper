import { IUser } from '../models/userModel';
import mongoose from 'mongoose';
import Session, { ISession } from '../models/sessionModel';

// Interface to define the shape of a user session
export interface UserSession {
  userId: string;
  sessionId: string;
  lastActivity: Date;
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
}

/**
 * Create a new user session and store in database
 * @param sessionId Unique session identifier
 * @param user User object
 * @param userAgent Browser/client user agent
 * @param ip Client IP address
 * @param maxInactivityMinutes Session timeout in minutes (default 30)
 * @returns The created session
 */
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
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
};

/**
 * Get an active session by ID from database
 * @param sessionId The session ID
 * @returns The session or null if not found
 */
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
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Update the last activity time for a session
 * @param sessionId The session ID to update
 * @param maxInactivityMinutes Minutes to extend the session
 * @returns true if session was updated, false if session not found
 */
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
    console.error('Error updating session activity:', error);
    return false;
  }
};

/**
 * Delete a user session from database
 * @param sessionId The session ID to remove
 * @returns true if session was deleted, false if session not found
 */
export const deleteSession = async (sessionId: string): Promise<boolean> => {
  try {
    const result = await Session.deleteOne({ sessionId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
};

/**
 * Get all active sessions for a user
 * @param userId The user ID
 * @returns Array of session IDs
 */
export const getUserSessions = async (userId: string): Promise<string[]> => {
  try {
    const sessions = await Session.find({ 
      userId,
      expiresAt: { $gt: new Date() }
    });
    
    return sessions.map(session => session.sessionId);
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
};

/**
 * Delete all sessions for a user
 * @param userId The user ID
 * @returns The number of sessions deleted
 */
export const deleteUserSessions = async (userId: string): Promise<number> => {
  try {
    const result = await Session.deleteMany({ userId });
    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting user sessions:', error);
    return 0;
  }
};

/**
 * Clean up expired sessions
 * @returns Number of sessions cleaned up
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  try {
    const now = new Date();
    const result = await Session.deleteMany({
      expiresAt: { $lt: now }
    });
    
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
};

/**
 * Get session count statistics
 * @returns Object with total sessions and active users count
 */
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
    console.error('Error getting session statistics:', error);
    return {
      totalSessions: 0,
      activeUsers: 0
    };
  }
}; 