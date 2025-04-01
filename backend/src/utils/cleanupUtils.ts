import User from '../models/userModel';

//Delete unverified users older than 24 hours
export const deleteUnverifiedUsers = async (hours: number = 24): Promise<void> => {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);
    
    // Find and delete unverified users older than the cutoff date
    await User.deleteMany({
      isVerified: false,
      createdAt: { $lt: cutoffDate }
    });
  } catch (error) {
    // Silent error handling
  }
}; 