export interface AuthState {
  isAuthenticated: boolean;
  address: string | null;
  username: string | null;
  password: string | null;
} 