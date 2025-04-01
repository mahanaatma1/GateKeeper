'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';

// Constants
const OTP_LENGTH = 6;
const MIN_SEND_INTERVAL_MS = 5000; // 5 seconds
const RESEND_COOLDOWN = 60; // 60 seconds

// Custom logger that can be toggled
const DEBUG = false;
const logger = {
  log: DEBUG ? console.log : () => {},
  warn: DEBUG ? console.warn : () => {},
  error: DEBUG ? console.error : () => {}
};

// Error message formatter
const getErrorMessage = (error: any): string => {
  if (error.isNetworkError || error.message === 'Network Error' || error.userFriendlyMessage) {
    return error.userFriendlyMessage || 'Unable to connect to the server. Please check your internet connection.';
  }
  
  if (error.isAborted || error.name === 'AbortError' || error.name === 'CanceledError' || 
      error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Request took too long. Please try again.';
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.status === 400 || error.response?.status === 401) {
    return 'Invalid verification code. Please check and try again.';
  }
  
  return error.message || 'An error occurred. Please try again.';
};

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
    <div className="flex items-center space-x-2">
      <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="text-sm font-medium text-gray-700">Loading...</span>
    </div>
  </div>
);

// OTP Input Component
const OtpInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));

  // Update input fields when external value changes
  useEffect(() => {
    const valueArray = value.split('');
    setOtpValues(Array(OTP_LENGTH).fill('').map((_, i) => valueArray[i] || ''));
  }, [value]);

  // Set ref function
  const setRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    
    // Validate input (one digit, numbers only)
    if (val.length > 1 || (val && !/^\d+$/.test(val))) {
      return;
    }

    // Update values
    const newOtpValues = [...otpValues];
    newOtpValues[index] = val;
    setOtpValues(newOtpValues);
    onChange(newOtpValues.join(''));

    // Auto-focus next input
    if (val && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && otpValues[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    
    if (!/^\d+$/.test(pasteData)) {
      return;
    }
    
    const pasteArray = pasteData.slice(0, OTP_LENGTH).split('');
    const newOtpValues = Array(OTP_LENGTH).fill('').map((_, i) => pasteArray[i] || '');
    setOtpValues(newOtpValues);
    onChange(newOtpValues.join(''));
    
    // Focus appropriate field
    const nextEmptyIndex = newOtpValues.findIndex(v => !v);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2">
      {Array(OTP_LENGTH).fill(0).map((_, index) => (
        <input
          key={index}
          type="text"
          ref={setRef(index)}
          value={otpValues[index]}
          onChange={e => handleChange(e, index)}
          onKeyDown={e => handleKeyDown(e, index)}
          onPaste={index === 0 ? handlePaste : undefined}
          maxLength={1}
          className="w-full h-10 text-center border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-lg font-medium text-gray-900"
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
};

// Verification form component
const VerificationForm = ({
  email,
  otp,
  setOtp,
  handleSubmit,
  authError,
  verifying,
  countdown,
  sendingOTP,
  handleResendOTP
}: {
  email: string;
  otp: string;
  setOtp: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  authError: string | null;
  verifying: boolean;
  countdown: number;
  sendingOTP: boolean;
  handleResendOTP: () => Promise<void>;
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-6 rounded-xl shadow-md transition-all">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-gray-900">Verify Your Email</h1>
          <p className="mt-1 text-sm text-gray-600">
            We sent a verification code to <strong>{email}</strong>
          </p>
        </div>

        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md text-sm" role="alert">
            <span className="block sm:inline">{authError}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <h3 className="text-xs font-medium text-blue-800 mb-1">Email Verification</h3>
          <p className="text-xs text-blue-600">
            Please enter the 6-digit code we sent to your email address to verify your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="otp" className="block text-xs font-medium text-gray-700 mb-2">
              Verification Code <span className="text-red-500">*</span>
            </label>
            <OtpInput value={otp} onChange={setOtp} />
            
            {otp.length < OTP_LENGTH ? (
              <p className="mt-1.5 text-xs text-gray-500">
                Please enter all {OTP_LENGTH} digits of your verification code
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-green-600">
                <span className="inline-flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                  </svg>
                  Code complete
                </span>
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={verifying || otp.length !== OTP_LENGTH}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {verifying ? (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </div>
        </form>
        
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={handleResendOTP}
            disabled={countdown > 0 && !sendingOTP}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingOTP ? (
              <div className="flex items-center justify-center space-x-1">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Resend OTP in {countdown}s</span>
              </div>
            ) : countdown > 0 ? (
              `Resend OTP in ${countdown}s`
            ) : (
              'Resend verification code'
            )}
          </button>
        </div>
      </div>
      
      <Toaster position="top-center" />
    </div>
  );
};

// Main component
export default function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, sendOTP, error: authError, clearError, resendOTP } = useAuth();
  
  // State
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Refs
  const otpAlreadySent = useRef(false);
  const lastSendAttemptRef = useRef<number>(0);
  const componentMountCountRef = useRef(0);

  // 1. Initialize component and get email parameter
  useEffect(() => {
    componentMountCountRef.current += 1;
    logger.log(`Component mounted (count: ${componentMountCountRef.current})`);
    
    const emailParam = searchParams.get('email');
    
    if (!emailParam) {
      toast.error('Email address is missing. Please go back to the signup page.');
      router.push('/signup');
      return;
    }
    
    setEmail(emailParam);
    clearError();
    
    if (componentMountCountRef.current === 1 || process.env.NODE_ENV === 'production') {
      otpAlreadySent.current = false;
      setSendingOTP(false);
      setVerifying(false);
    }
    
    setInitialLoadComplete(true);
  }, [searchParams, router, clearError]);

  // 2. Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 3. Auto-send OTP
  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;
    let backupTimer: NodeJS.Timeout | null = null;
    
    const autoSendParam = searchParams.get('autoSend');
    const shouldAutoSend = autoSendParam !== 'false';
    
    // Send initial OTP function
    const sendInitialOTP = async () => {
      // Skip if we don't meet the conditions
      if (!mounted || !initialLoadComplete || !email || otpAlreadySent.current || sendingOTP) {
        return;
      }
      
      if (!shouldAutoSend) return;
      
      // Skip on first mount in development to avoid double requests
      if (componentMountCountRef.current === 1 && process.env.NODE_ENV === 'development') {
        return;
      }
      
      // Throttle requests
      const now = Date.now();
      if (now - lastSendAttemptRef.current < MIN_SEND_INTERVAL_MS) {
        return;
      }
      
      lastSendAttemptRef.current = now;
      otpAlreadySent.current = true;
      
      if (mounted) {
        setSendingOTP(true);
        toast.loading('Sending verification code...', { id: 'otp-toast' });
      }
      
      // Set backup timer
      backupTimer = setTimeout(() => {
        if (mounted && sendingOTP) {
          setSendingOTP(false);
          toast.error('Request timed out. Please try resending manually.', { id: 'otp-toast' });
        }
      }, 10000);
      
      try {
        await sendOTP(email, { isResend: false });
        
        if (mounted) {
          // First set countdown and then clear sending state to avoid flickering
          setCountdown(RESEND_COOLDOWN);
          setSendingOTP(false);
          toast.success('Verification code sent!', { id: 'otp-toast' });
        }
      } catch (err: any) {
        if (mounted) {
          setSendingOTP(false);
          toast.error(getErrorMessage(err), { id: 'otp-toast' });
        }
      } finally {
        if (backupTimer) clearTimeout(backupTimer);
      }
    };
    
    // Set a delay before sending
    if (initialLoadComplete && email && !otpAlreadySent.current && !sendingOTP && shouldAutoSend) {
      timer = setTimeout(sendInitialOTP, 1000);
    }
    
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      if (backupTimer) clearTimeout(backupTimer);
      toast.dismiss('otp-toast');
    };
  }, [initialLoadComplete, email, searchParams, sendOTP, sendingOTP]);

  // Handle resend OTP action
  const handleResendOTP = async () => {
    if (!email) return;
    
    if (countdown > 0) {
      toast.error(`Please wait ${countdown} seconds before requesting another code`);
      return;
    }
    
    // Throttle requests
    const now = Date.now();
    if (now - lastSendAttemptRef.current < MIN_SEND_INTERVAL_MS) {
      toast.error('Please wait a moment before requesting another code');
      return;
    }
    
    lastSendAttemptRef.current = now;
    setSendingOTP(true);
    // Start countdown immediately to provide user feedback
    setCountdown(RESEND_COOLDOWN);
    
    toast.loading('Sending verification code...', { id: 'resend-toast' });
    
    let timeoutId = setTimeout(() => {
      setSendingOTP(false);
      toast.error('Request timed out. Please try again.');
      toast.dismiss('resend-toast');
      // Keep the countdown running even if request times out
    }, 10000);
    
    try {
      const result = await resendOTP(email);
      clearTimeout(timeoutId);
      
      // Always ensure sending state is cleared
      setSendingOTP(false);
      
      if (result && result.success !== false) {
        toast.success('Verification code sent successfully!', { id: 'resend-toast' });
      } else {
        // If there was an error in the response
        const errorMsg = result?.message || 'Failed to send verification code';
        toast.error(errorMsg, { id: 'resend-toast' });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setSendingOTP(false);
      toast.error(getErrorMessage(err), { id: 'resend-toast' });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Email address is missing. Please go back to the signup page.');
      return;
    }
    
    if (!otp || otp.length !== OTP_LENGTH) {
      toast.error(`Please enter a valid ${OTP_LENGTH}-digit verification code`);
      return;
    }
    
    toast.loading('Verifying your email...', { id: 'verify-toast' });

    try {
      setVerifying(true);
      clearError();
      
      const result = await verifyEmail(email, otp);
      
      if (result && (result.success || result.data?.token)) {
        toast.success('Email verified successfully!', { id: 'verify-toast' });
        setTimeout(() => router.push('/dashboard'), 500);
      } else {
        toast.error('Verification failed. Please try again.', { id: 'verify-toast' });
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err), { id: 'verify-toast' });
    } finally {
      setVerifying(false);
    }
  };

  // Show loading spinner if email is not available yet
  if (!email) {
    return <LoadingSpinner />;
  }

  // Render verification form
  return (
    <VerificationForm
      email={email}
      otp={otp}
      setOtp={setOtp}
      handleSubmit={handleSubmit}
      authError={authError}
      verifying={verifying}
      countdown={countdown}
      sendingOTP={sendingOTP}
      handleResendOTP={handleResendOTP}
    />
  );
}