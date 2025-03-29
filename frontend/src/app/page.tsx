'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (getToken()) {
      router.push('/dashboard');
    } else {
      // Otherwise redirect to login page (using the new URL)
      router.push('/login');
    }
  }, [router]);

  return <div></div>;
}
