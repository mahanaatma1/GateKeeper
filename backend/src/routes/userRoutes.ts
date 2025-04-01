import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getCurrentUserHandler, syncProfilesBetweenAccounts, uploadProfileImage } from '../controllers/userControllers';
import { uploadProfileImage as uploadProfileImageMiddleware } from '../middlewares/uploadMiddleware';
import { syncProfilesByEmail } from '../middlewares/profileSyncMiddleware';

const router = express.Router();

// Protected routes
router.use(authMiddleware);

// Get current user
router.get('/me', syncProfilesByEmail, getCurrentUserHandler);

// Upload profile image
router.post('/profile-image', uploadProfileImageMiddleware, uploadProfileImage);

// Sync profiles between accounts with the same email
router.post('/sync-profiles', syncProfilesBetweenAccounts);

export default router;