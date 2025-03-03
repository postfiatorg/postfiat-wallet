import React, { useEffect, useState, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';
import { AuthContext } from '@/context/AuthContext';
import { apiService } from '../services/apiService';

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

interface AccountStatus {
  init_rite_status: string;
  context_doc_link: string | null;
  is_blacklisted: boolean;
  init_rite_statement: string | null;
  sweep_address: string | null;
}

// Add this interface for tasks response
interface TasksResponse {
  requested: any[];
  proposed: any[];
  accepted: any[];
  challenged: any[];
  completed: any[];
  refused: any[];
  [key: string]: any[];  // For any other task categories
}

// Add this interface near other interfaces at the top of the file
interface DecryptionResponse {
  status: string;
  link: string;
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

  // Add this near the other state declarations
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  // Add state for account status
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Add these state variables with the other state declarations
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    type: string;
    data: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Add a new function to decrypt the link
  const decryptDocumentLink = async (encryptedLink: string, password: string) => {
    try {
      const data = await apiService.post<DecryptionResponse>('/decrypt/doc_link', {
        account: address,
        password,
        encrypted_link: encryptedLink
      });
      
      return data.link;
    } catch (error) {
      console.error('Error decrypting link:', error);
      throw error;
    }
  };

  // Modify the openContextDoc function
  const openContextDoc = async (link: string) => {
    // Check if the link contains WHISPER__ anywhere in it
    if (link.includes('WHISPER__')) {
      // Extract the encrypted part (everything from WHISPER__ onwards)
      const encryptedPart = link.substring(link.indexOf('WHISPER__'));
      
      // Show password modal
      setShowPasswordModal(true);
      setCurrentAction({
        type: 'decrypt_link',
        data: { link: encryptedPart }
      });
    } else {
      // Open directly if not encrypted
      window.open(link, '_blank');
    }
  };

  // Add password modal handling
  const handlePasswordConfirm = async (password: string) => {
    if (currentAction?.type === 'decrypt_link') {
      try {
        setIsLoading(true);
        const decryptedLink = await decryptDocumentLink(
          currentAction.data.link, 
          password
        );
        window.open(decryptedLink, '_blank');
      } catch (error) {
        setError(`Failed to decrypt link: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
        setShowPasswordModal(false);
        setCurrentAction(null);
      }
    }
  };

  useEffect(() => {
    const fetchSummary = async () => {
      if (!address) {
        console.log("No address available");
        setLoading(false);
        return;
      }
      
      console.log("Fetching summary for address:", address);
      try {
        const data = await apiService.get<AccountSummary>(`/account/${address}/summary`);
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

  // Add effect to fetch account status
  useEffect(() => {
    const fetchAccountStatus = async () => {
      if (!address) {
        console.log("No address available for status check");
        setLoadingStatus(false);
        return;
      }
      
      console.log("Fetching account status for address:", address);
      try {
        const data = await apiService.get<AccountStatus>(`/account/${address}/status?refresh=true`);
        console.log("Received account status data:", JSON.stringify(data, null, 2));
        setAccountStatus(data);
      } catch (err) {
        console.error("Status fetch error:", err);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchAccountStatus();
  }, [address]);

  useEffect(() => {
    const startRefreshLoop = async () => {
      if (!address) return;
      
      const fetchTasks = async () => {
        try {
          setLoadingTasks(true);
          const data = await apiService.get<TasksResponse>(`/tasks/${address}`);
          
          // Combine tasks from all sections into a single array
          const allTasks = [
            ...(data.requested || []),
            ...(data.proposed || []),
            ...(data.accepted || []),
            ...(data.challenged || []),
            ...(data.completed || []),
            ...(data.refused || [])
          ];
          
          // Sort tasks by timestamp (extracted from task ID)
          const parseTimestamp = (id: string): number => {
            const tsStr = id.split('__')[0];
            const isoTimestamp = tsStr.replace('_', 'T') + ":00";
            return new Date(isoTimestamp).getTime();
          };
          
          allTasks.sort((a, b) => parseTimestamp(b.id) - parseTimestamp(a.id));
          
          // Take only the most recent tasks (up to 10)
          setTasks(allTasks.slice(0, 10));
          setTasksError(null);
        } catch (err) {
          console.error("Error fetching tasks:", err);
          setTasksError(err instanceof Error ? err.message : 'Failed to fetch tasks');
        } finally {
          setLoadingTasks(false);
        }
      };
      
      // Initial fetch
      await fetchTasks();
      
      // Set up interval for periodic refreshes
      const intervalId = setInterval(fetchTasks, 30000); // Refresh every 30 seconds
      
      // Clean up interval on component unmount
      return () => clearInterval(intervalId);
    };
    
    startRefreshLoop();
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

  // Add PostFiat status details
  const postfiatDetails = loadingStatus ? [] : [
    // Put initiation rite statement first
    ...(accountStatus?.init_rite_statement ? [{
      label: "Initiation Rite",
      value: `"${accountStatus.init_rite_statement}"`,
      className: "italic"
    }] : []),
    // Then show initiation status
    {
      label: "Initiation Status",
      value: accountStatus?.init_rite_status || "Unknown",
      className: accountStatus?.init_rite_status === 'COMPLETED' 
        ? 'text-green-400' 
        : accountStatus?.init_rite_status === 'PENDING' 
          ? 'text-yellow-400'
          : 'text-slate-200'
    },
    {
      label: "Blacklist Status",
      value: accountStatus?.is_blacklisted ? "BLACKLISTED" : "NOT BLACKLISTED",
      className: accountStatus?.is_blacklisted ? "text-red-400" : "text-green-400"
    },
    ...(accountStatus?.sweep_address ? [{
      label: "Sweep Address",
      value: accountStatus.sweep_address,
      copyable: true
    }] : []),
    ...(accountStatus?.context_doc_link ? [{
      label: "Context Document",
      value: "View Document",
      link: accountStatus.context_doc_link
    }] : [])
  ].filter(item => item); // Filter out any undefined items

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
  if (loading || loadingStatus) {
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
            
            {/* PostFiat Status Skeleton */}
            <div className="border-t border-slate-800 pt-4 mt-4">
              <div className="h-4 w-32 bg-slate-700 rounded mb-4 animate-pulse"></div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 mb-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-700 rounded"></div>
                    <div className="h-4 w-48 bg-slate-700 rounded"></div>
                  </div>
                  <div className="h-8 w-8 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
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
              
              {/* PostFiat Status Details */}
              {postfiatDetails.length > 0 && (
                <>
                  <div className="border-t border-slate-800 pt-4 mt-4">
                    <p className="text-sm font-medium text-slate-400 mb-4">Post Fiat Status</p>
                    
                    {postfiatDetails.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 mb-4">
                        <div>
                          <p className="text-sm font-medium text-slate-400">{item.label}</p>
                          {item.link ? (
                            <button
                              onClick={() => openContextDoc(item.link!)}
                              className="text-blue-400 hover:underline hover:text-blue-300 text-sm mt-1"
                            >
                              {item.value}
                            </button>
                          ) : (
                            <p className={`text-sm mt-1 ${item.className || "text-slate-200"}`}>
                              {item.value}
                            </p>
                          )}
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
                </>
              )}
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
                            {/* Filter out duplicate messages by creating a unique key from direction + data */}
                            {Array.from(new Map(
                              task.message_history.map((msg: MessageHistoryItem) => 
                                [`${msg.direction}:${msg.data}`, msg]
                              )
                            ).values()).map((msg, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="text-slate-400 font-medium">
                                  {(msg as MessageHistoryItem).direction.charAt(0).toUpperCase() + (msg as MessageHistoryItem).direction.slice(1)}:
                                </span>
                                <p className="text-slate-300 mt-1 pl-4">{(msg as MessageHistoryItem).data}</p>
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

      {/* Password confirmation modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Enter Password</h3>
            <p className="text-slate-400 mb-4">
              Your password is needed to decrypt the document link.
            </p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
              handlePasswordConfirm(password);
            }}>
              <input
                type="password"
                name="password"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white mb-4"
                placeholder="Your wallet password"
                required
              />
              
              {error && (
                <div className="text-red-400 mb-4">{error}</div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentAction(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SummaryPage;