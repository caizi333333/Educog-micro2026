import { NextResponse } from 'next/server';
import { createHealthCheckResponse } from '@/lib/db-health-check';

/**
 * 数据库健康检查API端点
 */
export async function GET() {
  try {
    const healthCheck = await createHealthCheckResponse({ includeDatabaseInfo: false });
    
    return NextResponse.json(healthCheck, {
      status: healthCheck.database.isConnected ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scope: 'INSTANTANEOUS',
      label: '即时连接探测',
      note: '本次探测未完成，不代表数据库历史状态；请稍后手动重试。',
      database: {
        isConnected: false,
        error: '即时连接探测失败',
      },
      recommendations: [
        '请稍后手动重试，避免连续刷新增加连接压力。',
        '若多次失败，请联系系统管理员查看服务端日志。',
      ],
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
