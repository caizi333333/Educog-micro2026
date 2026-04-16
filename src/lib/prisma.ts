import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __mockPrisma?: any;
};

/**
 * Prisma 单例
 *
 * 说明：
 * - 正常运行：使用 PrismaClient 单例
 * - 测试：允许通过 globalThis.__mockPrisma “注入”一个 Prisma mock（不依赖 jest hoist/ESM mock）
 */
const basePrisma: any = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma: any = new Proxy(basePrisma, {
  get(target, prop) {
    const mock = (globalForPrisma as any).__mockPrisma;
    if (mock && prop in mock) return mock[prop as any];
    return (target as any)[prop];
  },
});

// 在开发环境中启用查询日志
if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

// 优雅关闭数据库连接
if (process.env.NODE_ENV !== 'test') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

// 添加连接健康检查
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
