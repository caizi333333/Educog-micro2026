import { CacheManager } from '@/lib/cache-manager';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockDateNow: jest.SpyInstance;
  const fixedTimestamp = 1640995200000; // 2022-01-01 00:00:00

  beforeEach(() => {
    // Mock Date.now()
    mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
    
    jest.clearAllMocks();
    cacheManager = new CacheManager();
    
    // Reset mock implementations
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    mockLocalStorage.removeItem.mockImplementation(() => {});
    mockLocalStorage.clear.mockImplementation(() => {});
    
    mockSessionStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockImplementation(() => {});
    mockSessionStorage.removeItem.mockImplementation(() => {});
    mockSessionStorage.clear.mockImplementation(() => {});
  });

  afterEach(() => {
    // 恢复Date.now()
    mockDateNow.mockRestore();
  });

  describe('基本缓存操作', () => {
    it('应该正确设置和获取缓存项', () => {
      const key = 'test-key';
      const value = { data: 'test-data', number: 123 };
      
      cacheManager.set(key, value);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        key,
        JSON.stringify({
          value,
          timestamp: fixedTimestamp,
          ttl: null
        })
      );
    });

    it('应该正确获取存在的缓存项', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      const cacheData = {
        value,
        timestamp: fixedTimestamp,
        ttl: null
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const result = cacheManager.get(key);
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it('应该为不存在的缓存项返回null', () => {
      const key = 'non-existent-key';
      
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
    });

    it('应该正确删除缓存项', () => {
      const key = 'test-key';
      
      cacheManager.remove(key);
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('应该正确清空所有缓存', () => {
      cacheManager.clear();
      
      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });

  describe('TTL (生存时间) 功能', () => {
    it('应该正确设置带TTL的缓存项', () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 3600; // 1小时
      
      cacheManager.set(key, value, ttl);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        key,
        JSON.stringify({
          value,
          timestamp: fixedTimestamp,
          ttl
        })
      );
    });

    it('应该返回未过期的缓存项', () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const cacheData = {
        value,
        timestamp: fixedTimestamp,
        ttl: 3600 // 1小时
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const result = cacheManager.get(key);
      
      expect(result).toBe(value);
    });

    it('应该自动删除过期的缓存项', () => {
      const key = 'expired-key';
      const value = 'expired-value';
      const cacheData = {
        value,
        timestamp: fixedTimestamp - 7200000, // 2小时前
        ttl: 3600 // 1小时TTL
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('应该正确处理永不过期的缓存项', () => {
      const key = 'permanent-key';
      const value = 'permanent-value';
      const cacheData = {
        value,
        timestamp: fixedTimestamp - 86400000, // 1天前
        ttl: null // 永不过期
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const result = cacheManager.get(key);
      
      expect(result).toBe(value);
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('存储类型选择', () => {
    it('应该使用localStorage作为默认存储', () => {
      const key = 'default-storage-key';
      const value = 'default-storage-value';
      
      cacheManager.set(key, value);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('应该能够使用sessionStorage', () => {
      const sessionCacheManager = new CacheManager('session');
      const key = 'session-key';
      const value = 'session-value';
      
      sessionCacheManager.set(key, value);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('应该从正确的存储中获取数据', () => {
      const sessionCacheManager = new CacheManager('session');
      const key = 'session-key';
      const value = 'session-value';
      const cacheData = {
        value,
        timestamp: fixedTimestamp,
        ttl: null
      };
      
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const result = sessionCacheManager.get(key);
      
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith(key);
      expect(result).toBe(value);
    });
  });

  describe('数据类型处理', () => {
    it('应该正确处理字符串类型', () => {
      const key = 'string-key';
      const value = 'string-value';
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          value,
          timestamp: fixedTimestamp,
          ttl: null
        }));
      
      const result = cacheManager.get(key);
      
      expect(result).toBe(value);
      expect(typeof result).toBe('string');
    });

    it('应该正确处理数字类型', () => {
      const key = 'number-key';
      const value = 12345;
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
          value,
          timestamp: fixedTimestamp,
          ttl: null
        }));
      
      const result = cacheManager.get(key);
      
      expect(result).toBe(value);
      expect(typeof result).toBe('number');
    });

    it('应该正确处理布尔类型', () => {
      const key = 'boolean-key';
      const value = true;
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        value,
        timestamp: Date.now(),
        ttl: null
      }));
      
      const result = cacheManager.get(key);
      
      expect(result).toBe(value);
      expect(typeof result).toBe('boolean');
    });

    it('应该正确处理对象类型', () => {
      const key = 'object-key';
      const value = {
        name: 'Test Object',
        count: 42,
        active: true,
        nested: {
          property: 'nested-value'
        }
      };
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        value,
        timestamp: Date.now(),
        ttl: null
      }));
      
      const result = cacheManager.get(key);
      
      expect(result).toEqual(value);
      expect(typeof result).toBe('object');
    });

    it('应该正确处理数组类型', () => {
      const key = 'array-key';
      const value = [1, 'two', { three: 3 }, [4, 5]];
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        value,
        timestamp: Date.now(),
        ttl: null
      }));
      
      const result = cacheManager.get(key);
      
      expect(result).toEqual(value);
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该正确处理null值', () => {
      const key = 'null-key';
      const value = null;
      
      cacheManager.set(key, value);
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        value,
        timestamp: Date.now(),
        ttl: null
      }));
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该处理JSON解析错误', () => {
      const key = 'invalid-json-key';
      
      mockLocalStorage.getItem.mockReturnValue('invalid json string');
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('应该处理localStorage设置错误', () => {
      const key = 'error-key';
      const value = 'error-value';
      
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      expect(() => {
        cacheManager.set(key, value);
      }).not.toThrow();
    });

    it('应该处理localStorage获取错误', () => {
      const key = 'error-key';
      
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
    });

    it('应该处理localStorage删除错误', () => {
      const key = 'error-key';
      
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      expect(() => {
        cacheManager.remove(key);
      }).not.toThrow();
    });

    it('应该处理缺少timestamp的缓存数据', () => {
      const key = 'invalid-cache-key';
      const invalidCacheData = {
        value: 'test-value'
        // 缺少timestamp和ttl
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(invalidCacheData));
      
      const result = cacheManager.get(key);
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
    });
  });

  describe('缓存统计和管理', () => {
    it('应该正确检查缓存项是否存在', () => {
      const key = 'exists-key';
      const cacheData = {
        value: 'test-value',
        timestamp: fixedTimestamp,
        ttl: null
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const exists = cacheManager.has(key);
      
      expect(exists).toBe(true);
    });

    it('应该为不存在的缓存项返回false', () => {
      const key = 'non-exists-key';
      
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const exists = cacheManager.has(key);
      
      expect(exists).toBe(false);
    });

    it('应该为过期的缓存项返回false', () => {
      const key = 'expired-key';
      const cacheData = {
        value: 'test-value',
        timestamp: fixedTimestamp - 7200000, // 2小时前
        ttl: 3600 // 1小时TTL
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const exists = cacheManager.has(key);
      
      expect(exists).toBe(false);
    });

    it('应该正确获取缓存大小', () => {
      mockLocalStorage.length = 5;
      
      const size = cacheManager.size();
      
      expect(size).toBe(5);
    });

    it('应该正确获取所有缓存键', () => {
      const keys = ['key1', 'key2', 'key3'];
      
      mockLocalStorage.length = keys.length;
      mockLocalStorage.key.mockImplementation((index) => keys[index]);
      
      const allKeys = cacheManager.keys();
      
      expect(allKeys).toEqual(keys);
    });
  });

  describe('批量操作', () => {
    it('应该支持批量设置缓存项', () => {
      const items: Record<string, unknown> = {
        'key1': 'value1',
        'key2': { data: 'value2' },
        'key3': 123
      };
      
      cacheManager.setMultiple(items);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
      Object.keys(items).forEach(key => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          key,
          expect.stringContaining(JSON.stringify(items[key]))
        );
      });
    });

    it('应该支持批量获取缓存项', () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];
      
      // 先设置缓存项
      keys.forEach((key, index) => {
        cacheManager.set(key, values[index]);
      });
      
      // 重置mock并设置正确的返回值
       mockLocalStorage.getItem.mockImplementation((k) => {
         const index = keys.indexOf(k);
         if (index !== -1) {
           return JSON.stringify({
             value: values[index],
             timestamp: fixedTimestamp,
             ttl: null
           });
         }
         return null;
       });
      
      const results = cacheManager.getMultiple(keys);
      
      expect(results).toEqual({
        'key1': 'value1',
        'key2': 'value2',
        'key3': 'value3'
      });
    });

    it('应该支持批量删除缓存项', () => {
      const keys = ['key1', 'key2', 'key3'];
      
      cacheManager.removeMultiple(keys);
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
      keys.forEach(key => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key);
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量缓存操作', () => {
      const startTime = performance.now();
      
      // 设置1000个缓存项
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`key${i}`, `value${i}`);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该在合理时间内处理大量缓存查询', () => {
      const cacheData = {
        value: 'test-value',
        timestamp: fixedTimestamp,
        ttl: null
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
      
      const startTime = performance.now();
      
      // 查询1000次
      for (let i = 0; i < 1000; i++) {
        cacheManager.get('test-key');
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100); // 应该在100毫秒内完成
    });
  });

  describe('内存管理', () => {
    it('应该正确清理过期的缓存项', () => {
      const keys = ['key1', 'key2', 'key3'];
      const now = fixedTimestamp;
      
      mockLocalStorage.length = keys.length;
      mockLocalStorage.key.mockImplementation((index) => keys[index]);
      
      // 模拟不同的缓存状态
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'key1') {
          // 未过期
          return JSON.stringify({
            value: 'value1',
            timestamp: now,
            ttl: 3600
          });
        } else if (key === 'key2') {
          // 已过期
          return JSON.stringify({
            value: 'value2',
            timestamp: now - 7200000,
            ttl: 3600
          });
        } else {
          // 永不过期
          return JSON.stringify({
            value: 'value3',
            timestamp: now - 86400000,
            ttl: null
          });
        }
      });
      
      cacheManager.cleanup();
      
      // 只有过期的key2应该被删除
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('key2');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('key1');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('key3');
    });
  });
});