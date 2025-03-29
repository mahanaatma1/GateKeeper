import User from '../models/userModel';
import { hashPassword } from '../utils/password';
import { sendPasswordResetEmail } from './emailService';
import crypto from 'crypto';

// Request password reset
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal that the user doesn't exist
      // Just return success to prevent email enumeration attacks
      console.log(`Password reset requested for non-existent email: ${email}`);
      return { 
        success: true,
        message: 'If an account with that email exists, we have sent password reset instructions.'
      };
    }

    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token (don't store plaintext token in DB)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Set expiration (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    // Update user with reset token and expiration
    await User.updateOne(
      { _id: user._id },
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: expiresAt
      }
    );
    
    // Send reset email with token
    await sendPasswordResetEmail(email, resetToken);
    console.log(`Password reset email sent successfully to ${email}`);
    
    return { 
      success: true,
      message: 'Password reset instructions sent to your email.'
    };
  } catch (error) {
    console.error('Error in requestPasswordReset:', error);
    throw error;
  }
};

// Reset password with token
export const resetPassword = async (
  email: string,
  token: string, 
  newPassword: string
): Promise<boolean> => {
  try {
    // Hash the token from the URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with matching token and valid expiration
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });
    
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update user with new password, clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isVerified = true; // Auto-verify on password reset
    
    await user.save();
    
    return true;
  } catch (error) {
    console.error('Error in resetPassword:', error);
    throw error;
  }
}; 