'use client';

import axios from 'axios';

// Disable console logs in production and optionally in development
const DEBUG = false; // Set to true to enable logs
const log = DEBUG ? console.log : () => {};
const warn = DEBUG ? console.warn : () => {};
const errorLog = DEBUG ? console.error : () => {}; // Renamed to avoid conflict

// Flag to track if API calls are in progress
const apiCallsInProgress = new Map<string, boolean>();
const apiCallTimeouts = new Map<string, NodeJS.Timeout>();

// Add timestamp tracking for rate limiting
const lastRequestTimestamps = new Map<string, number>();
const REQUEST_THROTTLE_MS = 3000; // Minimum 3 seconds between identical requests

// Create axios instance with base URL
const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
  // Set a reasonable timeout for all requests
  timeout: 8000,
});

// Create a custom error interface for more descriptive errors
interface ApiError extends Error {
  userFriendlyMessage?: string;
  isNetworkError?: boolean;
  isAborted?: boolean;
  code?: string;
  response?: any;
}

// Add authorization header to requests if token exists
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Add a global error handler for network issues
API.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Enhanced network error detection - check various conditions
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
      errorLog('API: Network error detected:', error.message);
      error.isNetworkError = true;
      error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Handle aborted requests or timeouts
    if (
      error.code === 'ERR_CANCELED' || 
      error.name === 'AbortError' || 
      error.name === 'CanceledError' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout')
    ) {
      errorLog('API: Request was aborted, canceled, or timed out:', error.message);
      error.isAborted = true;
      error.userFriendlyMessage = 'Request took too long to complete. Please try again.';
    }
    
    // Always clear any in-progress flags for this request
    if (error.config && error.config.url) {
      const callKey = `${error.config.method}_${error.config.url}`;
      apiCallsInProgress.set(callKey, false);
    }
    
    return Promise.reject(error);
  }
);

// Add a helper to ensure all requests have a timeout
const safeRequest = async (requestFn: Promise<any> | (() => Promise<any>), timeoutMs = 8000) => {
  // Create an abort controller for the timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  try {
    // If requestFn is a function, call it with the signal
    // If it's already a promise, just await it
    const result = typeof requestFn === 'function'
      ? await requestFn()
      : await requestFn;
      
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Add a check for timeout-related errors
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out') as ApiError;
      timeoutError.name = 'TimeoutError';
      timeoutError.userFriendlyMessage = 'Request took too long. Please try again.';
      throw timeoutError;
    }
    
    throw error;
  }
};

// Function to wrap any request with a timeout and proper error handling
const withTimeout = async (request: Promise<any>, timeoutMs = 8000) => {
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
};

// Function to safely mark API call as complete
const markApiCallComplete = (callKey: string) => {
  // Clear any existing timeout for this call
  const existingTimeout = apiCallTimeouts.get(callKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    apiCallTimeouts.delete(callKey);
  }
  
  // Set a new timeout to mark the call as complete
  const timeoutId = setTimeout(() => {
    apiCallsInProgress.set(callKey, false);
    apiCallTimeouts.delete(callKey);
  }, 1000); // Extended the delay to prevent immediate retries
  
  apiCallTimeouts.set(callKey, timeoutId);
};

// Helper to check if a call is in progress
const isCallInProgress = (callKey: string): boolean => {
  return apiCallsInProgress.get(callKey) === true;
};

// Check if a request should be throttled (identical request too soon)
const shouldThrottleRequest = (requestType: string, uniqueKey: string): boolean => {
  const now = Date.now();
  const key = `${requestType}_${uniqueKey}`;
  const lastTime = lastRequestTimestamps.get(key) || 0;
  
  // Check if this request type happened too recently
  if (now - lastTime < REQUEST_THROTTLE_MS) {
    return true;
  }
  
  // Update the timestamp for this request type
  lastRequestTimestamps.set(key, now);
  return false;
};

