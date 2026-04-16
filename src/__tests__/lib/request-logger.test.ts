/**
 * request-logger.ts 测试
 * 测试请求日志记录功能
 */

import { requestLogger, withRequestLogging } from '@/lib/request-logger';

describe('request-logger', () => {
  beforeEach(() => {
    requestLogger.clear();
  });

  describe('RequestLogger', () => {
    describe('log', () => {
      it('should add log to logs array', () => {
        // Arrange
        const log = {
          method: 'GET',
          url: '/api/test',
          headers: { 'content-type': 'application/json' },
          timestamp: new Date().toISOString()
        };

        // Act
        requestLogger.log(log);

        // Assert
        const recentLogs = requestLogger.getRecentLogs(1);
        expect(recentLogs).toHaveLength(1);
        expect(recentLogs[0]).toEqual(log);
      });

      it('should maintain max logs limit', () => {
        // Arrange
        const maxLogs = 1000;
        
        // Act - Add more than max logs
        for (let i = 0; i < maxLogs + 100; i++) {
          requestLogger.log({
            method: 'GET',
            url: `/api/test-${i}`,
            headers: {},
            timestamp: new Date().toISOString()
          });
        }

        // Assert
        const allLogs = requestLogger.getRecentLogs(maxLogs + 200);
        expect(allLogs).toHaveLength(maxLogs);
        
        // Should keep the most recent logs
        expect(allLogs[0]?.url).toBe('/api/test-100');
        expect(allLogs[maxLogs - 1]?.url).toBe(`/api/test-${maxLogs + 99}`);
      });

      it('should log to console in development environment', () => {
        // Arrange
        const originalEnv = process.env.NODE_ENV;
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'development',
          writable: true,
          configurable: true
        });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        const log = {
          method: 'GET',
          url: '/api/test',
          headers: {},
          duration: 150,
          statusCode: 200,
          timestamp: new Date().toISOString()
        };

        // Act
        requestLogger.log(log);

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          '[API] ✓ GET /api/test - 150ms - 200'
        );

        // Cleanup
        consoleSpy.mockRestore();
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
      });

      it('should show error symbol for error status codes', () => {
        // Arrange
        const originalEnv = process.env.NODE_ENV;
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'development',
          writable: true,
          configurable: true
        });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        const log = {
          method: 'POST',
          url: '/api/error',
          headers: {},
          duration: 50,
          statusCode: 500,
          timestamp: new Date().toISOString()
        };

        // Act
        requestLogger.log(log);

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          '[API] ✗ POST /api/error - 50ms - 500'
        );

        // Cleanup
        consoleSpy.mockRestore();
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
      });

      it('should handle missing duration and status code', () => {
        // Arrange
        const originalEnv = process.env.NODE_ENV;
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'development',
          writable: true,
          configurable: true
        });
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        const log = {
          method: 'GET',
          url: '/api/test',
          headers: {},
          timestamp: new Date().toISOString()
        };

        // Act
        requestLogger.log(log);

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
          '[API] ? GET /api/test - undefinedms - N/A'
        );

        // Cleanup
        consoleSpy.mockRestore();
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
      });

      it('should not log to console in production environment', () => {
        // Arrange
        const originalEnv = process.env.NODE_ENV;
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        
        // Set production environment before creating logger instance
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: 'production',
          writable: true,
          configurable: true
        });
        
        const log = {
          method: 'GET',
          url: '/api/test',
          headers: {},
          timestamp: new Date().toISOString()
        };

        // Act
        requestLogger.log(log);

        // Assert
        expect(consoleSpy).not.toHaveBeenCalled();

        // Cleanup
        Object.defineProperty(process.env, 'NODE_ENV', {
          value: originalEnv,
          writable: true,
          configurable: true
        });
        consoleSpy.mockRestore();
      });
    });

    describe('getRecentLogs', () => {
      it('should return recent logs with default count', () => {
        // Arrange
        for (let i = 0; i < 150; i++) {
          requestLogger.log({
            method: 'GET',
            url: `/api/test-${i}`,
            headers: {},
            timestamp: new Date().toISOString()
          });
        }

        // Act
        const recentLogs = requestLogger.getRecentLogs();

        // Assert
        expect(recentLogs).toHaveLength(100);
        expect(recentLogs[0]?.url).toBe('/api/test-50');
        expect(recentLogs[99]?.url).toBe('/api/test-149');
      });

      it('should return recent logs with custom count', () => {
        // Arrange
        for (let i = 0; i < 50; i++) {
          requestLogger.log({
            method: 'GET',
            url: `/api/test-${i}`,
            headers: {},
            timestamp: new Date().toISOString()
          });
        }

        // Act
        const recentLogs = requestLogger.getRecentLogs(10);

        // Assert
        expect(recentLogs).toHaveLength(10);
        expect(recentLogs[0]?.url).toBe('/api/test-40');
        expect(recentLogs[9]?.url).toBe('/api/test-49');
      });
    });

    describe('getErrorLogs', () => {
      it('should return logs with error messages', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/success',
          headers: {},
          statusCode: 200,
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'POST',
          url: '/api/error',
          headers: {},
          error: 'Something went wrong',
          timestamp: new Date().toISOString()
        });

        // Act
        const errorLogs = requestLogger.getErrorLogs();

        // Assert
        expect(errorLogs).toHaveLength(1);
        expect(errorLogs).toHaveLength(1);
        expect(errorLogs[0]!.url).toBe('/api/error');
        expect(errorLogs[0]!.error).toBe('Something went wrong');
      });

      it('should return logs with error status codes', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/success',
          headers: {},
          statusCode: 200,
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'GET',
          url: '/api/not-found',
          headers: {},
          statusCode: 404,
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'POST',
          url: '/api/server-error',
          headers: {},
          statusCode: 500,
          timestamp: new Date().toISOString()
        });

        // Act
        const errorLogs = requestLogger.getErrorLogs();

        // Assert
        expect(errorLogs).toHaveLength(2);
        expect(errorLogs[0]?.statusCode).toBe(404);
        expect(errorLogs[1]?.statusCode).toBe(500);
      });
    });

    describe('getSlowRequests', () => {
      it('should return requests slower than default threshold', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/fast',
          headers: {},
          duration: 500,
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'GET',
          url: '/api/slow',
          headers: {},
          duration: 1500,
          timestamp: new Date().toISOString()
        });

        // Act
        const slowRequests = requestLogger.getSlowRequests();

        // Assert
        expect(slowRequests).toHaveLength(1);
        expect(slowRequests[0]?.url).toBe('/api/slow');
        expect(slowRequests[0]?.duration).toBe(1500);
      });

      it('should return requests slower than custom threshold', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/medium',
          headers: {},
          duration: 300,
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'GET',
          url: '/api/slow',
          headers: {},
          duration: 600,
          timestamp: new Date().toISOString()
        });

        // Act
        const slowRequests = requestLogger.getSlowRequests(500);

        // Assert
        expect(slowRequests).toHaveLength(1);
        expect(slowRequests[0]?.url).toBe('/api/slow');
      });

      it('should handle requests without duration', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/no-duration',
          headers: {},
          timestamp: new Date().toISOString()
        });

        // Act
        const slowRequests = requestLogger.getSlowRequests();

        // Assert
        expect(slowRequests).toHaveLength(0);
      });
    });

    describe('getLogsByUser', () => {
      it('should return logs for specific user', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/user1',
          headers: {},
          userId: 'user1',
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'GET',
          url: '/api/user2',
          headers: {},
          userId: 'user2',
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'POST',
          url: '/api/user1-post',
          headers: {},
          userId: 'user1',
          timestamp: new Date().toISOString()
        });

        // Act
        const user1Logs = requestLogger.getLogsByUser('user1');

        // Assert
        expect(user1Logs).toHaveLength(2);
        expect(user1Logs[0]?.url).toBe('/api/user1');
        expect(user1Logs[1]?.url).toBe('/api/user1-post');
      });

      it('should return empty array for non-existent user', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/test',
          headers: {},
          userId: 'user1',
          timestamp: new Date().toISOString()
        });

        // Act
        const userLogs = requestLogger.getLogsByUser('non-existent');

        // Assert
        expect(userLogs).toHaveLength(0);
      });
    });

    describe('clear', () => {
      it('should clear all logs', () => {
        // Arrange
        requestLogger.log({
          method: 'GET',
          url: '/api/test1',
          headers: {},
          timestamp: new Date().toISOString()
        });
        
        requestLogger.log({
          method: 'GET',
          url: '/api/test2',
          headers: {},
          timestamp: new Date().toISOString()
        });

        // Act
        requestLogger.clear();

        // Assert
        expect(requestLogger.getRecentLogs()).toHaveLength(0);
      });
    });
  });

  describe('withRequestLogging', () => {
    it('should log successful requests', async () => {
      // Arrange
      const mockResponse = { status: 200 };
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withRequestLogging(mockHandler);
      
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: new Map([['content-type', 'application/json']])
      };

      // Act
      const response = await wrappedHandler(mockRequest);

      // Assert
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      
      const logs = requestLogger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs).toHaveLength(1);
        expect(logs[0]!.method).toBe('GET');
        expect(logs[0]!.url).toBe('/api/test');
        expect(logs[0]!.statusCode).toBe(200);
        expect(logs[0]!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should log failed requests', async () => {
      // Arrange
      const error = new Error('Handler failed');
      const mockHandler = jest.fn().mockRejectedValue(error);
      const wrappedHandler = withRequestLogging(mockHandler);
      
      const mockRequest = {
        method: 'POST',
        url: '/api/error',
        headers: new Map()
      };

      // Act & Assert
      await expect(wrappedHandler(mockRequest)).rejects.toThrow('Handler failed');
      
      const logs = requestLogger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs).toHaveLength(1);
        expect(logs[0]!.method).toBe('POST');
        expect(logs[0]!.url).toBe('/api/error');
        expect(logs[0]!.error).toBe('Handler failed');
        expect(logs[0]!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should log request body when enabled', async () => {
      // Arrange
      const mockResponse = { status: 200 };
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withRequestLogging(mockHandler, { logBody: true });
      
      const requestBody = { test: 'data' };
      const mockRequest = {
        method: 'POST',
        url: '/api/test',
        headers: new Map(),
        body: JSON.stringify(requestBody),
        clone: () => ({
          json: () => Promise.resolve(requestBody)
        })
      };

      // Act
      await wrappedHandler(mockRequest);

      // Assert
      const logs = requestLogger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs).toHaveLength(1);
        expect(logs[0]!.body).toEqual(requestBody);
    });

    it('should handle request body parsing errors', async () => {
      // Arrange
      const mockResponse = { status: 200 };
      const mockHandler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withRequestLogging(mockHandler, { logBody: true });
      
      const mockRequest = {
        method: 'POST',
        url: '/api/test',
        headers: new Map(),
        body: 'invalid json',
        clone: () => ({
          json: () => Promise.reject(new Error('Invalid JSON'))
        })
      };

      // Act
      await wrappedHandler(mockRequest);

      // Assert
      const logs = requestLogger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      expect(logs).toHaveLength(1);
        expect(logs[0]!.body).toBeUndefined();
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const mockHandler = jest.fn().mockRejectedValue('String error');
      const wrappedHandler = withRequestLogging(mockHandler);
      
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: new Map()
      };

      // Act & Assert
      await expect(wrappedHandler(mockRequest)).rejects.toBe('String error');
      
      const errorLogs = requestLogger.getErrorLogs();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs).toHaveLength(1);
        expect(errorLogs[0]!.error).toBe('String error');
    });
  });
});