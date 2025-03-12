import { useState } from 'react';
import { apiService } from '../services/apiService';

// Add this interface near the top of the file
interface AuthResponse {
  address: string;
  // Add other fields returned by the API as needed
}

// Add this interface for wallet generation response
interface WalletResponse {
  private_key: string;
  address: string;
}

export default function AuthPage({ onAuth }: { onAuth: (address: string, username: string, password: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'create' | 'import'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [address, setAddress] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if ((mode === 'create' || mode === 'import') && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Clear any previous account's requests and cache
    try {
      // Import here to avoid circular dependencies
      await import('../services/apiService').then(({ apiService }) => {
        // Use the safe accessor instead of direct window access
        const currentAccount = typeof window !== 'undefined' ? window.ACTIVE_ACCOUNT : null;
        if (currentAccount) {
          console.log("Cleaning up previous account before authentication");
          apiService.abortRequestsForAddress(currentAccount);
          apiService.clearCache(currentAccount);
        }
      });
    } catch (error) {
      console.error("Error during pre-auth cleanup:", error);
    }

    let endpoint = '';
    if (mode === 'signin') {
      endpoint = `/auth/signin`;
    } else if (mode === 'create' || mode === 'import') {
      endpoint = `/auth/create`;
    } else {
      setError('Invalid mode for submission.');
      return;
    }

    try {
      console.log(`Sending POST request to ${endpoint}`);
      const data = await apiService.post<AuthResponse>(endpoint, {
        username,
        password,
        ...(mode === 'create' || mode === 'import' ? { 
          private_key: privateKey,
          address: address 
        } : {})
      });

      console.log("Auth data:", data);
      
      // First complete authentication with the server response values
      // to set auth state properly before making other API calls
      onAuth(data.address, username, password);
      
      // THEN initialize tasks, but only after authentication is set
      await initializeUserTasks(data.address);
      
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWallet = async () => {
    console.log("handleGenerateWallet called");
    try {
      // This is a public endpoint that should work without authentication
      console.log("Sending wallet generation request");
      const wallet = await apiService.post<WalletResponse>('/wallet/generate');
      
      console.log("Wallet data:", wallet);
      setPrivateKey(wallet.private_key);
      setAddress(wallet.address);
    } catch (err) {
      console.error("Error in handleGenerateWallet:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  // Move task initialization into a separate function that's only called after successful auth
  const initializeUserTasks = async (userAddress: string) => {
    try {
      await apiService.post(`/tasks/clear-state/${userAddress}`);
      console.log("Server state cleared for new account:", userAddress);
      
      await apiService.post(`/tasks/initialize/${userAddress}`);
      console.log('Tasks initialized successfully for:', userAddress);
      
      await apiService.post(`/tasks/start-refresh/${userAddress}`);
      console.log('Task refresh loop started for:', userAddress);
    } catch (err) {
      console.error('Task initialization error:', err);
    }
  };

  // Render wallet creation form
  if (mode === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6">Create New Wallet</h1>
          
          <button
            type="button"
            onClick={handleGenerateWallet}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg mb-4"
          >
            Generate New XRP Wallet
          </button>
          
          {privateKey && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
              <p className="text-yellow-500 text-sm font-medium">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Important Warning
                </span>
              </p>
              <p className="text-yellow-400 text-sm mt-1">
                Please save your XRP Secret in a secure location. If you lose it, it <span className="font-bold">cannot be recovered</span> and you will permanently lose access to your funds.
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {address && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  XRP Address
                </label>
                <input
                  type="text"
                  value={address}
                  readOnly
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            )}

            {privateKey && (
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    XRP Secret
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-xs text-slate-400 hover:text-slate-300"
                  >
                    {showSecret ? 'Hide Secret' : 'Show Secret'}
                  </button>
                </div>
                <input
                  type={showSecret ? "text" : "password"}
                  value={privateKey}
                  readOnly
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={!privateKey || !address}
              className={`w-full ${!privateKey || !address ? 'bg-blue-600/50' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium py-2 px-4 rounded-lg`}
            >
              Create Account
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              onClick={() => {
                setMode('import');
                setPrivateKey('');
                setAddress('');
              }}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Import Existing Wallet
            </button>
            <div>
              <button
                onClick={() => {
                  setMode('signin');
                  setPrivateKey('');
                  setAddress('');
                }}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render wallet import form
  if (mode === 'import') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6">Import Existing Wallet</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                XRP Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  XRP Secret
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  {showSecret ? 'Hide Secret' : 'Show Secret'}
                </button>
              </div>
              <input
                type={showSecret ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
            >
              Import Wallet
            </button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <button
              onClick={() => {
                setMode('create');
                setPrivateKey('');
                setAddress('');
              }}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Create New Wallet Instead
            </button>
            <div>
              <button
                onClick={() => {
                  setMode('signin');
                  setPrivateKey('');
                  setAddress('');
                }}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6">
          Sign In
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <p className="text-center text-slate-400 text-sm">Don't have a wallet?</p>
          <button
            onClick={() => {
              setMode('create');
              setPrivateKey('');
              setAddress('');
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg border border-slate-700"
          >
            Create New Wallet
          </button>
          <button
            onClick={() => {
              setMode('import');
              setPrivateKey('');
              setAddress('');
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg border border-slate-700"
          >
            Import Existing Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
