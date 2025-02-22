import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

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

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedThread) return;
    
    const newMsg: Message = {
      id: Date.now().toString(),
      from: address,
      to: selectedThread,
      content: newMessage.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newMsg]);
    setNewMessage('');
  };

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
      <div className="flex h-[calc(100vh-120px)]">
        {/* Threads sidebar */}
        <div className="w-1/4 border-r border-slate-700 overflow-y-auto">
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

        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <>
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[70%] p-3 rounded-lg ${
                      message.from === address
                        ? 'ml-auto bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>

              {/* Message input */}
              <div className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-800 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Send
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
    </>
  );
};

export default MemosPage; 