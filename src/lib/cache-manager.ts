// 缓存管理器
export class CacheManager {
  private storage: Storage;

  constructor(storageType: 'local' | 'session' = 'local') {
    if (typeof window === 'undefined') {
      // Node.js环境下的模拟存储
      this.storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null
      } as Storage;
    } else {
      this.storage = storageType === 'session' ? sessionStorage : localStorage;
    }
  }

  // 设置缓存
  set(key: string, value: any, ttl?: number): void {
    try {
      const cacheData = {
        value,
        timestamp: Date.now(),
        ttl: ttl || null
      };
      this.storage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      // 静默处理存储错误
      console.warn('Cache set error:', error);
    }
  }

  // 获取缓存
  get<T>(key: string): T | null {
    try {
      const item = this.storage.getItem(key);
      if (!item) {
        return null;
      }

      const cacheData = JSON.parse(item);
      
      // 检查数据格式
      if (!cacheData || typeof cacheData.timestamp !== 'number') {
        this.remove(key);
        return null;
      }

      // 检查是否过期
      if (cacheData.ttl !== null && Date.now() - cacheData.timestamp > cacheData.ttl * 1000) {
        this.remove(key);
        return null;
      }

      return cacheData.value as T;
    } catch (error) {
      // JSON解析错误，删除无效缓存
      this.remove(key);
      return null;
    }
  }

  // 删除缓存
  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.warn('Cache remove error:', error);
    }
  }

  // 清空缓存
  clear(): void {
    try {
      this.storage.clear();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  // 检查缓存项是否存在
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  // 获取缓存大小
  size(): number {
    return this.storage.length;
  }

  // 获取所有缓存键
  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key) {
        keys.push(key);
      }
    }
    return keys;
  }

  // 批量设置缓存项
  setMultiple(items: Record<string, any>, ttl?: number): void {
    Object.entries(items).forEach(([key, value]) => {
      this.set(key, value, ttl);
    });
  }

  // 批量获取缓存项
  getMultiple<T>(keys: string[]): Record<string, T | null> {
    const results: Record<string, T | null> = {};
    keys.forEach(key => {
      results[key] = this.get<T>(key);
    });
    return results;
  }

  // 批量删除缓存项
  removeMultiple(keys: string[]): void {
    keys.forEach(key => {
      this.remove(key);
    });
  }

  // 清理过期缓存
  cleanup(): void {
    const keys = this.keys();
    keys.forEach(key => {
      // 通过get方法触发过期检查
      this.get(key);
    });
  }

  // 获取缓存统计信息
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.size(),
      hitRate: 0, // 可以添加命中率统计
    };
  }
}

// 全局缓存实例
export const cacheManager = new CacheManager();

// 定期清理过期缓存
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanup();
  }, 60000); // 每分钟清理一次
}

// 缓存装饰器
export function cached(ttl: number = 5 * 60 * 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}.${propertyKey}.${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      const cached = cacheManager.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);
      
      // 缓存结果
      cacheManager.set(cacheKey, result, ttl);
      
      return result;
    };

    return descriptor;
  };
}

// React Hook for caching
export function useCache<T>(key: string, fetcher: () => Promise<T>, ttl?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 尝试从缓存获取
        const cached = cacheManager.get<T>(key);
        if (cached !== null) {
          setData(cached);
          setLoading(false);
          return;
        }

        // 从fetcher获取数据
        const result = await fetcher();
        cacheManager.set(key, result, ttl);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [key, fetcher, ttl]);

  const invalidate = () => {
    cacheManager.remove(key);
  };

  return { data, loading, error, invalidate };
}

import { useState, useEffect } from 'react';

// API缓存工具
export class ApiCache {
  private static instance: ApiCache;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static getInstance(): ApiCache {
    if (!ApiCache.instance) {
      ApiCache.instance = new ApiCache();
    }
    return ApiCache.instance;
  }

  async fetch<T>(url: string, options: RequestInit = {}, ttl: number = 5 * 60 * 1000): Promise<T> {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // 发起请求
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 缓存结果
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    return data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCache = ApiCache.getInstance();