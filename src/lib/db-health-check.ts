import { prisma } from '@/lib/prisma';

export interface DatabaseHealthStatus {
  isConnected: boolean;
  latency?: number;
  error?: string;
  suggestions?: string[];
}

/**
 * 检查数据库连接健康状态
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();
  
  try {
    // 尝试执行一个简单的查询
    await prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - startTime;
    
    return {
      isConnected: true,
      latency,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const suggestions: string[] = [];
    
    // 根据错误类型提供建议
    if (errorMessage.includes('timeout') || errorMessage.includes('connect')) {
      suggestions.push('检查网络连接是否正常');
      suggestions.push('确认数据库服务器是否在线');
      suggestions.push('检查防火墙设置');
    }
    
    if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      suggestions.push('检查数据库用户名和密码');
      suggestions.push('确认数据库用户权限');
    }
    
    if (errorMessage.includes('database') && errorMessage.includes('not exist')) {
      suggestions.push('确认数据库名称是否正确');
      suggestions.push('检查数据库是否已创建');
    }
    
    if (errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
      suggestions.push('检查SSL/TLS配置');
      suggestions.push('确认数据库是否要求SSL连接');
    }
    
    // 通用建议
    if (suggestions.length === 0) {
      suggestions.push('检查DATABASE_URL环境变量配置');
      suggestions.push('确认数据库服务提供商状态');
      suggestions.push('尝试重启应用程序');
    }
    
    return {
      isConnected: false,
      error: errorMessage,
      suggestions,
    };
  }
}

/**
 * 获取数据库连接信息（不包含敏感信息）
 */
export function getDatabaseInfo() {
  const databaseUrl = process.env.DATABASE_URL || '';
  
  // 解析数据库URL，隐藏敏感信息
  try {
    const url = new URL(databaseUrl);
    return {
      provider: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || '默认端口',
      database: url.pathname.substring(1),
      hasCredentials: !!(url.username && url.password),
    };
  } catch {
    return {
      provider: '未知',
      host: '未配置',
      port: '未知',
      database: '未知',
      hasCredentials: false,
    };
  }
}

/**
 * 创建数据库健康检查API端点的响应
 */
export async function createHealthCheckResponse() {
  const health = await checkDatabaseHealth();
  const dbInfo = getDatabaseInfo();
  
  return {
    timestamp: new Date().toISOString(),
    database: {
      ...health,
      info: dbInfo,
    },
    recommendations: health.isConnected 
      ? ['数据库连接正常'] 
      : [
          '数据库连接失败，请检查以下项目：',
          ...health.suggestions || [],
        ],
  };
}