import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';
import { apiService } from '../../services/apiService';

// Define interface for API response
interface TransactionResponse {
  hash?: string;
  status: string;
}

interface FinalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  onSubmit: (taskId: string, details: string) => void;
  initialDetails: string;
  verificationPrompt: string;
}

const FinalVerificationModal = ({ 
  isOpen, 
  onClose, 
  taskId, 
  onSubmit, 
  initialDetails,
  verificationPrompt 
}: FinalVerificationModalProps) => {
  const [details, setDetails] = useState(initialDetails);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { address, username, password, setPassword } = useContext(AuthContext);

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
    await submitVerificationResponse(password);
  };

  const submitVerificationResponse = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const requestData = {
        account: address,
        tx_type: 'verification_response',
        password: passwordToUse,
        data: {
          verification_response: details,
          task_id: taskId,
          username: username
        }
      };

      console.log('Sending request data:', {
        ...requestData,
        password: '[REDACTED]'
      });

      const result = await apiService.post<TransactionResponse>('/transaction/send', requestData);
      console.log('Success response:', result);

      onSubmit(taskId, details);
      setDetails('');
      onClose();
    } catch (err) {
      console.error('Error submitting verification response:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit verification response');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Submit Verification Response</h2>
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
              
              {verificationPrompt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Verification Prompt</label>
                  <div className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg 
                              text-slate-300 text-sm max-h-[150px] overflow-y-auto">
                    {verificationPrompt}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Verification Response</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
                  placeholder="Enter your verification response..."
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
                  {isSubmitting ? 'Sending...' : 'Submit Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <PasswordConfirmModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={async (enteredPassword) => {
          setShowPasswordModal(false);
          setPassword(enteredPassword);
          await submitVerificationResponse(enteredPassword);
        }}
        error={error}
      />
    </>
  );
};

export default FinalVerificationModal; 