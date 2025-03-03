import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { PasswordConfirmModal } from './modals/PasswordConfirmModal';
import DecryptMessagesModal from './modals/DecryptMessagesModal';
import { apiService } from '../services/apiService';

// Add interfaces for API responses
interface MessagesResponse {
  status: string;
  messages: Message[];
}

interface SendMessageResponse {
  status: string;
  message_id: string;
}

interface SendLogResponse {
  status: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

interface Thread {
  address: string;
  displayName: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
}

interface MemosPageProps {
  address: string;
}

const MemosPage: React.FC<MemosPageProps> = ({ address }) => {
  const auth = useContext(AuthContext);
  const ODV_ADDRESS = 'rJ1mBMhEBKack5uTQvM8vWoAntbufyG9Yn';
  const [activeMode, setActiveMode] = useState<'odv' | 'logging'>('odv');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add a new state to track initial fetch with stored password
  const [initialFetching, setInitialFetching] = useState(false);
  
  // Replace password modal state with decrypt modal state
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [decryptError, setDecryptError] = useState<string | undefined>();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<'sendMessage' | 'sendLog' | 'decryptMessages' | null>(null);
  
  // Message decryption state
  const [messagesDecrypted, setMessagesDecrypted] = useState(false);
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);

  // Add this new state variable near other state declarations
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState('');

  const [threads, setThreads] = useState<Thread[]>([
    {
      address: ODV_ADDRESS,
      displayName: 'ODV',
      lastMessage: 'Greetings. I am ODV, a mediator between you and Future AI. I\'m here to help translate strategic insights focused on life extension and wealth creation. How may I assist you today?',
      timestamp: Date.now(),
      unread: 0
    }
  ]);

