import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport';
import { connectDB } from './config/db';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { errorHandler, notFound } from './middlewares/errorMiddleware';
import { sessionHandler } from './middlewares/sessionMiddleware';
import { deleteUnverifiedUsers } from './utils/cleanupUtils';
import { cleanupExpiredSessions } from './services/sessionService';

// Initialize environment variables
dotenv.config();

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());
app.use(cookieParser());

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://res.cloudinary.com',
      'http://res.cloudinary.com'
    ];
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Special CORS for image proxy
app.use('/api/users/proxy-image', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Session configuration (OAuth only)
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    },
    name: 'gatekeeper.sid',
    unset: 'destroy'
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
app.use(sessionHandler);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/', (_, res) => {
  res.status(200).send('Server is running');
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Scheduled tasks
cron.schedule('0 */12 * * *', async () => {
  try {
    await deleteUnverifiedUsers(24);
  } catch (error) {
    console.error('Error cleaning up unverified users:', error);
  }
});

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

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app; 