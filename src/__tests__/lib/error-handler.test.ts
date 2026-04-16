import {
  ErrorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ErrorCode,
  ErrorSeverity
} from '@/lib/error-handler';
import { NextResponse } from 'next/server';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

// Mock console methods
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

Object.assign(console, mockConsole);

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((data, options) => ({
      json: data,
      status: options?.status || 200,
      headers: options?.headers || {}
    }))
  }
}));

describe('Error Handler', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('AppError 类', () => {
    it('应该正确创建基础错误', () => {
      const message = 'Test error message';
      const statusCode = 400;
      const error = new AppError(message, statusCode);
      
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
      expect(error instanceof Error).toBe(true);
    });

    it('应该使用默认状态码500', () => {
      const error = new AppError('Test error');
      
      expect(error.statusCode).toBe(500);
    });

    it('应该正确设置错误堆栈', () => {
      const error = new AppError('Test error');
      
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('ValidationError 类', () => {
    it('应该正确创建验证错误', () => {
      const message = 'Validation failed';
      const field = 'email';
      const error = new ValidationError(message, field);
      
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe(field);
      expect(error.name).toBe('ValidationError');
      expect(error instanceof AppError).toBe(true);
    });

    it('应该处理没有字段的验证错误', () => {
      const message = 'General validation error';
      const error = new ValidationError(message);
      
      expect(error.message).toBe(message);
      expect(error.field).toBeUndefined();
    });
  });

  describe('AuthenticationError 类', () => {
    it('应该正确创建认证错误', () => {
      const message = 'Authentication failed';
      const error = new AuthenticationError(message);
      
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
      expect(error instanceof AppError).toBe(true);
    });

    it('应该使用默认认证错误消息', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('NotFoundError 类', () => {
    it('应该正确创建404错误', () => {
      const resource = 'User';
      const error = new NotFoundError(resource);
      
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
      expect(error instanceof AppError).toBe(true);
    });

    it('应该使用默认404错误消息', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
    });
  });

  describe('ErrorHandler.handleError', () => {
    it('应该正确处理AppError', () => {
      const error = new AppError('Test app error', 400);
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Test app error',
            statusCode: 400,
            type: 'AppError'
          }
        },
        { status: 400 }
      );
    });

    it('应该正确处理ValidationError', () => {
      const error = new ValidationError('Invalid email format', 'email');
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Invalid email format',
            statusCode: 400,
            type: 'ValidationError',
            field: 'email'
          }
        },
        { status: 400 }
      );
    });

    it('应该正确处理AuthenticationError', () => {
      const error = new AuthenticationError('Invalid token');
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Invalid token',
            statusCode: 401,
            type: 'AuthenticationError'
          }
        },
        { status: 401 }
      );
    });

    it('应该正确处理NotFoundError', () => {
      const error = new NotFoundError('User');
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'User not found',
            statusCode: 404,
            type: 'NotFoundError'
          }
        },
        { status: 404 }
      );
    });

    it('应该正确处理普通Error', () => {
      const error = new Error('Generic error message');
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Internal server error',
            statusCode: 500,
            type: 'Error'
          }
        },
        { status: 500 }
      );
      
      expect(mockConsole.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('应该正确处理字符串错误', () => {
      const error = 'String error message';
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Internal server error',
            statusCode: 500,
            type: 'Unknown'
          }
        },
        { status: 500 }
      );
      
      expect(mockConsole.error).toHaveBeenCalledWith('Unhandled error:', error);
    });

    it('应该正确处理null/undefined错误', () => {
      const response1 = ErrorHandler.handleError(null);
      const response2 = ErrorHandler.handleError(undefined);
      
      [response1, response2].forEach(() => {
        expect(NextResponse.json).toHaveBeenCalledWith(
          {
            error: {
              message: 'Internal server error',
              statusCode: 500,
              type: 'Unknown'
            }
          },
          { status: 500 }
        );
      });
    });
  });

  describe('ErrorHandler.logError', () => {
    it('应该记录AppError到控制台', () => {
      const error = new AppError('Test error', 400);
      
      ErrorHandler.logError(error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'AppError [400]:',
        'Test error',
        expect.stringContaining('/home/user/')
      );
    });

    it('应该记录ValidationError的详细信息', () => {
      const error = new ValidationError('Invalid input', 'username');
      
      ErrorHandler.logError(error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'ValidationError [400]:',
        'Invalid input',
        'Field: username',
        expect.stringContaining('/home/user/')
      );
    });

    it('应该记录普通Error', () => {
      const error = new Error('Generic error');
      
      ErrorHandler.logError(error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error [500]:',
        'Generic error',
        expect.stringContaining('/home/user/')
      );
    });

    it('应该处理没有堆栈信息的错误', () => {
      const error = new Error('No stack error');
      delete error.stack;
      
      ErrorHandler.logError(error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error [500]:',
        'No stack error',
        'No stack trace available'
      );
    });
  });

  describe('ErrorHandler.isOperationalError', () => {
    it('应该识别操作性错误', () => {
      const operationalError = new AppError('Operational error');
      const result = ErrorHandler.isOperationalError(operationalError);
      
      expect(result).toBe(true);
    });

    it('应该识别非操作性错误', () => {
      const nonOperationalError = new Error('Programming error');
      const result = ErrorHandler.isOperationalError(nonOperationalError);
      
      expect(result).toBe(false);
    });

    it('应该处理自定义isOperational属性', () => {
      const customError = new Error('Custom error');
      (customError as any).isOperational = true;
      
      const result = ErrorHandler.isOperationalError(customError);
      
      expect(result).toBe(true);
    });
  });

  describe('ErrorHandler.createErrorResponse', () => {
    it('应该创建标准错误响应', () => {
      const message = 'Test error';
      const statusCode = 400;
      const type = 'TestError';
      
      const response = ErrorHandler.createErrorResponse(message, statusCode, type);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message,
            statusCode,
            type
          }
        },
        { status: statusCode }
      );
    });

    it('应该创建带额外数据的错误响应', () => {
      const message = 'Validation error';
      const statusCode = 400;
      const type = 'ValidationError';
      const additionalData = { field: 'email', code: 'INVALID_FORMAT' };
      
      ErrorHandler.createErrorResponse(
        message,
        statusCode,
        type,
        additionalData
      );
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message,
            statusCode,
            type,
            ...additionalData
          }
        },
        { status: statusCode }
      );
    });
  });

  describe('ErrorHandler.handleAsyncError', () => {
    it('应该正确处理异步函数中的错误', async () => {
      const asyncFunction = async () => {
        throw new AppError('Async error', 400);
      };
      
      const wrappedFunction = ErrorHandler.handleAsyncError(asyncFunction);
      await wrappedFunction();
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Async error',
            statusCode: 400,
            type: 'AppError'
          }
        },
        { status: 400 }
      );
    });

    it('应该传递参数给异步函数', async () => {
      const asyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = ErrorHandler.handleAsyncError(asyncFunction);
      
      const arg1 = 'test';
      const arg2 = { data: 'value' };
      const result = await wrappedFunction(arg1, arg2);
      
      expect(asyncFunction).toHaveBeenCalledWith(arg1, arg2);
      expect(result).toBe('success');
    });

    it('应该处理异步函数中的非AppError', async () => {
      const asyncFunction = async () => {
        throw new Error('Generic async error');
      };
      
      const wrappedFunction = ErrorHandler.handleAsyncError(asyncFunction);
      await wrappedFunction();
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Internal server error',
            statusCode: 500,
            type: 'Error'
          }
        },
        { status: 500 }
      );
    });
  });

  describe('错误边界情况', () => {
    it('应该处理循环引用的错误对象', () => {
      const error = new AppError('Circular reference error');
      const circular: any = { error };
      circular.self = circular;
      (error as any).data = circular;
      
      expect(() => {
        ErrorHandler.handleError(error);
      }).not.toThrow();
    });

    it('应该处理非常长的错误消息', () => {
      const longMessage = 'A'.repeat(10000);
      const error = new AppError(longMessage);
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: longMessage
          })
        }),
        { status: 500 }
      );
    });

    it('应该处理包含特殊字符的错误消息', () => {
      const specialMessage = 'Error with special chars: <>&"\'\'\n\t';
      const error = new AppError(specialMessage);
      
      ErrorHandler.handleError(error);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: specialMessage
          })
        }),
        { status: 500 }
      );
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量错误', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const error = new AppError(`Error ${i}`, 400);
        ErrorHandler.handleError(error);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该在合理时间内记录大量错误', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const error = new AppError(`Error ${i}`, 400);
        ErrorHandler.logError(error);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(500); // 应该在500毫秒内完成
    });
  });

  describe('内存管理', () => {
    it('应该不会导致内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 创建大量错误对象
      for (let i = 0; i < 10000; i++) {
        const error = new AppError(`Error ${i}`, 400);
        ErrorHandler.handleError(error);
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('安全性测试', () => {
    it('应该防止错误消息中的敏感信息泄露', () => {
      const sensitiveError = new Error('Database connection failed: password=secret123');
      
      ErrorHandler.handleError(sensitiveError);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          error: {
            message: 'Internal server error', // 不应该暴露原始错误消息
            statusCode: 500,
            type: 'Error'
          }
        },
        { status: 500 }
      );
    });

    it('应该清理错误堆栈中的敏感路径', () => {
      const error = new AppError('Test error');
      
      ErrorHandler.logError(error);
      
      // 验证日志记录不包含敏感信息
      expect(mockConsole.error).toHaveBeenCalled();
      const loggedArgs = mockConsole.error.mock.calls[0];
      
      // 确保没有记录绝对路径或敏感信息
      loggedArgs.forEach((arg: any) => {
        if (typeof arg === 'string') {
          expect(arg).not.toMatch(/\/Users\/.*\//);
          expect(arg).not.toMatch(/password|secret|token/i);
        }
      });
    });
  });
});