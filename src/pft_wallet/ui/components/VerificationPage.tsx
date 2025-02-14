import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/custom-card';

const VerificationPage = () => {
  const verificationData = [
    {
      id: 1,
      taskId: '2025-01-22_17:18__FN84',
      proposal: 'Create a TypeScript component active_nodes_section.tsx that implements a grid layout showcasing PosiFiat\'s active nodes (Task Node and Image Generation Node). Include concise descriptions of each node\'s purpose, current operational status, and GitHub repository links. Add responsive styling using Tailwind CSS and implement unit tests verifying proper rendering of node information cards... 900',
      verification: 'Please provide: 1) The GitHub commit URL showing your implementation of active_nodes_section.tsx, 2) A brief description (2-3 sentences) of how you implemented the grid layout using Tailwind CSS, and 3) The number of unit tests you created and what they verify. Note: If the repository is private, please paste the component\'s code in the verification document section.'
    }
  ];

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
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg 
                        text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 
                        focus:ring-emerald-500/50 focus:border-emerald-500/50 min-h-[200px]"
              placeholder="Enter verification details"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <button className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 
                              text-white rounded-lg transition-colors text-sm font-medium">
                Submit Verification Details
              </button>
              <button className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                              text-white rounded-lg transition-colors text-sm font-medium">
                Refuse
              </button>
            </div>
            <div className="space-y-3">
              <button className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                              text-white rounded-lg transition-colors text-sm font-medium">
                Log Pomodoro
              </button>
              <button className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 
                              text-white rounded-lg transition-colors text-sm font-medium">
                Force Update
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
          <div className="space-y-4">
            {verificationData.map((item) => (
              <div key={item.id} className="p-4 rounded-lg bg-slate-800/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">#{item.id}</span>
                    <span className="text-xs font-mono text-slate-400">{item.taskId}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                    Pending Verification
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Proposal</h3>
                    <p className="text-sm text-slate-300">{item.proposal}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Verification Requirements</h3>
                    <p className="text-sm text-slate-300">{item.verification}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificationPage;