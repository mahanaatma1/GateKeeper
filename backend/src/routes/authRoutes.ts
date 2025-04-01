import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import {
  register,
  login,
  verifyEmail,
  resendVerificationCode,
  sendRegistrationOTP,
  oAuthCallback,
  refreshAccessToken,
  forgotPassword,
  resetPasswordWithToken,
  logout
} from '../controllers/authControllers';
import { AuthRequest } from '../middlewares/authMiddleware';
import { syncProfilesByEmail } from '../middlewares/profileSyncMiddleware';

// Extend passport modules with type definitions
declare module 'passport-local' {
  export interface LocalVerifyFunction {
    (username: string, password: string, done: (error: any, user?: any, options?: any) => void): void;
  }
  
  export class LocalStrategy {
    constructor(options: any, verify: LocalVerifyFunction);
  }
}

declare module 'passport-github2' {
  export interface GithubVerifyFunction {
    (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void): void;
  }
  
  export class GithubStrategy {
    constructor(options: any, verify: GithubVerifyFunction);
  }
}

// Add types for passport serialization
declare module 'passport' {
  export interface PassportStatic {
    serializeUser(fn: (user: any, done: (err: any, id?: any) => void) => void): void;
    deserializeUser(fn: (id: any, done: (err: any, user?: any) => void) => void): void;
  }
}

const router = express.Router();

// Frontend URL for redirecting
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Basic auth routes
router.post('/register', register);
router.post('/login', login, syncProfilesByEmail);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/send-registration-otp', sendRegistrationOTP);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithToken);

// OAuth route configuration
const configureOAuthRoute = (provider: string, scopes: string[]) => {
  // Initiation route
  router.get(`/${provider}`, (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(provider, { 
      scope: scopes, 
      session: true,
      prompt: 'select_account' // Force account selection
    })(req, res, next);
  });

  // Callback route
  router.get(
    `/${provider}/callback`,
    (req: Request, res: Response, next: NextFunction) => {
      const error = req.query.error as string;
      if (error) {
        return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
      }
      
      passport.authenticate(provider, {
        session: true,
        failureRedirect: `${FRONTEND_URL}/login?error=Authentication failed`
      })(req, res, next);
    },
    syncProfilesByEmail,
    oAuthCallback
  );
};

// Configure OAuth providers
if (process.env.GOOGLE_CLIENT_ID) {
  configureOAuthRoute('google', ['profile', 'email']);
}

if (process.env.GITHUB_CLIENT_ID) {
  configureOAuthRoute('github', ['user:email']);
}

if (process.env.LINKEDIN_CLIENT_ID) {
  configureOAuthRoute('linkedin', ['openid', 'profile', 'email']);
}

if (process.env.FACEBOOK_CLIENT_ID) {
  configureOAuthRoute('facebook', ['email']);
}

// Facebook data deletion callback
const handleDataDeletion: RequestHandler = (req, res) => {
  if (!req.body.signed_request) {
    res.status(400).json({ error: 'Missing signed_request parameter' });
    return;
  }
  
  res.json({
    url: `${FRONTEND_URL}/data-deletion`,
    confirmation_code: `gatekeeper-${Date.now()}`
  });
};

router.post('/facebook/data-deletion', handleDataDeletion);

// Test endpoint to get LinkedIn auth URL
router.get('/linkedin/auth-url', (req: Request, res: Response) => {
  const linkedinConfig = {
    clientID: process.env.LINKEDIN_CLIENT_ID,
    redirectURI: process.env.LINKEDIN_CALLBACK_URL || `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
    scope: ['openid', 'profile', 'email'],
    state: 'test-state-' + Date.now()
  };

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${linkedinConfig.clientID}&` +
    `redirect_uri=${encodeURIComponent(linkedinConfig.redirectURI)}&` +
    `scope=${linkedinConfig.scope.join('%20')}&` +
    `state=${linkedinConfig.state}`;

  res.json({ authUrl });
});

export default router;