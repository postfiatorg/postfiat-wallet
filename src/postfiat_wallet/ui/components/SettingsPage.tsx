import React, { useState, useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { apiService } from '@/services/apiService';

// Define interface for API response
interface SeedResponse {
  seed: string;
}

const SettingsPage: React.FC = () => {
  const { address, username } = useContext(AuthContext);
  const [password, setPassword] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [isRemHandshakeLoading, setIsRemHandshakeLoading] = useState(false);
  const [isNodeHandshakeLoading, setIsNodeHandshakeLoading] = useState(false);
  const [handshakeError, setHandshakeError] = useState<string | null>(null);
  const [handshakeSuccess, setHandshakeSuccess] = useState<string | null>(null);

  const handleRevealSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiService.post<SeedResponse>('/wallet/seed', {
        account: address,
        password: password
      });

      setSeed(data.seed);
      setShowSeed(true);
      setPassword('');
    } catch (err) {
      console.error('Error retrieving seed:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve seed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySeed = () => {
    if (seed) {
      navigator.clipboard.writeText(seed);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    }
  };

  const handleHandshake = async (type: 'remembrancer' | 'node') => {
    const endpoint = type === 'remembrancer' 
      ? '/transaction/handshake_remembrancer' 
      : '/transaction/handshake_node';
    
    setHandshakeError(null);
    setHandshakeSuccess(null);
    
    if (type === 'remembrancer') {
      setIsRemHandshakeLoading(true);
    } else {
      setIsNodeHandshakeLoading(true);
    }
    
    try {
      const result = await apiService.post(endpoint, {
        account: address,
        password: password,
        ecdh_public_key: "placeholder"
      });
      
      setHandshakeSuccess(`Successfully sent handshake to ${type}!`);
      setPassword('');
      
    } catch (err) {
      console.error(`Error sending handshake to ${type}:`, err);
      setHandshakeError(err instanceof Error ? err.message : `Failed to send handshake to ${type}`);
    } finally {
      if (type === 'remembrancer') {
        setIsRemHandshakeLoading(false);
      } else {
        setIsNodeHandshakeLoading(false);
      }
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <div className="mb-4">
              <p className="text-sm text-gray-400">Username</p>
              <p className="font-medium">{username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Wallet Address</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Network Connections</h2>
          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <p className="mb-4 text-sm text-gray-300">
              Send handshake transactions to establish encrypted communication with network nodes.
            </p>
            
            <div className="mb-4">
              <label htmlFor="handshake-password" className="block text-sm font-medium text-gray-300 mb-1">
                Enter your password to authorize handshakes
              </label>
              <input
                type="password"
                id="handshake-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
            </div>
            
            {handshakeError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-md text-red-200 text-sm">
                {handshakeError}
              </div>
            )}
            
            {handshakeSuccess && (
              <div className="mb-4 p-3 bg-green-900/50 border border-green-800 rounded-md text-green-200 text-sm">
                {handshakeSuccess}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleHandshake('remembrancer')}
                disabled={isRemHandshakeLoading || isNodeHandshakeLoading || !password}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition duration-200 flex justify-center items-center"
              >
                {isRemHandshakeLoading ? (
                  <span>Sending...</span>
                ) : (
                  <span>Handshake Remembrancer</span>
                )}
              </button>
              
              <button
                onClick={() => handleHandshake('node')}
                disabled={isRemHandshakeLoading || isNodeHandshakeLoading || !password}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition duration-200 flex justify-center items-center"
              >
                {isNodeHandshakeLoading ? (
                  <span>Sending...</span>
                ) : (
                  <span>Handshake Task Node</span>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Backup & Security</h2>
          
          {!showSeed ? (
            <form onSubmit={handleRevealSeed} className="bg-slate-800 rounded-lg p-4">
              <p className="mb-4 text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Never share your seed phrase with anyone. It provides full access to your wallet.
              </p>
              
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Enter your password to reveal your seed phrase
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-md text-red-200 text-sm">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition duration-200"
              >
                {isLoading ? 'Loading...' : 'Reveal Seed Phrase'}
              </button>
            </form>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Your Seed Phrase</h3>
                <button
                  onClick={() => setShowSeed(false)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Hide
                </button>
              </div>
              
              <div className="bg-slate-900 border border-yellow-500/30 rounded-md p-3 mb-4">
                <p className="font-mono break-all text-yellow-400">{seed}</p>
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">
                  Store this somewhere safe and secure
                </p>
                <button
                  onClick={handleCopySeed}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-sm py-1 px-3 rounded-md flex items-center"
                >
                  {seedCopied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                        <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
