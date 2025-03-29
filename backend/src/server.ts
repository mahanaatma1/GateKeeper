import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';
import cookieParser from 'cookie-parser';
import passport from './config/passport';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { errorHandler, notFound } from './middlewares/errorMiddleware';
import { sessionHandler } from './middlewares/sessionMiddleware';
import { deleteUnverifiedUsers } from './utils/cleanupUtils';
import { cleanupExpiredSessions } from './services/sessionService';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());

// Initialize Passport (without Express session)
app.use(passport.initialize());

// Custom MongoDB-based session handler
app.use(sessionHandler);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Schedule unverified users cleanup - run every 12 hours
cron.schedule('0 */12 * * *', async () => {
  try {
    await deleteUnverifiedUsers(24); // Delete unverified users after 24 hours
  } catch (error) {
    console.error('Error cleaning up unverified users:', error);
  }
});

// Schedule session cleanup - run every hour
cron.schedule('0 * * * *', async () => {
  try {
    const deletedCount = await cleanupExpiredSessions();
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
});

// Start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app; 