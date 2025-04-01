'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, userAPI } from '@/services/api';
import { toast } from 'react-hot-toast';

// Type definitions
interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  googleId?: string;
  githubId?: string;
  linkedinId?: string;
  facebookId?: string;
  providerUsername?: string;
  provider?: string;
  useProviderUsername?: boolean;
  avatarUrl?: string;
  profileImage?: string;
}

type User = UserProfile | null;

type OTPResponse = {
  otp: string;
  isNewUser: boolean;
  devOtp?: string;
};

type PasswordResetResponse = {
  success: boolean;
  message: string;
  resetToken?: string;
  resetUrl?: string;
};

interface AuthContextType {
  user: User;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<{ token: string; user: any }>;
  logout: () => void;
  verifyEmail: (email: string, otp: string) => Promise<any>;
  sendOTP: (email: string, userData?: OTPData) => Promise<OTPResponse>;
  resendOTP: (email: string) => Promise<any>;
  clearError: () => void;
  googleLogin: () => void;
  githubLogin: () => void;
  linkedinLogin: () => void;
  facebookLogin: () => void;
  setUser: (user: User) => void;
  getDisplayName: (userData: User) => string;
  forgotPassword: (email: string) => Promise<PasswordResetResponse>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{success: boolean; message: string}>;
}

interface OTPData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  isResend?: boolean;
}

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // State
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Check if user is already logged in (on page load)
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          setLoading(false);
          return;
        }
        
        // First try to get user data from localStorage
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
          try {
            const userData = JSON.parse(userDataString);
            setUser(userData);
            setLoading(false);
            return;
          } catch (parseError) {
            // If parse fails, continue with API call
          }
        }
        
        // Fetch user data from API if not available in localStorage
        try {
          const response = await userAPI.getCurrentUser();
          const userData = response.data?.user || response.data?.data || response.data;
          
          if (userData) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            throw new Error('Invalid user data structure');
          }
        } catch (apiError) {
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (err) {
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Authentication functions
  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.register({ firstName, lastName, email, password });
      
      // Delay to ensure component callback execution
      setTimeout(() => {
        if (window.location.pathname === '/signup') {
          router.push(`/verify-email?email=${encodeURIComponent(email)}&autoSend=true`);
        }
      }, 1000);
      
      return response;
    } catch (err: any) {
      // Handle duplicate email error
      if (err.response?.status === 400 || 
          err.response?.data?.code === 'EMAIL_EXISTS' || 
          err.response?.data?.code === 11000 || 
          (err.response?.data?.message && 
           err.response.data.message.toLowerCase().includes('already exists'))) {
        setError('This email is already registered. Please try logging in instead.');
      } else {
        setError(err?.response?.data?.message || 'Failed to register. Please try again.');
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.login({ email, password });
      
      if (response.success && response.data) {
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          document.cookie = `token=${response.data.token}; path=/; max-age=2592000`;
        }
        
        setUser(response.data.user);
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.data?.needsVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(err.response.data.email)}&autoSend=false`);
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    setUser(null);
    router.push('/login');
  };

  const verifyEmail = async (email: string, otp: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authAPI.verifyEmail({ email, otp });
      
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

  const sendOTP = async (email: string, userData?: OTPData): Promise<OTPResponse> => {
    try {
      setLoading(true);
      setError(null);
      
      const fullUserData = { ...userData, email: userData?.email || email };
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
      const errorMessage = err.userFriendlyMessage || err.response?.data?.message || err.message || 'Failed to send OTP';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async (email: string) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.sendOTP(email, { isResend: true });
      return response;
    } catch (error: any) {
      const errorMessage = error.userFriendlyMessage || error.response?.data?.message || error.message || 'Failed to resend verification code';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Social login methods
  const googleLogin = () => window.location.href = `${backendUrl}/api/auth/google`;
  const githubLogin = () => window.location.href = `${backendUrl}/api/auth/github`;
  const linkedinLogin = () => window.location.href = `${backendUrl}/api/auth/linkedin`;
  const facebookLogin = () => window.location.href = `${backendUrl}/api/auth/facebook`;

  // Helper functions
  const clearError = () => setError(null);

  const getDisplayName = (userData: User) => {
    if (!userData) return '';
    if (userData.email) return userData.email;
    if (userData.provider && userData.providerUsername) return userData.providerUsername;
    return `${userData.firstName} ${userData.lastName}`.trim();
  };

  // Password reset functions
  const forgotPassword = async (email: string): Promise<PasswordResetResponse> => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authAPI.forgotPassword({ email });
      
      if (response.success) {
        return {
          success: true,
          message: response.message || 'Password reset email sent successfully',
          resetToken: response.resetToken,
          resetUrl: response.resetUrl
        };
      } else {
        const errorMessage = response.message || 'Failed to process password reset request';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Unexpected error during password reset request';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

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
      const errorMessage = err.response?.data?.message || 'Failed to reset password';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const contextValue: AuthContextType = {
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
  };

  return (
    <AuthContext.Provider value={contextValue}>
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
