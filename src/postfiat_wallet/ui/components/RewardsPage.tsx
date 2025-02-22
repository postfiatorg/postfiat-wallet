'use client';

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';

const RewardsPage = () => {
  const { isAuthenticated, address } = useContext(AuthContext);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks from the API
  const fetchRewards = async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/tasks/${address}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch tasks: ${text}`);
      }
      const data = await response.json();

      // Only display rewarded tasks
      let rewardedTasks = data.rewarded || [];

      // Sort tasks by timestamp (extracted from task ID)
      const parseTimestamp = (id: string): number => {
        const tsStr = id.split('__')[0];
        const isoTimestamp = tsStr.replace('_', 'T') + ":00";
        return new Date(isoTimestamp).getTime();
      };

      rewardedTasks.sort((a, b) => parseTimestamp(b.id) - parseTimestamp(a.id));
      setRewards(rewardedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch rewards when component mounts
  useEffect(() => {
    if (!isAuthenticated || !address) return;
    fetchRewards();

    // Add periodic refresh
    const intervalId = setInterval(() => {
      fetchRewards();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, address]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      {/* Header */}
     

      {/* Authentication and Loading States */}
      {!isAuthenticated && (
        <div className="text-white">Please sign in to view rewards.</div>
      )}
      {isAuthenticated && !address && (
        <div className="text-white">No wallet address found.</div>
      )}
      {loading && <div className="text-white">Loading rewards...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}

      {/* Main Content */}
      {isAuthenticated && address && !loading && (
        <div className="space-y-6">
          {/* Rewards Table */}
          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="border-b border-gray-700">
                    <th className="p-4 text-gray-400 font-normal">Task ID</th>
                    <th className="p-4 text-gray-400 font-normal">Proposal</th>
                    <th className="p-4 text-gray-400 font-normal">Reward</th>
                    <th className="p-4 text-gray-400 font-normal">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-gray-400 text-center">
                        No rewards available.
                      </td>
                    </tr>
                  ) : (
                    rewards.map((reward, index) => {
                      console.log('Full reward object:', reward);
                      console.log('All reward properties:', Object.keys(reward));
                      
                      const initialMessage = reward.message_history?.[0]?.data || 'No message available';
                      const rewardMessage = reward.message_history?.[reward.message_history.length - 1]?.data || 'No reward message';
                      
                      return (
                        <tr key={reward.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="p-4 text-gray-300 font-mono align-top whitespace-nowrap">
                            {reward.id}
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-md">
                            <div className="line-clamp-4">{initialMessage}</div>
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-lg">
                            <div className="line-clamp-4">{rewardMessage}</div>
                          </td>
                          <td className="p-4 text-gray-300 align-top whitespace-nowrap">
                            {reward.pft_rewarded || reward.pft_offered || 'N/A'} PFT
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer Status */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-between p-2 bg-gray-800 text-gray-400 text-sm">
        <span>Wallet state: idle</span>
        <span>IDLE</span>
      </div>
    </div>
  );
};

export default RewardsPage;