// Auth API calls
export const authAPI = {
  sendOTP: async (email: string, userData?: { firstName?: string; lastName?: string; email?: string; password?: string; isResend?: boolean }) => {
    // Create a base key without timestamp for throttling check
    const baseKey = `sendOTP_${email}_${userData?.isResend ? 'resend' : 'new'}`;
    
    // Check if this is a duplicate request that should be throttled
    if (shouldThrottleRequest('sendOTP', baseKey)) {
      return Promise.reject(new Error('Please wait a moment before requesting another code'));
    }
    
    // Create a unique key for this API call with timestamp to prevent blocking
    const callKey = `${baseKey}_${Date.now()}`;
    
    try {
      // Mark this call as in progress
      apiCallsInProgress.set(callKey, true);
      
      // Make sure email is properly included in the request body
      const requestBody = { 
        email, 
        ...userData,
        // Explicitly include isResend flag
        isResend: userData?.isResend === true
      };
      
      // Use the abort controller and a timeout to ensure the request doesn't hang
      const controller = new AbortController();
      
      try {
        // Set a timeout to abort the request if it takes too long
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 8000);
        
        // Make the request with the abort signal and use our withTimeout wrapper
        const response = await withTimeout(
          API.post('/api/auth/send-registration-otp', requestBody, {
            signal: controller.signal,
            timeout: 8000 // Also set axios timeout for added safety
          }),
          10000 // Slightly longer timeout for the race
        );
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        return response.data;
      } catch (error: any) {
        // Check if this was a timeout or abort
        if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || 
            error.name === 'CanceledError' || error.name === 'TimeoutError') {
          const timeoutError = new Error('OTP request timed out. Please try again.') as ApiError;
          timeoutError.name = 'TimeoutError';
          timeoutError.userFriendlyMessage = 'Request took too long. Please try again.';
          throw timeoutError;
        }
        
        throw error;
      }
    } catch (error: any) {
      // Add user-friendly messages based on error codes from backend
      if (error.isNetworkError || error.message === 'Network Error') {
        error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.response?.data?.code === 'ALREADY_VERIFIED') {
        error.userFriendlyMessage = 'This email is already verified. Please login instead.';
      } else if (error.response?.data?.code === 'EMAIL_SEND_FAILED') {
        error.userFriendlyMessage = 'Unable to send verification email at this time. Please try again later.';
      } else if (error.response?.data?.code === 'INVALID_EMAIL') {
        error.userFriendlyMessage = 'Please provide a valid email address.';
      } else if (error.response?.status === 400 || error.response?.status === 409) {
        // Handle specific API errors with user-friendly messages
        error.userFriendlyMessage = error.response?.data?.message || 'There was a problem processing your request.';
      }
      
      throw error;
    } finally {
      // Always mark the call as completed, even if there was an error
      markApiCallComplete(callKey);
    }
  },

  verifyEmail: async (data: { email: string; otp: string }) => {
    // Create a unique key for this API call to prevent duplicates
    const callKey = `verifyEmail_${data.email}_${data.otp}_${Date.now()}`;
    
    try {
      // Mark this call as in progress
      apiCallsInProgress.set(callKey, true);
      
      // Use the abort controller and a timeout to ensure the request doesn't hang
      const controller = new AbortController();
      
      try {
        // Set a timeout to abort the request if it takes too long
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 8000);
        
        // Make the request with the abort signal
        const response = await withTimeout(
          API.post('/api/auth/verify-email', data, {
            signal: controller.signal,
            timeout: 8000
          }),
          10000
        );
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        return response.data;
      } catch (error: any) {
        // Check if this was a timeout or abort
        if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || 
            error.name === 'CanceledError' || error.name === 'TimeoutError') {
          const timeoutError = new Error('Verification request timed out. Please try again.') as ApiError;
          timeoutError.name = 'TimeoutError';
          timeoutError.userFriendlyMessage = 'Request took too long. Please try again.';
          throw timeoutError;
        }
        
        throw error;
      }
    } catch (error: any) {
      // Add user-friendly messages based on error codes from backend
      if (error.isNetworkError || error.message === 'Network Error') {
        error.userFriendlyMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.response?.data?.code === 'OTP_EXPIRED') {
        error.userFriendlyMessage = 'Verification code has expired. Please request a new one.';
      } else if (error.response?.data?.code === 'OTP_INVALID') {
        error.userFriendlyMessage = 'Invalid verification code. Please check and try again.';
      } else if (error.response?.data?.code === 'USER_NOT_FOUND') {
        error.userFriendlyMessage = 'User not found with this email. Please register first.';
      } else if (error.response?.status === 400 || error.response?.status === 401) {
        // Common status codes for invalid OTP
        error.userFriendlyMessage = error.response?.data?.message || 'Invalid verification code. Please check and try again.';
      }
      
      throw error;
    } finally {
      // Always mark the call as completed, even if there was an error
      markApiCallComplete(callKey);
    }
  },

  register: async (userData: { firstName: string; lastName: string; email: string; password: string }) => {
    try {
      log('API: Registering user:', userData.email);
      const response = await API.post('/api/auth/register', userData);
      log('API: Registration successful, response:', response.data);
      return response.data;
    } catch (error: any) {
      // Detailed logging for debugging
      errorLog('API: Registration error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // Check if this is a 400 Bad Request, which likely means email already exists
      if (error.response?.status === 400) {
        errorLog('API: Registration error - Email already registered:', userData.email);
        
        // Transform error to have a consistent format
        error.response.data = {
          ...error.response.data,
          message: 'This email is already registered. Please log in instead.',
          code: 'EMAIL_EXISTS'
        };
        
        throw error;
      }
      
      // Check for other specific error types
      if (error.response?.status === 409 || // Conflict status code for duplicate
          error.response?.data?.code === 11000 || // MongoDB duplicate key error
          (error.response?.data?.message && 
           (error.response.data.message.toLowerCase().includes('already exists') || 
            error.response.data.message.toLowerCase().includes('already registered') ||
            error.response.data.message.toLowerCase().includes('email is taken') ||
            error.response.data.message.toLowerCase().includes('duplicate')))) {
        errorLog('API: Registration error - Email already registered:', userData.email);
        
        // Transform error to have a consistent format
        if (!error.response) error.response = {};
        if (!error.response.data) error.response.data = {};
        
        error.response.data = {
          ...error.response.data,
          message: 'This email is already registered. Please log in instead.',
          code: 'EMAIL_EXISTS'
        };
      } else {
        errorLog('API: Registration error:', error.response?.data || error.message || error);
      }
      throw error;
    }
  },

  login: async (credentials: { email: string; password: string }) => {
    try {
      const response = await API.post('/api/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Request password reset
  forgotPassword: async (data: { email: string }) => {
    try {
      const response = await API.post('/api/auth/forgot-password', data);
      return {
        ...response.data,
        // Ensure success is included
        success: response.data.success
      };
    } catch (error) {
      errorLog('API: Error requesting password reset:', error);
      throw error;
    }
  },
  
  // Reset password with token
  resetPassword: async (data: { email: string; token: string; newPassword: string }) => {
    try {
      const response = await API.post('/api/auth/reset-password', data);
      return response.data;
    } catch (error) {
      errorLog('API: Error resetting password:', error);
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
      errorLog('Get user error:', error);
      throw error;
    }
  },
};

export default API; 