import multer from 'multer';
import { Request } from 'express';

// Configure multer for memory storage (files stored as buffers)
const storage = multer.memoryStorage();

// File filter function to validate uploaded files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Create multer upload instance
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Export middleware for use in routes
export const uploadSingleImage = upload.single('image');
export const uploadProfileImage = upload.single('profileImage'); 