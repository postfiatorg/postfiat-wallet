import React, { useEffect, useState } from 'react';

interface OnboardingProps {
  initStatus: string;
  address: string;
  onCheckStatus: () => void;
}

interface Balance {
  xrp: string;
  pft: string;
}

const Onboarding: React.FC<OnboardingProps> = ({ initStatus, address, onCheckStatus }) => {
  const [balance, setBalance] = useState<Balance | null>(null);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`/api/balance/${address}`);
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
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
    // Check status every 10s when pending
    if (initStatus === 'PENDING_INITIATION') {
      const intervalId = setInterval(() => {
        onCheckStatus();
      }, 10000);

      return () => clearInterval(intervalId);
    }
  }, [initStatus, onCheckStatus]);

  const renderStepContent = () => {
    // Only show funding requirement if XRP balance is too low AND initiation is not completed
    const xrpBalance = balance ? parseFloat(balance.xrp) : 0;
    const needsFunding = xrpBalance < 2 && initStatus === 'UNSTARTED';

    switch (initStatus) {
      case 'UNSTARTED':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Required</h2>
            {needsFunding ? (
              <div className="mb-4 p-4 bg-yellow-900 rounded-lg">
                <h3 className="font-semibold mb-2">Wallet Funding Required</h3>
                <p>Your wallet needs at least 2 XRP to complete the initiation process.</p>
                <p className="mt-2">Current balance: {balance?.xrp || '0'} XRP</p>
              </div>
            ) : (
              <>
                <p className="mb-4">
                  To join the network, you need to complete the initiation process. This involves:
                </p>
                <ul className="list-disc list-inside mb-4">
                  <li>Setting up your context document</li>
                  <li>Making a small XRP payment to demonstrate wallet control and commitment to the network</li>
                </ul>
                {/* Add initiation action button/form here */}
              </>
            )}
          </div>
        );

      case 'INITIATED':
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

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-6">Welcome to PostFiat</h1>
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
};

export default Onboarding;