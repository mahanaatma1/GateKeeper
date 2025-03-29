'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

// Disable console logs in production and optionally in development
const DEBUG = false; // Set to true to enable logs
const log = DEBUG ? console.log : () => {};
const warn = DEBUG ? console.warn : () => {};
const error = DEBUG ? console.error : () => {};

// OTP Input Component
const OtpInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  // Update the OTP input fields when value changes externally
  useEffect(() => {
    const valueArray = value.split('');
    setOtpValues(Array(6).fill('').map((_, i) => valueArray[i] || ''));
  }, [value]);

  const setRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    
    // Allow only one digit per input
    if (val.length > 1) {
      return;
    }
    
    // Only allow numbers
    if (val && !/^\d+$/.test(val)) {
      return;
    }

    // Update the OTP values
    const newOtpValues = [...otpValues];
    newOtpValues[index] = val;
    setOtpValues(newOtpValues);
    
    // Call the parent onChange with the new complete value
    onChange(newOtpValues.join(''));

    // Auto-focus next input if value is entered
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle backspace to clear current field and move focus to previous
    if (e.key === 'Backspace') {
      if (otpValues[index] === '' && index > 0) {
        // If current field is empty, move to previous field
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    
    // Check if pasted content is numeric and of right length
    if (!/^\d+$/.test(pasteData)) {
      return;
    }
    
    // Use up to 6 digits from paste data
    const pasteArray = pasteData.slice(0, 6).split('');
    const newOtpValues = Array(6).fill('').map((_, i) => pasteArray[i] || '');
    setOtpValues(newOtpValues);
    
    // Call parent onChange with new complete value
    onChange(newOtpValues.join(''));
    
    // Focus the next empty input or the last one
    const nextEmptyIndex = newOtpValues.findIndex(v => !v);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2">
      {Array(6).fill(0).map((_, index) => (
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

export default function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, sendOTP, error: authError, loading: authLoading, clearError, resendOTP } = useAuth();
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // Separate loading states for different operations
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Add a ref to track if OTP has already been sent to prevent duplicate calls
  const otpAlreadySent = useRef(false);
  
  // Keep track of the last time we attempted to send an OTP
  const lastSendAttemptRef = useRef<number>(0);
  const MIN_SEND_INTERVAL_MS = 5000; // 5 seconds
  
  // Add a ref to track mounted status across renders
  const componentMountCountRef = useRef(0);
  
  // Utility function to extract user-friendly error messages
  const getUserFriendlyErrorMessage = (error: any): string => {
    // Check for network errors first
    if (error.isNetworkError || error.message === 'Network Error' || error.userFriendlyMessage) {
      return error.userFriendlyMessage || 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Check for timeout errors
    if (error.isAborted || error.name === 'AbortError' || error.name === 'CanceledError' || 
        error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'Request took too long. Please try again.';
    }
    
    // Check for server response errors
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    // For OTP validation errors specifically
    if (error.response?.status === 400 || error.response?.status === 401) {
      return 'Invalid verification code. Please check and try again.';
    }
    
    // Generic error as a fallback
    return error.message || 'An error occurred. Please try again.';
  };

  // Initial setup - get email parameter only - and handle strict mode
  useEffect(() => {
    // Increment mount count to detect development mode remounts
    componentMountCountRef.current += 1;
    log(`[VerifyEmail] Component mounted (count: ${componentMountCountRef.current})`);
    
    const emailParam = searchParams.get('email');
    log('[VerifyEmail] Got email parameter:', emailParam);
    
    if (!emailParam) {
      log('[VerifyEmail] No email param, redirecting to signup');
      toast.error('Email address is missing. Please go back to the signup page.');
      router.push('/signup');
      return;
    }
    
    setEmail(emailParam);
    
    // Clear any existing errors when component mounts
    clearError();
    
    // Only reset state on first mount (or in production)
    if (componentMountCountRef.current === 1) {
      // Reset the ref and loading states
      otpAlreadySent.current = false;
      setSendingOTP(false);
      setVerifying(false);
    }
    
    setInitialLoadComplete(true);
    
    return () => {
      log('[VerifyEmail] Component cleanup - initialLoadEffect');
    };
  }, [searchParams, router, clearError]);

  // Send OTP - using a more explicit pattern to prevent duplicate calls
  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;
    let backupTimer: NodeJS.Timeout | null = null;
    let failsafeTimer: NodeJS.Timeout | null = null;
    
    const autoSendParam = searchParams.get('autoSend');
    const shouldAutoSend = autoSendParam !== 'false';
    log('[VerifyEmail] Should auto send OTP?', shouldAutoSend);
    
    const sendInitialOTP = async () => {
      // Skip if any condition prevents sending
      if (!mounted || !initialLoadComplete || !email || otpAlreadySent.current || sendingOTP) {
        log('[VerifyEmail] Not sending OTP:', {
          mounted,
          initialLoadComplete,
          emailPresent: !!email,
          otpAlreadySent: otpAlreadySent.current,
          sendingOTP
        });
        return;
      }
      
      if (!shouldAutoSend) {
        log('[VerifyEmail] Auto-send disabled by URL parameter');
        return;
      }
      
      // Development mode safeguard - only send on second mount to avoid double sending
      if (componentMountCountRef.current === 1 && process.env.NODE_ENV === 'development') {
        log('[VerifyEmail] Skipping OTP send on first mount in development mode');
        return;
      }
      
      // Check if we've attempted to send an OTP recently
      const now = Date.now();
      if (now - lastSendAttemptRef.current < MIN_SEND_INTERVAL_MS) {
        log('[VerifyEmail] Throttling OTP send - too soon after previous attempt');
        return;
      }
      
      // Update the last attempt timestamp
      lastSendAttemptRef.current = now;
      
      // Mark that we're sending to prevent duplicate calls
      otpAlreadySent.current = true;
      
      if (mounted) {
        log('[VerifyEmail] Auto-sending OTP to:', email);
        setSendingOTP(true);
        
        // Show a loading toast
        toast.loading('Sending verification code...', { id: 'initial-otp-toast' });
      }
      
      // Set backup timer to reset UI if API call hangs
      backupTimer = setTimeout(() => {
        if (mounted && sendingOTP) {
          log('[VerifyEmail] OTP sending timed out, resetting state');
          setSendingOTP(false);
          otpAlreadySent.current = true; // Keep this true to prevent auto-retry
          toast.error('Verification code request timed out. Please try resending manually.', { id: 'initial-otp-toast' });
        }
      }, 10000);
      
      // Add an absolute failsafe that will ALWAYS reset the sending state
      failsafeTimer = setTimeout(() => {
        if (mounted) {
          log('[VerifyEmail] Failsafe timer triggered to reset sending state');
          setSendingOTP(false);
          toast.dismiss('initial-otp-toast');
        }
      }, 15000);
      
      try {
        const response = await sendOTP(email, { isResend: false });
        
        if (mounted) {
          log('[VerifyEmail] Initial OTP sent successfully', response);
          setCountdown(60);
          
          // Update toast to success
          toast.success('Verification code sent! Please check your email.', {
            id: 'initial-otp-toast'
          });
          
          setSendingOTP(false);
        }
      } catch (err: any) {
        if (mounted) {
          log('[VerifyEmail] Failed to send initial OTP:', err);
          otpAlreadySent.current = true; // Keep this true to prevent auto-retry
          setSendingOTP(false);
          
          // Use our utility function for consistent error messages
          toast.error(getUserFriendlyErrorMessage(err), { id: 'initial-otp-toast' });
        }
      } finally {
        if (mounted) {
          setSendingOTP(false);
        }
        
        if (backupTimer) {
          clearTimeout(backupTimer);
          backupTimer = null;
        }
        
        if (failsafeTimer) {
          clearTimeout(failsafeTimer);
          failsafeTimer = null;
        }
      }
    };
    
    // Set a delay before sending the OTP to ensure component is fully mounted
    if (initialLoadComplete && email && !otpAlreadySent.current && !sendingOTP && shouldAutoSend) {
      log('[VerifyEmail] Setting up delay for initial OTP send');
      timer = setTimeout(() => {
        sendInitialOTP();
      }, 1000);
    }
    
    return () => {
      log('[VerifyEmail] Cleaning up OTP send effect');
      mounted = false;
      if (timer) clearTimeout(timer);
      if (backupTimer) clearTimeout(backupTimer);
      if (failsafeTimer) clearTimeout(failsafeTimer);
      
      // Dismiss any toast when unmounting
      toast.dismiss('initial-otp-toast');
      
      // Make sure we reset the sending state when component unmounts
      setSendingOTP(false);
    };
  }, [initialLoadComplete, email, searchParams, sendOTP, sendingOTP, getUserFriendlyErrorMessage, lastSendAttemptRef]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendOTP = async (e?: React.MouseEvent) => {
    // Prevent any default actions if this is called from an event
    if (e) e.preventDefault();
    
    log('[VerifyEmail] handleResendOTP called');
    
    // Only check that we have an email to send to
    if (!email) {
      log('[VerifyEmail] Not resending OTP: no email provided');
      return;
    }
    
    // Add UI feedback for countdown
    if (countdown > 0) {
      toast.error(`Please wait ${countdown} seconds before requesting another code`, {
        id: 'countdown-info'
      });
      return;
    }
    
    // Check if we've attempted to send an OTP recently
    const now = Date.now();
    if (now - lastSendAttemptRef.current < MIN_SEND_INTERVAL_MS) {
      log('[VerifyEmail] Throttling OTP resend - too soon after previous attempt');
      toast.error('Please wait a moment before requesting another code', {
        id: 'throttle-info'
      });
      return;
    }
    
    // Update the last attempt timestamp
    lastSendAttemptRef.current = now;
    
    // Set sending state immediately for UI feedback
    setSendingOTP(true);
    
    // Create a timeout to automatically cancel if taking too long
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      log('[VerifyEmail] Resend OTP request timed out, resetting UI state');
      setSendingOTP(false);
      toast.error('Verification code request timed out. Please try again.');
      toast.dismiss('sending-otp');
    }, 10000);
    
    // Add an absolute failsafe that will reset the sending state no matter what
    let failsafeId: NodeJS.Timeout | null = setTimeout(() => {
      log('[VerifyEmail] Failsafe timer triggered to reset sending state');
      setSendingOTP(false);
      toast.dismiss('sending-otp');
    }, 15000);
    
    // Show immediate feedback to user
    toast.loading('Sending verification code...', { id: 'sending-otp' });
    
    try {
      log('[VerifyEmail] Manually resending OTP to:', email);
      
      // Use resendOTP which is specifically for resending and has the isResend flag
      await resendOTP(email);
      log('[VerifyEmail] Manual OTP resent successfully');
      toast.success('Verification code sent successfully. Please check your email.', { id: 'sending-otp' });
      setCountdown(60);
    } catch (err: any) {
      log('[VerifyEmail] Failed to resend OTP:', err);
      
      // Display user-friendly error message
      toast.error(getUserFriendlyErrorMessage(err), { id: 'sending-otp' });
    } finally {
      // Clean up
      setSendingOTP(false);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (failsafeId) {
        clearTimeout(failsafeId);
        failsafeId = null;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    log('[VerifyEmail] Form submit handler called');
    
    if (!email) {
      log('[VerifyEmail] No email, cannot submit');
      toast.error('Email address is missing. Please go back to the signup page.');
      return;
    }
    
    if (!otp || otp.length !== 6) {
      log('[VerifyEmail] Invalid OTP entered, cannot submit');
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }
    
    // Show toast to indicate verification is in progress
    toast.loading('Verifying your email...', { id: 'verifying-otp' });

    try {
      log('[VerifyEmail] Verifying OTP for email:', email);
      // Verify the OTP
      setVerifying(true);
      clearError(); // Clear any previous errors
      
      const result = await verifyEmail(email, otp);
      
      log('[VerifyEmail] Verification result:', result);
      
      // If verification successful, redirect to dashboard
      if (result && (result.success === true || result.data?.token)) {
        log('[VerifyEmail] OTP verification successful, redirecting to dashboard');
        toast.success('Email verified successfully!', { id: 'verifying-otp' });
        // Short delay before redirect to allow toast to be seen
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        // Handle case where response doesn't indicate success
        log('[VerifyEmail] Verification response invalid:', result);
        toast.error('Verification failed. Please try again or request a new code.', { id: 'verifying-otp' });
      }
    } catch (err: any) {
      log('[VerifyEmail] OTP verification failed:', err);
      
      // Use our utility function for consistent error messages
      toast.error(getUserFriendlyErrorMessage(err), { id: 'verifying-otp' });
    } finally {
      // Always clean up
      setVerifying(false);
    }
  };

  if (!email) {
    return (
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
  }

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
            {otp.length < 6 && (
              <p className="mt-1.5 text-xs text-gray-500">
                Please enter all 6 digits of your verification code
              </p>
            )}
            {otp.length === 6 && (
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
              disabled={verifying || otp.length !== 6}
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
            disabled={countdown > 0 || sendingOTP}
            className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sendingOTP ? (
              <div className="flex items-center justify-center space-x-1">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sending...</span>
              </div>
            ) : countdown > 0 ? (
              `Resend code in ${countdown}s`
            ) : (
              'Resend verification code'
            )}
          </button>
        </div>
      </div>
      
      {/* Toast notifications will appear here */}
      <Toaster position="top-center" />
    </div>
  );
}