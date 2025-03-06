import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';
import { generateCustomId } from '../../utils/taskId';
import { apiService } from '../../services/apiService';

// Define interface for API response
interface TransactionResponse {
  hash?: string;
  status: string;
}

interface RequestTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequest: (message: string) => void;
  initialMessage: string;
}

export function RequestTaskModal({ isOpen, onClose, onRequest, initialMessage }: RequestTaskModalProps) {
  const [message, setMessage] = useState(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { address, username, password, setPassword } = useContext(AuthContext);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setShowPasswordModal(true);
      return;
    }
    await submitRequest(password);
  };

  const submitRequest = async (passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);

    try {
      const taskId = generateCustomId();
      
      const requestData = {
        account: address,
        tx_type: 'task_request',
        password: passwordToUse,
        data: {
          request: message,
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

      onRequest(message);
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Error sending task request:', err);
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Request Task</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Task Request Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Enter your task request..."
                  required
                  maxLength={1000}
                />
                <div className="flex justify-end">
                  <span className={`text-xs ${message.length >= 950 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {message.length}/1000
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
                  {isSubmitting ? 'Sending...' : 'Submit Request'}
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
          await submitRequest(enteredPassword);
        }}
        error={error}
      />
    </>
  );
} 