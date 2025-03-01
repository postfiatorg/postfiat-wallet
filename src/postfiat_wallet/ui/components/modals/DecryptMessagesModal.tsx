import React, { useState } from 'react';

interface DecryptMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDecrypt: (password: string) => void;
  error?: string;
}

const DecryptMessagesModal: React.FC<DecryptMessagesModalProps> = ({
  isOpen,
  onClose,
  onDecrypt,
  error,
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDecrypt(password);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-4 text-white">Decrypt Messages</h2>
        
        <p className="text-slate-300 mb-4">
          Your messages are encrypted. Please enter your password to decrypt and view them.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!password}
            >
              Decrypt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DecryptMessagesModal;
