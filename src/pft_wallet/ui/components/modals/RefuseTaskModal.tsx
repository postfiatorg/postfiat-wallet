import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';

interface RefuseTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  onRefuse: (taskId: string, reason: string) => void;
}

const RefuseTaskModal = ({ isOpen, onClose, taskId, onRefuse }: RefuseTaskModalProps) => {
  const [reason, setReason] = useState('');
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
    await submitRefusal(password);
  };

  const submitRefusal = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const requestData = {
        account: address,
        tx_type: 'task_refusal',
        password: passwordToUse,
        data: {
          refusal_reason: reason,
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

      onRefuse(taskId, reason);
      setReason('');
      onClose();
    } catch (err) {
      console.error('Error refusing task:', err);
      setError(err instanceof Error ? err.message : 'Failed to refuse task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Refuse Task</h2>
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
                <label className="text-sm font-medium text-slate-400">Reason for Refusal</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[100px]"
                  placeholder="Enter reason for refusing the task..."
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
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 
                           text-white rounded-lg transition-colors text-sm font-medium
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Refuse Task'}
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
          await submitRefusal(password);
        }}
        error={error}
      />
    </>
  );
};

export default RefuseTaskModal; 