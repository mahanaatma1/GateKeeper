import User from '../models/userModel';
import { hashPassword } from '../utils/password';

// Get user by ID
export const getUserById = async (userId: string) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    throw error;
  }
};

// Get user by email
export const getUserByEmail = async (email: string) => {
  try {
    const user = await User.findOne({ email });
    return user;
  } catch (error) {
    throw error;
  }
};

// Update user details
export const updateUserDetails = async (
  userId: string,
  updateData: {
    firstName?: string;
    lastName?: string;
  }
) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    throw error;
  }
};

// Update user password
export const updateUserPassword = async (userId: string, newPassword: string) => {
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { password: hashedPassword } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  } catch (error) {
    throw error;
  }
}; 