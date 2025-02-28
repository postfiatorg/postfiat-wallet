import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';

interface SubmitVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  onSubmit: (taskId: string, details: string) => void;
  initialDetails: string;
}

const SubmitVerificationModal = ({ isOpen, onClose, taskId, onSubmit, initialDetails }: SubmitVerificationModalProps) => {
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
    await submitVerification(password);
  };

  const submitVerification = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const requestData = {
        account: address,
        tx_type: 'task_completion',
        password: passwordToUse,
        data: {
          completion_justification: details,
          task_id: taskId,
          username: username
        }
      };

      console.log('Sending request data:', {
        ...requestData,
        password: '[REDACTED]'
      });

      const response = await fetch('http://localhost:8000/api/transaction/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Full error response:', errorData);
        throw new Error(errorData.detail || 'Failed to send transaction');
      }

      const result = await response.json();
      console.log('Success response:', result);

      onSubmit(taskId, details);
      setDetails('');
      onClose();
    } catch (err) {
      console.error('Error submitting completion:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit completion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Submit for Verification</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Task ID</label>
                <input
                  type="text"
                  value={taskId}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Verification Details</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
                  placeholder="Enter verification details..."
                  required
                  maxLength={1000}
                />
                <div className="flex justify-end">
                  <span className={`text-xs ${details.length >= 950 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {details.length}/1000
                  </span>
                </div>
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
                  {isSubmitting ? 'Sending...' : 'Submit Verification'}
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
          await submitVerification(password);
        }}
        error={error}
      />
    </>
  );
};

export default SubmitVerificationModal; 