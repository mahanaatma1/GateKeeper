//import { getToken } from './auth';

const API_URL = 'http://localhost:5000/api';

interface ApiError extends Error {
  response?: {
    status: number;
    data: {
      message: string;
      code?: string;
      needsVerification?: boolean;
    };
  };
}

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
  
  try {
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
      const error = new Error(isJson ? data.message : 'An error occurred') as ApiError;
      error.response = {
        status: response.status,
        data: isJson ? data : { message: data }
      };
      throw error;
    }
    
    return data;
  } catch (error) {
    // Ensure error has the expected structure
    const apiError = error as ApiError;
    if (!apiError.response) {
      apiError.response = {
        status: 500,
        data: { message: 'Network error or server unavailable' }
      };
    }
    throw apiError;
  }
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
  }
};

// Token management functions
export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function removeToken(): void {
  localStorage.removeItem('token');
}
