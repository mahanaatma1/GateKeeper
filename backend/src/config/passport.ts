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
    scope: ['r_liteprofile', 'r_emailaddress'],
    profileFields: ['id', 'first-name', 'last-name', 'email-address'],
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
    // Extract email from profile
    const email = profile.emails && profile.emails.length > 0 
      ? profile.emails[0].value 
      : '';

    if (!email) {
      return done(new Error(`Could not retrieve email from ${providerName}`));
    }

    // Extract provider username - e.g. GitHub username, Google display name, etc.
    let providerUsername = '';
    if (providerName === 'GitHub') {
      providerUsername = profile.username || '';
    } else if (providerName === 'Google') {
      providerUsername = profile.displayName || '';
    } else if (providerName === 'LinkedIn') {
      providerUsername = `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();
    } else if (providerName === 'Facebook') {
      providerUsername = profile.displayName || '';
    }

    // Check if user exists with provider ID
    const query = { [providerIdField]: profile.id };
    let user = await User.findOne(query);
    
    if (user) {
      // Add provider info but don't set useProviderUsername to true
      // if we already have this user registered with the provider
      const userObj = user.toObject() as IOAuthUser;
      userObj.providerUsername = providerUsername;
      userObj.provider = providerName.toLowerCase();
      
      // Flag to control name display preference - set it to false
      // if the user created their account manually before OAuth
      userObj.useProviderUsername = false;
      return done(null, userObj);
    }
    
    // Check if user exists with email
    user = await User.findOne({ email });

    if (user) {
      // Link provider to existing account
      user[providerIdField] = profile.id;
      user.isVerified = true;
      await user.save();
      
      // Add provider info but set useProviderUsername to false
      // because this user already exists with manual registration
      const userObj = user.toObject() as IOAuthUser;
      userObj.providerUsername = providerUsername;
      userObj.provider = providerName.toLowerCase();
      userObj.useProviderUsername = false;
      return done(null, userObj);
    }

    // Create new user if not found
    const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || `${providerName}`;
    const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || 'User';
    
    // Generate a random password
    const randomPassword = await generateRandomPassword();

    const newUser = new User({
      email,
      firstName,
      lastName,
      password: randomPassword,
      [providerIdField]: profile.id,
      isVerified: true // OAuth users are pre-verified
    });

    await newUser.save();
    
    // Add provider info and set useProviderUsername to true
    // because this is a new user created via OAuth
    const newUserObj = newUser.toObject() as IOAuthUser;
    newUserObj.providerUsername = providerUsername;
    newUserObj.provider = providerName.toLowerCase();
    newUserObj.useProviderUsername = true;
    return done(null, newUserObj);
  } catch (error) {
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

// Configure LinkedIn strategy
if (oAuthConfigs.linkedin.clientID && oAuthConfigs.linkedin.clientSecret) {
  passport.use(
    new LinkedInStrategy(
      oAuthConfigs.linkedin,
      async (accessToken: string, refreshToken: string, profile: any, done: DoneCallback) => {
        try {
          // Check if we have a valid profile with an ID
          if (profile && profile.id) {
            // Check if profile has emails
            if (!profile.emails || profile.emails.length === 0) {
              // Try to fetch email via LinkedIn API
              try {
                const emailResponse = await axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                  }
                });
                
                if (emailResponse.data?.elements?.[0]?.['handle~']?.emailAddress) {
                  const email = emailResponse.data.elements[0]['handle~'].emailAddress;
                  profile.emails = [{ value: email }];
                }
              } catch (emailError: any) {
                // If email fetch fails, use a placeholder email if absolutely necessary
                if (!profile.emails || profile.emails.length === 0) {
                  const placeholderEmail = `linkedin-${profile.id}@example.com`;
                  profile.emails = [{ value: placeholderEmail }];
                }
              }
            }
            
            return await handleOAuthProfile(profile, 'linkedinId', 'LinkedIn', done);
          } else {
            return done(new Error('Invalid LinkedIn profile received - missing ID'));
          }
        } catch (error: any) {
          return done(error);
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


export default passport; 