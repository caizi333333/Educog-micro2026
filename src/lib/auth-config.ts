// 生产环境认证配置
export const authConfig = {
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },

  // Cookie配置
  cookies: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 // 30天
  },

  // 密码策略
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    saltRounds: 10
  },

  // 会话配置
  session: {
    maxConcurrentSessions: 5,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
    extendOnActivity: true
  },

  // 安全头配置
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }
};

// 验证密码强度
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = authConfig.password;

  if (password.length < config.minLength) {
    errors.push(`密码长度至少${config.minLength}位`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }

  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}