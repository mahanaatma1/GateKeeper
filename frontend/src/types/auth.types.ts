// Authentication types

// User model
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
}

// Auth response from API
export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

// Login form data
export interface LoginFormData {
  email: string;
  password: string;
}

// Registration form data
export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// OTP verification form data
export interface OTPFormData {
  email: string;
  otp: string;
}
