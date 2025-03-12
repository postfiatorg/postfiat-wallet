import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { AuthState } from '../types/auth';

// Create a global registry to track active accounts
// This helps prevent API calls to old accounts
let ACTIVE_ACCOUNT: string | null = null;

interface AuthContextType extends AuthState {
  clearAuth: () => Promise<void>;
  setPassword: (password: string) => void;
  isCurrentAccount: (address: string | null) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  address: null,
  username: null,
  password: null,
  clearAuth: async () => {},
  setPassword: () => {},
  isCurrentAccount: () => false
});

export function AuthProvider({ 
  children,
  value,
  onClearAuth
}: { 
  children: ReactNode;
  value: AuthState;
  onClearAuth: () => Promise<void>;
}) {
  // Update the global tracker whenever auth state changes
  useEffect(() => {
    console.log("Auth state changed, updating active account:", value.address);
    ACTIVE_ACCOUNT = value.address;
  }, [value.address]);

  const setPassword = (password: string) => {
    value.password = password;
  };
  
  // Add a helper method to check if an address is the current active one
  const isCurrentAccount = (address: string | null) => {
    return address !== null && address === ACTIVE_ACCOUNT;
  };

  const contextValue = {
    ...value,
    clearAuth: onClearAuth,
    setPassword,
    isCurrentAccount
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Export a custom hook for components to safely use auth state
export function useAuthAccount() {
  const auth = useContext(AuthContext);
  const [componentId] = useState(() => Math.random().toString(36).substr(2, 9));
  
  // Log when components start/stop using an account
  useEffect(() => {
    console.log(`[${componentId}] Component using address: ${auth.address}`);
    
    return () => {
      console.log(`[${componentId}] Component unmounting, was using: ${auth.address}`);
    };
  }, [auth.address, componentId]);
  
  return {
    address: auth.address,
    isAuthenticated: auth.isAuthenticated,
    username: auth.username,
    isCurrentAccount: auth.isCurrentAccount // Expose the helper method
  };
}

export { AuthContext };
export type { AuthState }; 