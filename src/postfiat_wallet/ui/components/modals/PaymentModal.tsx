import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { PasswordConfirmModal } from './PasswordConfirmModal';
import { apiService } from '../../services/apiService';

// Define interface for API response
interface PaymentResponse {
  transaction_hash?: string;
  status: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: string, toAddress: string, currency: string, memoId?: string, memo?: string) => void;
  initialAmount: string;
  initialToAddress: string;
  initialCurrency: string;
  initialMemoId?: string;
  initialMemo?: string;
}

export function PaymentModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  initialAmount,
  initialToAddress,
  initialCurrency,
  initialMemoId,
  initialMemo
}: PaymentModalProps) {
  const { address, password, setPassword } = useContext(AuthContext);
  const [amount, setAmount] = useState(initialAmount);
  const [toAddress, setToAddress] = useState(initialToAddress);
  const [currency, setCurrency] = useState(initialCurrency);
  const [memoId, setMemoId] = useState(initialMemoId || '');
  const [memo, setMemo] = useState(initialMemo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    setAmount(initialAmount);
    setToAddress(initialToAddress);
    setCurrency(initialCurrency);
    setMemoId(initialMemoId || '');
    setMemo(initialMemo || '');
  }, [initialAmount, initialToAddress, initialCurrency, initialMemoId, initialMemo]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !toAddress) {
      setError('Amount and destination address are required');
      return;
    }
    
    // Use password from context if available
    if (password) {
      await submitPayment(password);
    } else {
      setShowPasswordModal(true);
    }
  };

  const submitPayment = async (password: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      const requestData = {
        from_account: address,
        to_address: toAddress,
        amount: amount,
        currency: currency,
        password: password,
        memo_id: memoId || undefined,
        memo: memo || undefined
      };

      console.log('Payment request:', {
        ...requestData,
        password: '[REDACTED]'
      });

      const result = await apiService.post<PaymentResponse>('/transaction/payment', requestData);
      console.log('Payment success response:', result);

      onClose();
    } catch (err) {
      console.error('Error sending payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to send payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Send Payment</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={amount}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                              text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                              focus:ring-emerald-500/50 focus:border-emerald-500/50"
                    placeholder="Amount"
                    required
                  />
                  <select
                    value={currency}
                    disabled
                    className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                              text-slate-200 focus:outline-none focus:ring-2 
                              focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  >
                    <option value="XRP">XRP</option>
                    <option value="PFT">PFT</option>
                  </select>
                </div>
                
                <input
                  type="text"
                  value={toAddress}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Destination Address"
                  required
                />
                
                <input
                  type="text"
                  value={memoId}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Memo ID (Optional)"
                />
                
                <input
                  type="text"
                  value={memo}
                  readOnly
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Memo (Optional)"
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
                  {isSubmitting ? 'Sending...' : 'Send Payment'}
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
          // Save the password in the context for future use
          setPassword(enteredPassword);
          await submitPayment(enteredPassword);
        }}
        error={error}
      />
    </>
  );
}