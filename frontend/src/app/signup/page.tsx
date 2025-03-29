'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import OAuthButtons from '@/components/auth/OAuthButtons';
import SignupForm from '@/components/auth/SignupForm';

export default function Signup() {
  const router = useRouter();
  const { clearError } = useAuth();

  // Clear errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSignupSuccess = (email: string) => {
    console.log("Signup successful, redirecting to verify email page with email:", email);
    
    // Use router for client-side navigation
    router.push(`/verify-email?email=${encodeURIComponent(email)}&autoSend=true`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-6 bg-white p-6 rounded-xl shadow-md transition-all">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-gray-900">Join GateKeeper</h1>
          <p className="mt-1 text-sm text-gray-600">Create your account in seconds</p>
        </div>

        {/* Two-column layout for desktop, single column for mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column - Signup Form */}
          <div className="bg-white p-5 rounded-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Sign Up</h2>
            <SignupForm onSubmitSuccess={handleSignupSuccess} />
          </div>
          
          {/* Right column - OAuth Buttons and Login link */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Access</h2>
            <OAuthButtons mode="signup" />
            
            <div className="text-center mt-5 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
