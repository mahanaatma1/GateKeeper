import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';
import { sendRegistrationOTP } from '../services/registrationService';
import { uploadBufferToCloudinary } from '../config/cloudniaryConfig';

// Define the User interface to match the model structure
interface IUser {
  _id: any;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  isVerified?: boolean;
}

// Constants
const PLACEHOLDER_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Ccircle cx=%2260%22 cy=%2260%22 r=%2250%22 fill=%22%23e2e8f0%22/%3E%3Cpath d=%22M60 30 C 42 30 30 45 30 60 C 30 75 45 90 60 90 C 75 90 90 75 90 60 C 90 45 78 30 60 30 Z M 60 40 C 65 40 70 45 70 50 C 70 55 65 60 60 60 C 55 60 50 55 50 50 C 50 45 55 40 60 40 Z M 42 82 C 44 74 52 68 60 68 C 68 68 76 74 78 82 C 73 86 67 88 60 88 C 53 88 47 86 42 82 Z%22 fill=%22%23cbd5e1%22/%3E%3C/svg%3E';
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Utility functions
const sendResponse = (
  res: Response, 
  status: number, 
  success: boolean, 
  message: string, 
  data?: any, 
  extras?: Record<string, any>
) => {
  return res.status(status).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(extras !== undefined && extras)
  });
};

const handleError = (res: Response, error: any, customMessage: string) => {
  console.error(`${customMessage}:`, error);
  return sendResponse(
    res, 
    500, 
    false, 
    error.message || customMessage
  );
};

const checkAuthentication = (req: AuthRequest, res: Response): boolean => {
  if (!req.user || !req.user._id) {
    sendResponse(res, 401, false, 'Unauthorized');
    return false;
  }
  return true;
};

// Get current user
export const getCurrentUserHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!checkAuthentication(req, res)) return;
    
    const user = await User.findById(req.user!._id).select('-password');
    
    if (!user) {
      sendResponse(res, 404, false, 'User not found');
      return;
    }

    sendResponse(res, 200, true, 'User retrieved successfully', user);
  } catch (error) {
    handleError(res, error, 'Error retrieving user');
  }
};

// Send OTP to user
export const sendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      sendResponse(res, 400, false, 'Email is required');
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      sendResponse(res, 400, false, 'Please enter a valid email');
      return;
    }

    const user = await User.findOne({ email });
    const otp = await sendRegistrationOTP(email);
    
    sendResponse(
      res, 
      200, 
      true, 
      'OTP sent successfully', 
      null, 
      { 
        otp,  // Only for development/testing
        isNewUser: !user 
      }
    );
  } catch (error) {
    handleError(res, error, 'Error sending OTP');
  }
};

// Update user profile
export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!checkAuthentication(req, res)) return;
    
    const { firstName, lastName } = req.body;
    const updateData: Record<string, any> = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    
    if (Object.keys(updateData).length === 0) {
      sendResponse(res, 400, false, 'No profile data provided for update');
      return;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      updateData,
      { new: true }
    ).select('-password');
    
    if (!user) {
      sendResponse(res, 404, false, 'User not found');
      return;
    }
    
    sendResponse(res, 200, true, 'Profile updated successfully', user);
  } catch (error) {
    handleError(res, error, 'Error updating user profile');
  }
};

// Upload profile image
export const uploadProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!checkAuthentication(req, res)) return;

    if (!req.file) {
      sendResponse(res, 400, false, 'No image file uploaded');
      return;
    }

    try {
      // Upload to Cloudinary
      const cloudinaryResult = await uploadBufferToCloudinary(
        req.file.buffer,
        `profile_images/user_${req.user!._id}_${Date.now()}`,
        { folder: 'profile_images' }
      );

      // Update user with the new profile image URL
      const user = await User.findByIdAndUpdate(
        req.user!._id,
        { profileImage: cloudinaryResult.url },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      sendResponse(
        res, 
        200, 
        true, 
        'Profile image uploaded successfully', 
        null, 
        {
          url: cloudinaryResult.url,
          profileImage: cloudinaryResult.url
        }
      );
    } catch (cloudinaryError) {
      // Update user with placeholder
      await User.findByIdAndUpdate(
        req.user!._id,
        { profileImage: PLACEHOLDER_AVATAR },
        { new: true }
      );

      sendResponse(
        res, 
        200, 
        true, 
        'Using placeholder image (Cloudinary upload failed)', 
        null, 
        {
          url: PLACEHOLDER_AVATAR,
          profileImage: PLACEHOLDER_AVATAR
        }
      );
    }
  } catch (error) {
    handleError(res, error, 'Error uploading profile image');
  }
};

// Sync profiles between accounts with the same email
export const syncProfilesBetweenAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!checkAuthentication(req, res)) return;

    // At this point we know req.user exists because checkAuthentication passed
    const userId = req.user!._id;
    const userEmail = req.user!.email;
    
    // Find all accounts with the same email
    const accounts = await User.find({ email: userEmail }) as IUser[];
    
    if (accounts.length <= 1) {
      sendResponse(
        res, 
        200, 
        true, 
        'No other accounts found with the same email to sync with', 
        null, 
        { synced: false }
      );
      return;
    }

    // Find accounts with and without profile images
    const accountsWithImage = accounts.filter(account => account.profileImage) as IUser[];
    const accountsWithoutImage = accounts.filter(account => !account.profileImage) as IUser[];
    
    // If no account has a profile image or all accounts have images, no need to sync
    if (accountsWithImage.length === 0 || accountsWithoutImage.length === 0) {
      sendResponse(
        res, 
        200, 
        true, 
        'No profile images need to be synced between accounts', 
        null, 
        { synced: false }
      );
      return;
    }
    
    // Use the first account with an image as the source
    const sourceAccount: IUser = accountsWithImage[0];
    const profileImage = sourceAccount.profileImage;
    
    // Copy the profile image to all accounts that don't have one
    const updatePromises = accountsWithoutImage.map(account => 
      User.findByIdAndUpdate(
        account._id,
        { profileImage },
        { new: true }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Update current user's profile image in memory if needed
    if (
      !req.user!.profileImage && 
      sourceAccount._id && 
      userId && 
      sourceAccount._id.toString() !== userId.toString()
    ) {
      req.user!.profileImage = profileImage;
    }
    
    sendResponse(
      res, 
      200, 
      true, 
      'Successfully synced profile image across all accounts', 
      null, 
      {
        synced: true,
        updatedAccounts: accountsWithoutImage.length,
        profileImage
      }
    );
  } catch (error) {
    handleError(res, error, 'Error syncing profiles between accounts');
  }
};

