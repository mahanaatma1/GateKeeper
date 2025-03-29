import jwt from 'jsonwebtoken';
import { IUser } from '../models/userModel';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'gatekeeper_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'gatekeeper_refresh_secret';

// Generate JWT token
export const generateToken = (user: IUser): string => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate a refresh token with longer expiration
export const generateRefreshToken = (user: IUser): string => {
  return jwt.sign(
    {
      id: user._id
    },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Verify refresh token
export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};