import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { AuthState } from '../types/auth';

// Type declaration for window
declare global {
  interface Window {
    ACTIVE_ACCOUNT: string | null;
  }
}

// Create context without accessing window
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  address: null,
  username: null,
  password: null,
  clearAuth: async () => {},
  setPassword: () => {},
  isCurrentAccount: () => false
});

// Safe function to get the active account
function getActiveAccount(): string | null {
  if (typeof window !== 'undefined') {
    return window.ACTIVE_ACCOUNT;
  }
  return null;
}

// Safe function to set the active account
function setActiveAccount(address: string | null): void {
  if (typeof window !== 'undefined') {
    window.ACTIVE_ACCOUNT = address;
  }
}

interface AuthContextType extends AuthState {
  clearAuth: () => Promise<void>;
  setPassword: (password: string) => void;
  isCurrentAccount: (address: string | null) => boolean;
}

export function AuthProvider({ 
  children,
  value,
  onClearAuth
}: { 
  children: ReactNode;
  value: AuthState;
  onClearAuth: () => Promise<void>;
}) {
  // Initialize the window variable IMMEDIATELY, not in an effect
  if (typeof window !== 'undefined') {
    // Only set if not already set - this ensures we don't lose the current value
    if (window.ACTIVE_ACCOUNT === undefined) {
      console.log("Initializing ACTIVE_ACCOUNT to null");
      window.ACTIVE_ACCOUNT = null;
    }
  }

  // Update the global tracker whenever auth state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log("Auth state changed, updating active account:", value.address);
    
    // Clear previous account's cache when switching accounts
    const previousAccount = getActiveAccount();
    if (previousAccount && previousAccount !== value.address) {
      import('../services/apiService').then(({ apiService }) => {
        console.log(`Cleaning up resources for previous account: ${previousAccount}`);
        apiService.clearCache(previousAccount);
        apiService.abortRequestsForAddress(previousAccount);
      });
    }
    
    // Update global account tracker
    setActiveAccount(value.address);
  }, [value.address]);

  const setPassword = (password: string) => {
    value.password = password;
  };
  
  // Add a helper method to check if an address is the current active one
  const isCurrentAccount = (address: string | null) => {
    if (typeof window === 'undefined') return false;
    return address !== null && address === getActiveAccount();
  };

  // Modify clearAuth to also clear cache
  const clearAuthWithCache = async () => {
    // Clear cache before auth
    import('../services/apiService').then(({ apiService }) => {
      apiService.clearAllCache();
    });
    
    // Call original clearAuth
    await onClearAuth();
  };

  const contextValue = {
    ...value,
    clearAuth: clearAuthWithCache,
    setPassword,
    isCurrentAccount
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Update useAuthAccount hook to be more defensive
export function useAuthAccount() {
  const auth = useContext(AuthContext);
  const [componentId] = useState(() => Math.random().toString(36).substr(2, 9));
  
  // Ensure this component is using the current active account
  const isActive = typeof window !== 'undefined' && auth.address === getActiveAccount();
  
  // Log when components start/stop using an account
  useEffect(() => {
    console.log(`[${componentId}] Component using address: ${auth.address}, active: ${isActive}`);
    
    return () => {
      console.log(`[${componentId}] Component unmounting, was using: ${auth.address}`);
    };
  }, [auth.address, componentId, isActive]);
  
  return {
    address: isActive ? auth.address : null,
    isAuthenticated: isActive && auth.isAuthenticated,
    username: isActive ? auth.username : null,
    isCurrentAccount: auth.isCurrentAccount
  };
}

export { AuthContext };
export type { AuthState }; 