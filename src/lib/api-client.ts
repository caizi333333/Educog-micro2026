import { ApiResponse, CacheEntry, PendingRequest, RequestConfig } from '@/types';

class ApiClient {
  private baseURL: string;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private defaultTimeout = 30000; // 30 seconds
  private defaultCacheTime = 5 * 60 * 1000; // 5 minutes

  constructor(baseURL = '') {
    this.baseURL = baseURL;
    
    // Cleanup expired cache entries every minute
    setInterval(() => this.cleanupCache(), 60000);
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private getCacheKey(url: string, config?: RequestConfig): string {
    const method = config?.method || 'GET';
    const params = config?.params ? JSON.stringify(config.params) : '';
    const body = config?.body ? JSON.stringify(config.body) : '';
    return `${method}:${url}:${params}:${body}`;
  }

  private getFromCache<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T = unknown>(key: string, data: T, cacheTime: number) {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + cacheTime,
    } as CacheEntry<T>);
  }

  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(endpoint, this.baseURL);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  }

  async request<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const cacheKey = this.getCacheKey(url, config);
    
    // Check cache for GET requests
    if (config?.method === 'GET' || !config?.method) {
      const cachedData = this.getFromCache<T>(cacheKey);
      if (cachedData) {
        return { success: true, data: cachedData };
      }
    }

    // Check for pending requests (request deduplication)
    if (config?.dedupe !== false) {
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) {
        try {
          const result = await pending.promise;
          return result as ApiResponse<T>;
        } catch (error) {
          // If the pending request failed, continue with a new request
        }
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = config?.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Build request options
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config?.headers as Record<string, string> || {}),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const requestConfig: RequestInit = {
      ...config,
      headers,
      signal: controller.signal,
    };

    // Create the request promise
    const requestPromise = fetch(url, requestConfig)
      .then(response => this.handleResponse<T>(response))
      .finally(() => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(cacheKey);
      });

    // Store pending request for deduplication
    if (config?.dedupe !== false) {
      this.pendingRequests.set(cacheKey, {
        promise: requestPromise,
        controller,
      } as PendingRequest<T>);
    }

    // Retry logic
    let retries = config?.retry || 0;
    let lastError: Error;

    const attemptRequest = async (): Promise<ApiResponse<T>> => {
      try {
        const result = await requestPromise;
        
        // Cache successful GET responses
        if ((config?.method === 'GET' || !config?.method) && result.success) {
          const cacheTime = config?.cacheTime || this.defaultCacheTime;
          this.setCache(cacheKey, result.data, cacheTime);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (retries > 0 && !controller.signal.aborted) {
          retries--;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, config?.retry! - retries) * 1000));
          return attemptRequest();
        }
        
        throw lastError;
      }
    };

    return attemptRequest();
  }

  // Convenience methods
  async get<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T = unknown>(endpoint: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T = unknown>(endpoint: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T = unknown>(endpoint: string, data?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T = any>(endpoint: string, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // Clear cache
  clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Cancel all pending requests
  cancelAll() {
    for (const [key, pending] of this.pendingRequests.entries()) {
      pending.controller.abort();
      this.pendingRequests.delete(key);
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient('/api');

export default apiClient;

// Export for use in hooks and components
export { ApiClient, type RequestConfig, type ApiResponse };