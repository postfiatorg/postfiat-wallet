import { useState } from 'react';

export default function AuthPage({ onAuth }: { onAuth: (address: string, username: string, password: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'generate'>('signin');
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

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    let endpoint = '';
    if (mode === 'signin') {
      endpoint = `/api/auth/signin`;
    } else if (mode === 'generate') {
      endpoint = `/api/auth/create`;
    } else {
      setError('Invalid mode for submission.');
      return;
    }

    try {
      console.log(`Sending POST request to http://localhost:8000${endpoint}`);
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          ...(mode === 'generate' && { 
            private_key: privateKey,
            address: address 
          })
        }),
      });

      console.log("Response for auth:", response);
      if (!response.ok) {
        const errorResponse = await response.json();
        console.error("Auth error response:", errorResponse);
        throw new Error(errorResponse.detail || 'Authentication failed');
      }

      const data = await response.json();
      console.log("Auth data:", data);
      
      // Initialize tasks after successful authentication
      try {
        const initResponse = await fetch(`http://localhost:8000/api/tasks/initialize/${data.address}`, {
          method: 'POST'
        });
        console.log('Response status:', initResponse.status);
        console.log('Response headers:', Object.fromEntries(initResponse.headers));
        
        if (!initResponse.ok) {
          const errorText = await initResponse.text();
          console.error('Error response:', errorText);
          throw new Error(`Failed to initialize tasks: ${errorText}`);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        throw err;
      }
      
      if (mode === 'generate') {
        // Clear form and switch to signin mode after successful account creation
        setUsername('');
        setPassword('');
        setPrivateKey('');
        setAddress('');
        setMode('signin');
        setError('Account created successfully! Please sign in.');
      } else {
        // Normal signin flow - pass both address and username
        onAuth(data.address, username, password);
      }
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
      console.log("Sending POST request to http://localhost:8000/api/wallet/generate");
      const response = await fetch('http://localhost:8000/api/wallet/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log("Response for wallet generation:", response);
      if (!response.ok) {
        const errorResponse = await response.json();
        console.error("Wallet generation error response:", errorResponse);
        throw new Error(errorResponse.detail || 'Failed to generate wallet');
      }
      
      const wallet = await response.json();
      console.log("Wallet data:", wallet);
      setPrivateKey(wallet.private_key);
      setAddress(wallet.address);
    } catch (err) {
      console.error("Error in handleGenerateWallet:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  if (mode === 'generate') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6">Create New Wallet</h1>
          
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

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGenerateWallet}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
              >
                Generate New XRP Wallet
              </button>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
              >
                Create Account
              </button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setMode('signin')}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 p-8 rounded-lg border border-slate-800 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6">
          {mode === 'signin' ? 'Sign In' : 'Create New Wallet'}
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
            {mode === 'signin' ? 'Sign In' : 'Create Wallet'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode === 'signin' && (
            <div>
              <button
                onClick={() => setMode('generate')}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Create a new Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
