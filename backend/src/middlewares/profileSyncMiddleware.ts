import { Request, Response, NextFunction } from 'express';
import User from '../models/userModel';


export const syncProfilesByEmail = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Only proceed if we have a user in the request
    if (!req.user || !req.user.email) {
      return next();
    }

    const userEmail = req.user.email;
    const userId = req.user._id;

    console.log(`[Profile Sync] Checking for accounts with email: ${userEmail}`);

    // Find all accounts with the same email
    const accounts = await User.find({ email: userEmail });
    
    if (accounts.length <= 1) {
      // No other accounts to sync with
      return next();
    }

    console.log(`[Profile Sync] Found ${accounts.length} accounts with email ${userEmail}`);

    // Find account with profile image
    let accountWithImage = null;
    for (const account of accounts) {
      if (account.profileImage) {
        accountWithImage = account;
        break;
      }
    }

    // If we found an account with an image, and the current user doesn't have one
    if (accountWithImage && !req.user.profileImage) {
      console.log(`[Profile Sync] Copying profile image from account ${accountWithImage._id} to current user ${userId}`);
      
      // Update the current user's document in the database
      await User.findByIdAndUpdate(
        userId,
        { profileImage: accountWithImage.profileImage },
        { new: true }
      );
      
      // Also update the user object in the request so the response has the updated data
      req.user.profileImage = accountWithImage.profileImage;
      
      console.log(`[Profile Sync] Successfully synced profile image to current user`);
    }

    next();
  } catch (error) {
    // Log the error but don't block the request
    console.error('[Profile Sync] Error syncing profiles:', error);
    next();
  }
}; 