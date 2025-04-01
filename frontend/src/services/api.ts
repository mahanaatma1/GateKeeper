'use client';

import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';

// Constants
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const REQUEST_THROTTLE_MS = 3000; // Minimum 3 seconds between identical requests

// Custom error interface
interface ApiError extends Error {
  userFriendlyMessage?: string;
  isNetworkError?: boolean;
  isAborted?: boolean;
  code?: string;
  response?: any;
}

// Request tracking
const apiCallsInProgress = new Map<string, boolean>();
const apiCallTimeouts = new Map<string, NodeJS.Timeout>();
const lastRequestTimestamps = new Map<string, number>();

// Configure axios instance with longer timeout
const API = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT,
});

// Add auth token to requests
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Global error handler
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error detection
    const isNetworkError = (
      error.message === 'Network Error' || 
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network') ||
      error.message?.includes('connection') ||
      !error.response
    );
    
    if (isNetworkError) {
      error.isNetworkError = true;
      error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Timeout detection
    if (
      error.code === 'ERR_CANCELED' || 
      error.name === 'AbortError' || 
      error.name === 'CanceledError' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout')
    ) {
      error.isAborted = true;
      error.userFriendlyMessage = 'Request took too long to complete. Please try again.';
    }
    
    // Clear progress flag for this request
    if (error.config?.url) {
      const callKey = `${error.config.method}_${error.config.url}`;
      apiCallsInProgress.set(callKey, false);
    }
    
    return Promise.reject(error);
  }
);

// Request helper functions
function withTimeout<T>(request: Promise<T>, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  return Promise.race([
    request,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error('Request timed out') as ApiError;
        error.name = 'TimeoutError';
        error.userFriendlyMessage = 'Request took too long to complete. Please try again.';
        reject(error);
      }, timeoutMs);
    })
  ]);
}

