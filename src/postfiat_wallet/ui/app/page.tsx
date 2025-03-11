'use client';

import React, { useState, useEffect } from 'react';
import SummaryPage from '@/components/SummaryPage';
import ProposalsPage from '@/components/ProposalsPage';
import RewardsPage from '@/components/RewardsPage';
import PaymentsPage from '@/components/PaymentsPage';
import AuthPage from '@/components/AuthPage';
import Navbar from '@/components/navbar';
import { AuthState } from '@/types/auth';
import { AuthProvider } from '@/context/AuthContext';
import Onboarding from '@/components/Onboarding';
import MemosPage from '@/components/MemosPage';
import SettingsPage from '@/components/SettingsPage';
import { apiService } from '@/services/apiService';
import { ServerUnavailableModal } from '@/components/modals/ServerUnavailableModal';
import { connectionManager, CONNECTION_STATUS_CHANGED } from '@/services/connectionManager';

// Define response interfaces for better type safety
interface StatusResponse {
  init_rite_status: string;
  // Add other fields as needed
}

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
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  // Setup connection monitoring with basic check only
  useEffect(() => {
    // Start the connection manager in basic mode (no authenticated endpoints)
    connectionManager.startMonitoring(false);
    
    // Set up event listener for connection status changes
    const handleConnectionStatusChange = (event: CustomEvent) => {
      setIsServerAvailable(event.detail.isConnected);
    };

    // Add event listener
    window.addEventListener(
      CONNECTION_STATUS_CHANGED, 
      handleConnectionStatusChange as EventListener
    );
    
    // Perform initial check
    connectionManager.manualCheck();
    
    // Cleanup function
    return () => {
      connectionManager.stopMonitoring();
      window.removeEventListener(
        CONNECTION_STATUS_CHANGED, 
        handleConnectionStatusChange as EventListener
      );
    };
  }, []);
  
  // Update connection monitoring when auth changes
  useEffect(() => {
    // When auth state changes, update connection monitoring mode
    connectionManager.stopMonitoring();
    connectionManager.startMonitoring(auth.isAuthenticated);
    
    // Perform immediate check with new mode
    connectionManager.manualCheck();
  }, [auth.isAuthenticated]);

  useEffect(() => {
    // Comment out or remove this auto-login code
    /*
    const savedAddress = localStorage.getItem('wallet_address');
    const savedUsername = localStorage.getItem('username');
    const autoAuth = localStorage.getItem('auto_auth') === 'true';
    
    if (savedAddress && savedUsername && autoAuth) {
      // Don't auto-login
      // checkAccountStatus(savedAddress);
    }
    */
  }, []);

  useEffect(() => {
    const checkInitStatus = async () => {
      if (!auth.address) return;

      try {
        console.log('Checking init status for address:', auth.address);
        
        // Add timestamp to force a fresh fetch
        const data = await apiService.get<StatusResponse>(
          `/account/${auth.address}/status?refresh=true&nocache=${Date.now()}`
        );
        console.log('Initiation status response:', data);
        
        // Simply use the status as returned by the API
        setInitStatus(data.init_rite_status || 'UNSTARTED');
      } catch (error) {
        console.error('Error checking initialization status:', error);
        // Default to UNSTARTED in case of error
        setInitStatus('UNSTARTED');
      } finally {
        setIsLoading(false);
      }
    };

    if (auth.isAuthenticated && isServerAvailable) {
      checkInitStatus();
      
      // Set up periodic checking without the balance checks
      const intervalId = setInterval(() => {
        checkInitStatus();
      }, 10000);
      
      return () => clearInterval(intervalId);
    } else {
      setIsLoading(false);
    }
  }, [auth.isAuthenticated, auth.address, isServerAvailable]);

  const handleAuth = (address: string, username: string, password: string) => {
    // Update auth state
    setAuth({
      isAuthenticated: true,
      address,
      username,
      password
    });
    
    // Set API service as authenticated
    apiService.setAuthenticated(true);
    
    // Don't store in localStorage anymore
    // localStorage.setItem('wallet_address', address);
    // localStorage.setItem('username', username);
    // localStorage.setItem('auto_auth', 'true');
  };

  const handleSignOut = async () => {
    console.log("Signing out and resetting all state...");
    
    // Don't try to clear state if there's no connection
    if (auth.address && isServerAvailable) {
      try {
        // First stop task refresh for this account to prevent race conditions
        await apiService.post(`/tasks/stop-refresh/${auth.address}`);
        console.log("Stopped refresh loop for account:", auth.address);
        
        // Add a small delay to ensure refresh has fully stopped
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Then clear the server state for this account
        await apiService.post(`/tasks/clear-state/${auth.address}`);
        console.log("Server state cleared for account:", auth.address);
        
        // Force a server-side cache reset for all endpoints
        await apiService.post(`/cache/clear/${auth.address}`);
        console.log("Cache cleared for account:", auth.address);
      } catch (error) {
        console.error("Error during sign out cleanup:", error);
      }
    }
    
    // Reset auth state
    setAuth({
      isAuthenticated: false,
      address: null,
      username: null,
      password: null
    });
    
    // Reset initStatus state
    setInitStatus(null);
    
    // Reset active page
    setActivePage('summary');
    
    // Clear localStorage
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('username');
    
    // Set API service as not authenticated
    apiService.setAuthenticated(false);
    
    // Force a page reload to completely reset React application state
    // This is the most reliable way to ensure all component state is reset
    window.location.reload();
  };

  const handlePageChange = (page: string) => {
    setActivePage(page);
  };

  // Handle retry connection
  const handleRetryConnection = () => {
    connectionManager.manualCheck();
  };

  // Show the server unavailable modal if server is unavailable
  // This takes precedence over everything else
  if (!isServerAvailable) {
    return (
      <div className="min-h-screen bg-slate-950">
        <ServerUnavailableModal isOpen={true} onRetry={handleRetryConnection} />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <AuthPage onAuth={handleAuth} />;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Show onboarding UI if not initiated or status is pending
  if (initStatus) {
    // Only show onboarding for these specific statuses
    const needsOnboarding = ['UNSTARTED', 'PENDING_INITIATION', 'PENDING'].includes(initStatus);
    
    // Don't show onboarding for COMPLETE status
    if (needsOnboarding) {
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
  }

  const renderPage = () => {
    switch (activePage) {
      case 'proposals':
        return <ProposalsPage />;
      case 'rewards':
        return <RewardsPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'memos':
        return <MemosPage address={auth.address!} />;
      case 'settings':
        return <SettingsPage />;
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