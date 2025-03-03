/**
 * API service for making requests to the backend
 */
export class ApiService {
  private static instance: ApiService;
  
  // Base path for all API endpoints
  private readonly basePath: string = '/api';
  
  private constructor() {}
  
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
    const response = await fetch(`${this.basePath}${endpoint}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * POST request to the API
   */
  public async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.basePath}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    return response.json();
  }
}

// Export a singleton instance
export const apiService = ApiService.getInstance();
