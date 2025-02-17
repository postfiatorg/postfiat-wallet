import { useState, useEffect } from 'react';

// Define the task status types based on TaskStatus enum from backend
type TaskStatus = 
  | 'invalid'
  | 'requested' 
  | 'proposed'
  | 'accepted'
  | 'refused'
  | 'completed'
  | 'challenged'
  | 'responded'
  | 'rewarded';

interface TaskMessage {
  id: string;
  task_id: string;
  request?: string;
  proposal?: string;
  response?: string;
  status: TaskStatus;
  reward?: string;
  timestamp: string;
}

interface TasksByStatus {
  invalid: TaskMessage[];
  requested: TaskMessage[];
  proposed: TaskMessage[];
  accepted: TaskMessage[];
  refused: TaskMessage[];
  completed: TaskMessage[];
  challenged: TaskMessage[];
  responded: TaskMessage[];
  rewarded: TaskMessage[];
}

export function useTasks(walletAddress: string | null) {
  const [tasksByStatus, setTasksByStatus] = useState<TasksByStatus>({
    invalid: [],
    requested: [],
    proposed: [],
    accepted: [],
    refused: [],
    completed: [],
    challenged: [],
    responded: [],
    rewarded: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/tasks/${walletAddress}`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        
        const data = await response.json();
        setTasksByStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchTasks();

    // Set up polling
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  return { tasksByStatus, loading, error };
} 