'use client';

import React, { useState, useEffect } from 'react';
import SummaryPage from '@/components/summarypage';
import ProposalsPage from '@/components/ProposalsPage';
import VerificationPage from '@/components/VerificationPage';
import RewardsPage from '@/components/RewardsPage';
import PaymentsPage from '@/components/PaymentsPage';
import AuthPage from '@/components/AuthPage';
import Navbar from '@/components/navbar';
import { AuthState } from '@/types/auth';
import { AuthProvider } from '@/context/AuthContext';

export default function Home() {
  const [activePage, setActivePage] = useState('summary');
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    address: null,
    username: null
  });

  useEffect(() => {
    // Check if we have a stored wallet address
    const storedAddress = localStorage.getItem('wallet_address');
    const storedUsername = localStorage.getItem('username');
    if (storedAddress && storedUsername) {
      setAuth({
        isAuthenticated: true,
        address: storedAddress,
        username: storedUsername
      });
    }
  }, []);

  const handleAuth = (address: string, username: string) => {
    setAuth({
      isAuthenticated: true,
      address,
      username
    });
    localStorage.setItem('wallet_address', address);
    localStorage.setItem('username', username);
  };

  const handleSignOut = () => {
    setAuth({
      isAuthenticated: false,
      address: null,
      username: null
    });
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('username');
  };

  const handlePageChange = (page: string) => {
    setActivePage(page);
  };

  if (!auth.isAuthenticated) {
    return <AuthPage onAuth={handleAuth} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'proposals':
        return <ProposalsPage />;
      case 'verification':
        return <VerificationPage />;
      case 'rewards':
        return <RewardsPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'memos':
        return <div>Memos Page</div>;
      case 'log':
        return <div>Log Page</div>;
      case 'summary':
      default:
        return <SummaryPage />;
    }
  };

  return (
    <AuthProvider value={auth}>
      <div className="min-h-screen bg-slate-950">
        <Navbar 
          username={auth.username} 
          onSignOut={handleSignOut}
          activePage={activePage}
          onPageChange={handlePageChange}
        />
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {renderPage()}
        </main>
      </div>
    </AuthProvider>
  );
}