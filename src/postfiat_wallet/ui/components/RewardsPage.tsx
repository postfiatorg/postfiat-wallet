'use client';

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext, useAuthAccount } from '../context/AuthContext';
import { apiService } from '../services/apiService';

interface MessageHistoryItem {
  direction: string;
  data: string;
}

interface FinishedTask {
  id: string;
  message_history: MessageHistoryItem[];
  pft_rewarded?: number;
  pft_offered?: number;
  status?: string;
}

// Add this interface for typing the API response
interface TasksResponse {
  rewarded: FinishedTask[];
  refused: FinishedTask[];
  [key: string]: any[];  // For any other task categories
}

const FinishedTasksPage = () => {
  const { isAuthenticated, address, isCurrentAccount } = useAuthAccount();
  const [tasks, setTasks] = useState<FinishedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'rewarded' | 'refused'>('all');
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState<number>(0);

  // Fetch tasks from the API with delta updates
  const fetchTasks = async (forceFullRefresh = false) => {
    if (!address || !isAuthenticated || !isCurrentAccount(address)) {
      console.log("Not fetching rewards - inactive account or not authenticated");
      setLoading(false);
      return;
    }

    try {
      // Build endpoint with optional timestamp for delta updates
      let endpoint = `/tasks/${address}`;
      if (!forceFullRefresh && lastRefreshTimestamp > 0) {
        endpoint += `?since=${lastRefreshTimestamp}`;
      }
      
      const data = await apiService.get<TasksResponse>(endpoint);
      
      // Update timestamp for next refresh
      setLastRefreshTimestamp(Math.floor(Date.now() / 1000));
      
      if (forceFullRefresh || lastRefreshTimestamp === 0) {
        // Complete refresh - rebuild the array from scratch
        let finishedTasks = [...(data.rewarded || []), ...(data.refused || [])];
        
        // Mark tasks with their status
        finishedTasks = finishedTasks.map((task: FinishedTask) => {
          if (data.rewarded?.some((r: FinishedTask) => r.id === task.id)) {
            return { ...task, status: 'rewarded' };
          } else {
            return { ...task, status: 'refused' };
          }
        });

        // Sort tasks by timestamp
        const parseTimestamp = (id: string): number => {
          const tsStr = id.split('__')[0];
          const isoTimestamp = tsStr.replace('_', 'T') + ":00";
          return new Date(isoTimestamp).getTime();
        };

        finishedTasks.sort((a: FinishedTask, b: FinishedTask) => parseTimestamp(b.id) - parseTimestamp(a.id));
        setTasks(finishedTasks);
      } else {
        // Delta update - merge with existing tasks
        setTasks(prevTasks => {
          // Create a map from the current tasks for quick lookup
          const taskMap = new Map(prevTasks.map(task => [task.id, task]));
          
          // Update with new rewarded tasks
          if (data.rewarded) {
            data.rewarded.forEach((task: FinishedTask) => {
              taskMap.set(task.id, { ...task, status: 'rewarded' });
            });
          }
          
          // Update with new refused tasks
          if (data.refused) {
            data.refused.forEach((task: FinishedTask) => {
              taskMap.set(task.id, { ...task, status: 'refused' });
            });
          }
          
          // Remove any tasks that were deleted
          if (data.removed_task_ids) {
            data.removed_task_ids.forEach((id: string) => {
              taskMap.delete(id);
            });
          }
          
          // Convert back to array and sort
          const updatedTasks = Array.from(taskMap.values());
          const parseTimestamp = (id: string): number => {
            const tsStr = id.split('__')[0];
            const isoTimestamp = tsStr.replace('_', 'T') + ":00";
            return new Date(isoTimestamp).getTime();
          };
          
          updatedTasks.sort((a: FinishedTask, b: FinishedTask) => 
            parseTimestamp(b.id) - parseTimestamp(a.id)
          );
          
          return updatedTasks;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!address || !isAuthenticated || !isCurrentAccount(address)) {
      console.log("Not starting rewards fetch - inactive account or not authenticated");
      setLoading(false);
      return;
    }

    console.log(`Fetching rewards for current account: ${address}`);
    fetchTasks(true);
    
    // Set up interval for periodic refreshes
    const interval = setInterval(() => {
      if (isCurrentAccount(address)) {
        fetchTasks();
      } else {
        console.log(`Stopping rewards interval for inactive account: ${address}`);
        clearInterval(interval);
      }
    }, 60000); // Every minute
    
    // Cleanup function
    return () => {
      console.log(`Cleaning up rewards refresh interval for: ${address}`);
      clearInterval(interval);
    };
  }, [address, isAuthenticated]);

  // Filter tasks based on selected filter
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  // Get the proposal message from a task using more robust logic
  const getProposalMessage = (task: FinishedTask) => {
    if (!task.message_history?.length) return "No proposal available";
    
    // First, try to find a message that starts with "PROPOSED PF"
    for (let i = 0; i < task.message_history.length; i++) {
      const msg = task.message_history[i];
      if (msg.data.startsWith("PROPOSED PF")) {
        return msg.data;
      }
    }
    
    // If no "PROPOSED PF" message is found, fall back to index 1
    if (task.message_history.length >= 2) {
      return task.message_history[1].data;
    }
    
    // Last resort fallback to index 0
    return task.message_history[0].data;
  };

  // Add this CSS at the top of your file or in your global styles
  const styles = `
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .animate-fade-in {
      animation: fade-in 0.5s ease-out;
    }
  `;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 space-y-6 animate-fade-in">
        <style>{styles}</style>
        {/* Header Skeleton */}
        <div className="h-8 w-48 bg-slate-700 rounded animate-pulse"></div>
        
        {/* Filter Controls Skeleton */}
        <div className="flex space-x-4 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 bg-slate-700 rounded-lg animate-pulse"></div>
          ))}
        </div>
        
        {/* Table Header Skeleton */}
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="border-b border-gray-700">
                  {['Task ID', 'Proposal', 'Reward/Refusal', 'Payout'].map((header, i) => (
                    <th key={i} className="p-4">
                      <div className="h-4 w-24 bg-slate-700 rounded animate-pulse"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="h-4 w-48 bg-slate-700 rounded animate-pulse"></div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-700 rounded animate-pulse"></div>
                        <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse"></div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-700 rounded animate-pulse"></div>
                        <div className="h-4 w-2/3 bg-slate-700 rounded animate-pulse"></div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-20 bg-slate-700 rounded animate-pulse"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      <style>{styles}</style>
      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">Finished Tasks</h1>

      {/* Authentication States */}
      {!isAuthenticated && (
        <div className="text-white">Please sign in to view your finished tasks.</div>
      )}
      {isAuthenticated && !address && (
        <div className="text-white">No wallet address found.</div>
      )}
      {error && <div className="text-red-500">Error: {error}</div>}

      {/* Main Content */}
      {isAuthenticated && address && !loading && (
        <div className="space-y-6 animate-fade-in">
          {/* Filter Controls */}
          <div className="flex space-x-4 mb-4">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Tasks
            </button>
            <button 
              onClick={() => setFilter('rewarded')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'rewarded' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Rewarded
            </button>
            <button 
              onClick={() => setFilter('refused')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'refused' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Refused
            </button>
          </div>

          {/* Tasks Table */}
          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="border-b border-gray-700">
                    <th className="p-4 text-gray-400 font-normal">Task ID</th>
                    <th className="p-4 text-gray-400 font-normal">Proposal</th>
                    <th className="p-4 text-gray-400 font-normal">Reward/Refusal</th>
                    <th className="p-4 text-gray-400 font-normal">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-gray-400 text-center">
                        No tasks available.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      // Get the proposal using the new helper function
                      const proposal = getProposalMessage(task);
                      
                      // For rewarded tasks, find the reward message (typically the last message)
                      const rewardMessage = task.status === 'rewarded' && task.message_history?.length > 1
                        ? task.message_history[task.message_history.length - 1].data
                        : null;
                      
                      // For refused tasks, find the refusal message
                      const refusalMessage = task.status === 'refused' && task.message_history?.length > 1
                        ? task.message_history[task.message_history.length - 1].data
                        : null;
                      
                      // Display the appropriate message based on task status
                      const responseToShow = task.status === 'rewarded' && rewardMessage
                        ? rewardMessage
                        : task.status === 'refused' && refusalMessage
                        ? refusalMessage
                        : 'No response available';
                      
                      return (
                        <tr key={task.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="p-4 text-gray-300 font-mono align-top whitespace-nowrap">
                            {task.id}
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-md">
                            <div className="line-clamp-4">{proposal}</div>
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-lg">
                            <div className="line-clamp-4">{responseToShow}</div>
                          </td>
                          <td className="p-4 text-gray-300 align-top whitespace-nowrap">
                            {task.status === 'rewarded' 
                              ? `${task.pft_rewarded || task.pft_offered || 'N/A'} PFT` 
                              : '–'}
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
    </div>
  );
};

export default FinishedTasksPage;