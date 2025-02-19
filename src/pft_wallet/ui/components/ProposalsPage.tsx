'use client';

import React, { useState, useContext, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';
import { AuthContext } from '../context/AuthContext';
import AcceptTaskModal from './modals/AcceptTaskModal';
import { RequestTaskModal } from './modals/RequestTaskModal';
import RefuseTaskModal from './modals/RefuseTaskModal';
import SubmitVerificationModal from './modals/SubmitVerificationModal';

const ProposalsPage = () => {
  const { isAuthenticated, address, username, password } = useContext(AuthContext);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRefused, setShowRefused] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [modalState, setModalState] = useState({
    accept: false,
    request: false,
    refuse: false,
    verify: false
  });
  const [modalError, setModalError] = useState<string | null>(null);

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

      // Combine tasks from allowed statuses
      let tasksToDisplay = [
        ...data.requested || [],
        ...data.proposed || [],
        ...data.accepted || [],
        ...(showRefused ? data.refused || [] : [])
      ];

      // Sort tasks by timestamp (extracted from task ID)
      const parseTimestamp = (id: string): number => {
        const tsStr = id.split('__')[0];
        const isoTimestamp = tsStr.replace('_', 'T') + ":00";
        return new Date(isoTimestamp).getTime();
      };

      tasksToDisplay.sort((a, b) => parseTimestamp(b.id) - parseTimestamp(a.id));
      setTasks(tasksToDisplay);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Start the refresh loop when the component mounts
  useEffect(() => {
    if (!isAuthenticated || !address) return;

    const startRefreshLoop = async () => {
      try {
        await fetch(`http://localhost:8000/api/tasks/start-refresh/${address}`, {
          method: 'POST'
        });
        console.log("Started task refresh loop");
      } catch (error) {
        console.error("Failed to start refresh loop:", error);
      }
    };

    startRefreshLoop();
    fetchTasks();

    // Cleanup: stop the refresh loop when component unmounts
    return () => {
      if (address) {
        fetch(`http://localhost:8000/api/tasks/stop-refresh/${address}`, {
          method: 'POST'
        }).catch(error => {
          console.error("Failed to stop refresh loop:", error);
        });
      }
    };
  }, [isAuthenticated, address]);

  // Add periodic frontend refresh (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated || !address) return;

    const intervalId = setInterval(() => {
      fetchTasks();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, address]);

  // Refetch when showRefused changes
  useEffect(() => {
    fetchTasks();
  }, [showRefused]);

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

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  // Modal handlers
  const handleModalOpen = (modalType: keyof typeof modalState) => {
    if (modalType !== 'request' && (!selectedTaskId || !tasks.some(task => task.id === selectedTaskId))) {
      setModalError('Please select a valid task first');
      return;
    }
    setModalError(null);
    setModalState({ ...modalState, [modalType]: true });
  };

  const handleModalClose = (modalType: keyof typeof modalState) => {
    setModalState({ ...modalState, [modalType]: false });
    setModalError(null);
  };

  // Task action handlers
  const handleAcceptTask = async (taskId: string, message: string) => {
    // TODO: Implement accept task API call
    console.log('Accepting task:', taskId, message);
    handleModalClose('accept');
  };

  const handleRequestTask = async (message: string) => {
    // TODO: Implement request task API call
    console.log('Requesting task:', message);
    handleModalClose('request');
  };

  const handleRefuseTask = async (taskId: string, reason: string) => {
    // TODO: Implement refuse task API call
    console.log('Refusing task:', taskId, reason);
    handleModalClose('refuse');
  };

  const handleSubmitVerification = async (taskId: string, details: string) => {
    try {
      // The actual submission is now handled in the modal
      console.log('Verification submitted:', taskId, details);
      handleModalClose('verify');
      await fetchTasks(); // Refresh the task list
    } catch (error) {
      console.error('Error handling verification submission:', error);
    }
  };

  return (
    <div className="space-y-6">
      {!isAuthenticated && (
        <div className="text-white">Please sign in to view tasks.</div>
      )}
      {isAuthenticated && !address && (
        <div className="text-white">No wallet address found.</div>
      )}
      {loading && <div className="text-white">Loading tasks...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}
      {isAuthenticated && address && !loading && (
        <>
          {/* Error Message */}
          {modalError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm">{modalError}</p>
            </div>
          )}

          {/* Input Section */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Task Actions</CardTitle>
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

              {/* Task Details */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Task Details</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                            text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                            focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
                  placeholder="Enter task details"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <button 
                    onClick={() => handleModalOpen('request')}
                    className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 
                             text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Request Task
                  </button>
                  <button 
                    onClick={() => handleModalOpen('refuse')}
                    className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                             text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Refuse Task
                  </button>
                </div>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleModalOpen('accept')}
                    className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 
                             text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Accept Task
                  </button>
                  <button 
                    onClick={() => handleModalOpen('verify')}
                    className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                             text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Submit for Verification
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter Controls */}
          <div className="flex justify-end">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={showRefused}
                onChange={(e) => setShowRefused(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
              />
              Show Refused Tasks
            </label>
          </div>

          {/* Tasks List */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-slate-500">No tasks available.</div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => {
                    const tsStr = task.id.split('__')[0];
                    const displayTs = tsStr.replace('_', ' ');

                    // Determine which message to show based on status
                    let mainMessage = "No message available";
                    if (task.message_history?.length > 0) {
                      if (task.status === 'accepted' && task.message_history.length >= 3) {
                        mainMessage = task.message_history[2].data;
                      } else if (task.status === 'proposed' && task.message_history.length >= 2) {
                        mainMessage = task.message_history[1].data;
                      } else {
                        mainMessage = task.message_history[0].data;
                      }
                    }

                    return (
                      <div 
                        key={task.id} 
                        className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                        onClick={() => handleTaskClick(task.id)}
                      >
                        <div className="space-y-4">
                          {/* Header with ID and Status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-500">{task.id}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                task.status === 'accepted'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : task.status === 'requested'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : task.status === 'proposed'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}>
                                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
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

                          {/* Main Message */}
                          <div>
                            <p className="text-sm text-slate-300">{mainMessage}</p>
                            <p className="text-xs text-slate-500 mt-2">{displayTs}</p>
                          </div>
                          
                          {/* Message History Expansion */}
                          {expandedTasks.has(task.id) && task.message_history && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                              <h4 className="text-sm font-medium text-slate-400 mb-2">Message History</h4>
                              <div className="space-y-3">
                                {task.message_history.map((msg, idx) => (
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

          {/* Modals */}
          <AcceptTaskModal
            isOpen={modalState.accept}
            onClose={() => handleModalClose('accept')}
            taskId={selectedTaskId}
            onAccept={handleAcceptTask}
          />
          <RequestTaskModal
            isOpen={modalState.request}
            onClose={() => handleModalClose('request')}
            onRequest={handleRequestTask}
          />
          <RefuseTaskModal
            isOpen={modalState.refuse}
            onClose={() => handleModalClose('refuse')}
            taskId={selectedTaskId}
            onRefuse={handleRefuseTask}
          />
          <SubmitVerificationModal
            isOpen={modalState.verify}
            onClose={() => handleModalClose('verify')}
            taskId={selectedTaskId}
            onSubmit={handleSubmitVerification}
          />
        </>
      )}
    </div>
  );
};

export default ProposalsPage;