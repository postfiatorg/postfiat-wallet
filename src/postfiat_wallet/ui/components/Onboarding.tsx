import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { PasswordConfirmModal } from './modals/PasswordConfirmModal';
import { apiService } from '@/services/apiService';

// Define interfaces for API responses
interface BalanceResponse {
  xrp: string;
  pft: string;
}

interface StatusResponse {
  init_rite_status: string;
}

interface EcdhResponse {
  ecdh_public_key: string;
}

interface InitiationResponse {
  status: string;
  message?: string;
}

interface OnboardingProps {
  initStatus: string;
  address: string;
  onCheckStatus: (data: any) => void;
}

interface Balance {
  xrp: string;
  pft: string;
}

const Onboarding: React.FC<OnboardingProps> = ({ initStatus, address, onCheckStatus }) => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const { username, clearAuth } = useContext(AuthContext);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [initiationRite, setInitiationRite] = useState('');
  const [googleDocLink, setGoogleDocLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);

  const fetchBalance = async () => {
    try {
      const data = await apiService.get<BalanceResponse>(`/balance/${address}`);
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const checkInitStatus = async () => {
    try {
      // Simple status check without the balance-related logic
      const data = await apiService.get<StatusResponse>(`/account/${address}/status?refresh=true`);
      
      console.log("Status check result:", data);
      onCheckStatus({ init_rite_status: data.init_rite_status });
    } catch (error) {
      console.error('Error checking init status:', error);
      // In case of error, assume UNSTARTED
      onCheckStatus({ init_rite_status: 'UNSTARTED' });
    }
  };

  const handleInitiationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const submitInitiation = async (password: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      // First get the ECDH public key
      const ecdhResponse = await apiService.post<EcdhResponse>('/wallet/ecdhkey', {
        account: address,
        password: password
      });

      // Now submit the full initiation sequence
      const requestData = {
        account: address,
        password: password,
        username: username,
        initiation_rite: initiationRite,
        google_doc_link: googleDocLink,
        ecdh_public_key: ecdhResponse.ecdh_public_key,
        use_pft_for_doc: false
      };

      const result = await apiService.post<InitiationResponse>('/initiation/full-sequence', requestData);

      console.log('Initiation submitted successfully:', result);
      
      // Set waiting for confirmation state
      setIsWaitingForConfirmation(true);
      
      // Trigger status check to update UI
      onCheckStatus({ init_rite_status: 'PENDING_INITIATION' });
      
      // Start checking status periodically
      const checkInterval = setInterval(async () => {
        await checkInitStatus();
      }, 10000);
      
      // Clear interval after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        setIsWaitingForConfirmation(false);
      }, 120000);
      
    } catch (err) {
      console.error('Error submitting initiation:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit initiation');
      setIsWaitingForConfirmation(false);
    } finally {
      setIsSubmitting(false);
      setShowPasswordModal(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBalance();

    // Set up interval for periodic fetching
    const intervalId = setInterval(fetchBalance, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [address]);

  useEffect(() => {
    // Check status every 10s when pending initiation
    if (initStatus === 'PENDING_INITIATION') {
      const intervalId = setInterval(() => {
        checkInitStatus();
        fetchBalance();
      }, 10000);

      return () => clearInterval(intervalId);
    }
  }, [initStatus, address, onCheckStatus]);

  const renderStepContent = () => {
    const xrpBalance = balance ? parseFloat(balance.xrp) : 0;
    const needsFunding = xrpBalance <= 0;

    if (isWaitingForConfirmation) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Initiation Submitted</h2>
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-blue-400">Processing Your Initiation</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300">Your initiation has been submitted to the blockchain. It may take a minute or two to be confirmed.</p>
              
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-gray-400">The page will automatically update once your initiation is confirmed. Please be patient.</p>
              </div>

              <div className="border-t border-blue-500/20 pt-4">
                <p className="text-sm font-medium text-blue-400 mb-3">What's happening now:</p>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">1</span>
                    <span>Your initiation rite is being recorded on the XRP Ledger</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">2</span>
                    <span>A secure connection is being established with the PostFiat node</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">3</span>
                    <span>Your Google Doc link is being securely stored</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (needsFunding) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white">Step 1: Fund Your Wallet</h2>
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-blue-400">Wallet Funding Required</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300">Before you can complete the initiation process, you need at least 2 XRP in your wallet.</p>
              
              <div className="bg-slate-900/50 rounded-lg p-4">
                <span className="text-gray-400">Current balance:</span>
                <span className="ml-2 text-xl font-medium text-white">{balance?.xrp || '0'} XRP</span>
              </div>

              <div className="border-t border-blue-500/20 pt-4">
                <p className="text-sm font-medium text-blue-400 mb-3">To fund your wallet:</p>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">1</span>
                    <span>Send XRP from another wallet or exchange</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">2</span>
                    <span>Use your wallet address shown above</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-sm">3</span>
                    <span>Wait for the transaction to confirm</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (initStatus) {
      case 'UNSTARTED':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Step 2: Complete Initiation</h2>
            <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-blue-400">Complete Your Initiation</h3>
              </div>

              <form onSubmit={handleInitiationSubmit} className="space-y-6">
                <div>
                  <label htmlFor="initiation-rite" className="block text-sm font-medium text-gray-300 mb-2">
                    Initiation Rite
                  </label>
                  <textarea
                    id="initiation-rite"
                    value={initiationRite}
                    onChange={(e) => setInitiationRite(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Write your initiation rite here..."
                    required
                  />
                  <p className="mt-2 text-sm text-gray-400">
                    Your initiation rite should be a thoughtful statement about your intentions and goals.
                  </p>
                </div>

                <div>
                  <label htmlFor="google-doc" className="block text-sm font-medium text-gray-300 mb-2">
                    Google Doc Link
                  </label>
                  <input
                    type="url"
                    id="google-doc"
                    value={googleDocLink}
                    onChange={(e) => setGoogleDocLink(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://docs.google.com/..."
                    required
                  />
                  <p className="mt-2 text-sm text-gray-400">
                    Share a Google Doc that contains your detailed background and interests.
                  </p>
                </div>

                {error && (
                  <div className="text-red-500 text-sm">{error}</div>
                )}

                <div className="pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>{isSubmitting ? 'Submitting...' : 'Submit Initiation'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div className="bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-2">What happens next?</h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Create a trust line for the PFT token
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit your initiation rite transaction
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Send handshake transactions to the node and remembrancer
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submit your Google Doc context link
                    </li>
                  </ul>
                </div>
              </form>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Confirm Initiation</h3>
                  <p className="text-gray-300 mb-4">
                    Are you sure you want to submit your initiation? This will:
                  </p>
                  <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
                    <li>Create a trust line for the PFT token</li>
                    <li>Submit your initiation rite</li>
                    <li>Set up secure communication with the network</li>
                    <li>Submit your context document</li>
                  </ul>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        setShowPasswordModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Password Modal */}
            <PasswordConfirmModal
              isOpen={showPasswordModal}
              onClose={() => setShowPasswordModal(false)}
              onConfirm={submitInitiation}
              error={error}
            />
          </div>
        );

      case 'INITIATED':
      case 'COMPLETE':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Complete</h2>
            <p>Your account has been successfully initiated. You can now use the network.</p>
          </div>
        );

      case 'PENDING':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Pending</h2>
            <p>Your initiation request is being processed. Please check back soon.</p>
          </div>
        );

      case 'REJECTED':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Rejected</h2>
            <p>Your initiation request was not accepted. Please contact support for more information.</p>
          </div>
        );

      default:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Account Setup Required</h2>
            <p>Additional setup is needed for your account.</p>
            <p className="text-sm text-gray-400 mt-2">Status: {initStatus}</p>
          </div>
        );
    }
  };

  // Helper function to determine if wallet needs funding
  const needsFunding = () => {
    const xrpBalance = balance ? parseFloat(balance.xrp) : 0;
    return xrpBalance <= 0;
  };

  // Helper function to determine if onboarding is complete
  const isOnboardingComplete = () => {
    return ['INITIATED', 'COMPLETE'].includes(initStatus);
  };

  // Only render main content if onboarding is NOT complete
  if (!isOnboardingComplete()) {
    return (
      <div className="min-h-screen bg-slate-950">
        <nav className="bg-slate-900 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <span className="text-white font-medium">{username}</span>
              </div>
              <button
                onClick={clearAuth}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-6">Welcome to Post Fiat</h1>
            <div className="mb-6">
              <p className="text-sm text-gray-400">Wallet Address:</p>
              <p className="font-mono">{address}</p>
              {balance && (
                <p className="text-sm text-gray-400 mt-2">
                  Balance: {balance.xrp} XRP / {balance.pft} PFT
                </p>
              )}
            </div>
            {renderStepContent()}
          </div>
        </main>
      </div>
    );
  }

  // Return null when onboarding is complete
  return null;
};

export default Onboarding;