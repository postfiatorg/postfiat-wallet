'use client';

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext, useAuthAccount } from '../context/AuthContext';
import { PaymentModal } from './modals/PaymentModal';
import { apiService } from '../services/apiService';

// Add interfaces for API responses
interface PaymentResponse {
  payments: Payment[];
  removed_payment_ids?: string[]; // Support for tracking removed payments
}

interface Payment {
  timestamp: string;
  from_address: string;
  to_address: string;
  amount_xrp: number;
  amount_pft: number;
  hash: string;
  id?: string; // Unique identifier for the payment
}

interface TransactionResponse {
  transaction_hash: string;
  status: string;
}

const PaymentsPage = () => {
  // Replace direct context usage with our custom hook
  const { isAuthenticated, address, isCurrentAccount } = useAuthAccount();
  const { password } = useContext(AuthContext); // Only if password is needed
  
  const [selectedToken, setSelectedToken] = useState('XRP');
  const [transactions, setTransactions] = useState<Payment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [memoId, setMemoId] = useState('');
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Add lastRefreshTimestamp for incremental updates
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState<number>(0);

  const fetchPayments = async (forceFullRefresh = false) => {
    if (!address || !isAuthenticated || !isCurrentAccount(address)) {
      console.log("Not fetching payments - inactive account or not authenticated");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // CHANGE 1: Remove delta updates temporarily
      let endpoint = `/payments/${address}`;
      
      // Debug info
      console.log(`Fetching payments from: ${endpoint}`);
      
      // CHANGE 2: Add better error handling
      try {
        const data = await apiService.get<PaymentResponse>(endpoint);
        
        console.log("Received payments data type:", typeof data);
        console.log("Keys in response:", Object.keys(data || {}));
        
        // CHANGE 3: Handle response data more carefully
        if (data && data.payments && Array.isArray(data.payments)) {
          const sortedTransactions = data.payments.sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          
          setTransactions(sortedTransactions);
          console.log(`Loaded ${sortedTransactions.length} payments`);
        } else {
          // Fallback for empty or unexpected response format
          console.warn("Received unexpected data format from payments API:", data);
          setTransactions([]);
        }
        
        // Update timestamp for next refresh
        setLastRefreshTimestamp(Math.floor(Date.now() / 1000));
      } catch (fetchError: any) {
        console.error("API Error details:", fetchError);
        if (fetchError.response) {
          console.error('Response data:', fetchError.response.data);
          console.error('Response status:', fetchError.response.status);
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError(error instanceof Error ? error.message : "Failed to fetch payments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Start payment refresh loop when component mounts
    if (!address || !isAuthenticated || !isCurrentAccount(address)) {
      console.log("Not starting payments fetch - inactive account or not authenticated");
      setIsLoading(false);
      return;
    }
    
    console.log(`Starting payment fetch for current account: ${address}`);
    
    // Initial fetch (full refresh)
    fetchPayments(true);
    
    // Set up interval for periodic refreshes using delta updates
    const intervalId = setInterval(() => {
      if (isCurrentAccount(address)) {
        fetchPayments(false);
      } else {
        console.log(`Stopping payment interval for inactive account: ${address}`);
        clearInterval(intervalId);
      }
    }, 30000); // Every 30 seconds
    
    // Clean up interval on unmount
    return () => {
      console.log(`Cleaning up payment refresh interval for: ${address}`);
      clearInterval(intervalId);
    };
  }, [address, isAuthenticated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !toAddress) {
      setError('Amount and destination address are required');
      return;
    }
    setIsModalOpen(true);
  };

  const handlePaymentSubmit = async (
    amount: string,
    toAddress: string,
    currency: string,
    memoId?: string,
    memo?: string
  ) => {
    setStatus('loading');
    setError('');
    
    try {
      await apiService.post<TransactionResponse>('/transaction/payment', {
        from_account: address,
        to_address: toAddress,
        amount: amount,
        currency: currency,
        memo_id: memoId || undefined,
        memo: memo || undefined
      });

      // Clear form
      setAmount('');
      setToAddress('');
      setMemoId('');
      setMemo('');
      setStatus('success');
      
      // Force full refresh after making a payment
      await fetchPayments(true);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
      throw err;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Fixed Header with Form */}
      <div className="flex-none p-4">
        <h1 className="text-2xl font-bold mb-6">Payments</h1>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Send Amount"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                  >
                    <option value="XRP">XRP</option>
                    <option value="PFT">PFT</option>
                  </select>
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="To Address"
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Right Column */}
            <div className="space-y-4">
              <input
                type="text"
                value={memoId}
                onChange={(e) => setMemoId(e.target.value)}
                placeholder="Memo ID (optional)"
                className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Memo (Optional)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
                />
                <button 
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-md transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm mt-2">{error}</div>
          )}
        </form>
      </div>

      {/* Scrollable Transaction Table Container */}
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto px-4">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-700">
                <th className="p-4 text-gray-400 font-normal">#</th>
                <th className="p-4 text-gray-400 font-normal">Date</th>
                <th className="p-4 text-gray-400 font-normal">Amount</th>
                <th className="p-4 text-gray-400 font-normal">Token</th>
                <th className="p-4 text-gray-400 font-normal">To/From</th>
                <th className="p-4 text-gray-400 font-normal">Address</th>
                <th className="p-4 text-gray-400 font-normal">Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Skeleton loader rows
                [...Array(5)].map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b border-gray-800 animate-pulse">
                    <td className="p-4"><div className="h-4 w-8 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-24 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-16 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-12 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-8 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-32 bg-gray-700 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-40 bg-gray-700 rounded"></div></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 text-gray-300">{index + 1}</td>
                    <td className="p-4 text-gray-300 whitespace-nowrap">{tx.timestamp}</td>
                    <td className="p-4 text-gray-300">{tx.amount_xrp > 0 ? tx.amount_xrp : tx.amount_pft}</td>
                    <td className="p-4 text-gray-300">
                      {tx.amount_xrp > 0 ? 'XRP' : (tx.amount_pft > 0 ? 'PFT' : '')}
                    </td>
                    <td className="p-4 text-gray-300">
                      {tx.from_address === address ? 'To' : 'From'}
                    </td>
                    <td className="p-4 text-gray-300 font-mono">
                      {tx.from_address === address ? tx.to_address : tx.from_address}
                    </td>
                    <td className="p-4 text-gray-300 font-mono">
                      <a 
                        href={`https://livenet.xrpl.org/transactions/${tx.hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {tx.hash.substring(0, 10)}...
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    
      {/* Payment Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        initialAmount={amount}
        initialToAddress={toAddress}
        initialCurrency={selectedToken}
        initialMemoId={memoId}
        initialMemo={memo}
      />
    </div>
  );
};

export default PaymentsPage; 