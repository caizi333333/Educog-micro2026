import { NextResponse } from 'next/server';
import { createHealthCheckResponse } from '@/lib/db-health-check';

/**
 * 数据库健康检查API端点
 */
export async function GET() {
  try {
    const healthCheck = await createHealthCheckResponse();
    
    return NextResponse.json(healthCheck, {
      status: healthCheck.database.isConnected ? 200 : 503,
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: {
        isConnected: false,
        error: error instanceof Error ? error.message : '健康检查失败',
      },
      recommendations: [
        '无法执行健康检查',
        '请检查应用程序配置',
        '联系技术支持获取帮助',
      ],
    }, { status: 503 });
  }
}