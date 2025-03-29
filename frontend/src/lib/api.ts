// DEPRECATED - Use the new API client in src/services/api.ts instead

// This file is kept for backward compatibility but will be removed in the future.
// Please import from '@/services/api' instead.

// Simple API client for backend communication
import { getToken } from './auth';

const API_URL = 'http://localhost:5000/api';

// Basic fetch wrapper with authentication
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  console.warn('DEPRECATED: Using old API client. Please switch to the new one in src/services/api.ts');
  
  const token = getToken();
  
  // Add auth header if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };
  
  // Make the fetch request
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  // Check if the response is JSON
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  
  // Handle API errors
  if (!response.ok) {
    const error = isJson ? data.message : 'An error occurred';
    throw new Error(error || 'API request failed');
  }
  
  return data;
}

// API methods
export const api = {
  // Auth endpoints
  auth: {
    // Login with email and password
    login: (email: string, password: string) => {
      return fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },
    
    // Register new user
    register: (firstName: string, lastName: string, email: string, password: string) => {
      return fetchWithAuth('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, password })
      });
    },
    
    // Send OTP for email verification
    sendOTP: (email: string) => {
      return fetchWithAuth('/users/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },
    
    // Verify OTP code
    verifyOTP: (email: string, otp: string) => {
      return fetchWithAuth('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      });
    },
    
    // Get current user
    getUser: () => {
      return fetchWithAuth('/users/me');
    },
    
    // OAuth URLs - commented out as not implemented yet
    // googleAuthUrl: `${API_URL}/auth/google`,
    // githubAuthUrl: `${API_URL}/auth/github`
  }
};
