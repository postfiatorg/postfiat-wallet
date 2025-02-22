export interface Task {
  id: string;
  type: 'Incoming' | 'Outgoing';
  status: 'Proposed' | 'In Progress' | 'Completed' | 'Failed';
  message: string;
  timestamp: string;
  address: string;  // wallet address associated with the task
}

export interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
} 