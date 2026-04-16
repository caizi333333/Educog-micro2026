interface RequestLog {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  userId?: string;
  duration?: number;
  statusCode?: number;
  error?: string;
  timestamp: string;
}

class RequestLogger {
  private logs: RequestLog[] = [];
  private maxLogs = 1000;

  log(log: RequestLog): void {
    this.logs.push(log);
    
    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // 开发环境输出到控制台
    if (process.env.NODE_ENV === 'development') {
      const { method, url, duration, statusCode } = log;
      const status = statusCode ? (statusCode < 400 ? '✓' : '✗') : '?';
      console.log(
        `[API] ${status} ${method} ${url} - ${duration?.toFixed(0)}ms - ${statusCode || 'N/A'}`
      );
    }
  }

  getRecentLogs(count = 100): RequestLog[] {
    return this.logs.slice(-count);
  }

  getErrorLogs(): RequestLog[] {
    return this.logs.filter(log => log.error || (log.statusCode && log.statusCode >= 400));
  }

  getSlowRequests(threshold = 1000): RequestLog[] {
    return this.logs.filter(log => log.duration && log.duration > threshold);
  }

  getLogsByUser(userId: string): RequestLog[] {
    return this.logs.filter(log => log.userId === userId);
  }

  clear(): void {
    this.logs = [];
  }
}

export const requestLogger = new RequestLogger();

// 中间件包装器
export function withRequestLogging<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  options?: { logBody?: boolean }
): T {
  return (async (...args: Parameters<T>) => {
    const [request] = args;
    const startTime = Date.now();
    
    const log: RequestLog = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString()
    };
    
    // 记录请求体（如果需要）
    if (options?.logBody && request.body) {
      try {
        const body = await request.clone().json();
        log.body = body;
      } catch {}
    }
    
    try {
      const response = await handler(...args);
      
      log.duration = Date.now() - startTime;
      log.statusCode = response.status;
      
      requestLogger.log(log);
      
      return response;
    } catch (error) {
      log.duration = Date.now() - startTime;
      log.error = error instanceof Error ? error.message : String(error);
      
      requestLogger.log(log);
      
      throw error;
    }
  }) as T;
}