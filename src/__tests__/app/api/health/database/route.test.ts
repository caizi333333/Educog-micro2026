import { GET } from '@/app/api/health/database/route';
import { createHealthCheckResponse } from '@/lib/db-health-check';
import { NextResponse } from 'next/server';

// Mock the dependencies
jest.mock('@/lib/db-health-check');
jest.mock('next/server');

const mockCreateHealthCheckResponse = createHealthCheckResponse as jest.MockedFunction<typeof createHealthCheckResponse>;
const mockNextResponse = {
  json: jest.fn()
};

(NextResponse.json as jest.Mock) = mockNextResponse.json;

describe('/api/health/database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('GET', () => {
    it('should return 200 when database is connected', async () => {
      const mockHealthCheck = {
        timestamp: '2024-01-01T00:00:00.000Z',
        database: {
          isConnected: true,
          responseTime: 50,
          version: '14.0'
        },
        recommendations: [
          '数据库连接正常',
          '响应时间良好'
        ]
      };

      mockCreateHealthCheckResponse.mockResolvedValue(mockHealthCheck as any);
      mockNextResponse.json.mockReturnValue({ status: 200 });

      await GET();

      expect(mockCreateHealthCheckResponse).toHaveBeenCalledTimes(1);
      expect(mockNextResponse.json).toHaveBeenCalledWith(mockHealthCheck, {
        status: 200
      });
    });

    it('should return 503 when database is not connected', async () => {
      const mockHealthCheck = {
        timestamp: '2024-01-01T00:00:00.000Z',
        database: {
          isConnected: false,
          error: 'Connection timeout'
        },
        recommendations: [
          '数据库连接失败',
          '请检查数据库服务状态'
        ]
      };

      mockCreateHealthCheckResponse.mockResolvedValue(mockHealthCheck as any);
      mockNextResponse.json.mockReturnValue({ status: 503 });

      await GET();

      expect(mockCreateHealthCheckResponse).toHaveBeenCalledTimes(1);
      expect(mockNextResponse.json).toHaveBeenCalledWith(mockHealthCheck, {
        status: 503
      });
    });

    it('should handle errors and return 503', async () => {
      const mockError = new Error('Database connection failed');
      mockCreateHealthCheckResponse.mockRejectedValue(mockError);
      mockNextResponse.json.mockReturnValue({ status: 503 });

      await GET();

      expect(console.error).toHaveBeenCalledWith('健康检查失败:', mockError);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        database: {
          isConnected: false,
          error: 'Database connection failed'
        },
        recommendations: [
          '无法执行健康检查',
          '请检查应用程序配置',
          '联系技术支持获取帮助'
        ]
      }, { status: 503 });
    });

    it('should handle non-Error exceptions', async () => {
      const mockError = 'String error';
      mockCreateHealthCheckResponse.mockRejectedValue(mockError);
      mockNextResponse.json.mockReturnValue({ status: 503 });

      await GET();

      expect(console.error).toHaveBeenCalledWith('健康检查失败:', mockError);
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        database: {
          isConnected: false,
          error: '健康检查失败'
        },
        recommendations: [
          '无法执行健康检查',
          '请检查应用程序配置',
          '联系技术支持获取帮助'
        ]
      }, { status: 503 });
    });

    it('should include valid timestamp in error response', async () => {
      const mockError = new Error('Test error');
      mockCreateHealthCheckResponse.mockRejectedValue(mockError);
      mockNextResponse.json.mockReturnValue({ status: 503 });

      const beforeTime = new Date().toISOString();
      await GET();
      const afterTime = new Date().toISOString();

      const callArgs = mockNextResponse.json.mock.calls[0][0];
      const timestamp = callArgs.timestamp;
      
      expect(timestamp).toBeDefined();
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });

    it('should return proper error structure', async () => {
      const mockError = new Error('Connection refused');
      mockCreateHealthCheckResponse.mockRejectedValue(mockError);
      mockNextResponse.json.mockReturnValue({ status: 503 });

      await GET();

      const callArgs = mockNextResponse.json.mock.calls[0][0];
      
      expect(callArgs).toHaveProperty('timestamp');
      expect(callArgs).toHaveProperty('database');
      expect(callArgs).toHaveProperty('recommendations');
      expect(callArgs.database).toHaveProperty('isConnected', false);
      expect(callArgs.database).toHaveProperty('error', 'Connection refused');
      expect(Array.isArray(callArgs.recommendations)).toBe(true);
      expect(callArgs.recommendations).toHaveLength(3);
    });
  });
});