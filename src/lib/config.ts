// 应用配置管理
export const config = {
  // 应用基本信息
  app: {
    name: '芯智育才',
    version: '1.0.0',
    description: '基于AI大模型的微控制器课程智能化教学辅助平台',
  },
  
  // 环境配置
  env: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },
  
  // API配置
  api: {
    timeout: 30000, // 30秒
    retryAttempts: 3,
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  },
  
  // AI配置
  ai: {
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 60000, // 60秒
  },
  
  // 安全配置
  security: {
    maxInputLength: 1000,
    rateLimitWindow: 60000, // 1分钟
    rateLimitMax: 100, // 每分钟最多100个请求
  },
  
  // 性能配置
  performance: {
    enableMetrics: process.env.NODE_ENV === 'development',
    cacheTimeout: 300000, // 5分钟
  },
  
  // 功能开关
  features: {
    enableAI: true,
    enableAnalytics: true,
    enableCaching: true,
    enableErrorReporting: process.env.NODE_ENV === 'production',
  },
} as const;

// 验证必要的环境变量
export function validateConfig() {
  const requiredEnvVars: string[] = [];
  
  const missing = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );
  
  if (missing.length > 0) {
    console.warn(
      `⚠️ Warning: Missing environment variables: ${missing.join(', ')}`
    );
  }
  
  if (config.env.isDevelopment) {
    console.log('🔧 Running in development mode');
  }
}

// 获取配置值的辅助函数
export function getConfig<T extends keyof typeof config>(
  section: T
): typeof config[T] {
  return config[section];
}