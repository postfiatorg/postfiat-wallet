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
    // Clear all auth data from localStorage on app startup
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('username');
    localStorage.removeItem('auto_auth');
    
    console.log('Auth data cleared from localStorage');
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
