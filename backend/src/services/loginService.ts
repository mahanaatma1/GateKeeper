import User, { IUser } from '../models/userModel';
import { comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken } from '../utils/jwt';

type OAuthProvider = 'google' | 'github' | 'facebook' | 'linkedin';
type ProviderKey = `${OAuthProvider}Id`;

// Login function with error codes
export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) throw { code: 'USER_NOT_FOUND', message: 'User not found' };
  if (!user.isVerified) throw { code: 'NEEDS_VERIFICATION', message: 'Please verify your email' };
  
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) throw { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
  
  const userWithoutPassword = user.toObject();
  delete (userWithoutPassword as any).password;
  
  return {
    user: userWithoutPassword,
    token: generateToken(user),
    refreshToken: generateRefreshToken(user)
  };
};

// OAuth login
export const handleOAuthLogin = async (profile: any, provider: OAuthProvider) => {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error(`No email found from ${provider}`);
  
  const providerKey = `${provider}Id` as ProviderKey;
  const names = getNameFromProfile(profile, provider);
  
  let user = await User.findOne({ 
    $or: [
      { [providerKey]: profile.id },
      { email }
    ]
  });
  
  if (!user) {
    user = await User.create({
      firstName: names.firstName,
      lastName: names.lastName,
      email,
      password: Math.random().toString(36).slice(-12),
      [providerKey]: profile.id,
      isVerified: true
    });
  } else if (!user[providerKey]) {
    (user as any)[providerKey] = profile.id;
    user.isVerified = true;
    await user.save();
  }
  
  return {
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isVerified: user.isVerified
    },
    token: generateToken(user)
  };
};

// Helper to extract name from various provider profiles
const getNameFromProfile = (profile: any, provider: OAuthProvider) => {
  const nameMap: Record<OAuthProvider, () => { firstName: string; lastName: string }> = {
    google: () => ({ firstName: profile.name.givenName, lastName: profile.name.familyName }),
    github: () => {
      const nameParts = profile.displayName?.split(' ') || [];
      return {
        firstName: nameParts[0] || profile.username,
        lastName: nameParts.slice(1).join(' ')
      };
    },
    facebook: () => ({ firstName: profile.name.givenName, lastName: profile.name.familyName }),
    linkedin: () => ({ firstName: profile.name.givenName, lastName: profile.name.familyName })
  };

  return nameMap[provider]?.() || {
    firstName: profile.displayName?.split(' ')[0] || provider,
    lastName: profile.displayName?.split(' ').slice(1).join(' ') || 'User'
  };
}; 