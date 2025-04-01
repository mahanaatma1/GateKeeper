import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { validateEmail, validatePassword, validateName, isDisposableEmail } from '@/utils/validation';

interface SignupFormProps {
  onSubmitSuccess?: (email: string) => void;
}

export default function SignupForm({ onSubmitSuccess }: SignupFormProps) {
  const { register, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
  }>({});
  const [isDisposableEmailDetected, setIsDisposableEmailDetected] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Calculate password strength
  const calculatePasswordStrength = (password: string): number => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    
    // Character variety checks
    if (/[A-Z]/.test(password)) strength += 1; // Has uppercase
    if (/[a-z]/.test(password)) strength += 1; // Has lowercase
    if (/[0-9]/.test(password)) strength += 1; // Has number
    if (/[^A-Za-z0-9]/.test(password)) strength += 1; // Has special char
    
    // Normalize to scale of 0-4
    return Math.min(4, Math.floor(strength / 1.5));
  };

  // Validate email on every change to detect temporary emails immediately
  useEffect(() => {
    if (formData.email) {
      // First check if it's a disposable email
      const isTemp = isDisposableEmail(formData.email);
      setIsDisposableEmailDetected(isTemp);
      
      // Then do the full validation
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.valid || isTemp) {
        setValidationErrors(prev => ({ 
          ...prev, 
          email: isTemp ? 'Temporary or disposable email addresses are not allowed' : emailValidation.error 
        }));
      } else {
        setValidationErrors(prev => ({ ...prev, email: undefined }));
      }
    } else {
      setIsDisposableEmailDetected(false);
      setValidationErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [formData.email]);

  // Update password strength when password changes
  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
    
    // Validate password
    if (formData.password) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.valid) {
        setValidationErrors(prev => ({ ...prev, password: passwordValidation.error }));
      } else {
        setValidationErrors(prev => ({ ...prev, password: undefined }));
      }
    }
  }, [formData.password]);

  // Validate entire form whenever any field changes
  useEffect(() => {
    const firstNameValid = validateName(formData.firstName, 'First name').valid;
    const lastNameValid = validateName(formData.lastName, 'Last name').valid;
    const emailValid = validateEmail(formData.email).valid;
    const passwordValid = validatePassword(formData.password).valid;
    
    setIsFormValid(firstNameValid && lastNameValid && emailValid && passwordValid && !isDisposableEmailDetected);
  }, [formData, isDisposableEmailDetected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when field is edited (except email which is validated in real-time)
    if (name !== 'email' && name !== 'password' && validationErrors[name as keyof typeof validationErrors]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
    
    // Show password requirements when user starts typing in password field
    if (name === 'password' && value && !showPasswordRequirements) {
      setShowPasswordRequirements(true);
    }
  };

  const validateForm = (): boolean => {
    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    } = {};
    
    // Validate first name
    const firstNameValidation = validateName(formData.firstName, 'First name');
    if (!firstNameValidation.valid) {
      errors.firstName = firstNameValidation.error;
    }
    
    // Validate last name
    const lastNameValidation = validateName(formData.lastName, 'Last name');
    if (!lastNameValidation.valid) {
      errors.lastName = lastNameValidation.error;
    }
    
    // Validate email
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.error;
    }
    
    // Validate password
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.error;
    }
    
    setValidationErrors(errors);
    
    // Form is valid if there are no errors
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      // Register user in the database
      const response = await register(
        formData.firstName,
        formData.lastName,
        formData.email,
        formData.password
      );
      
      // Store token if available
      if (response && response.token) {
        localStorage.setItem('token', response.token);
      }
      
      // Call success callback with the email to redirect to verification page
      if (onSubmitSuccess) {
        onSubmitSuccess(formData.email);
      }
    } catch (err: any) {
      // Check for email already exists error - handle 400 status code
      if (err.response?.status === 400 || 
          err.response?.data?.code === 'EMAIL_EXISTS' || 
          err.response?.data?.code === 11000 || 
          (err.response?.data?.message && 
           (err.response?.data?.message.toLowerCase().includes('already registered') || 
            err.response?.data?.message.toLowerCase().includes('already exists') ||
            err.response?.data?.message.toLowerCase().includes('email is taken')))) {
        
        setValidationErrors(prev => ({
          ...prev,
          email: 'This email is already registered'
        }));
        
        // Show the email field error with a login button
        document.getElementById('email')?.focus();
        document.getElementById('email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Password strength indicator colors and text
  const strengthColors = ['bg-gray-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
  const strengthTexts = ['Empty', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded relative mb-3 text-sm" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <h3 className="text-xs font-medium text-blue-800 mb-1">Account Creation Information</h3>
        <p className="text-xs text-blue-600">
          After creating your account, you'll need to verify your email address.
        </p>
      </div>

      {/* Special error for already registered emails */}
      {validationErrors.email && validationErrors.email.toLowerCase().includes('already registered') && (
        <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
          <h3 className="text-xs font-medium text-yellow-800 mb-1">Email Already Registered</h3>
          <p className="text-xs text-yellow-600 mb-2">
            This email address is already registered with us.
          </p>
          <a 
            href="/login" 
            className="inline-flex items-center text-xs justify-center px-3 py-1.5 border border-transparent 
                    rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Login Page
          </a>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={formData.firstName}
                onChange={handleChange}
                className={`appearance-none relative block w-full px-3 py-1.5 border ${
                  validationErrors.firstName ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm`}
                placeholder="John"
              />
              {validationErrors.firstName && (
                <p className="mt-1 text-xs text-red-500">
                  {validationErrors.firstName}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={formData.lastName}
                onChange={handleChange}
                className={`appearance-none relative block w-full px-3 py-1.5 border ${
                  validationErrors.lastName ? 'border-red-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm`}
                placeholder="Doe"
              />
              {validationErrors.lastName && (
                <p className="mt-1 text-xs text-red-500">
                  {validationErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              onBlur={() => {
                if (formData.email) {
                  const isTemp = isDisposableEmail(formData.email);
                  setIsDisposableEmailDetected(isTemp);
                  if (isTemp) {
                    setValidationErrors(prev => ({
                      ...prev,
                      email: 'Temporary or disposable email addresses are not allowed'
                    }));
                  }
                }
              }}
              className={`appearance-none relative block w-full px-3 py-1.5 border ${
                validationErrors.email?.toLowerCase().includes('already registered') 
                  ? 'border-yellow-400 bg-yellow-50'
                  : validationErrors.email || isDisposableEmailDetected 
                    ? 'border-red-300' 
                    : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm`}
              placeholder="your@email.com"
            />
            {validationErrors.email && (
              <p className="mt-1 text-xs text-red-500">
                {validationErrors.email.toLowerCase().includes('already registered') ? (
                  <>
                    This email is already registered with us.
                  </>
                ) : (
                  validationErrors.email
                )}
              </p>
            )}
            {isDisposableEmailDetected && (
              <p className="mt-1 text-xs text-red-500 font-semibold">
                Temporary or disposable email addresses are not allowed.
              </p>
            )}
            {!isDisposableEmailDetected && !validationErrors.email && (
              <div className="flex items-center mt-1">
                <svg className="h-3 w-3 text-blue-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                </svg>
                <p className="text-xs text-gray-600">
                  You'll need to verify this email address.
                </p>
              </div>
            )}
          </div>

          <div className="mb-1">
            <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setShowPasswordRequirements(true)}
              className={`appearance-none relative block w-full px-3 py-1.5 border ${
                validationErrors.password ? 'border-red-300' : 'border-gray-300'
              } placeholder-gray-500 text-gray-900 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm`}
              placeholder="Create a strong password"
            />
            
            {/* Password strength meter */}
            {formData.password && (
              <div className="mt-1">
                <div className="flex items-center mb-0.5 text-xs">
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mr-2">
                    <div 
                      className={`h-full ${strengthColors[passwordStrength]} transition-all duration-300`} 
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-700 whitespace-nowrap">{strengthTexts[passwordStrength]}</span>
                </div>
              </div>
            )}
            
            {validationErrors.password && (
              <p className="mt-1 text-xs text-red-500">
                {validationErrors.password}
              </p>
            )}
            
            {/* Password requirements list */}
            {showPasswordRequirements && (
              <div className="mt-1 text-xs text-gray-500 bg-gray-50 py-1 px-1.5 rounded border border-gray-200">
                <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
                  <div className={`flex items-center ${/^.{8,}$/.test(formData.password) ? 'text-green-600' : ''}`}>
                    <svg className={`h-2.5 w-2.5 mr-0.5 ${/^.{8,}$/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      {/^.{8,}$/.test(formData.password) ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-xs">8+ characters</span>
                  </div>
                  <div className={`flex items-center ${/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}`}>
                    <svg className={`h-2.5 w-2.5 mr-0.5 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      {/[A-Z]/.test(formData.password) ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-xs">Uppercase</span>
                  </div>
                  <div className={`flex items-center ${/[a-z]/.test(formData.password) ? 'text-green-600' : ''}`}>
                    <svg className={`h-2.5 w-2.5 mr-0.5 ${/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      {/[a-z]/.test(formData.password) ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-xs">Lowercase</span>
                  </div>
                  <div className={`flex items-center ${/[0-9]/.test(formData.password) ? 'text-green-600' : ''}`}>
                    <svg className={`h-2.5 w-2.5 mr-0.5 ${/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      {/[0-9]/.test(formData.password) ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-xs">Number</span>
                  </div>
                  <div className={`flex items-center ${/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : ''}`}>
                    <svg className={`h-2.5 w-2.5 mr-0.5 ${/[^A-Za-z0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      {/[^A-Za-z0-9]/.test(formData.password) ? (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                      )}
                    </svg>
                    <span className="text-xs">Special char</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading || !isFormValid || isDisposableEmailDetected}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                Creating account...
              </>
            ) : isDisposableEmailDetected ? (
              'Temporary email not allowed'
            ) : (
              'Create account'
            )}
          </button>
        </div>
      </form>

    </>
  );
}
