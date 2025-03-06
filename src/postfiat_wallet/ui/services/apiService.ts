/**
 * API service for making requests to the backend
 */
import { connectionManager } from './connectionManager';

export class ApiService {
  private static instance: ApiService;
  
  // Base path for all API endpoints
  private readonly basePath: string;
  
  private constructor() {
    // In development mode, use the absolute URL to the API server
    this.basePath = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:28080/api'  // Adjust port if needed
      : '/api';
  }
  
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  /**
   * GET request to the API
   */
  public async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.basePath}${endpoint}`, {
        credentials: 'include' // Include cookies in the request
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      // If we have a network error, trigger connection check
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Trigger a connection check without waiting for the next interval
        connectionManager.manualCheck();
      }
      throw error;
    }
  }
  
  /**
   * POST request to the API
   */
  public async post<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await fetch(`${this.basePath}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in the request
        body: data ? JSON.stringify(data) : undefined,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      // If we have a network error, trigger connection check
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Trigger a connection check without waiting for the next interval
        connectionManager.manualCheck();
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
