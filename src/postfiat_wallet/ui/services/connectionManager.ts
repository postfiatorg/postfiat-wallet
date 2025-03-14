import { apiService } from './apiService';

// Create a custom event for connection status changes
export const CONNECTION_STATUS_CHANGED = 'connection_status_changed';

export class ConnectionManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isConnected: boolean = true;

  // Start monitoring the connection status
  startMonitoring(useAuthenticatedEndpoints = false) {
    if (this.intervalId) {
      // Clear existing interval if we're changing monitoring type
      this.stopMonitoring();
    }
    
    // Initial check
    this._checkServerConnectivity(useAuthenticatedEndpoints);
    
    // Start periodic checking
    this.intervalId = setInterval(() => {
      this._checkServerConnectivity(useAuthenticatedEndpoints);
    }, 5000);
    
    console.log(`Connection monitoring started (using ${useAuthenticatedEndpoints ? 'authenticated' : 'basic'} endpoints)`);
  }

  // Stop monitoring the connection status
  stopMonitoring() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Connection monitoring stopped');
    }
  }

  // Check if the backend is available using apiService
  private async checkConnection(): Promise<boolean> {
    try {
      // Use a simple health check endpoint
      const response = await apiService.get('/health');
      
      // Type-safe check for response structure
      const isHealthy = response && typeof response === 'object' && 
                        'status' in response && response.status === 'ok';
      
      // Update state and dispatch event if needed
      if (isHealthy) {
        if (!this.isConnected) {
          this.isConnected = true;
          this.dispatchConnectionEvent(true);
        }
        return true;
      } else {
        if (this.isConnected) {
          this.isConnected = false;
          this.dispatchConnectionEvent(false);
        }
        return false;
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      // Only update if status changed
      if (this.isConnected) {
        this.isConnected = false;
        this.dispatchConnectionEvent(false);
      }
      return false;
    }
  }

  // Manually trigger a connection check and return the result
  async manualCheck(): Promise<boolean> {
    try {
      const result = await this.checkBasicConnectivity();
      this.isConnected = result;
      this.dispatchConnectionEvent(result);
      return result;
    } catch (error) {
      this.isConnected = false;
      this.dispatchConnectionEvent(false);
      return false;
    }
  }

  // Dispatch custom event with connection status
  private dispatchConnectionEvent(isConnected: boolean) {
    console.log(`Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`);
    const event = new CustomEvent(CONNECTION_STATUS_CHANGED, { 
      detail: { isConnected } 
    });
    window.dispatchEvent(event);
  }

  // Get current connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Method that checks server is running using direct fetch
  async checkBasicConnectivity(): Promise<boolean> {
    try {
      // Use a lightweight public endpoint for the health check
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      // Additional check to validate the response
      if (response.ok) {
        const data = await response.json();
        return data && data.status === 'ok';
      }
      
      return false;
    } catch (error) {
      console.error('Server connectivity check failed:', error);
      return false;
    }
  }

  // Update check method to conditionally use basic or authenticated endpoints
  private async _checkServerConnectivity(useAuthenticatedEndpoints: boolean): Promise<void> {
    try {
      // Always use the reliable basic connectivity check regardless of authentication status
      const isConnected = await this.checkBasicConnectivity();
      
      if (isConnected !== this.isConnected) {
        this.isConnected = isConnected;
        this.dispatchConnectionEvent(isConnected);
      }
    } catch (error) {
      console.error('Error in connectivity check:', error);
      if (this.isConnected) {
        this.isConnected = false;
        this.dispatchConnectionEvent(false);
      }
    }
  }
}

export const connectionManager = new ConnectionManager(); 