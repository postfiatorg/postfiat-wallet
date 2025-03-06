import { apiService } from './apiService';

// Create a custom event for connection status changes
export const CONNECTION_STATUS_CHANGED = 'connection_status_changed';

class ConnectionManager {
  private intervalId: number | null = null;
  private isConnected: boolean = true;

  // Start monitoring the connection status
  startMonitoring(intervalMs: number = 5000) {
    // Clear any existing interval
    this.stopMonitoring();
    
    // Set up a new interval to check connection
    this.intervalId = window.setInterval(() => {
      this.checkConnection();
    }, intervalMs);
    
    // Do an immediate check
    this.checkConnection();
  }

  // Stop monitoring the connection status
  stopMonitoring() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Check if the backend is available
  private async checkConnection() {
    try {
      // Use a simple health check endpoint - adjust according to your API
      await apiService.get('/health');
      
      // If we get here, the connection is up
      if (!this.isConnected) {
        this.isConnected = true;
        this.dispatchConnectionEvent(true);
      }
    } catch (error) {
      // If we get here, the connection is down
      if (this.isConnected) {
        this.isConnected = false;
        this.dispatchConnectionEvent(false);
      }
    }
  }

  // Manually trigger a connection check and return the result
  async manualCheck(): Promise<boolean> {
    try {
      await apiService.get('/health');
      this.isConnected = true;
      this.dispatchConnectionEvent(true);
      return true;
    } catch (error) {
      this.isConnected = false;
      this.dispatchConnectionEvent(false);
      return false;
    }
  }

  // Dispatch custom event with connection status
  private dispatchConnectionEvent(isConnected: boolean) {
    const event = new CustomEvent(CONNECTION_STATUS_CHANGED, { 
      detail: { isConnected } 
    });
    window.dispatchEvent(event);
  }

  // Get current connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const connectionManager = new ConnectionManager(); 