import { Request, Response, NextFunction } from 'express';

// Helper function for validation errors
const validationError = (res: Response, message: string): Response => {
  return res.status(400).json({ success: false, message });
};

// Email validation regex
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Validate email format
export const validateEmail = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void | Response => {
  const { email } = req.body;
  
  if (!email) {
    return validationError(res, 'Email is required');
  }
  
  if (!EMAIL_REGEX.test(email)) {
    return validationError(res, 'Please provide a valid email address');
  }
  
  next();
};

// Validate registration data
export const validateRegister = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void | Response => {
  const { firstName, lastName, email, password } = req.body;
  
  // Check for required fields
  if (!firstName || !lastName || !email || !password) {
    return validationError(res, 'First name, last name, email, and password are required');
  }
  
  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return validationError(res, 'Please provide a valid email address');
  }
  
  // Validate password length
  if (password.length < 8) {
    return validationError(res, 'Password must be at least 8 characters long');
  }
  
  next();
}; 