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

// Add a simple in-memory cache
class ApiCache {
  private cache: Map<string, {data: any, timestamp: number}> = new Map();
  private maxAge: number = 5 * 60 * 1000; // 5 minutes default cache lifetime
  
  // Clear cache for a specific account when it changes
  clearAccountCache(address: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(`/account/${address}`) || key.includes(`/tasks/${address}`)) {
        this.cache.delete(key);
      }
    }
  }
  
  // Clear all cache (for logout)
  clearAllCache() {
    this.cache.clear();
  }
  
  // Add a new method to clear task-related cache entries
  clearTaskRelatedCache() {
    for (const key of this.cache.keys()) {
      if (key.includes('/tasks/')) {
        this.cache.delete(key);
      }
    }
  }
  
  get(key: string): any | null {
    const cachedItem = this.cache.get(key);
    if (!cachedItem) return null;
    
    // Check if cache is still valid
    if (Date.now() - cachedItem.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return cachedItem.data;
  }
  
  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

const apiCache = new ApiCache();

// Add a request tracking system
class RequestTracker {
  private activeRequests: Map<string, AbortController[]> = new Map();
  
  createAbortController(address: string | null): AbortController {
    const controller = new AbortController();
    if (!address) return controller;
    
    if (!this.activeRequests.has(address)) {
      this.activeRequests.set(address, []);
    }
    
    this.activeRequests.get(address)?.push(controller);
    return controller;
  }
  
  abortRequestsForAddress(address: string | null) {
    if (!address) return;
    
    const controllers = this.activeRequests.get(address) || [];
    controllers.forEach(controller => {
      try {
        controller.abort();
      } catch (e) {
        console.error("Error aborting request:", e);
      }
    });
    
    this.activeRequests.set(address, []);
  }
}

const requestTracker = new RequestTracker();

export class ApiService {
  private static instance: ApiService;
  
  // Base path for all API endpoints
  private readonly basePath: string;
  
  // Track if app is authenticated
  private isAuthenticated: boolean = false;
  
  private static logAllRequests = true;
  
  private constructor() {
    // In development mode, use the absolute URL to the API server
    this.basePath = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:28080/api'  // Adjust port if needed
      : '/api';
    
    // Prevent any requests before initialization is complete
    if (typeof window !== 'undefined' && window.ACTIVE_ACCOUNT === undefined) {
      window.ACTIVE_ACCOUNT = null;
    }
    
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
    // Expand the list of public endpoints
    const publicEndpoints = [
      '/auth/signin',
      '/auth/create',
      '/wallet/generate',
      '/wallet/address',
      '/health',
      '/server/status'
    ];
    
    // Check if the endpoint is in our allowed list
    return publicEndpoints.some(publicEndpoint => 
      endpoint === publicEndpoint || endpoint.startsWith(publicEndpoint)
    );
  }
  
  /**
   * GET request to the API
   */
  public async get<T>(endpoint: string, useCache: boolean = true): Promise<T> {
    console.trace(`API REQUEST ORIGIN: ${endpoint}`);
    
    // Block private API requests when not authenticated
    if (!this.isAuthenticated && !this.isPublicEndpoint(endpoint)) {
      console.warn(`Blocked unauthenticated GET request to ${endpoint}`);
      throw new Error(`Authentication required for ${endpoint}`);
    }

    const cacheKey = this.getCacheKey(endpoint);
    
    // Extract address from endpoint if possible
    const addressMatch = endpoint.match(/\/account\/([^\/]+)\/|\/tasks\/([^\/]+)/);
    const addressForRequest = addressMatch ? (addressMatch[1] || addressMatch[2]) : null;
    
    // Check if this account is still active before proceeding
    if (addressForRequest && typeof window !== 'undefined' && window.ACTIVE_ACCOUNT !== null && 
        addressForRequest !== window.ACTIVE_ACCOUNT) {
      console.log(`Skipping request for inactive account: ${addressForRequest}`);
      throw new Error('Account inactive');
    }
    
    // Check cache first if useCache is true
    if (useCache) {
      const cachedData = apiCache.get(cacheKey);
      if (cachedData) {
        console.log(`Using cached data for ${endpoint}`);
        return cachedData as T;
      }
    }
    
    // Create abort controller for this request
    const controller = requestTracker.createAbortController(addressForRequest);
    
    try {
      if (ApiService.logAllRequests) {
        console.log('API Request:', {
          endpoint,
          stackTrace: new Error().stack,
          timestamp: new Date().toISOString()
        });
      }
      console.log(`[API Request] GET ${endpoint}`);
      const response = await fetch(`${this.basePath}${endpoint}`, {
        signal: controller.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      // Store in cache if caching is enabled
      if (useCache) {
        apiCache.set(cacheKey, data);
      }
      
      return data as T;
    } catch (error) {
      // Don't log aborted requests as errors
      if (error instanceof Error && error.name === 'AbortError') {
        // Do nothing for aborted requests
      } else {
        console.error(`API request failed for ${endpoint}:`, error);
      }
      throw error;
    }
  }
  
  /**
   * POST request to the API
   */
  public async post<T>(endpoint: string, data?: any): Promise<T> {
    console.trace(`API REQUEST ORIGIN: ${endpoint}`);
    
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
      
      const result = await response.json();
      
      // Improved cache invalidation logic
      // 1. Extract address from endpoint if possible
      const addressMatch = endpoint.match(/\/account\/([^\/]+)\/|\/tasks\/([^\/]+)|\/transaction\/[^\/]+/);
      if (addressMatch) {
        const address = addressMatch[1] || addressMatch[2];
        if (address) {
          console.log(`Invalidating cache for address: ${address} after POST to ${endpoint}`);
          apiCache.clearAccountCache(address);
        }
      }
      
      // 2. For any task-related endpoints, invalidate ALL task cache entries
      if (endpoint.includes('/tasks/') || endpoint.includes('/transaction/')) {
        console.log(`Invalidating all task-related cache entries after POST to ${endpoint}`);
        apiCache.clearTaskRelatedCache(); // Using our new method
      }
      
      return result as T;
    } catch (error) {
      // If we have a network error, trigger connection check
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Trigger a connection check without waiting for the next interval
        connectionManager.manualCheck();
      }
      throw error;
    }
  }
  
  // Add this helper method to get cache key
  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}${params ? JSON.stringify(params) : ''}`;
  }
  
  // Add cache control methods
  public clearCache(address: string) {
    apiCache.clearAccountCache(address);
    requestTracker.abortRequestsForAddress(address);
  }
  
  public clearAllCache() {
    apiCache.clearAllCache();
  }
  
  abortRequestsForAddress(address: string) {
    requestTracker.abortRequestsForAddress(address);
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
