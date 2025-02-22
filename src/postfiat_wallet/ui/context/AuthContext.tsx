import { createContext, useContext, ReactNode } from 'react';
import { AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  clearAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  address: null,
  username: null,
  password: null,
  clearAuth: async () => {}
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
  const contextValue = {
    ...value,
    clearAuth: onClearAuth
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext }; 