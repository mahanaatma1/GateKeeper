'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, userAPI } from '@/services/api';
import { toast } from 'react-hot-toast';

// Disable console logs in production and optionally in development
const DEBUG = false; // Set to true to enable logs
const log = DEBUG ? console.log : () => {};
const warn = DEBUG ? console.warn : () => {};
const errorLog = DEBUG ? console.error : () => {}; // Renamed to avoid conflict

// Define types
type User = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  googleId?: string; // Add optional Google ID
  githubId?: string; // Add optional GitHub ID
  linkedinId?: string; // Add optional LinkedIn ID
  facebookId?: string; // Add optional Facebook ID
  providerUsername?: string; // Add OAuth provider username
  provider?: string; // Add OAuth provider name
  useProviderUsername?: boolean; // Flag to determine if we should use the provider username
} | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<{ token: string; user: any }>;
  logout: () => void;
  verifyEmail: (email: string, otp: string) => Promise<any>;
  sendOTP: (email: string, userData?: { firstName?: string; lastName?: string; email?: string; password?: string; isResend?: boolean }) => Promise<{otp: string; isNewUser: boolean; devOtp?: string}>;
  resendOTP: (email: string) => Promise<void>;
  clearError: () => void;
  googleLogin: () => void; // Google login function
  githubLogin: () => void; // GitHub login function
  linkedinLogin: () => void; // LinkedIn login function
  facebookLogin: () => void; // Facebook login function
  setUser: (user: User) => void; // Add setUser function
  getDisplayName: (userData: User) => string; // Add getDisplayName function
  forgotPassword: (email: string) => Promise<{
    success: boolean; 
    message: string;
    resetToken?: string;
    resetUrl?: string;
  }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{success: boolean; message: string}>;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Helper function to handle API errors
  const handleApiError = (error: any) => {
    console.error('API Error:', error);
    const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
    setError(errorMessage);
    toast.error(errorMessage);
  };

  // Check if user is already logged in (on page load)
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        log('AuthContext: Checking login state');
        const token = localStorage.getItem('token');
        
        if (token) {
          log('AuthContext: Token found in localStorage');
          
          // First check if user data is already in localStorage
          const userDataString = localStorage.getItem('user');
          if (userDataString) {
            try {
              log('AuthContext: Found user data in localStorage');
              const userData = JSON.parse(userDataString);
              setUser(userData);
              log('AuthContext: Set user from localStorage:', userData.email);
              
              // Log provider info if available
              if (userData.provider && userData.providerUsername) {
                log(`AuthContext: User has ${userData.provider} provider with username: ${userData.providerUsername}`);
              }
              
              setLoading(false);
              return; // Exit early since we have the user data
            } catch (parseError) {
              log('AuthContext: Error parsing user data from localStorage', parseError);
              // Continue with API call if parsing fails
            }
          }
          
          // If we don't have the user data in localStorage, fetch it from API
          log('AuthContext: Fetching user data from API');
          try {
            const { data } = await userAPI.getCurrentUser();
            log('AuthContext: Received user data from API');
            setUser(data.user);
          } catch (apiError) {
            log('AuthContext: API error fetching user data', apiError);
            // Token might be expired or invalid
            localStorage.removeItem('token');
            setUser(null);
          }
        } else {
          log('AuthContext: No token found');
        }
      } catch (err) {
        log('AuthContext: Error during login check', err);
        // Token might be expired or invalid
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Register function
  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      log(`Registering user: ${email}`);
      const response = await authAPI.register({ firstName, lastName, email, password });
      log("Registration successful:", response);
      
      // Don't store token yet as the user is not verified
      // The token will be stored after successful verification
      
      // Add a slight delay before returning to ensure the component callback has a chance to execute
      setTimeout(() => {
        // Backup redirect in case the component callback fails
        if (window.location.pathname === '/signup') {
          log("Backup redirect to verify-email page");
          router.push(`/verify-email?email=${encodeURIComponent(email)}&autoSend=true`);
        }
      }, 1000);
      
      return response; // Return the response so the component can access token/user data
    } catch (err: any) {
      log("Registration error:", err);
      
      // Handle 400 Bad Request specifically for duplicate email
      if (err.response?.status === 400) {
        log("Email already exists error detected via 400 status");
        setError('This email is already registered. Please try logging in instead.');
        return Promise.reject(err);
      }
      
      // Check for specific error identifying that the email already exists
      if (err.response?.data?.code === 'EMAIL_EXISTS' || 
          err.response?.data?.code === 11000 || 
          (err.response?.data?.message && 
           (err.response.data.message.toLowerCase().includes('already exists') || 
            err.response.data.message.toLowerCase().includes('already registered') ||
            err.response.data.message.toLowerCase().includes('email is taken')))) {
            
        setError('This email is already registered. Please try logging in instead.');
      } else {
        setError(err?.response?.data?.message || 'Failed to register. Please try again.');
      }
      
      throw err; // Re-throw to allow component to handle error
    } finally {
      setLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.login({ email, password });
      
      if (response.success && response.data) {
        // Store token and user data
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          document.cookie = `token=${response.data.token}; path=/; max-age=2592000`;
        }
        
        setUser(response.data.user);
        router.push('/dashboard');
      }
    } catch (err: any) {
      // Handle verification redirect
      if (err.response?.data?.needsVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(err.response.data.email)}&autoSend=false`);
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    router.push('/login');
  };

  // Verify email with OTP
  const verifyEmail = async (email: string, otp: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.verifyEmail({ email, otp });
      
      // Store token and user data after verification
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
        document.cookie = `token=${response.data.token}; path=/; max-age=2592000`;
        setUser(response.data.user);
      }
      
      return response;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const sendOTP = async (email: string, userData?: { firstName?: string; lastName?: string; email?: string; password?: string; isResend?: boolean }) => {
    try {
      log('[AuthContext] Starting sendOTP for email:', email);
      setLoading(true);
      setError(null);
      
      // Make sure email is included in userData if not already
      const fullUserData = {
        ...userData,
        email: userData?.email || email
      };
      
      const response = await authAPI.sendOTP(email, fullUserData);
      
      if (response.success === false) {
        throw new Error(response.message || 'Failed to send OTP');
      }
      
      return {
        otp: response.otp,
        isNewUser: response.isNewUser,
        devOtp: response.devOtp
      };
    } catch (err: any) {
      errorLog('[AuthContext] Error sending OTP:', err);
      const errorMessage = err.userFriendlyMessage || err.response?.data?.message || err.message || 'Failed to send OTP';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP (uses the same endpoint as sendOTP)
  const resendOTP = async (email: string) => {
    try {
      log('[AuthContext] Starting resendOTP for email:', email);
      setLoading(true);
      clearError();
      
      // Add a flag to indicate this is a resend operation
      const response = await authAPI.sendOTP(email, { isResend: true });
      
      log('[AuthContext] OTP resent successfully:', response);
      
      return response;
    } catch (error: any) {
      errorLog('[AuthContext] Error in resendOTP:', error);
      const errorMessage = error.userFriendlyMessage || error.response?.data?.message || error.message || 'Failed to resend verification code';
      handleApiError(error);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Google login
  const googleLogin = () => {
    try {
      setLoading(true);
      setError(null);
      
      // Redirect to Google OAuth endpoint
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      window.location.href = `${backendUrl}/api/auth/google`;
    } catch (err: any) {
      setError('Failed to initiate Google login');
    } finally {
      setLoading(false);
    }
  };

  // GitHub login
  const githubLogin = () => {
    try {
      setLoading(true);
      setError(null);
      
      // Redirect to GitHub OAuth endpoint
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      window.location.href = `${backendUrl}/api/auth/github`;
    } catch (err: any) {
      setError('Failed to initiate GitHub login');
    } finally {
      setLoading(false);
    }
  };

  // LinkedIn login
  const linkedinLogin = () => {
    try {
      setLoading(true);
      setError(null);
      
      // Redirect to LinkedIn OAuth endpoint
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      window.location.href = `${backendUrl}/api/auth/linkedin`;
    } catch (err: any) {
      setError('Failed to initiate LinkedIn login');
    } finally {
      setLoading(false);
    }
  };

  // Facebook login
  const facebookLogin = () => {
    try {
      setLoading(true);
      setError(null);
      
      // Redirect to Facebook OAuth endpoint
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      window.location.href = `${backendUrl}/api/auth/facebook`;
    } catch (err: any) {
      setError('Failed to initiate Facebook login');
    } finally {
      setLoading(false);
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Forgot password function
  const forgotPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.forgotPassword({ email });
      
      return {
        success: response.success,
        message: response.message,
        resetToken: response.resetToken,
        resetUrl: response.resetUrl
      };
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process password reset request');
      
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to process password reset request'
      };
    } finally {
      setLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (email: string, token: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.resetPassword({ email, token, newPassword });
      
      return {
        success: response.success,
        message: response.message
      };
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
      
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to reset password'
      };
    } finally {
      setLoading(false);
    }
  };

  // Add a function to get display name based on login method
  const getDisplayName = (userData: User) => {
    if (!userData) return '';
    
    // Always prioritize showing email in one of several formats
    if (userData.email) {
      // You can uncomment one of these options based on your preference:
      
      // Option 1: Show full email address
      return userData.email;
      
      // Option 2: Show username part of the email
      // const username = userData.email.split('@')[0];
      // return username;
      
      // Option 3: Show partially masked email for privacy
      // const [username, domain] = userData.email.split('@');
      // const maskedUsername = username.length > 2 
      //   ? `${username.charAt(0)}${'*'.repeat(username.length - 2)}${username.charAt(username.length - 1)}`
      //   : username;
      // return `${maskedUsername}@${domain}`;
    }
    
    // Fallback to provider username if available
    if (userData.provider && userData.providerUsername) {
      return userData.providerUsername;
    }
    
    // Last resort: use first+last name
    return `${userData.firstName} ${userData.lastName}`.trim();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        verifyEmail,
        sendOTP,
        resendOTP,
        clearError,
        googleLogin,
        githubLogin,
        linkedinLogin,
        facebookLogin,
        setUser,
        getDisplayName,
        forgotPassword,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
