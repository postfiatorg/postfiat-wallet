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
import Onboarding from '@/components/Onboarding';
import MemosPage from '@/components/MemosPage';
export default function Home() {
  const [activePage, setActivePage] = useState('summary');
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    address: null,
    username: null,
    password: null
  });
  const [initStatus, setInitStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have a stored wallet address
    const storedAddress = localStorage.getItem('wallet_address');
    const storedUsername = localStorage.getItem('username');
    if (storedAddress && storedUsername) {
      setAuth({
        isAuthenticated: true,
        address: storedAddress,
        username: storedUsername,
        password: null
      });
    }
  }, []);

  useEffect(() => {
    const checkInitStatus = async () => {
      if (!auth.address) return;
      
      try {
        console.log('Checking init status for address:', auth.address);
        const response = await fetch(`http://localhost:8000/api/account/${auth.address}/status`);
        console.log('Raw response:', response);
        const data = await response.json();
        console.log('Initiation status response:', data);
        setInitStatus(data.init_rite_status || 'UNSTARTED');
      } catch (error) {
        console.error('Error checking initialization status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (auth.isAuthenticated) {
      checkInitStatus();
      // Set up periodic checking
      const intervalId = setInterval(checkInitStatus, 10000);
      return () => clearInterval(intervalId);
    }
  }, [auth.isAuthenticated, auth.address]);

  const handleAuth = (address: string, username: string, password: string) => {
    setAuth({
      isAuthenticated: true,
      address,
      username,
      password
    });
    localStorage.setItem('wallet_address', address);
    localStorage.setItem('username', username);
    // Note: We intentionally don't store password in localStorage for security
  };

  const handleSignOut = async () => {
    setAuth({
      isAuthenticated: false,
      address: null,
      username: null,
      password: null
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show onboarding UI if not initiated or status is pending
  if (initStatus && ['UNSTARTED', 'PENDING_INITIATION', 'PENDING'].includes(initStatus)) {
    return (
      <AuthProvider value={auth} onClearAuth={handleSignOut}>
        <Onboarding 
          initStatus={initStatus} 
          address={auth.address!} 
          onCheckStatus={(data) => {
            setInitStatus(data.init_rite_status);
          }}
        />
      </AuthProvider>
    );
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
        return <MemosPage address={auth.address!} />;
      case 'summary':
      default:
        return <SummaryPage />;
    }
  };

  return (
    <AuthProvider value={auth} onClearAuth={handleSignOut}>
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