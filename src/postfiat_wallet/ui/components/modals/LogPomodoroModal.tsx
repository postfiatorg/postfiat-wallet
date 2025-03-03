import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';
import { apiService } from '../../services/apiService';

// Define interface for API response
interface LogResponse {
  transaction_hash?: string;
  status: string;
}

interface LogPomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (details: string) => void;
  initialDetails: string;
}

const LogPomodoroModal = ({ isOpen, onClose, onSubmit, initialDetails }: LogPomodoroModalProps) => {
  const [details, setDetails] = useState(initialDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { address, username, password } = useContext(AuthContext);

  useEffect(() => {
    setDetails(initialDetails);
  }, [initialDetails]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setShowPasswordModal(true);
      return;
    }
    await submitPomodoroLog(password);
  };

  const submitPomodoroLog = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const logId = `pomo_${Date.now()}`;

      const requestData = {
        account: address,
        password: passwordToUse,
        log_message: details,
        log_id: logId,
        username: username,
        use_pft: true,
      };

      console.log('Sending PF Log request:', {
        ...requestData,
        password: '[REDACTED]',
      });

      const result = await apiService.post<LogResponse>('/transaction/pf_log', requestData);
      console.log('PF Log success response:', result);

      onSubmit(details);
      onClose();
    } catch (err) {
      console.error('Error submitting PF log:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit PF log');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Submit Pomodoro Log</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Log Message</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
                  placeholder="Enter your log message..."
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
                  {isSubmitting ? 'Sending...' : 'Submit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <PasswordConfirmModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={async (password) => {
          setShowPasswordModal(false);
          await submitPomodoroLog(password);
        }}
        error={error}
      />
    </>
  );
};

export default LogPomodoroModal; 