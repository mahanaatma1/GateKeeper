'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import EmailDisplay from '@/components/EmailDisplay';
import ImageUploader from '@/components/dashboard/ImageUploader';
import { toast, Toaster } from 'react-hot-toast';

// Component to show when user is not authenticated
const AuthError = ({ onRedirect }: { onRedirect: () => void }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <p className="mb-4">Authentication issue. Please try logging in again.</p>
      <button
        onClick={onRedirect}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
      >
        Go to Login
      </button>
    </div>
  </div>
);

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// User profile information component
const UserInfo = ({ user, isOAuth }: { user: any, isOAuth: boolean }) => (
  <div className="md:w-2/3 md:pl-8">
    <h2 className="text-2xl font-bold mb-4">Welcome to your Dashboard</h2>
    <p className="text-gray-600 mb-4">
      You are now securely authenticated with GateKeeper.
      {isOAuth && (
        <span className="block mt-2">
          You signed in using your {user.provider} account.
        </span>
      )}
    </p>
    <div className="mt-4">
      <div className="bg-gray-50 p-3 rounded mb-3">
        <p className="text-sm text-gray-500">Email</p>
        <p className="font-medium">
          {user.email ? (
            <EmailDisplay 
              email={user.email} 
              style="full"
            />
          ) : 'Not available'}
        </p>
      </div>
      
      {(user.firstName || user.lastName) && (
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm text-gray-500">Name</p>
          <p className="font-medium">
            {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Not available'}
          </p>
        </div>
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const router = useRouter();
  const { user, setUser, logout, loading, getDisplayName } = useAuth();
  const searchParams = useSearchParams();
  const [initializing, setInitializing] = useState(false);

  // Process OAuth callback data
  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const userDataParam = searchParams.get('userData');
    
    if (token && userDataParam) {
      setInitializing(true);
      
      try {
        // Parse and store user data
        const userData = JSON.parse(userDataParam);
        
        // Store authentication data
        localStorage.setItem('token', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        localStorage.setItem('user', userDataParam);
        
        // Set cookies for additional auth persistence
        document.cookie = `token=${token}; path=/; max-age=2592000`;
        if (refreshToken) {
          document.cookie = `refreshToken=${refreshToken}; path=/; max-age=2592000`;
        }
        
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
  
  // Check authentication status
  useEffect(() => {
    if (!loading && !initializing && !user && !localStorage.getItem('token')) {
      router.push('/login');
    }
  }, [loading, initializing, user, router]);

  // Handle loading state
  if (loading || initializing) {
    return <LoadingSpinner />;
  }

  // Get user data (from context or localStorage fallback)
  const displayUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}') : null);
  
  // Show auth error if no user data available
  if (!displayUser) {
    return <AuthError onRedirect={() => router.push('/login')} />;
  }

  // Determine if user logged in with OAuth
  const loggedInViaOAuth = displayUser.provider && displayUser.providerUsername;

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Navigation bar */}
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
      
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/3 flex justify-center mb-6 md:mb-0">
                <ImageUploader 
                  onSuccess={() => toast.success('Profile image updated!')}
                  onError={(error) => toast.error(error)}
                />
              </div>
              <UserInfo 
                user={displayUser} 
                isOAuth={loggedInViaOAuth} 
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
