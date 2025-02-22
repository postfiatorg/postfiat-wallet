import { useEffect, useState } from 'react';
import { Task } from '../types/task';

export function useTaskRefresh(walletAddress: string | null) {
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeTasks = async () => {
      if (!walletAddress) return;

      try {
        // Initialize tasks when user signs in
        const response = await fetch(`/api/tasks/initialize/${walletAddress}`);
        if (!response.ok) throw new Error('Failed to initialize tasks');
        
        // Start the refresh loop on the backend
        await fetch(`/api/tasks/start-refresh/${walletAddress}`);
        
        // Set up periodic polling for new tasks
        const pollInterval = setInterval(async () => {
          if (!mounted) return;
          
          try {
            const response = await fetch(`/api/tasks/${walletAddress}`);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            
            const data = await response.json();
            setTasks(data);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        }, 30000); // Poll every 30 seconds

        return () => {
          clearInterval(pollInterval);
          // Stop the refresh loop on the backend
          fetch(`/api/tasks/stop-refresh/${walletAddress}`);
        };
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeTasks();

    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  return { tasks, loading, error };
} 