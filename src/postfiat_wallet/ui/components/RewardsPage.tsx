'use client';

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';

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

const FinishedTasksPage = () => {
  const { isAuthenticated, address } = useContext(AuthContext);
  const [tasks, setTasks] = useState<FinishedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'rewarded' | 'refused'>('all');

  // Fetch tasks from the API
  const fetchTasks = async () => {
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

      // Get both rewarded and refused tasks
      let finishedTasks = [...(data.rewarded || []), ...(data.refused || [])];
      
      // Mark tasks with their status
      finishedTasks = finishedTasks.map((task: FinishedTask) => {
        if (data.rewarded?.some((r: FinishedTask) => r.id === task.id)) {
          return { ...task, status: 'rewarded' };
        } else {
          return { ...task, status: 'refused' };
        }
      });

      // Sort tasks by timestamp (extracted from task ID)
      const parseTimestamp = (id: string): number => {
        const tsStr = id.split('__')[0];
        const isoTimestamp = tsStr.replace('_', 'T') + ":00";
        return new Date(isoTimestamp).getTime();
      };

      finishedTasks.sort((a: FinishedTask, b: FinishedTask) => parseTimestamp(b.id) - parseTimestamp(a.id));
      setTasks(finishedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch tasks when component mounts
  useEffect(() => {
    if (!isAuthenticated || !address) return;
    fetchTasks();

    // Add periodic refresh
    const intervalId = setInterval(() => {
      fetchTasks();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, address]);

  // Filter tasks based on selected filter
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-6">Finished Tasks</h1>

      {/* Authentication and Loading States */}
      {!isAuthenticated && (
        <div className="text-white">Please sign in to view your finished tasks.</div>
      )}
      {isAuthenticated && !address && (
        <div className="text-white">No wallet address found.</div>
      )}
      {loading && <div className="text-white">Loading tasks...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}

      {/* Main Content */}
      {isAuthenticated && address && !loading && (
        <div className="space-y-6">
          {/* Filter Controls */}
          <div className="flex space-x-4 mb-4">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              All Tasks
            </button>
            <button 
              onClick={() => setFilter('rewarded')}
              className={`px-4 py-2 rounded ${filter === 'rewarded' ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              Rewarded
            </button>
            <button 
              onClick={() => setFilter('refused')}
              className={`px-4 py-2 rounded ${filter === 'refused' ? 'bg-blue-600' : 'bg-gray-700'}`}
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
                      // Find the user's request (first message from user)
                      const userRequest = task.message_history?.find(msg => 
                        msg.direction === 'user_to_assistant'
                      )?.data || 'No request available';
                      
                      // Find the response (last message from assistant)
                      const assistantResponse = task.message_history
                        ?.filter(msg => msg.direction === 'assistant_to_user')
                        ?.pop()?.data || 'No response available';
                      
                      return (
                        <tr key={task.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="p-4 text-gray-300 font-mono align-top whitespace-nowrap">
                            {task.id}
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-md">
                            <div className="line-clamp-4">{userRequest}</div>
                          </td>
                          <td className="p-4 text-gray-300 align-top max-w-lg">
                            <div className="line-clamp-4">{assistantResponse}</div>
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