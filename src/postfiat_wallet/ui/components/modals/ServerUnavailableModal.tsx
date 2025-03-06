import React from 'react';

interface ServerUnavailableModalProps {
  isOpen: boolean;
  onRetry: () => void;
}

export function ServerUnavailableModal({ isOpen, onRetry }: ServerUnavailableModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100]">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">Backend Service Unavailable</h2>
          
          <p className="text-slate-300 mb-6">
            The Post Fiat Wallet backend service is not responding. The wallet cannot function without a connection to the backend server.
          </p>
          
          <div className="bg-slate-700 rounded-lg p-4 mb-6 w-full text-left">
            <p className="text-sm text-slate-300 mb-2">Possible causes:</p>
            <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
              <li>The local server process has been terminated</li>
              <li>There's a network connectivity issue</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
