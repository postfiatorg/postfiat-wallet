import { createContext, useContext, ReactNode } from 'react';
import { AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  clearAuth: () => Promise<void>;
  setPassword: (password: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  address: null,
  username: null,
  password: null,
  clearAuth: async () => {},
  setPassword: () => {}
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
  const setPassword = (password: string) => {
    value.password = password;
  };

  const contextValue = {
    ...value,
    clearAuth: onClearAuth,
    setPassword
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext }; 