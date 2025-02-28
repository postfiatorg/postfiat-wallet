import React, { useState, useContext, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';
import { AuthContext } from '../context/AuthContext';

import FinalVerificationModal from './modals/FinalVerificationModal';
import RefuseTaskModal from './modals/RefuseTaskModal';
import LogPomodoroModal from './modals/LogPomodoroModal';

// Add this interface near the top of the file
interface MessageHistoryItem {
  direction: string;
  data: string;
}

const VerificationPage = () => {
  const { isAuthenticated, address } = useContext(AuthContext);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [verificationDetails, setVerificationDetails] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [verificationPrompt, setVerificationPrompt] = useState<string>('');

  // Fetch tasks from the API
  const fetchTasks = async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    setIsRefreshing(true);
    try {
      // Add artificial delay for better UX
      const [response] = await Promise.all([
        fetch(`http://localhost:8000/api/tasks/${address}`),
        new Promise(resolve => setTimeout(resolve, 1000)) // Minimum 1 second refresh
      ]);
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch tasks: ${text}`);
      }
      const data = await response.json();

      // Only get challenged tasks
      let tasksToDisplay = data.challenged || [];

      // Sort tasks by timestamp
      const parseTimestamp = (id: string): number => {
        const tsStr = id.split('__')[0];
        const isoTimestamp = tsStr.replace('_', 'T') + ":00";
        return new Date(isoTimestamp).getTime();
      };

      tasksToDisplay.sort((a: any, b: any) => parseTimestamp(b.id) - parseTimestamp(a.id));
      setTasks(tasksToDisplay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch and refresh setup
  useEffect(() => {
    if (!isAuthenticated || !address) return;

    fetchTasks();
    const intervalId = setInterval(fetchTasks, 30000); // 30 seconds refresh

    return () => clearInterval(intervalId);
  }, [isAuthenticated, address]);

  useEffect(() => {
    // Set a default verification prompt or fetch it if needed
    setVerificationPrompt('Please provide verification details for this task.');
  }, []);

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleVerificationSubmit = (taskId: string, details: string) => {
    // Refresh tasks after submission
    fetchTasks();
  };

  const handleRefuseTask = (taskId: string, reason: string) => {
    // Refresh tasks after refusal
    fetchTasks();
  };

  const handleLogSubmit = async (details: string) => {
    setVerificationDetails(''); // Clear the input after submission
    // Optionally refresh tasks or show success message
    fetchTasks();
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Submit Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Task ID Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Task ID</label>
            <input
              type="text"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg 
                        text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                        focus:ring-emerald-500/50 focus:border-emerald-500/50"
              placeholder="Enter task ID"
            />
          </div>

          {/* Verification Details */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Verification Details</label>
            <textarea
              value={verificationDetails}
              onChange={(e) => setVerificationDetails(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                        text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                        focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
              placeholder="Enter verification details"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <button 
                onClick={() => setShowVerificationModal(true)}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 
                          text-white rounded-lg transition-colors text-sm font-medium">
                Submit Verification Details
              </button>
              <button 
                onClick={() => setShowRefuseModal(true)}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                          text-white rounded-lg transition-colors text-sm font-medium">
                Refuse
              </button>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => setShowLogModal(true)}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                          text-white rounded-lg transition-colors text-sm font-medium">
                Log Pomodoro
              </button>
              <button 
                onClick={() => fetchTasks()}
                disabled={isRefreshing}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                          text-white rounded-lg transition-all duration-200 text-sm font-medium
                          disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRefreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Updating...</span>
                  </>
                ) : (
                  'Force Update'
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification History */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Verification History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-slate-500">Loading tasks...</div>
          ) : error ? (
            <div className="text-red-500">Error: {error}</div>
          ) : tasks.length === 0 ? (
            <div className="text-slate-500">No tasks available for verification.</div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const tsStr = task.id.split('__')[0];
                const displayTs = tsStr.replace('_', ' ');
                const verificationMessage = task.message_history?.[4]?.data || "No verification message available";

                return (
                  <div 
                    key={task.id} 
                    className="p-4 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-800"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">{task.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                          Challenged
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskExpansion(task.id);
                        }}
                        className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white 
                                 bg-slate-700/50 hover:bg-slate-700 rounded-full transition-colors"
                      >
                        {expandedTasks.has(task.id) ? 'Hide Messages' : 'Show Messages'}
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-1">Verification Message</h3>
                        <p className="text-sm text-slate-300">{verificationMessage}</p>
                        <p className="text-xs text-slate-500 mt-2">{displayTs}</p>
                      </div>
                      
                      {expandedTasks.has(task.id) && task.message_history && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                          <h4 className="text-sm font-medium text-slate-400 mb-2">Message History</h4>
                          <div className="space-y-3">
                            {task.message_history.map((msg: MessageHistoryItem, idx: number) => (
                              <div key={idx} className="text-sm">
                                <span className="text-slate-400 font-medium">
                                  {msg.direction.charAt(0).toUpperCase() + msg.direction.slice(1)}:
                                </span>
                                <p className="text-slate-300 mt-1 pl-4">{msg.data}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <FinalVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        taskId={selectedTaskId}
        onSubmit={(taskId, details) => {
          handleVerificationSubmit(taskId, details);
          setVerificationDetails(''); // Clear the input after submission
        }}
        initialDetails={verificationDetails}
        verificationPrompt={verificationPrompt}
      />

      <RefuseTaskModal
        isOpen={showRefuseModal}
        onClose={() => setShowRefuseModal(false)}
        taskId={selectedTaskId}
        onRefuse={(taskId, reason) => {
          handleRefuseTask(taskId, reason);
          setVerificationDetails(''); // Clear the input after submission
        }}
        initialReason={verificationDetails}
      />

      <LogPomodoroModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSubmit={handleLogSubmit}
        initialDetails={verificationDetails}
      />
    </div>
  );
};

export default VerificationPage;