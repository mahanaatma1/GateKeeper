import User, { IUser } from '../models/userModel';
import { comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken } from '../utils/jwt';

// Login function with error codes
export const loginUser = async (email: string, password: string): Promise<{
  user: any;
  token: string;
  refreshToken: string;
}> => {
  try {
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      const error: any = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    
    // Check if email is verified
    if (!user.isVerified) {
      const error: any = new Error('Please verify your email before logging in');
      error.code = 'NEEDS_VERIFICATION';
      throw error;
    }
    
    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      const error: any = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }
    
    // Remove password from returned user object
    const userWithoutPassword = user.toObject();
    delete (userWithoutPassword as any).password;
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    return { user: userWithoutPassword, token, refreshToken };
  } catch (error: any) {
    // Add error code if missing
    if (!error.code) {
      error.code = 'LOGIN_ERROR';
    }
    throw error;
  }
};

// OAuth login
export const handleOAuthLogin = async (profile: any, provider: string): Promise<{ user: any; token: string }> => {
  try {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    
    if (!email) {
      throw new Error(`Could not get email from ${provider}`);
    }
    
    // Find providerKey based on provider name
    const providerKey = `${provider}Id` as keyof IUser;
    
    // Look for existing user by provider ID or email
    let user = await User.findOne({ 
      $or: [
        { [providerKey]: profile.id },
        { email: email }
      ]
    });
    
    if (user) {
      // If user exists but doesn't have provider ID, update it
      if (!user.get(providerKey)) {
        user.set(providerKey, profile.id);
        user.isVerified = true; // Auto-verify users who sign in with OAuth
        await user.save();
      }
    } else {
      // Create new user
      const names = getNameFromProfile(profile, provider);
      
      const userData: Partial<IUser> = {
        firstName: names.firstName,
        lastName: names.lastName,
        email: email,
        password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
        isVerified: true
      };
      
      // Add the provider ID
      userData[providerKey] = profile.id;
      
      user = await User.create(userData);
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Return user without password and token
    const userWithoutPassword = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.isVerified,
    };
    
    return { user: userWithoutPassword, token };
  } catch (error) {
    throw error;
  }
};

// Helper to extract name from various provider profiles
const getNameFromProfile = (profile: any, provider: string) => {
  let firstName = '';
  let lastName = '';
  
  switch (provider) {
    case 'google':
      firstName = profile.name.givenName || '';
      lastName = profile.name.familyName || '';
      break;
    case 'github':
      // GitHub doesn't provide first/last name reliably
      // Try to split displayName or use login as firstName
      if (profile.displayName) {
        const nameParts = profile.displayName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        firstName = profile.username || '';
      }
      break;
    case 'facebook':
      firstName = profile.name.givenName || '';
      lastName = profile.name.familyName || '';
      break;
    case 'linkedin':
      firstName = profile.name.givenName || '';
      lastName = profile.name.familyName || '';
      break;
    default:
      // Generic fallback
      if (profile.displayName) {
        const nameParts = profile.displayName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
  }
  
  return { firstName, lastName };
}; 