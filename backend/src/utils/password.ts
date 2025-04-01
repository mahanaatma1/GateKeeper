import bcrypt from 'bcryptjs';
import crypto from 'crypto';

//Hash password
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

//Compare password
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

//Generate random password
export const generateRandomPassword = async (): Promise<string> => {
  // Generate a random 16-byte buffer and convert to base64
  const randomBytes = crypto.randomBytes(16).toString('base64');
  
  // Hash the password before storing
  return await hashPassword(randomBytes);
}; 