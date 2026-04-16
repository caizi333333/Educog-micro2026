import { NextResponse } from 'next/server';

// 错误代码枚举
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND'
}

// 错误严重程度枚举
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
  isOperational: boolean = true;
  
  constructor(message: string, statusCode: number = 500, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    if (details) this.details = details;
    
    // 确保堆栈跟踪正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ValidationError extends AppError {
  field?: string;
  
  constructor(message: string, field?: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    if (field) this.field = field;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError);
    }
  }
}

export class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
    }
  }
}

export class NotFoundError extends AppError {
  override statusCode = 404;
  override code = 'NOT_FOUND';
  override isOperational = true;
  
  constructor(resource?: string) {
    const message = resource ? `${resource} not found` : 'Resource not found';
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotFoundError);
    }
  }
}

export class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConflictError);
    }
  }
}

export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁，请稍后再试') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}

// 错误处理中间件
export function handleApiError(error: Error & Partial<AppError>): NextResponse {
  // 记录错误
  logError(error);
  
  // 处理已知错误
  if (error.statusCode) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details
      },
      { status: error.statusCode || 500 }
    );
  }
  
  // 处理 Prisma 错误
  if (error.code === 'P2002') {
    return NextResponse.json(
      { error: '数据已存在', code: 'DUPLICATE_ENTRY' },
      { status: 409 }
    );
  }
  
  if (error.code === 'P2025') {
    return NextResponse.json(
      { error: '记录不存在', code: 'RECORD_NOT_FOUND' },
      { status: 404 }
    );
  }
  
  // 默认错误响应
  return NextResponse.json(
    { 
      error: process.env.NODE_ENV === 'production' ? '服务器错误' : error.message,
      code: 'INTERNAL_SERVER_ERROR'
    },
    { status: 500 }
  );
}

// 错误日志记录
function logError(error: Error & Partial<AppError>): void {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: (error as AppError).code,
    statusCode: (error as AppError).statusCode,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  };
  
  if (process.env.NODE_ENV === 'production') {
    // 生产环境：发送到错误追踪服务
    // 例如: Sentry, LogRocket, etc.
    console.error('[ERROR]', JSON.stringify(errorInfo));
  } else {
    // 开发环境：详细日志
    console.error('[ERROR]', errorInfo);
  }
}

// API 路由装饰器
export function withErrorHandler(
  handler: (req: Request, context?: Record<string, unknown>) => Promise<NextResponse>
) {
  return async (req: Request, context?: Record<string, unknown>) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleApiError(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

// ErrorHandler 类，用于测试兼容性
export class ErrorHandler {
  private static shouldHideMessage(message: string): boolean {
    // 无论环境如何，都不应该在响应中暴露敏感信息
    return /(password|secret|token|api[_-]?key|authorization|bearer)/i.test(message);
  }

  static handleError(error: unknown): NextResponse {
    if (!error) {
      return NextResponse.json(
        {
          error: {
            message: 'Internal server error',
            statusCode: 500,
            type: 'Unknown'
          }
        },
        { status: 500 }
      );
    }
    
    if (error instanceof AppError) {
      const errorData: Record<string, unknown> = {
        message: error.message,
        statusCode: error.statusCode,
        type: error.constructor.name
      };
      
      if (error instanceof ValidationError && error.field) {
        errorData.field = error.field;
      }
      
      return NextResponse.json(
        { error: errorData },
        { status: error.statusCode }
      );
    }
    
    if (error instanceof Error) {
      // 对于普通错误：默认不向客户端暴露具体消息（避免泄露实现细节/敏感信息）
      const errorMessage = 'Internal server error';
      console.error('Unhandled error:', error);
      
      return NextResponse.json(
        {
          error: {
            message: errorMessage,
            statusCode: 500,
            type: 'Error'
          }
        },
        { status: 500 }
      );
    }
    
    // 处理非Error对象
    console.error('Unhandled error:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Internal server error',
          statusCode: 500,
          type: 'Unknown'
        }
      },
      { status: 500 }
    );
  }
  
  static logError(error: Error & Partial<AppError>): void {
    const errorType = error.constructor.name;
    const statusCode = (error as AppError).statusCode || 500;
    let stack = error.stack || 'No stack trace available';
    
    // 清理堆栈跟踪中的敏感路径
    stack = stack.replace(/\/Users\/[^/]+\//g, '/home/user/');
    stack = stack.replace(/\/sessions\/[^/]+\/[^/]+\//g, '/home/user/');
    stack = stack.replace(/password|secret|token/gi, '[REDACTED]');
    
    if (error instanceof ValidationError && error.field) {
      console.error(
        `${errorType} [${statusCode}]:`,
        error.message,
        `Field: ${error.field}`,
        stack
      );
    } else {
      console.error(
        `${errorType} [${statusCode}]:`,
        error.message,
        stack
      );
    }
  }
  
  static isOperationalError(error: Error): boolean {
    return (error as AppError).isOperational === true;
  }
  
  static createErrorResponse(
    message: string, 
    statusCode: number, 
    type: string, 
    additionalData?: Record<string, unknown>
  ): NextResponse {
    return NextResponse.json(
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
  }
  
  static handleAsyncError<T extends (...args: unknown[]) => Promise<NextResponse>>(
    fn: T
  ): (...args: Parameters<T>) => Promise<NextResponse> {
    return async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error);
      }
    };
  }
}
