import React from 'react';

interface NavbarProps {
  username: string | null;
  onSignOut: () => Promise<void>;
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Navbar({ username, onSignOut, activePage, onPageChange }: NavbarProps) {
  const navItems = [
    { label: 'Summary', id: 'summary' },
    { label: 'Active Tasks', id: 'proposals' },
    { label: 'Finished Tasks', id: 'rewards' },
    { label: 'Payments', id: 'payments' },
    { label: 'Memos', id: 'memos' },
    { label: 'Settings', id: 'settings' },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-4">
            <span className="text-white font-bold text-xl">Post Fiat Wallet</span>
            <div className="flex space-x-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium 
                    ${activePage === item.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'} 
                    transition-colors duration-200 ease-in-out`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-slate-300">{username}</span>
            <button
              onClick={onSignOut}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}