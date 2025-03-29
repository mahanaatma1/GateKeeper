'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import OAuthButtons from '@/components/auth/OAuthButtons';
import LoginForm from '@/components/auth/LoginForm';

export default function Login() {
  const router = useRouter();
  const { clearError, isAuthenticated } = useAuth();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (hasAttemptedSubmit && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router, hasAttemptedSubmit]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleLoginSuccess = () => {
    setHasAttemptedSubmit(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-6 bg-white p-6 rounded-xl shadow-md transition-all">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-gray-900">Welcome to GateKeeper</h1>
          <p className="mt-1 text-sm text-gray-600">Secure authentication system</p>
        </div>

        {/* Two-column layout for desktop, single column for mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column - Login Form */}
          <div className="bg-white p-5 rounded-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Login</h2>
            <LoginForm onSubmitSuccess={handleLoginSuccess} />
            
            <div className="text-center mt-4">
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                Forgot your password?
              </Link>
            </div>
          </div>
          
          {/* Right column - OAuth Buttons and Sign Up link */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h2>
            <OAuthButtons mode="login" />
            
            <div className="text-center mt-5 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
