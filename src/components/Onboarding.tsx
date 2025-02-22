import React from 'react';

interface OnboardingProps {
  initStatus: string;
  address: string;
}

const Onboarding: React.FC<OnboardingProps> = ({ initStatus, address }) => {
  const renderStepContent = () => {
    switch (initStatus) {
      case 'NEEDS_INITIATION_RITE':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Rite Required</h2>
            <p className="mb-4">
              To join the network, you need to complete the initiation rite. This involves:
            </p>
            <ul className="list-disc list-inside mb-4">
              <li>Reading and accepting the network's context document</li>
              <li>Making a small XRP payment to demonstrate wallet control</li>
            </ul>
            {/* Add initiation rite action button/form here */}
          </div>
        );

      case 'PENDING_INITIATION':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Initiation Pending</h2>
            <p>Your initiation request is being processed. Please check back soon.</p>
          </div>
        );

      case 'NEEDS_CONTEXT_DOCUMENT':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Context Document Required</h2>
            <p>Please review and accept the network's context document to continue.</p>
            {/* Add context document acceptance form/button here */}
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
          </div>
          {renderStepContent()}
        </div>
      </main>
    </div>
  );
};

export default Onboarding;
