import { useState } from 'react';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  error?: string;
}

export function PasswordConfirmModal({ isOpen, onClose, onConfirm, error }: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(password);
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Confirm Password</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Enter your password to sign this transaction
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                          text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                          focus:ring-emerald-500/50 focus:border-emerald-500/50"
                placeholder="Password"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                         text-white rounded-lg transition-colors text-sm font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 