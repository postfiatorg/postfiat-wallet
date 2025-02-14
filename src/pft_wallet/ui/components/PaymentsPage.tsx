import React, { useState } from 'react';

const PaymentsPage = () => {
 // const [activeTab, setActiveTab] = useState('payments');
  const [selectedToken, setSelectedToken] = useState('XRP');
  

  const transactions = [
    {
      id: 1,
      date: '2025-02-07 08:54:01',
      amount: '1',
      token: 'PFT',
      direction: 'From',
      address: 'r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD',
      txHash: '7004C97FB69B558202D0DCE6CC8F553F334DDB77FE92FF1E072E00C834E815AC'
    },
    // ... add more transactions as needed
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <div className="mb-6">
      </div>


      {/* Payment Form */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <input
                  type="text"
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
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <input
              type="text"
              placeholder="To Address"
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Right Column */}
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Memo ID (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between items-center">
              <input
                type="text"
                placeholder="Memo (Optional)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 mr-2"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
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
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="p-4 text-gray-300">{tx.id}</td>
                <td className="p-4 text-gray-300 whitespace-nowrap">{tx.date}</td>
                <td className="p-4 text-gray-300">{tx.amount}</td>
                <td className="p-4 text-gray-300">{tx.token}</td>
                <td className="p-4 text-gray-300">{tx.direction}</td>
                <td className="p-4 text-gray-300 font-mono">{tx.address}</td>
                <td className="p-4 text-gray-300 font-mono">{tx.txHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Status */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between p-2 bg-gray-800 text-gray-400 text-sm">
        <span>Wallet state: idle</span>
        <span>IDLE</span>
      </div>
    </div>
  );
};

export default PaymentsPage; 