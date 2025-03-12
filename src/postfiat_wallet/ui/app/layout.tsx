'use client';

import React, { useEffect, useState } from 'react';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '../context/AuthContext';
import { AuthState } from '../types/auth';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create initial auth state
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    address: null,
    username: null,
    password: null
  });

  // Clear auth function
  const handleClearAuth = async () => {
    setAuthState({
      isAuthenticated: false,
      address: null,
      username: null,
      password: null
    });
  };

  useEffect(() => {
    // Clear ALL auth data on startup
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('username');
      localStorage.removeItem('auto_auth');
      localStorage.removeItem('auth_token');
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Reset global variables
      window.ACTIVE_ACCOUNT = null;
      
      // Ensure API service is set to unauthenticated
      import('../services/apiService').then(({ apiService }) => {
        apiService.setAuthenticated(false);
        apiService.clearAllCache();
      });
      
      // Reset server state (stop all background tasks)
      fetch('/api/debug/reset', {
        method: 'POST',
      })
      .then(response => response.json())
      .then(data => {
        console.log('Server state reset complete:', data);
      })
      .catch(error => {
        console.error('Failed to reset server state:', error);
      });
      
      console.log('Auth completely reset on application startup');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('---- DEBUGGING PERSISTENT DATA ----');
      
      // Log all localStorage keys
      console.log('LocalStorage keys:', Object.keys(localStorage));
      
      // Log all sessionStorage keys
      console.log('SessionStorage keys:', Object.keys(sessionStorage));
      
      // Check for indexedDB databases
      indexedDB.databases().then(dbs => {
        console.log('IndexedDB databases:', dbs);
      });
      
      // Log cookies
      console.log('Cookies:', document.cookie);
    }
  }, []);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider value={authState} onClearAuth={handleClearAuth}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
