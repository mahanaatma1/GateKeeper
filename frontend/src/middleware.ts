// Route protection middleware
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Pages that require authentication
const protectedRoutes = [
  '/dashboard',
];

// API routes and other routes that should always be accessible without a token
const publicRoutes = [
  '/api/auth/google/success',
  '/api/auth/google',
  '/api/auth/github',
  '/api/auth/github/callback',
  '/api/auth/linkedin',
  '/api/auth/linkedin/callback',
  '/api/auth/facebook',
  '/api/auth/facebook/callback',
  '/login',
  '/signup',
  '/verify-email',
];

// Check if route needs protection
const needsProtection = (pathname: string) => {
  return protectedRoutes.some(route => pathname.startsWith(route));
};

// Check if the route is a public route
const isPublicRoute = (pathname: string) => {
  return publicRoutes.some(route => pathname.startsWith(route));
};

// Check if URL has authentication parameters
const hasAuthParams = (url: URL) => {
  return url.searchParams.has('token') && url.searchParams.has('userData');
};

export function middleware(request: NextRequest) {
  // Get token from cookies or authorization header
  const token = request.cookies.get('token')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Handle root route - redirect to login page
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Only check protected routes
  if (needsProtection(pathname)) {
    // If URL has auth parameters, allow access (for Google Auth redirect)
    if (hasAuthParams(request.nextUrl)) {
      console.log('Middleware: Auth parameters detected in URL, allowing access');
      return NextResponse.next();
    }
    
    // If no token, redirect to login
    if (!token) {
      console.log('Middleware: No token found, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // Allow all other requests to proceed
  return NextResponse.next();
}

// Configure middleware to run ONLY on exact paths we want to handle
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/api/auth/:path*',
  ],
};
