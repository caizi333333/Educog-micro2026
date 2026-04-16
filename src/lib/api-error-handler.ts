import { toast } from 'sonner';

// API错误类型定义
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
  timestamp: string;
}

// 错误处理配置
export interface ErrorHandlerConfig {
  showToast?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: ApiError) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: (error: ApiError) => void;
}

// 默认配置
const defaultConfig: ErrorHandlerConfig = {
  showToast: true,
  retryable: true,
  maxRetries: 3,
  retryDelay: 1000,
};

// 标准化错误对象
export function normalizeError(error: any): ApiError {
  const timestamp = new Date().toISOString();
  
  if (error instanceof Response) {
    return {
      message: `HTTP ${error.status}: ${error.statusText}`,
      status: error.status,
      timestamp,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
      timestamp,
    };
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      timestamp,
    };
  }
  
  return {
    message: '未知错误',
    details: error,
    timestamp,
  };
}

// 判断错误是否可重试
export function isRetryableError(error: ApiError): boolean {
  // 网络错误通常可重试
  if (!error.status) return true;
  
  // 5xx服务器错误可重试
  if (error.status >= 500) return true;
  
  // 429 请求过多可重试
  if (error.status === 429) return true;
  
  // 408 请求超时可重试
  if (error.status === 408) return true;
  
  // 其他错误不重试
  return false;
}

// 获取用户友好的错误消息
export function getUserFriendlyMessage(error: ApiError): string {
  if (error.status) {
    switch (error.status) {
      case 400:
        return '请求参数错误，请检查输入内容';
      case 401:
        return '身份验证失败，请重新登录';
      case 403:
        return '权限不足，无法执行此操作';
      case 404:
        return '请求的资源不存在';
      case 408:
        return '请求超时，请稍后重试';
      case 429:
        return '请求过于频繁，请稍后重试';
      case 500:
        return '服务器内部错误，请稍后重试';
      case 502:
        return '网关错误，请稍后重试';
      case 503:
        return '服务暂时不可用，请稍后重试';
      default:
        return error.message || '请求失败';
    }
  }
  
  // 网络错误
  if (error.message.includes('fetch')) {
    return '网络连接失败，请检查网络连接';
  }
  
  if (error.message.includes('timeout')) {
    return '请求超时，请稍后重试';
  }
  
  return error.message || '操作失败';
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 带重试的API调用包装器
export async function fetchWithErrorHandling<T>(
  fetchFn: () => Promise<T>,
  config: ErrorHandlerConfig = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  let lastError: ApiError;
  
  for (let attempt = 1; attempt <= (finalConfig.maxRetries || 1); attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = normalizeError(error);
      
      // 如果不可重试或已达到最大重试次数
      if (!finalConfig.retryable || 
          !isRetryableError(lastError) || 
          attempt >= (finalConfig.maxRetries || 1)) {
        break;
      }
      
      // 调用重试回调
      finalConfig.onRetry?.(attempt);
      
      // 计算延迟时间（指数退避）
      const delayMs = (finalConfig.retryDelay || 1000) * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }
  
  // 所有重试都失败了
  finalConfig.onMaxRetriesReached?.(lastError!);
  
  // 显示错误提示
  if (finalConfig.showToast) {
    const friendlyMessage = getUserFriendlyMessage(lastError!);
    toast.error(friendlyMessage);
  }
  
  // 调用错误回调
  finalConfig.onError?.(lastError!);
  
  throw lastError!;
}

// React Hook for API calls with error handling
import { useState, useCallback } from 'react';

export interface UseApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export function useApiCall<T>(
  config: ErrorHandlerConfig = {}
) {
  const [state, setState] = useState<UseApiCallState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  
  const execute = useCallback(async (fetchFn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await fetchWithErrorHandling(fetchFn, {
        ...config,
        onError: (error) => {
          setState(prev => ({ ...prev, error, loading: false }));
          config.onError?.(error);
        },
      });
      
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      // Error is already handled in fetchWithErrorHandling
      throw error;
    }
  }, [config]);
  
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);
  
  return {
    ...state,
    execute,
    reset,
  };
}

// 预定义的错误处理配置
export const errorHandlerPresets = {
  // 静默处理，不显示toast
  silent: {
    showToast: false,
    retryable: true,
    maxRetries: 2,
  },
  
  // 快速失败，不重试
  noRetry: {
    showToast: true,
    retryable: false,
    maxRetries: 1,
  },
  
  // 积极重试
  aggressive: {
    showToast: true,
    retryable: true,
    maxRetries: 5,
    retryDelay: 500,
  },
  
  // 用户操作，显示详细错误
  userAction: {
    showToast: true,
    retryable: true,
    maxRetries: 2,
    retryDelay: 1500,
  },
};