  const [selectedThread, setSelectedThread] = useState<string>('ODV');
  const [showModal, setShowModal] = useState(false);
  const [selectedThreadForModal, setSelectedThreadForModal] = useState<Thread | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      from: 'ODV',
      to: address,
      content: 'Greetings. I am ODV, a mediator between you and Future AI. I\'m here to help translate strategic insights focused on life extension and wealth creation. How may I assist you today?',
      timestamp: Date.now() - 1000
    }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const [refreshTimeoutId, setRefreshTimeoutId] = useState<number | null>(null);

  // Add a ref for the messages container
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Add an effect to initialize scroll position after messages load
  useEffect(() => {
    if (messagesDecrypted && messages.length > 0 && !isLoading && !initialFetching) {
      // Set scroll to bottom when messages are first loaded
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messages, messagesDecrypted, isLoading, initialFetching]);

  // Modify fetchMessages to include a forceRefresh parameter
  const fetchMessages = async (password?: string, forceRefresh: boolean = false) => {
    if (!address) return;
    
    // Use auth context password if available and no specific password provided
    const passwordToUse = password || sessionPassword || auth.password;
    
    // If no password is available, show the decrypt modal
    if (!passwordToUse) {
      setDecryptError(undefined);
      setShowDecryptModal(true);
      return;
    }
    
    setIsRefreshing(true);
    try {
      // Add artificial delay for better UX
      const [response] = await Promise.all([
        apiService.post<MessagesResponse>(`/odv/messages/${address}`, {
          password: passwordToUse,
          refresh: forceRefresh // Add this parameter to request fresh data
        }),
        new Promise(resolve => setTimeout(resolve, 1000)) // Minimum 1 second refresh
      ]);
      
      if (response.status === 'success') {
        // Transform API messages to our format
        const apiMessages = response.messages.map((msg: any) => ({
          id: msg.id,
          from: msg.from,
          to: msg.to,
          content: msg.content,
          timestamp: msg.timestamp
        }));
        
        setMessages(apiMessages);
        
        // Update thread with last message if we have any
        if (apiMessages.length > 0) {
          const lastMsg = apiMessages[apiMessages.length - 1];
          setThreads(prev => prev.map(thread => 
            thread.address === ODV_ADDRESS 
              ? { 
                  ...thread, 
                  lastMessage: lastMsg.content, 
                  timestamp: lastMsg.timestamp,
                  unread: 0
                }
              : thread
          ));
        }
        
        // Always mark messages as decrypted on success and store password
        setMessagesDecrypted(true);
        
        // Store the password if it's new
        if (password && !sessionPassword) {
          setSessionPassword(password);
          // Also update in auth context
          if (auth.setPassword) {
            auth.setPassword(password);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      if (pendingAction === 'decryptMessages') {
        setPasswordError(err instanceof Error ? err.message : 'Failed to decrypt messages');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setInitialFetching(false); // Clear initialFetching state when done
    }
  };
  
  // Update scheduleRefresh to force refresh
  const scheduleRefresh = (delayMs = 5000) => {
    // Clear any existing timeout
    if (refreshTimeoutId !== null) {
      clearTimeout(refreshTimeoutId);
    }
    
    // Set new timeout
    const timeoutId = window.setTimeout(() => {
      fetchMessages(undefined, true); // Pass true to force refresh from blockchain
      setRefreshTimeoutId(null);
    }, delayMs);
    
    setRefreshTimeoutId(Number(timeoutId));
  };

  // Update the periodic refresh to force a refresh from blockchain
  useEffect(() => {
    if (!address || !messagesDecrypted) return;
    
    // Set up periodic refresh
    const intervalId = setInterval(() => {
      fetchMessages(undefined, true); // Pass true to force refresh from blockchain
    }, 30000); // 30 seconds
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [address, messagesDecrypted]);

  // Handle password confirmation
  const handlePasswordConfirm = async (password: string) => {
    try {
      if (pendingAction === 'sendMessage') {
        await executeSendMessage(password);
        // Save password for future use if successful
        if (!sessionPassword) {
          setSessionPassword(password);
          // Also update in auth context
          if (auth.setPassword) {
            auth.setPassword(password);
          }
        }
      } else if (pendingAction === 'sendLog') {
        await executeSendLog(password);
        // Save password for future use if successful
        if (!sessionPassword) {
          setSessionPassword(password);
          // Also update in auth context
          if (auth.setPassword) {
            auth.setPassword(password);
          }
        }
      } else if (pendingAction === 'decryptMessages') {
        await fetchMessages(password);
        // fetchMessages already handles storing the password
      }
      setShowPasswordModal(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Password operation failed:', error);
      // Don't close modal if there's an error
    }
  };
  
  // Execute sending message with confirmed password
  const executeSendMessage = async (password: string) => {
    if (!newMessage.trim() || !address) {
      setError('Please enter a message');
      return;
    }
    
    setIsLoading(true);
    try {
      // Add detailed logging before sending
      const requestData = {
        account: address,
        password: password,
        message: newMessage.trim(),
        amount_pft: 1 // Set to 1 PFT to ensure we have valid amount
      };
      
      console.log('Sending message request:', {
        url: '/odv/send_message',
        method: 'POST',
        body: JSON.stringify({
          ...requestData,
          password: '[REDACTED]' // Don't log actual password
        })
      });
      
      const data = await apiService.post<SendMessageResponse>('/odv/send_message', requestData);
      
      console.log('Parsed response data:', data);
      
      if (data.status === 'success') {
        // Add message to UI immediately (optimistic update)
        const newMsg: Message = {
          id: data.message_id,
          from: address,
          to: ODV_ADDRESS,
          content: newMessage.trim(),
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        
        // Update thread with last message
        setThreads(prev => prev.map(thread => 
          thread.address === ODV_ADDRESS 
            ? { 
                ...thread, 
                lastMessage: newMessage.trim(), 
                timestamp: Date.now(),
                unread: 0
              }
            : thread
        ));
        
        // Schedule a refresh after a few seconds to get response
        scheduleRefresh(5000);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Add more detailed logging for the error
      if (err instanceof Error) {
        console.log('Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      } else {
        console.log('Unknown error type:', err);
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPasswordError(err instanceof Error ? err.message : 'Failed to send message');
      throw err; // Re-throw to handle in calling function
    } finally {
      setIsLoading(false);
    }
  };

  // Execute sending log with confirmed password
  const executeSendLog = async (password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiService.post<SendLogResponse>('/odv/send_log', {
        account: address,
        password: password,
        log_content: newMessage.trim(),
        amount_pft: 1.0  // Update to send 1 PFT with logs, same as messages
      });
      
      // Add the message to the UI immediately
      const newMsg: Message = {
        id: `local_${Date.now()}`,
        from: address,
        to: ODV_ADDRESS,
        content: newMessage.trim(),
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      
      // Store password for the session
      if (!sessionPassword) {
        setSessionPassword(password);
      }
      
      // Feedback to user
      console.log('Log sent:', data);
      
      // Refresh after a short delay
      scheduleRefresh(3000);
      
    } catch (err) {
      console.error('Error sending log:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare to send message (show password modal only if needed)
  const sendMessageToODV = () => {
    if (!newMessage.trim()) {
      setError('Please enter a message');
      return;
    }
    
    // First check auth context password, then session password
    const storedPassword = auth.password || sessionPassword;
    
    // If we already have a password, use it directly
    if (storedPassword) {
      executeSendMessage(storedPassword).catch(() => {
        // If using stored password fails, ask for it again
        setPendingAction('sendMessage');
        setPasswordError('Stored password is invalid. Please enter your password again.');
        setShowPasswordModal(true);
        setSessionPassword(null); // Clear invalid password
        // Also clear from auth context
        if (auth.setPassword) {
          auth.setPassword('');
        }
      });
    } else {
      setPendingAction('sendMessage');
      setPasswordError(undefined);
      setShowPasswordModal(true);
    }
  };

  // Prepare to send log (show password modal only if needed)
  const sendLogEntry = () => {
    if (!newMessage.trim()) {
      setError('Please enter a log message');
      return;
    }
    
    // First check auth context password, then session password
    const storedPassword = auth.password || sessionPassword;
    
    // If we already have a password, use it directly
    if (storedPassword) {
      executeSendLog(storedPassword).catch(() => {
        // If using stored password fails, ask for it again
        setPendingAction('sendLog');
        setPasswordError('Stored password is invalid. Please enter your password again.');
        setShowPasswordModal(true);
        setSessionPassword(null); // Clear invalid password
        // Also clear from auth context
        if (auth.setPassword) {
          auth.setPassword('');
        }
      });
    } else {
      setPendingAction('sendLog');
      setPasswordError(undefined);
      setShowPasswordModal(true);
    }
  };

  // Update the handleSendMessage function to handle both modes
  const handleSendMessage = () => {
    if (activeMode === 'odv') {
      sendMessageToODV();
    } else if (activeMode === 'logging') {
      sendLogEntry();
    }
  };
  
  // Update the handleDecrypt function to show loading state
  const handleDecrypt = async (password: string) => {
    setIsDecrypting(true); // Set decrypt button to loading state
    try {
      await fetchMessages(password);
      setShowDecryptModal(false);
      // Password is saved within fetchMessages if successful
    } catch (err) {
      console.error('Error decrypting messages:', err);
      setDecryptError(err instanceof Error ? err.message : 'Failed to decrypt messages');
    } finally {
      setIsDecrypting(false); // Reset decrypt button state
    }
  };
  
  // Prompt for decryption password when component mounts
  useEffect(() => {
    if (!address) return;
    
    // Check auth context password first, then session password
    if (auth.password) {
      setInitialFetching(true); // Set initialFetching to true when using stored password
      fetchMessages(auth.password).catch(() => {
        // If using stored password fails, clear it and show decrypt modal
        setSessionPassword(null);
        if (auth.setPassword) {
          auth.setPassword('');
        }
        setMessagesDecrypted(false);
        setInitialFetching(false); // Clear initialFetching state on error
        setDecryptError('Stored password is invalid. Please enter your password again.');
        setShowDecryptModal(true);
      });
    } else if (sessionPassword) {
      setInitialFetching(true); // Set initialFetching to true when using stored password
      fetchMessages(sessionPassword).catch(() => {
        // Handle failed session password similarly
        setSessionPassword(null);
        setMessagesDecrypted(false);
        setInitialFetching(false); // Clear initialFetching state on error
        setDecryptError('Stored password is invalid. Please enter your password again.');
        setShowDecryptModal(true);
      });
    } else if (!messagesDecrypted) {
      setDecryptError(undefined);
      setShowDecryptModal(true);
    }
  }, [address]);

  const handleInfoClick = (thread: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThreadForModal(thread);
    setNewDisplayName(thread.displayName);
    setShowModal(true);
  };

  const handleSaveDisplayName = () => {
    if (selectedThreadForModal && newDisplayName.trim()) {
      setThreads(threads.map(thread => 
        thread.address === selectedThreadForModal.address 
          ? { ...thread, displayName: newDisplayName.trim() }
          : thread
      ));
      setShowModal(false);
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-120px)] overflow-hidden">
        {/* Threads sidebar */}
        <div className="w-1/4 min-w-[250px] border-r border-slate-700 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {threads.map((thread) => (
              <div
                key={thread.address}
                onClick={() => setSelectedThread(thread.address)}
                className={`p-4 cursor-pointer hover:bg-slate-800 relative ${
                  selectedThread === thread.address ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-medium text-slate-200">{thread.displayName}</div>
                  <button
                    onClick={(e) => handleInfoClick(thread, e)}
                    className="text-slate-400 hover:text-slate-200 p-1 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-4 h-4"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </button>
                </div>
                <div className="text-sm text-slate-400 truncate">{thread.lastMessage}</div>
              </div>
            ))}
          </div>
          
          {/* Mode toggle - both options visible */}
          <div className="border-t border-slate-700 p-4 sticky bottom-0 bg-slate-900">
            <div className="flex rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveMode('odv')}
                className={`flex-1 py-2 px-3 flex justify-center items-center transition-colors ${
                  activeMode === 'odv' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ODV Chat
              </button>
              <button
                onClick={() => setActiveMode('logging')}
                className={`flex-1 py-2 px-3 flex justify-center items-center transition-colors ${
                  activeMode === 'logging' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Logging
              </button>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Error message display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 m-4">
                  <p className="text-red-400 text-sm">{error}</p>
                  <button 
                    className="text-xs text-red-400 hover:text-red-300 mt-2"
                    onClick={() => setError(null)}
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {/* Messages container - add ref here */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {/* Show loading state when initially fetching with stored password */}
                {initialFetching || isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="mt-4 text-slate-400">Loading messages...</p>
                  </div>
                ) : !messagesDecrypted ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <p>Messages need to be decrypted</p>
                    <button
                      onClick={() => {
                        setDecryptError(undefined);
                        setShowDecryptModal(true);
                      }}
                      className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Decrypt Messages
                    </button>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.id || 'msg'}_${index}`}
                      className={`max-w-[70%] p-3 rounded-lg break-words overflow-hidden ${
                        message.from === address
                          ? 'ml-auto bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-all overflow-hidden">
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
                
                {/* Refreshing indicator */}
                {isRefreshing && !initialFetching && (
                  <div className="flex justify-center items-center p-2">
                    <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Message input */}
              <div className="p-4 border-t border-slate-700 sticky bottom-0 bg-slate-900">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={activeMode === 'odv' ? "Type a message..." : "Type a log entry..."}
                    className="flex-1 bg-slate-800 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading || !messagesDecrypted}
                  />
                  <button
                    onClick={handleSendMessage}
                    className={`bg-blue-600 text-white px-4 py-2 rounded-lg ${
                      isLoading || !messagesDecrypted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                    }`}
                    disabled={isLoading || !messagesDecrypted}
                  >
                    {isLoading ? 'Sending...' : (activeMode === 'odv' ? 'Send' : 'Log')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>

      {/* Info Modal */}
      {showModal && selectedThreadForModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Thread Information</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Address
              </label>
              <div className="text-slate-200 bg-slate-700 p-2 rounded break-all">
                {selectedThreadForModal.address}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Nickname
              </label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-slate-700 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDisplayName}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace with our two separate modals */}
      <PasswordConfirmModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        error={passwordError}
      />
      
      {/* Decrypt Modal */}
      {showDecryptModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-slate-200 mb-4">Decrypt Messages</h3>
            <p className="text-slate-400 mb-4">
              Enter your wallet password to decrypt messages
            </p>
            
            {decryptError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {decryptError}
              </div>
            )}
            
            <input
              type="password"
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded mb-4 text-slate-200"
              placeholder="Enter your password"
              value={decryptPassword}
              onChange={(e) => setDecryptPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDecrypt(decryptPassword)}
            />
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDecryptModal(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecrypt(decryptPassword)}
                disabled={isDecrypting || !decryptPassword.trim()}
                className={`px-4 py-2 rounded flex items-center justify-center min-w-[100px] ${
                  isDecrypting || !decryptPassword.trim()
                    ? 'bg-blue-700/50 text-blue-300/50 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isDecrypting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-300 border-t-transparent mr-2"></div>
                    Decrypting...
                  </>
                ) : (
                  'Decrypt'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MemosPage; 