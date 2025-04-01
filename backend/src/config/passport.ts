import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as PassportStrategy } from 'passport-strategy';
import { IUser } from '../models/userModel';
import User from '../models/userModel';
import { generateRandomPassword } from '../utils/password';
import dotenv from 'dotenv';
import { Request } from 'express';
import axios from 'axios';

// Ensure environment variables are loaded
dotenv.config();

// Define types for passport callbacks
type DoneCallback = (error: Error | null, user?: any) => void;

// Extend user type for OAuth additions
interface IOAuthUser extends IUser {
  providerUsername?: string;
  provider?: string;
  useProviderUsername?: boolean; // Flag to control which name to display
}

// Configure OAuth credentials
const oAuthConfigs = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  },
  github: {
    clientID: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/github/callback`,
    scope: ['user:email']
  },
  linkedin: {
    clientID: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    callbackURL: process.env.LINKEDIN_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
    scope: ['openid', 'profile', 'email'],
    state: true
  },
  facebook: {
    clientID: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'name', 'emails'],
    enableProof: true
  }
};

// Generic function for OAuth user creation/association
async function handleOAuthProfile(
  profile: any, 
  providerIdField: 'googleId' | 'githubId' | 'linkedinId' | 'facebookId', 
  providerName: string,
  done: DoneCallback
) {
  try {
    // Get email and check development mode
    const email = profile.emails?.[0]?.value || '';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isLinkedIn = providerName === 'LinkedIn';

    // Handle development mode for LinkedIn
    if (isDevelopment && isLinkedIn && !email) {
      const existingUser = await User.findOne({ [providerIdField]: profile.id });
      if (existingUser) {
        return done(null, { ...existingUser.toObject(), provider: 'linkedin' });
      }

      const newUser = await User.create({
        email: `linkedin-${profile.id}@dev-placeholder.com`,
        firstName: profile.name?.givenName || 'LinkedIn',
        lastName: profile.name?.familyName || 'User',
        password: await generateRandomPassword(),
        [providerIdField]: profile.id,
        isVerified: true
      });

      return done(null, { ...newUser.toObject(), provider: 'linkedin' });
    }

    // Require email for production
    if (!email) {
      return done(new Error(`No email found from ${providerName}`));
    }

    // Get username based on provider
    const providerUsername = providerName === 'GitHub' ? profile.username :
      providerName === 'Google' ? profile.displayName :
      providerName === 'LinkedIn' ? `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || profile.displayName :
      profile.displayName;

    // Find or create user
    let user = await User.findOne({ [providerIdField]: profile.id });
    
    if (!user) {
      // Look for a user with the same email
      user = await User.findOne({ email });
      
      if (user) {
        console.log(`Linking ${providerName} account to existing user with email ${email}`);
        
        // Link the accounts by adding the provider ID
        user[providerIdField] = profile.id;
        user.isVerified = true;
        
        // If the user doesn't have a profile image but the provider does, use the provider's image
        if (!user.profileImage && profile.photos && profile.photos.length > 0) {
          user.profileImage = profile.photos[0].value;
          console.log(`Added profile image from ${providerName} to existing user account`);
        }
        
        await user.save();
        console.log(`Successfully linked ${providerName} account to existing user`);
      } else {
        // Create a completely new user
        // Try to get profile image from the OAuth provider
        let profileImage = '';
        
        if (providerName === 'Google' && profile.photos && profile.photos.length > 0) {
          profileImage = profile.photos[0].value;
        } else if (providerName === 'GitHub' && profile.photos && profile.photos.length > 0) {
          profileImage = profile.photos[0].value;
        } else if (providerName === 'LinkedIn' && profile.photos && profile.photos.length > 0) {
          profileImage = profile.photos[0].value;
        } else if (providerName === 'Facebook' && profile.photos && profile.photos.length > 0) {
          profileImage = profile.photos[0].value;
        }
        
        user = await User.create({
          email,
          firstName: profile.name?.givenName || providerName,
          lastName: profile.name?.familyName || 'User',
          password: await generateRandomPassword(),
          [providerIdField]: profile.id,
          isVerified: true,
          profileImage: profileImage || undefined
        });
        console.log(`Created new user with ${providerName} profile and email ${email}`);
      }
    } else {
      console.log(`Found existing user with ${providerName} ID ${profile.id}`);
      
      // Check if this OAuth account's email is associated with another account
      const emailAccount = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailAccount) {
        console.log(`Found another account with same email ${email}. Merging accounts...`);
        
        // If the email account has a profile image and this account doesn't, copy it
        if (emailAccount.profileImage && !user.profileImage) {
          user.profileImage = emailAccount.profileImage;
          console.log(`Copied profile image from email account to OAuth account`);
        }
        await user.save();
      }
    }

    // Return user with provider info
    const userObj = user.toObject() as IOAuthUser;
    return done(null, {
      ...userObj,
      provider: providerName.toLowerCase(),
      providerUsername,
      useProviderUsername: !user[providerIdField] // Only true for new users
    });

  } catch (error) {
    console.error(`Error in handleOAuthProfile for ${providerName}:`, error);
    return done(error as Error);
  }
}

// Configure Google strategy
if (oAuthConfigs.google.clientID && oAuthConfigs.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      oAuthConfigs.google,
      async (accessToken: string, refreshToken: string, profile: Profile, done: DoneCallback) => {
        await handleOAuthProfile(profile, 'googleId', 'Google', done);
      }
    )
  );
}

// Configure GitHub strategy
if (oAuthConfigs.github.clientID && oAuthConfigs.github.clientSecret) {
  passport.use(
    new GitHubStrategy(
      oAuthConfigs.github,
      async (accessToken: string, refreshToken: string, profile: any, done: DoneCallback) => {
        await handleOAuthProfile(profile, 'githubId', 'GitHub', done);
      }
    )
  );
}

// Configure LinkedIn strategy with OAuth 2.0
if (oAuthConfigs.linkedin.clientID && oAuthConfigs.linkedin.clientSecret) {
  passport.use(
    new LinkedInStrategy(
      oAuthConfigs.linkedin,
      async (accessToken: string, refreshToken: string, profile: any, done: DoneCallback) => {
        try {
          // Validate required profile data
          if (!profile.id) {
            return done(new Error('Missing LinkedIn profile ID'));
          }

          if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
            return done(new Error('Missing email in LinkedIn profile'));
          }

          // Use the common handleOAuthProfile function
          await handleOAuthProfile(profile, 'linkedinId', 'LinkedIn', done);

        } catch (error: any) {
          return done(error as Error);
        }
      }
    )
  );
}

// Configure Facebook strategy
if (oAuthConfigs.facebook.clientID && oAuthConfigs.facebook.clientSecret) {
  passport.use(
    new FacebookStrategy(
      oAuthConfigs.facebook,
      async (accessToken: string, refreshToken: string, profile: any, done: DoneCallback) => {
        await handleOAuthProfile(profile, 'facebookId', 'Facebook', done);
      }
    )
  );
}

// Required for OAuth State validation
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

export default passport; 