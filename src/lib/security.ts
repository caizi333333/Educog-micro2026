import crypto from 'crypto';

// 环境变量验证
export function validateEnvironment() {
  const requiredEnvVars = ['NODE_ENV'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`Warning: Missing environment variables: ${missing.join(', ')}`);
  }
}

// 输入验证和清理
export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
    .replace(/javascript:/gi, '') // 移除javascript:协议
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .trim();
}

// 验证字符串长度
export function validateStringLength(input: string, maxLength: number = 1000): boolean {
  return input.length <= maxLength;
}

// 生成安全的随机ID
export function generateSecureId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// 验证输入是否包含危险内容
export function containsDangerousContent(input: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /Function\s*\(/i,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
}

// 数据脱敏（用于日志）
export function maskSensitiveData(data: unknown): unknown {
  if (typeof data === 'string') {
    // 简单的邮箱脱敏
    return data.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+)/g, '***@$2');
  }
  
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const masked = { ...data as Record<string, unknown> };
    // 脱敏常见的敏感字段
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (field in masked) {
        masked[field] = '***';
      }
    });
    return masked;
  }
  
  return data;
}