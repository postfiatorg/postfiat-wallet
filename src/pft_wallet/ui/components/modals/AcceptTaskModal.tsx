import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';

interface AcceptTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  onAccept: (taskId: string, message: string) => void;
}

const AcceptTaskModal = ({ isOpen, onClose, taskId, onAccept }: AcceptTaskModalProps) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { address, username, password } = useContext(AuthContext);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setShowPasswordModal(true);
      return;
    }
    await submitAcceptance(password);
  };

  const submitAcceptance = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const requestData = {
        account: address,
        tx_type: 'task_acceptance',
        password: passwordToUse,
        data: {
          message: message,
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

      onAccept(taskId, message);
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Error accepting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Accept Task</h2>
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
                <label className="text-sm font-medium text-slate-400">Acceptance Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[100px]"
                  placeholder="Enter your acceptance message..."
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
                  {isSubmitting ? 'Sending...' : 'Accept Task'}
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
          await submitAcceptance(password);
        }}
        error={error}
      />
    </>
  );
};

export default AcceptTaskModal; 