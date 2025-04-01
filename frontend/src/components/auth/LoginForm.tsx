import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface LoginFormProps {
  onSubmitSuccess?: () => void;
}

export default function LoginForm({ onSubmitSuccess }: LoginFormProps) {
  const { login, loading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: ''
  });
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  // Clear context errors when component unmounts or when form data changes
  useEffect(() => {
    clearError?.();
    return () => clearError?.();
  }, [formData, clearError]);

  const validateEmail = (email: string) => {
    if (!email.trim()) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Update form data
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear general errors
    setFormError('');
    clearError?.();
    
    // Reset verification state if changing email
    if (name === 'email') {
      setNeedsVerification(false);
    }
    
    // Validate in real-time if field has been touched
    if (touched[name as keyof typeof touched]) {
      let error = '';
      if (name === 'email') {
        error = validateEmail(value);
      } else if (name === 'password') {
        error = validatePassword(value);
      }
      
      setFieldErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate on blur
    let error = '';
    if (name === 'email') {
      error = validateEmail(value);
    } else if (name === 'password') {
      error = validatePassword(value);
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setFormError('');
    clearError?.();
    setFieldErrors({
      email: '',
      password: ''
    });
    
    // Mark all fields as touched
    setTouched({
      email: true,
      password: true
    });
    
    // Validate all fields
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    
    if (emailError || passwordError) {
      setFieldErrors({
        email: emailError,
        password: passwordError
      });
      return;
    }
    
    // Log form submission for debugging
    console.log('Submitting login form with email:', formData.email.trim());
    
    // If we have a verification issue, don't try to login again
    if (needsVerification) {
      return;
    }
    
    try {
      await login(formData.email.trim(), formData.password);
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Log detailed error information
      if (err.response) {
        console.error('Error response:', {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers,
        });
      } else if (err.request) {
        console.error('Error request:', err.request);
      } else {
        console.error('Error message:', err.message);
      }
      
      // Handle verification needed
      if (err.response?.data?.code === 'NEEDS_VERIFICATION' || err.response?.data?.needsVerification) {
        setNeedsVerification(true);
        setVerificationEmail(formData.email.trim());
        setFieldErrors(prev => ({ ...prev, email: 'Please verify your email before logging in' }));
        return;
      }
      
      // Handle specific error codes
      const errorCode = err.response?.data?.code;
      const errorMessage = err.response?.data?.message || '';
      const errorStatus = err.response?.status;
      
      console.log('Processing error:', { errorCode, errorMessage, errorStatus });
      
      // Map error codes to field errors
      if (errorCode === 'INVALID_CREDENTIALS' || errorCode === 'INVALID_PASSWORD') {
        setFieldErrors(prev => ({ ...prev, password: 'Incorrect password' }));
      } else if (errorCode === 'USER_NOT_FOUND') {
        setFieldErrors(prev => ({ ...prev, email: 'This email is not registered. Please sign up first.' }));
      } else if (errorCode === 'MISSING_EMAIL') {
        setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
      } else if (errorCode === 'MISSING_PASSWORD') {
        setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
      } else if (errorCode === 'INVALID_EMAIL_FORMAT') {
        setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      } else if (errorStatus === 400) {
        // Handle generic bad request errors
        if (errorMessage.toLowerCase().includes('email')) {
          setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
        } else if (errorMessage.toLowerCase().includes('password')) {
          setFieldErrors(prev => ({ ...prev, password: 'Please enter your password' }));
        } else {
          setFormError(errorMessage || 'Please check your login details');
        }
      } else if (errorStatus === 401 || errorStatus === 403) {
        setFieldErrors(prev => ({ ...prev, password: 'Invalid login credentials' }));
      } else {
        // Generic error handling
        setFormError(errorMessage || 'Login failed. Please try again.');
      }
    }
  };

  const handleResendVerification = (e: React.MouseEvent) => {
    e.preventDefault();
    // Redirect to verification page with the email
    window.location.href = `/verify-email?email=${encodeURIComponent(verificationEmail)}&autoSend=true`;
  };

  // Display either context error or form error
  const displayError = error || formError;

  return (
    <>
      {displayError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{displayError}</span>
        </div>
      )}

      {needsVerification ? (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-medium">Email verification required</p>
          <p className="text-sm mt-1">Please verify your email before logging in.</p>
          <button 
            onClick={handleResendVerification}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium focus:outline-none"
          >
            Click here to verify your email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`appearance-none relative block w-full px-3 py-2 border ${
                  fieldErrors.email ? 'border-red-500' : touched.email ? 'border-green-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Email address"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`appearance-none relative block w-full px-3 py-2 border ${
                  fieldErrors.password ? 'border-red-500' : touched.password && formData.password ? 'border-green-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Password"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || needsVerification}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          
          <div className="text-center text-sm mt-4">
            <p>
              Don't have an account?{' '}
              <Link href="/signup" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      )}
    </>
  );
}
