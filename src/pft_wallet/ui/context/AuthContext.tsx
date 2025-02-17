import { createContext, useContext, ReactNode } from 'react';
import { AuthState } from '../types/auth';

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  address: null,
  username: null
});

export function AuthProvider({ 
  children,
  value
}: { 
  children: ReactNode;
  value: AuthState;
}) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext }; 