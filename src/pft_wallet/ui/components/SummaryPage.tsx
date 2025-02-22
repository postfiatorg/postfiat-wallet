import React, { useEffect, useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';
import { AuthContext } from '@/context/AuthContext';

interface AccountSummary {
  xrp_balance: number;
  pft_balance: number;
}

interface MessageHistoryItem {
  direction: string;
  data: string;
}

interface Task {
  id: string;
  status: string;
  message_history: MessageHistoryItem[];
}

const SummaryPage = () => {
  const { address } = useContext(AuthContext);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State variables for tasks (recent activity)
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Add this near the other state declarations (around line 19)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSummary = async () => {
      if (!address) {
        console.log("No address available");
        setLoading(false);
        return;
      }
      
      console.log("Fetching summary for address:", address);
      try {
        const response = await fetch(`http://localhost:8000/api/account/${address}/summary`);
        console.log("API Response:", response);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error:", errorText);
          throw new Error(`Failed to fetch account summary: ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Received summary:", data);
        setSummary(data);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [address]);

  // Start the refresh loop when the component mounts
  useEffect(() => {
    const startRefreshLoop = async () => {
      if (!address) return;
      
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
  }, [address]);

  // Add periodic frontend refresh (every 30 seconds)
  useEffect(() => {
    if (!address) return;

    const intervalId = setInterval(() => {
      fetchTasks();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [address]);

  // Extract fetchTasks into a separate function so we can reuse it
  const fetchTasks = async () => {
    if (!address) {
      setLoadingTasks(false);
      return;
    }
    
    try {
      console.log("=== Task Message Analysis ===");
      console.log("Fetching tasks for address:", address);
      
      const response = await fetch(`http://localhost:8000/api/tasks/${address}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch tasks: ${text}`);
      }
      const data = await response.json();
      console.log("Raw task data:", data);
      
      // When no status is provided, our API returns tasks grouped by status.
      // Flatten the results from an object into an array.
      const flattenedTasks = Object.values(data).flat();
      
      // Analyze message directions
      let userToNodeCount = 0;
      let nodeToUserCount = 0;
      
      (flattenedTasks as Task[]).forEach((task: Task) => {
        console.log("\nTask ID:", task.id);
        console.log("Status:", task.status);
        console.log("Message History:", task.message_history);
        
        // Count message directions
        task.message_history?.forEach((msg: MessageHistoryItem) => {
          if (msg.direction === 'outbound') {
            userToNodeCount++;
          } else if (msg.direction === 'inbound') {
            nodeToUserCount++;
          }
          console.log(`Message Direction: ${msg.direction}, Content: ${msg.data}`);
        });
      });
      
      console.log("\n=== Message Direction Summary ===");
      console.log(`User -> Node messages: ${userToNodeCount}`);
      console.log(`Node -> User messages: ${nodeToUserCount}`);
      console.log("Total tasks:", flattenedTasks.length);
      
      // Function to parse timestamp from task id. Adjust as needed.
      const parseTimestamp = (id: string): number => {
        const tsStr = id.split('__')[0]; // e.g., "2025-01-16_10:02"
        // Replace the first underscore (between date and time) with 'T' and append seconds (":00")
        const isoTimestamp = tsStr.replace('_', 'T') + ":00"; // becomes "2025-01-16T10:02:00"
        return new Date(isoTimestamp).getTime();
      };

      // Sort tasks by the extracted timestamp in descending order.
      (flattenedTasks as Task[]).sort((a: Task, b: Task) => {
        return parseTimestamp(b.id) - parseTimestamp(a.id);
      });
      
      setTasks(flattenedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasksError(
        error instanceof Error ? error.message : "An error occurred while fetching tasks"
      );
    } finally {
      setLoadingTasks(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [address]);

  // Add this effect to handle address changes
  useEffect(() => {
    if (!address) return;
    
    // Clear previous user's state when address changes
    const clearPreviousState = async () => {
      try {
        await fetch(`http://localhost:8000/api/tasks/clear-state/${address}`, {
          method: 'POST'
        });
        console.log("Cleared previous user state");
      } catch (error) {
        console.error("Failed to clear previous state:", error);
      }
    };
    
    clearPreviousState();
    fetchTasks(); // Fetch tasks for new user
  }, [address]);

  const balanceInfo = [
    {
      label: "XRP Balance",
      value: (typeof summary?.xrp_balance === 'number' 
        ? summary.xrp_balance.toFixed(6) 
        : parseFloat(summary?.xrp_balance || "0").toFixed(6))
    },
    {
      label: "PFT Balance",
      value: (typeof summary?.pft_balance === 'number'
        ? summary.pft_balance.toFixed(1)
        : parseFloat(summary?.pft_balance || "0").toFixed(1))
    }
  ];

  const accountDetails = [
    {
      label: "Account Address",
      value: address || "",
      copyable: true
    },
    {
      label: "Task Node",
      value: "r4yc85M1hwsegVGZ1pawpZPwj65SVs8PzD",
      copyable: true
    }
  ];

  // Function to copy text to the clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`Copied to clipboard: ${text}`);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Add this function before the return statement
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

  // Update the loading state render
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Skeleton for Balance Cards */}
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-900 border-slate-800 rounded-lg p-6 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-700 rounded"></div>
                <div className="h-8 w-32 bg-slate-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton for Account Details */}
        <div className="bg-slate-900 border-slate-800 rounded-lg">
          <div className="p-6 border-b border-slate-800">
            <div className="h-6 w-40 bg-slate-700 rounded animate-pulse"></div>
          </div>
          <div className="p-6 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-700 rounded"></div>
                  <div className="h-4 w-48 bg-slate-700 rounded"></div>
                </div>
                <div className="h-8 w-8 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton for Recent Activity */}
        <div className="bg-slate-900 border-slate-800 rounded-lg">
          <div className="p-6 border-b border-slate-800">
            <div className="h-6 w-40 bg-slate-700 rounded animate-pulse"></div>
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-slate-800/50 animate-pulse">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-slate-700 rounded"></div>
                    <div className="h-4 w-20 bg-slate-700 rounded"></div>
                  </div>
                  <div className="h-4 w-3/4 bg-slate-700 rounded"></div>
                  <div className="h-4 w-24 bg-slate-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
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

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="space-y-6 animate-fade-in">
        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-6">
          {balanceInfo.map((item) => (
            <Card key={item.label} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-slate-400">{item.label}</p>
                  <p className="text-2xl font-semibold text-white mt-1">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Account Details */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accountDetails.map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-400">{item.label}</p>
                    <p className="text-sm font-mono text-slate-200 mt-1">{item.value}</p>
                  </div>
                  {item.copyable && (
                    <button 
                      onClick={() => copyToClipboard(item.value)}
                      className="p-2 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {loadingTasks ? (
              <div className="text-white">Loading tasks...</div>
            ) : tasksError ? (
              <div className="text-red-500">Error: {tasksError}</div>
            ) : tasks.length === 0 ? (
              <div className="text-slate-500">No recent activity</div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const tsStr = task.id.split('__')[0];
                  const displayTs = tsStr.replace('_', ' ');
                  return (
                    <div key={task.id} className="p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                      <div 
                        className="cursor-pointer" 
                        onClick={() => toggleTaskExpansion(task.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-400">
                              {task.message_history && task.message_history.length > 0
                                ? task.message_history[0].direction.charAt(0).toUpperCase() + task.message_history[0].direction.slice(1)
                                : "Unknown"}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{task.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                              {task.status}
                            </span>
                            <svg 
                              className={`w-4 h-4 text-slate-400 transition-transform ${expandedTasks.has(task.id) ? 'transform rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">
                          {task.message_history && task.message_history.length > 0
                            ? task.message_history[0].data
                            : "No message available"}
                        </p>
                        <p className="text-xs text-slate-500">{displayTs}</p>
                      </div>
                      
                      {/* Message History Expansion */}
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SummaryPage;