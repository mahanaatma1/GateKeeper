import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash password
 * @param password Password to hash
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 * @param password Plain text password
 * @param hashedPassword Hashed password to compare against
 * @returns Boolean indicating if passwords match
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generates a random secure password for social login users
 * @returns Hashed random password
 */
export const generateRandomPassword = async (): Promise<string> => {
  // Generate a random 16-byte buffer and convert to base64
  const randomBytes = crypto.randomBytes(16).toString('base64');
  
  // Hash the password before storing
  return await hashPassword(randomBytes);
}; 