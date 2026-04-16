/**
 * db-health-check.ts 测试
 * 测试数据库健康检查功能
 */

import {
  checkDatabaseHealth,
  getDatabaseInfo,
  createHealthCheckResponse,
  DatabaseHealthStatus
} from '@/lib/db-health-check';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn()
  }
}));

import { prisma } from '@/lib/prisma';

describe('db-health-check', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000) // Start time
      .mockReturnValueOnce(1050); // End time (50ms latency)
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database connection succeeds', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(true);
      expect(result.latency).toBe(50);
      expect(result.error).toBeUndefined();
      expect(result.suggestions).toBeUndefined();
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should return unhealthy status with timeout suggestions when connection times out', async () => {
      // Arrange
      const timeoutError = new Error('Connection timeout occurred');
      mockPrisma.$queryRaw.mockRejectedValue(timeoutError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('Connection timeout occurred');
      expect(result.suggestions).toContain('检查网络连接是否正常');
      expect(result.suggestions).toContain('确认数据库服务器是否在线');
      expect(result.suggestions).toContain('检查防火墙设置');
    });

    it('should return unhealthy status with connect suggestions when connection fails', async () => {
      // Arrange
      const connectError = new Error('Failed to connect to database');
      mockPrisma.$queryRaw.mockRejectedValue(connectError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('Failed to connect to database');
      expect(result.suggestions).toContain('检查网络连接是否正常');
      expect(result.suggestions).toContain('确认数据库服务器是否在线');
      expect(result.suggestions).toContain('检查防火墙设置');
    });

    it('should return unhealthy status with authentication suggestions when auth fails', async () => {
      // Arrange
      const authError = new Error('Authentication failed: invalid password');
      mockPrisma.$queryRaw.mockRejectedValue(authError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('Authentication failed: invalid password');
      expect(result.suggestions).toContain('检查数据库用户名和密码');
      expect(result.suggestions).toContain('确认数据库用户权限');
    });

    it('should return unhealthy status with database suggestions when database does not exist', async () => {
      // Arrange
      const dbError = new Error('database "testdb" does not exist');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('database "testdb" does not exist');
      expect(result.suggestions).toContain('确认数据库名称是否正确');
      expect(result.suggestions).toContain('检查数据库是否已创建');
    });

    it('should return unhealthy status with SSL suggestions when SSL error occurs', async () => {
      // Arrange
      const sslError = new Error('SSL connection required');
      mockPrisma.$queryRaw.mockRejectedValue(sslError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('SSL connection required');
      expect(result.suggestions).toContain('检查SSL/TLS配置');
      expect(result.suggestions).toContain('确认数据库是否要求SSL连接');
    });

    it('should return unhealthy status with TLS suggestions when TLS error occurs', async () => {
      // Arrange
      const tlsError = new Error('TLS handshake failed');
      mockPrisma.$queryRaw.mockRejectedValue(tlsError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('TLS handshake failed');
      expect(result.suggestions).toContain('检查SSL/TLS配置');
      expect(result.suggestions).toContain('确认数据库是否要求SSL连接');
    });

    it('should return unhealthy status with generic suggestions for unknown errors', async () => {
      // Arrange
      const unknownError = new Error('Some unknown database error');
      mockPrisma.$queryRaw.mockRejectedValue(unknownError);
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('Some unknown database error');
      expect(result.suggestions).toContain('检查DATABASE_URL环境变量配置');
      expect(result.suggestions).toContain('确认数据库服务提供商状态');
      expect(result.suggestions).toContain('尝试重启应用程序');
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockRejectedValue('String error');
      
      // Act
      const result = await checkDatabaseHealth();
      
      // Assert
      expect(result.isConnected).toBe(false);
      expect(result.error).toBe('未知错误');
      expect(result.suggestions).toContain('检查DATABASE_URL环境变量配置');
    });
  });

  describe('getDatabaseInfo', () => {
    const originalEnv = process.env;
    
    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });
    
    afterAll(() => {
      process.env = originalEnv;
    });

    it('should parse valid PostgreSQL database URL', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('postgresql');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe('5432');
      expect(result.database).toBe('testdb');
      expect(result.hasCredentials).toBe(true);
    });

    it('should parse valid MySQL database URL', () => {
      // Arrange
      process.env.DATABASE_URL = 'mysql://admin:secret@db.example.com:3306/myapp';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('mysql');
      expect(result.host).toBe('db.example.com');
      expect(result.port).toBe('3306');
      expect(result.database).toBe('myapp');
      expect(result.hasCredentials).toBe(true);
    });

    it('should handle database URL without port', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://user:password@localhost/testdb';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('postgresql');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe('默认端口');
      expect(result.database).toBe('testdb');
      expect(result.hasCredentials).toBe(true);
    });

    it('should handle database URL without credentials', () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://localhost:5432/testdb';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('postgresql');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe('5432');
      expect(result.database).toBe('testdb');
      expect(result.hasCredentials).toBe(false);
    });

    it('should handle missing DATABASE_URL environment variable', () => {
      // Arrange
      delete process.env.DATABASE_URL;
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('未知');
      expect(result.host).toBe('未配置');
      expect(result.port).toBe('未知');
      expect(result.database).toBe('未知');
      expect(result.hasCredentials).toBe(false);
    });

    it('should handle invalid DATABASE_URL format', () => {
      // Arrange
      process.env.DATABASE_URL = 'invalid-url-format';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('未知');
      expect(result.host).toBe('未配置');
      expect(result.port).toBe('未知');
      expect(result.database).toBe('未知');
      expect(result.hasCredentials).toBe(false);
    });

    it('should handle empty DATABASE_URL', () => {
      // Arrange
      process.env.DATABASE_URL = '';
      
      // Act
      const result = getDatabaseInfo();
      
      // Assert
      expect(result.provider).toBe('未知');
      expect(result.host).toBe('未配置');
      expect(result.port).toBe('未知');
      expect(result.database).toBe('未知');
      expect(result.hasCredentials).toBe(false);
    });
  });

  describe('createHealthCheckResponse', () => {
    const originalEnv = process.env;
    let dateNowSpy: jest.SpyInstance;
    
    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/testdb';
      // Mock Date.now for consistent timestamps
      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    });
    
    afterAll(() => {
      process.env = originalEnv;
      dateNowSpy?.mockRestore();
    });

    it('should create successful health check response', async () => {
      // Arrange
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      
      // Act
      const result = await createHealthCheckResponse();
      
      // Assert
      expect(result.timestamp).toBeDefined();
      expect(result.database.isConnected).toBe(true);
      expect(result.database.latency).toBeGreaterThanOrEqual(0);
      expect(result.database.info.provider).toBe('postgresql');
      expect(result.database.info.host).toBe('localhost');
      expect(result.database.info.port).toBe('5432');
      expect(result.database.info.database).toBe('testdb');
      expect(result.database.info.hasCredentials).toBe(true);
      expect(result.recommendations).toEqual(['数据库连接正常']);
    });

    it('should create failed health check response', async () => {
      // Arrange
      const dbError = new Error('Connection failed');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);
      
      // Act
      const result = await createHealthCheckResponse();
      
      // Assert
      expect(result.timestamp).toBeDefined();
      expect(result.database.isConnected).toBe(false);
      expect(result.database.error).toBe('Connection failed');
      expect(result.database.info.provider).toBe('postgresql');
      expect(result.recommendations[0]).toBe('数据库连接失败，请检查以下项目：');
      expect(result.recommendations).toContain('检查DATABASE_URL环境变量配置');
    });

    it('should include specific suggestions in failed response', async () => {
      // Arrange
      const timeoutError = new Error('Connection timeout');
      mockPrisma.$queryRaw.mockRejectedValue(timeoutError);
      
      // Act
      const result = await createHealthCheckResponse();
      
      // Assert
      expect(result.database.isConnected).toBe(false);
      expect(result.recommendations).toContain('数据库连接失败，请检查以下项目：');
      expect(result.recommendations).toContain('检查网络连接是否正常');
      expect(result.recommendations).toContain('确认数据库服务器是否在线');
      expect(result.recommendations).toContain('检查防火墙设置');
    });

    it('should handle health check response with empty suggestions array', async () => {
      // Arrange
      const unknownError = new Error('Unknown database error');
      mockPrisma.$queryRaw.mockRejectedValue(unknownError);
      
      // Act
      const result = await createHealthCheckResponse();
      
      // Assert
      expect(result.database.isConnected).toBe(false);
      expect(result.database.error).toBe('Unknown database error');
      expect(result.recommendations[0]).toBe('数据库连接失败，请检查以下项目：');
      expect(result.recommendations).toContain('检查DATABASE_URL环境变量配置');
      expect(result.recommendations).toContain('确认数据库服务提供商状态');
      expect(result.recommendations).toContain('尝试重启应用程序');
    });
  });

  describe('DatabaseHealthStatus interface', () => {
    it('should allow valid health status objects', () => {
      // Test successful status
      const successStatus: DatabaseHealthStatus = {
        isConnected: true,
        latency: 100
      };
      
      expect(successStatus.isConnected).toBe(true);
      expect(successStatus.latency).toBe(100);
      
      // Test failed status
      const failedStatus: DatabaseHealthStatus = {
        isConnected: false,
        error: 'Connection failed',
        suggestions: ['Check connection']
      };
      
      expect(failedStatus.isConnected).toBe(false);
      expect(failedStatus.error).toBe('Connection failed');
      expect(failedStatus.suggestions).toEqual(['Check connection']);
    });
  });
});