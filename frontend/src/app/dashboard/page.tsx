'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import EmailDisplay from '@/components/EmailDisplay';

export default function Dashboard() {
  const router = useRouter();
  const { user, setUser, logout, loading, getDisplayName } = useAuth();
  const searchParams = useSearchParams();
  const [initializing, setInitializing] = useState(false);
  // Choose your preferred email display style
  const emailDisplayStyle: 'full' | 'username' | 'masked' = 'full';

  // Handle auth data from URL (Google OAuth)
  useEffect(() => {
    const token = searchParams.get('token');
    const userDataParam = searchParams.get('userData');
    
    if (token && userDataParam) {
      setInitializing(true);
      
      try {
        // Parse and store user data
        const userData = JSON.parse(userDataParam);
        localStorage.setItem('token', token);
        localStorage.setItem('user', userDataParam);
        document.cookie = `token=${token}; path=/; max-age=2592000`;
        
        // Update auth context
        if (setUser) {
          setUser(userData);
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/dashboard');
      } catch (error) {
        console.error('Error processing auth data:', error);
      } finally {
        setInitializing(false);
      }
    }
  }, [searchParams, setUser]);

  // Check authentication
  useEffect(() => {
    if (!loading && !initializing && !user && !localStorage.getItem('token')) {
      router.push('/login');
    }
  }, [loading, initializing, user, router]);

  // Loading state
  if (loading || initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Fallback to localStorage if context hasn't updated yet
  const displayUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : null);
  
  if (!displayUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Authentication issue. Please try logging in again.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Determine if user logged in with an OAuth provider
  const loggedInViaOAuth = displayUser.provider && displayUser.providerUsername;
  
  // Get the display name based on login method - will respect useProviderUsername flag
  const displayName = getDisplayName ? getDisplayName(displayUser) : `${displayUser.firstName} ${displayUser.lastName}`;

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">GateKeeper</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={logout}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Welcome to your Dashboard</h2>
            <div className="text-gray-600">
              <p className="text-center mb-4">
                You are now securely authenticated with GateKeeper.
                {loggedInViaOAuth && (
                  <span className="block mt-2">
                    You signed in using your {displayUser.provider} account.
                  </span>
                )}
              </p>
              
              <div className="mt-6 border-t pt-4">
                <h3 className="text-lg font-medium mb-2">Your Account Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">
                      {displayUser.email ? (
                        <EmailDisplay 
                          email={displayUser.email} 
                          style="full"
                        />
                      ) : 'Not available'}
                    </p>
                  </div>
                  {(displayUser.firstName || displayUser.lastName) && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">
                        {`${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim() || 'Not available'}
                      </p>
                    </div>
                  )}
                  {loggedInViaOAuth && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Connected Account</p>
                      <p className="font-medium">
                        {displayUser.provider} 
                        {displayUser.providerUsername && ` (${displayUser.providerUsername})`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
