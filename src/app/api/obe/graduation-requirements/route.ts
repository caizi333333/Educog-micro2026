import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return json({ error: '权限不足' }, 403);
    }

    const requirements = await prisma.graduationRequirement.findMany({
      include: { indicators: { orderBy: { subIndex: 'asc' } } },
      orderBy: { index: 'asc' },
    });

    return json({
      graduationRequirements: requirements.map((r) => ({
        ...r,
        indicatorPoints: r.indicators,
      })),
    });
  } catch (error) {
    console.error('GET /api/obe/graduation-requirements error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
