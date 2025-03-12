import { apiService } from './apiService';

// Create a custom event for connection status changes
export const CONNECTION_STATUS_CHANGED = 'connection_status_changed';

export class ConnectionManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isConnected: boolean = true;

  // Start monitoring the connection status
  startMonitoring(useAuthenticatedEndpoints = false) {
    if (this.intervalId) return;
    
    // Initial check
    this._checkServerConnectivity(useAuthenticatedEndpoints);
    
    // Start periodic checking
    this.intervalId = setInterval(() => {
      this._checkServerConnectivity(useAuthenticatedEndpoints);
    }, 5000);
  }

  // Stop monitoring the connection status
  stopMonitoring() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
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

  // New method that only checks server is running, not authenticated endpoints
  async checkBasicConnectivity(): Promise<boolean> {
    try {
      // Use a lightweight public endpoint for the health check
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      return response.ok;
    } catch (error) {
      console.error('Server connectivity check failed:', error);
      return false;
    }
  }

  // Update check method to conditionally use basic or authenticated endpoints
  private async _checkServerConnectivity(useAuthenticatedEndpoints: boolean): Promise<void> {
    const isConnected = useAuthenticatedEndpoints 
      ? await this.checkConnection()
      : await this.checkBasicConnectivity();
      
    if (isConnected) {
      if (!this.isConnected) {
        this.isConnected = true;
        this.dispatchConnectionEvent(true);
      }
    } else {
      if (this.isConnected) {
        this.isConnected = false;
        this.dispatchConnectionEvent(false);
      }
    }
  }
}

export const connectionManager = new ConnectionManager(); 