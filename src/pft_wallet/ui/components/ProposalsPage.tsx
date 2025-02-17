'use client';

import React, { useState, useContext } from 'react';
import { Card, CardContent } from '@/components/custom-card';
import { useTasks } from '../hooks/useTasks';
import { AuthContext } from '../context/AuthContext';

const ProposalsPage = () => {
  const { isAuthenticated, address } = useContext(AuthContext);
  const { tasksByStatus, loading, error } = useTasks(isAuthenticated ? address : null);
  
  // Local state to toggle showing refused tasks
  const [showRefused, setShowRefused] = useState(false);

  // Combine tasks from allowed statuses:
  // Always include tasks with status "requested", "proposed", and "accepted"
  // Optionally add "refused" tasks if the checkbox is checked.
  let tasksToDisplay = [
    ...tasksByStatus.requested,
    ...tasksByStatus.proposed,
    ...tasksByStatus.accepted,
    ...(showRefused ? tasksByStatus.refused : [])
  ];

  // Sort the combined tasks by timestamp in descending order
  tasksToDisplay.sort(
    (a, b) => new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf()
  );

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
          <div className="space-y-4">
            {tasksToDisplay.length === 0 ? (
              <div className="text-white">No tasks available.</div>
            ) : (
              tasksToDisplay.map((task) => (
                <Card
                  key={task.task_id}
                  className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <CardContent className="p-6">
                    {/* Task Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">
                          {task.task_id}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            task.status === 'accepted'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : task.status === 'requested'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : task.status === 'proposed'
                              ? 'bg-blue-500/10 text-blue-400'
                              : task.status === 'refused'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-gray-500/10 text-gray-400'
                          }`}
                        >
                          {task.status.charAt(0).toUpperCase() +
                            task.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Reward:</span>
                        <span className="text-sm font-medium text-white">
                          {task.reward}
                        </span>
                      </div>
                    </div>

                    {/* Request */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">
                        Request
                      </h3>
                      <p className="text-sm text-slate-300">{task.request}</p>
                    </div>

                    {/* Proposal */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-1">
                        Proposal
                      </h3>
                      <p className="text-sm text-slate-300">{task.proposal}</p>
                    </div>

                    {/* Response, if any */}
                    {task.response && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-1">
                          Response
                        </h3>
                        <p className="text-sm text-slate-300">{task.response}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProposalsPage;