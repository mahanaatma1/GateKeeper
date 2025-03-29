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
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationCode);
router.post('/send-registration-otp', sendRegistrationOTP);
router.post('/refresh-token', refreshAccessToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithToken);

// Configure OAuth providers (common configuration)
const configureOAuthRoutes = (providerName: string, scopes: string[]) => {
  // Auth initiation route
  router.get(`/${providerName}`, (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(providerName, { 
      scope: scopes,
      session: false 
    })(req, res, next);
  });

  // Auth callback route
  router.get(
    `/${providerName}/callback`,
    (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate(providerName, {
        session: false,
        failureRedirect: `${FRONTEND_URL}/login?error=${encodeURIComponent(`Authentication failed with ${providerName}`)}`
      })(req, res, next);
    },
    // Success handler (cast req to AuthRequest to access user property)
    (req: Request, res: Response) => oAuthCallback(req as AuthRequest, res)
  );
};

// Set up OAuth routes for each provider
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  configureOAuthRoutes('google', ['profile', 'email']);
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  configureOAuthRoutes('github', ['user:email']);
}

if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  configureOAuthRoutes('linkedin', ['r_liteprofile', 'r_emailaddress']);
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  configureOAuthRoutes('facebook', ['email']);
}

// Add Facebook data deletion callback URL
router.post('/facebook/data-deletion', (req: Request, res: Response) => {
  try {
    // Facebook sends a signed_request parameter
    const signedRequest = req.body.signed_request;
    
    if (!signedRequest) {
      res.status(400).json({ error: 'Missing signed_request parameter' });
      return;
    }
    
    // Return a confirmation status URL as per Facebook requirements
    res.json({
      url: `${FRONTEND_URL}/data-deletion`,
      confirmation_code: `gatekeeper-${Date.now()}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;