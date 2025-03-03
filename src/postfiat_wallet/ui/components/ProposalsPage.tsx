'use client';

import React, { useState, useContext, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';
import { AuthContext } from '../context/AuthContext';
import AcceptTaskModal from './modals/AcceptTaskModal';
import { RequestTaskModal } from './modals/RequestTaskModal';
import RefuseTaskModal from './modals/RefuseTaskModal';
import SubmitVerificationModal from './modals/SubmitVerificationModal';
import FinalVerificationModal from './modals/FinalVerificationModal';
import LogPomodoroModal from './modals/LogPomodoroModal';
import { apiService } from '../services/apiService';

// Add interface near top of file
interface MessageHistoryItem {
  direction: string;
  data: string;
}

// Add interface for the tasks API response
interface TasksResponse {
  requested: any[];
  proposed: any[];
  accepted: any[];
  challenged: any[];
  refused: any[];
  [key: string]: any[];  // For any other categories
}

const ProposalsPage = () => {
  const { isAuthenticated, address, username, password } = useContext(AuthContext);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRefused, setShowRefused] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [modalState, setModalState] = useState({
    accept: false,
    request: false,
    refuse: false,
    verify: false,
    finalVerify: false,
    logPomodoro: false,
    verificationPrompt: ''
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Fetch tasks from the API
  const fetchTasks = async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    setIsRefreshing(true);
    setError(null); // Clear any previous errors
    try {
      // Add artificial delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000)); // Minimum 1 second refresh
      
      const data = await apiService.get<TasksResponse>(`/tasks/${address}`);

      // Combine tasks from allowed statuses
      let tasksToDisplay = [
        ...data.requested || [],
        ...data.proposed || [],
        ...data.accepted || [],
        ...data.challenged || [],
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
    } catch (error) {
      console.error("Error fetching tasks:", error);
      // Instead of toast, set the error state
      setError(error instanceof Error ? error.message : "Failed to fetch tasks");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // Start the refresh loop when the component mounts
  useEffect(() => {
    if (!isAuthenticated || !address) return;

    const startRefreshLoop = async () => {
      try {
        await apiService.post(`/tasks/start-refresh/${address}`);
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
        apiService.post(`/tasks/stop-refresh/${address}`)
          .catch(error => {
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

  const toggleMessageExpansion = (taskId: string) => {
    setExpandedMessages(prev => {
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
    if (modalType !== 'request' && modalType !== 'logPomodoro' && (!selectedTaskId || !tasks.some(task => task.id === selectedTaskId))) {
      setModalError('Please select a valid task first');
      return;
    }
    setModalError(null);
    
    // Get verification prompt for the selected task if opening verification modal
    let verificationPrompt = '';
    if (modalType === 'verify' || modalType === 'finalVerify') {
      const selectedTask = tasks.find(task => task.id === selectedTaskId);
      if (selectedTask?.message_history) {
        // Search for message containing "VERIFICATION PROMPT"
        const promptMessage = selectedTask.message_history.find(
          (msg: MessageHistoryItem) => msg.data.includes("VERIFICATION PROMPT")
        );
        
        // If found, use it
        if (promptMessage) {
          verificationPrompt = promptMessage.data;
        } 
        // Fallback to message at index 4 if it exists
        else if (selectedTask.message_history.length >= 5) {
          verificationPrompt = selectedTask.message_history[4].data;
        }
      }
    }
    
    setModalState({ 
      ...modalState, 
      [modalType]: true,
      verificationPrompt: verificationPrompt
    });
  };

  const handleModalClose = (modalType: keyof typeof modalState) => {
    setModalState({ ...modalState, [modalType]: false });
    setModalError(null);
  };

  // Task action handlers
  const handleAcceptTask = async (taskId: string, message: string) => {
    try {
      // TODO: Implement accept task API call
      console.log('Accepting task:', taskId, message);
      handleModalClose('accept');
      await fetchTasks();
      
      // Remove task from current list until refresh completes
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error accepting task:', error);
    }
  };

  const handleRequestTask = async (message: string) => {
    try {
      // TODO: Implement request task API call
      console.log('Requesting task:', message);
      handleModalClose('request');
      await fetchTasks();
    } catch (error) {
      console.error('Error requesting task:', error);
    }
  };

  const handleRefuseTask = async (taskId: string, reason: string) => {
    try {
      // TODO: Implement refuse task API call
      console.log('Refusing task:', taskId, reason);
      handleModalClose('refuse');
      
      // Remove task from current list until refresh completes
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      await fetchTasks();
    } catch (error) {
      console.error('Error refusing task:', error);
    }
  };

  const handleSubmitVerification = async (taskId: string, details: string) => {
    try {
      // The actual submission is now handled in the modal
      console.log('Verification submitted:', taskId, details);
      handleModalClose('verify');
      
      // Remove task from current list until refresh completes
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      await fetchTasks(); // Refresh the task list
    } catch (error) {
      console.error('Error handling verification submission:', error);
    }
  };

  const handleFinalVerification = async (taskId: string, details: string) => {
    try {
      console.log('Final verification submitted:', taskId, details);
      handleModalClose('finalVerify');
      
      // Remove task from current list until refresh completes
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      await fetchTasks();
    } catch (error) {
      console.error('Error handling final verification:', error);
    }
  };

  const handleLogPomodoro = async (details: string) => {
    try {
      console.log('Pomodoro logged:', details);
      handleModalClose('logPomodoro');
      await fetchTasks();
    } catch (error) {
      console.error('Error logging pomodoro:', error);
    }
  };

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'all') return true;
    return task.status === activeTab;
  });

  // Get the main message to display for a task
  const getMainMessage = (task: any) => {
    if (!task.message_history?.length) return "No message available";
    
    // For all tasks, find the first message that starts with "PROPOSED PF"
    // This ensures we show the actual proposal content, not the request
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

  // Truncate text with "Show more" option
  const truncateText = (text: string, taskId: string) => {
    const maxLength = 300;
    if (text.length <= maxLength || expandedMessages.has(taskId)) {
      return <p className="text-sm text-slate-300">{text}</p>;
    }
    
    return (
      <div>
        <p className="text-sm text-slate-300">{text.substring(0, maxLength)}...</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleMessageExpansion(taskId);
          }}
          className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
        >
          Show more
        </button>
      </div>
    );
  };

  // Render task action buttons based on status
  const renderTaskActions = (task: any) => {
    switch (task.status) {
      case 'proposed':
        return (
          <div className="flex gap-2 mt-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('accept');
              }}
              className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 
                        text-white rounded-lg transition-colors"
            >
              Accept
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('refuse');
              }}
              className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 
                        text-white rounded-lg transition-colors"
            >
              Refuse
            </button>
          </div>
        );
      case 'accepted':
        return (
          <div className="flex gap-2 mt-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('verify');
              }}
              className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 
                        text-white rounded-lg transition-colors"
            >
              Submit for Verification
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('refuse');
              }}
              className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 
                        text-white rounded-lg transition-colors"
            >
              Refuse
            </button>
          </div>
        );
      case 'challenged':
        return (
          <div className="flex gap-2 mt-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('finalVerify');
              }}
              className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 
                        text-white rounded-lg transition-colors"
            >
              Submit Verification Details
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTaskId(task.id);
                handleModalOpen('refuse');
              }}
              className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 
                        text-white rounded-lg transition-colors"
            >
              Refuse
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Filter Controls and Action Buttons Skeleton */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-24 bg-slate-800 rounded-lg animate-pulse"></div>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-28 bg-emerald-600/50 rounded-lg animate-pulse"></div>
            <div className="h-10 w-24 bg-slate-800 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Tasks List Skeleton */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-slate-800/50">
                <div className="space-y-4">
                  {/* Task Header Skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-48 bg-slate-700 rounded animate-pulse"></div>
                      <div className="h-5 w-20 bg-blue-500/10 rounded-full animate-pulse"></div>
                    </div>
                    <div className="h-7 w-28 bg-slate-700 rounded-full animate-pulse"></div>
                  </div>

                  {/* Task Content Skeleton */}
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-4 w-3/4 bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-4 w-1/2 bg-slate-700 rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-slate-700 rounded animate-pulse mt-2"></div>
                  </div>
                  
                  {/* Task Actions Skeleton */}
                  <div className="flex gap-2 mt-3">
                    <div className="h-7 w-24 bg-emerald-600/50 rounded-lg animate-pulse"></div>
                    <div className="h-7 w-20 bg-slate-700 rounded-lg animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <>
      <style>{styles}</style>
      <div className="space-y-6">
        {!isAuthenticated && (
          <div className="text-white">Please sign in to view tasks.</div>
        )}
        {isAuthenticated && !address && (
          <div className="text-white">No wallet address found.</div>
        )}
        
        {/* Display error message if there is one */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {isAuthenticated && address && !loading && (
          <>
            {/* Modal Error Message */}
            {modalError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm">{modalError}</p>
              </div>
            )}

            {/* Filter Controls and Action Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'all' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All Tasks
                </button>
                <button
                  onClick={() => setActiveTab('proposed')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'proposed' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Proposed
                </button>
                <button
                  onClick={() => setActiveTab('accepted')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'accepted' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Accepted
                </button>
                <button
                  onClick={() => setActiveTab('challenged')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'challenged' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Verification
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleModalOpen('request')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                           text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Request Task
                </button>
                <button 
                  onClick={() => fetchTasks()}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 
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
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    'Refresh'
                  )}
                </button>
              </div>
            </div>

            {/* Tasks List */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-white">Active Tasks</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {filteredTasks.length === 0 ? (
                  <div className="text-slate-500">No tasks available.</div>
                ) : (
                  <div className="space-y-4">
                    {filteredTasks.map((task) => {
                      const tsStr = task.id.split('__')[0];
                      const displayTs = tsStr.replace('_', ' ');
                      const mainMessage = getMainMessage(task);

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
                                    : task.status === 'challenged'
                                    ? 'bg-purple-500/10 text-purple-400'
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
                              {truncateText(mainMessage, task.id)}
                              <p className="text-xs text-slate-500 mt-2">{displayTs}</p>
                            </div>
                            
                            {/* Task Action Buttons */}
                            {renderTaskActions(task)}
                            
                            {/* Message History Expansion */}
                            {expandedTasks.has(task.id) && task.message_history && (
                              <div className="mt-4 pt-4 border-t border-slate-700">
                                <h4 className="text-sm font-medium text-slate-400 mb-2">Message History</h4>
                                <div className="space-y-3">
                                  {/* Filter out duplicate messages by creating a unique key from direction + data */}
                                  {Array.from(new Map(
                                    task.message_history.map((msg: MessageHistoryItem) => 
                                      [`${msg.direction}:${msg.data}`, msg]
                                    )
                                  ).values()).map((msg, idx) => (
                                    <div key={idx} className="text-sm">
                                      <span className="text-slate-400 font-medium">
                                        {(msg as MessageHistoryItem).direction}:
                                      </span>
                                      <p className="text-slate-300 mt-1 pl-4">{(msg as MessageHistoryItem).data}</p>
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
              onAccept={(taskId, message) => {
                handleAcceptTask(taskId, message);
              }}
              initialMessage=""
            />
            <RequestTaskModal
              isOpen={modalState.request}
              onClose={() => handleModalClose('request')}
              onRequest={(message) => {
                handleRequestTask(message);
              }}
              initialMessage=""
            />
            <RefuseTaskModal
              isOpen={modalState.refuse}
              onClose={() => handleModalClose('refuse')}
              taskId={selectedTaskId}
              onRefuse={(taskId, reason) => {
                handleRefuseTask(taskId, reason);
              }}
              initialReason=""
            />
            <SubmitVerificationModal
              isOpen={modalState.verify}
              onClose={() => handleModalClose('verify')}
              taskId={selectedTaskId}
              onSubmit={(taskId, details) => {
                handleSubmitVerification(taskId, details);
              }}
              initialDetails=""
            />
            <FinalVerificationModal
              isOpen={modalState.finalVerify}
              onClose={() => handleModalClose('finalVerify')}
              taskId={selectedTaskId}
              onSubmit={(taskId, details) => {
                handleFinalVerification(taskId, details);
              }}
              initialDetails=""
              verificationPrompt={modalState.verificationPrompt}
            />
            <LogPomodoroModal
              isOpen={modalState.logPomodoro}
              onClose={() => handleModalClose('logPomodoro')}
              onSubmit={handleLogPomodoro}
              initialDetails=""
            />
          </>
        )}
      </div>
    </>
  );
};

export default ProposalsPage;