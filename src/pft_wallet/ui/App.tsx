import { useState } from 'react';
import AuthPage from './components/AuthPage';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import { AuthState } from './types/auth';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    address: null,
    username: null
  });

  const handleAuth = (address: string, username: string) => {
    setAuth({
      isAuthenticated: true,
      address,
      username
    });
  };

  const handleSignOut = () => {
    setAuth({
      isAuthenticated: false,
      address: null,
      username: null
    });
  };

  if (!auth.isAuthenticated) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar username={auth.username} onSignOut={handleSignOut} />
      <Dashboard address={auth.address} />
    </div>
  );
} 