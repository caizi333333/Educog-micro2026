import { z } from 'zod';

// 更严格的环境变量验证
const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').refine(
    (url) => url.includes('postgresql://') || url.includes('postgres://') || url.includes('file:'),
    'DATABASE_URL must be a valid PostgreSQL or SQLite connection string'
  ),
  
  // JWT 配置
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long').optional(),
  
  // 安全配置
  PEPPER: z.string().min(16, 'PEPPER must be at least 16 characters long').optional(),
  
  // AI 服务配置
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  
  // 应用配置
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // NextAuth 配置
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters long').optional(),
  NEXTAUTH_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function validateEnv(): Env {
  // 在开发环境中不使用缓存，确保环境变量更新能及时生效
  if (cachedEnv && process.env.NODE_ENV !== 'development') {
    return cachedEnv;
  }

  try {
    // 为了向后兼容，如果没有设置NEXTAUTH_SECRET，使用JWT_SECRET
    const envToValidate = {
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
    };

    cachedEnv = envSchema.parse(envToValidate);
    return cachedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('\n');
      
      const errorMessage = `
❌ 环境变量配置错误:
${missingVars}

请检查以下环境变量的配置：
${error.errors.map(e => `- ${e.path.join('.')}`).join('\n')}

运行以下命令生成安全密钥：
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('NEXTAUTH_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
`;
      
      throw new Error(errorMessage);
    }
    throw error;
  }
}

// 安全的环境变量获取函数
export function getJwtSecret(): string {
  const env = validateEnv();
  
  // 检查是否使用了默认/不安全的密钥
  const unsafeKeys = [
    'your-secret-key-change-in-production',
    'dev-secret-key-change-in-production',
    'secret',
    'jwt-secret',
    '12345678901234567890123456789012'
  ];
  
  // 开发环境调试信息
  if (process.env.NODE_ENV === 'development') {
    console.log('Current JWT_SECRET:', env.JWT_SECRET.substring(0, 8) + '...');
    console.log('Is unsafe key?', unsafeKeys.includes(env.JWT_SECRET));
  }
  
  if (unsafeKeys.includes(env.JWT_SECRET)) {
    throw new Error(
      'JWT_SECRET 使用了不安全的默认值。' +
      '请生成一个新的安全密钥并在环境变量中设置。'
    );
  }
  
  return env.JWT_SECRET;
}

export function getJwtRefreshSecret(): string {
  const env = validateEnv();
  return env.JWT_REFRESH_SECRET || env.JWT_SECRET;
}

export function getDatabaseUrl(): string {
  const env = validateEnv();
  return env.DATABASE_URL;
}

export function getGoogleAiKey(): string | undefined {
  const env = validateEnv();
  return env.GOOGLE_GENAI_API_KEY;
}

export function getPepper(): string {
  const env = validateEnv();
  return env.PEPPER || 'default-pepper-change-in-production';
}

// 在应用启动时调用此函数进行验证
export function checkRequiredEnvVars(): boolean {
  try {
    validateEnv();
    console.log('✅ 环境变量验证通过');
    return true;
  } catch (error) {
    console.error('❌ 环境变量验证失败:', error instanceof Error ? error.message : String(error));
    
    // 在开发环境中，打印更详细的错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('详细错误信息:', error);
    }
    
    throw error;
  }
}

// 导出验证后的环境变量
export const env = validateEnv();