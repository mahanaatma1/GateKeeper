import express from 'express';
import { getCurrentUserHandler } from '../controllers/userControllers';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Get current user route (protected)
router.get('/me', authMiddleware, getCurrentUserHandler);

export default router;