function markApiCallComplete(callKey: string): void {
  const existingTimeout = apiCallTimeouts.get(callKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  const timeoutId = setTimeout(() => {
    apiCallsInProgress.set(callKey, false);
    apiCallTimeouts.delete(callKey);
  }, 1000);
  
  apiCallTimeouts.set(callKey, timeoutId);
}

function shouldThrottleRequest(requestType: string, uniqueKey: string): boolean {
  const now = Date.now();
  const key = `${requestType}_${uniqueKey}`;
  const lastTime = lastRequestTimestamps.get(key) || 0;
  
  if (now - lastTime < REQUEST_THROTTLE_MS) {
    return true;
  }
  
  lastRequestTimestamps.set(key, now);
  return false;
}

// Auth API calls
export const authAPI = {
  sendOTP: async (email: string, userData?: { 
    firstName?: string; 
    lastName?: string; 
    email?: string; 
    password?: string; 
    isResend?: boolean 
  }) => {
    const baseKey = `sendOTP_${email}_${userData?.isResend ? 'resend' : 'new'}`;
    
    if (shouldThrottleRequest('sendOTP', baseKey)) {
      return Promise.reject(new Error('Please wait a moment before requesting another code'));
    }
    
    const callKey = `${baseKey}_${Date.now()}`;
    apiCallsInProgress.set(callKey, true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    
    try {
      const requestBody = { 
        email, 
        ...userData,
        isResend: userData?.isResend === true
      };
      
      const response = await withTimeout(
        API.post('/api/auth/send-registration-otp', requestBody, {
          signal: controller.signal,
          timeout: DEFAULT_TIMEOUT
        })
      );
      
      return response.data;
    } catch (error: any) {
      // Add user-friendly messages
      if (error.isNetworkError || error.message === 'Network Error') {
        error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.response?.data?.code === 'ALREADY_VERIFIED') {
        error.userFriendlyMessage = 'This email is already verified. Please login instead.';
      } else if (error.response?.data?.code === 'EMAIL_SEND_FAILED') {
        error.userFriendlyMessage = 'Unable to send verification email at this time. Please try again later.';
      } else if (error.response?.data?.code === 'INVALID_EMAIL') {
        error.userFriendlyMessage = 'Please provide a valid email address.';
      } else if (error.response?.status === 400 || error.response?.status === 409) {
        error.userFriendlyMessage = error.response?.data?.message || 'There was a problem processing your request.';
      }
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
      markApiCallComplete(callKey);
    }
  },

  verifyEmail: async (data: { email: string; otp: string }) => {
    const callKey = `verifyEmail_${data.email}_${data.otp}_${Date.now()}`;
    apiCallsInProgress.set(callKey, true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    
    try {
      const response = await withTimeout(
        API.post('/api/auth/verify-email', data, {
          signal: controller.signal,
          timeout: DEFAULT_TIMEOUT
        })
      );
      
      return response.data;
    } catch (error: any) {
      // Add user-friendly messages
      if (error.isNetworkError || error.message === 'Network Error') {
        error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.response?.data?.code === 'OTP_EXPIRED') {
        error.userFriendlyMessage = 'Verification code has expired. Please request a new one.';
      } else if (error.response?.data?.code === 'OTP_INVALID') {
        error.userFriendlyMessage = 'Invalid verification code. Please check and try again.';
      } else if (error.response?.data?.code === 'USER_NOT_FOUND') {
        error.userFriendlyMessage = 'User not found with this email. Please register first.';
      } else if (error.response?.status === 400 || error.response?.status === 401) {
        error.userFriendlyMessage = error.response?.data?.message || 'Invalid verification code. Please check and try again.';
      }
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
      markApiCallComplete(callKey);
    }
  },

  register: async (userData: { firstName: string; lastName: string; email: string; password: string }) => {
    try {
      const response = await API.post('/api/auth/register', userData);
      return response.data;
    } catch (error: any) {
      // Handle duplicate email
      if (error.response?.status === 400 || 
          error.response?.status === 409 || 
          error.response?.data?.code === 11000 || 
          (error.response?.data?.message && 
           error.response.data.message.toLowerCase().includes('already exists'))) {
        
        if (!error.response) error.response = {};
        if (!error.response.data) error.response.data = {};
        
        error.response.data = {
          ...error.response.data,
          message: 'This email is already registered. Please log in instead.',
          code: 'EMAIL_EXISTS'
        };
      }
      throw error;
    }
  },

  login: async (credentials: { email: string; password: string }) => {
    try {
      // Validate inputs
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      
      if (!credentials.email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }
      
      // Make request
      const response = await API.post('/api/auth/login', {
        email: credentials.email.trim(),
        password: credentials.password
      });
      
      return response.data;
    } catch (error: any) {
      // Add user-friendly messages
      if (error.isNetworkError || error.message === 'Network Error') {
        error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.response?.data?.code === 'NEEDS_VERIFICATION') {
        error.userFriendlyMessage = 'Please verify your email before logging in.';
      } else if (error.response?.data?.code === 'INVALID_CREDENTIALS') {
        error.userFriendlyMessage = 'Invalid email or password. Please try again.';
      } else if (error.response?.data?.code === 'USER_NOT_FOUND') {
        error.userFriendlyMessage = 'No account found with this email. Please sign up first.';
      }
      
      throw error;
    }
  },

  forgotPassword: async (data: { email: string }) => {
    try {
      // Validate email
      if (!data.email) {
        return {
          success: false,
          message: 'Email address is required'
        };
      }
      
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(data.email)) {
        return {
          success: false,
          message: 'Please enter a valid email address'
        };
      }
      
      const response = await API.post('/api/auth/forgot-password', data);
      
      return {
        success: true,
        message: 'Password reset email sent successfully',
        ...response.data
      };
    } catch (error: any) {
      // Return friendly error messages
      if (error.isNetworkError || error.message === 'Network Error') {
        return {
          success: false,
          message: 'Unable to connect to the server. Please check your internet connection.'
        };
      } else if (error.response?.data?.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          message: 'No account found with this email address. Please check your email.'
        };
      } else if (error.response?.data?.code === 'EMAIL_SEND_FAILED') {
        return {
          success: false,
          message: 'Failed to send password reset email. Please try again later.'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to process password reset request. Please try again.'
      };
    }
  },
  
  resetPassword: async (data: { email: string; token: string; newPassword: string }) => {
    try {
      const response = await API.post('/api/auth/reset-password', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

// User API calls
export const userAPI = {
  getCurrentUser: async () => {
    try {
      const response = await API.get('/api/users/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  uploadProfileImage: async (file: File) => {
    const formData = new FormData();
    formData.append('profileImage', file);

    const response = await API.post('/api/users/profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

export default API; 