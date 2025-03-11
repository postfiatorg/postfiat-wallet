/**
 * API service for making requests to the backend
 */
import { connectionManager } from './connectionManager';

// Define which API endpoints should be allowed before authentication
const PUBLIC_ENDPOINTS = [
  '/auth/signin',
  '/auth/create',
  '/wallet/generate',
  '/wallet/address'
];

export class ApiService {
  private static instance: ApiService;
  
  // Base path for all API endpoints
  private readonly basePath: string;
  
  // Track if app is authenticated
  private isAuthenticated: boolean = false;
  
  private constructor() {
    // In development mode, use the absolute URL to the API server
    this.basePath = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:28080/api'  // Adjust port if needed
      : '/api';
    
    console.log('API Service initialized');
  }
  
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
  
  /**
   * Set authentication state
   */
  public setAuthenticated(value: boolean): void {
    this.isAuthenticated = value;
    console.log(`API Service: Authentication state set to ${value}`);
  }
  
  /**
   * Check if endpoint should be allowed without authentication
   */
  private isPublicEndpoint(endpoint: string): boolean {
    const publicEndpoints = [
      '/auth/signin',
      '/auth/create',
      '/wallet/generate',
      '/health'
    ];
    
    // Check if the endpoint is in our allowed list
    return publicEndpoints.some(publicEndpoint => 
      endpoint === publicEndpoint || endpoint.startsWith(publicEndpoint)
    );
  }
  
  /**
   * GET request to the API
   */
  public async get<T>(endpoint: string): Promise<T> {
    console.log(`[API Request] GET ${endpoint}`);
    
    // Check if this request should be blocked
    if (!this.isAuthenticated && !this.isPublicEndpoint(endpoint)) {
      console.warn(`Blocked unauthenticated GET request to ${endpoint}`);
      throw new Error(`Authentication required for ${endpoint}`);
    }
    
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
    console.log(`[API Request] POST ${endpoint}`, data ? '(with data)' : '');
    
    // Check if this request should be blocked
    if (!this.isAuthenticated && !this.isPublicEndpoint(endpoint)) {
      console.warn(`Blocked unauthenticated POST request to ${endpoint}`);
      throw new Error(`Authentication required for ${endpoint}`);
    }
    
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
