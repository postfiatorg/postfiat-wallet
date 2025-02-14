'use client';

import React from 'react';
import { Card, CardContent} from '@/components/custom-card';

const ProposalsPage = () => {
  const tasks = [
    {
      id: "2025-01-22_16:16__UG49",
      request: "I am going to implement the nodes section of the website to showcase the different types of PostFiat nodes.",
      proposal: "Create a TypeScript component nodes_overview.tsx that implements the parent container for all node-related sections. Include a responsive layout manager using Tailwind CSS grid system, integration points for active_nodes_section.tsx, and placeholder sections for future node types. Add unit tests verifying proper component composition and responsive behavior.",
      response: "",
      status: "pending",
      reward: "900"
    },
    {
      id: "2025-01-18_15:08__ZB22",
      request: "test",
      proposal: "Please create a Next.js dynamic route called '/nodes/[nodeName].tsx' that displays detailed usage instructions, status, and GitHub links for each PostFiat node. Provide a short test suite verifying that navigation to '/nodes/task,' '/nodes/corbanu,' and '/nodes/image-gen' works correctly with the expected content.",
      response: "",
      status: "active",
      reward: "800"
    },
    {
      id: "2025-01-18_15:06__CX40",
      request: "Update both the record_question and record_evaluation methods in corbanu_processing/corbanu/corbanu_node.py to use StandardizedMemoProcessor for proper chunking and compression.",
      proposal: "Update implementation to handle chunking/compression for any text size. Add comprehensive testing suite.",
      response: "In progress",
      status: "in Progress",
      reward: "900"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium">
            Request Task
          </button>
          <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium">
            Refuse Task
          </button>
        </div>
        <div className="space-y-4">
          <button className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors text-sm font-medium">
            Accept Task
          </button>
          <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium">
            Submit for Verification
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Active Proposals</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
            />
            Show Refused Tasks
          </label>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.map((task) => (
          <Card key={task.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">{task.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium 
                      ${task.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        task.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-blue-500/10 text-blue-400'}`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Reward:</span>
                    <span className="text-sm font-medium text-white">{task.reward}</span>
                  </div>
                </div>

                {/* Request */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Request</h3>
                  <p className="text-sm text-slate-300">{task.request}</p>
                </div>

                {/* Proposal */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Proposal</h3>
                  <p className="text-sm text-slate-300">{task.proposal}</p>
                </div>

                {/* Response (if any) */}
                {task.response && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-1">Response</h3>
                    <p className="text-sm text-slate-300">{task.response}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProposalsPage;