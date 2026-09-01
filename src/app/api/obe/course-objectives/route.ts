import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { OBE_ASSESSMENT_RESOURCES, resolveOBEAssessmentResource } from '@/lib/obe-data';

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

    const objectives = await prisma.courseObjective.findMany({
      where: payload.role === 'ADMIN' ? {} : { isActive: true },
      include: {
        indicatorPoint: { include: { graduationRequirement: true } },
        assessmentLinks: { orderBy: { weight: 'desc' } },
      },
      orderBy: { code: 'asc' },
    });

    return json({
      assessmentResources: OBE_ASSESSMENT_RESOURCES,
      objectives: objectives.map((objective) => {
        const configurationIssues: string[] = [];
        const totalWeight = objective.assessmentLinks.reduce((sum, link) => sum + link.weight, 0);
        if (objective.assessmentLinks.length === 0) configurationIssues.push('尚未配置考核环节');
        else if (Math.abs(totalWeight - 1) > 1e-6) {
          configurationIssues.push(`考核权重合计为 ${(totalWeight * 100).toFixed(1)}%，应为 100%`);
        }
        const assessmentLinks = objective.assessmentLinks.map((link) => {
          const resource = resolveOBEAssessmentResource(
            link.assessmentType,
            link.assessmentTargetId,
            link.chapter,
          );
          if (!resource.valid) configurationIssues.push(`${link.assessmentTargetId}：${resource.error}`);
          return {
            ...link,
            resourceValid: resource.valid,
            resourceIssue: resource.valid ? null : resource.error,
            resolvedDescription: resource.valid ? resource.description : null,
          };
        });
        return { ...objective, assessmentLinks, totalWeight, configurationIssues };
      }),
    });
  } catch (error) {
    console.error('GET /api/obe/course-objectives error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return json({ error: '令牌无效' }, 401);
    }
    if (payload.role !== 'ADMIN') {
      return json({ error: '仅管理员可操作' }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : null;
    const indicatorPointId = typeof body.indicatorPointId === 'string' ? body.indicatorPointId.trim() : '';
    const supportWeight = typeof body.supportWeight === 'number' ? body.supportWeight : Number.NaN;

    if (!code || !name || !indicatorPointId || !Number.isFinite(supportWeight)) {
      return json({ error: '缺少必填字段' }, 400);
    }
    if (!/^[A-Z][A-Z0-9_-]{1,15}$/.test(code) || name.length > 200 || indicatorPointId.length > 128) {
      return json({ error: '课程目标字段格式无效' }, 400);
    }
    if (supportWeight <= 0 || supportWeight > 1) {
      return json({ error: '支撑权重必须大于0且不超过1' }, 400);
    }
    const indicator = await prisma.indicatorPoint.findUnique({ where: { id: indicatorPointId }, select: { id: true } });
    if (!indicator) {
      return json({ error: '毕业要求指标点不存在' }, 400);
    }

    const existing = await prisma.courseObjective.findUnique({ where: { code } });
    if (existing) {
      const sameObjective = existing.name === name
        && (existing.description ?? null) === description
        && existing.indicatorPointId === indicatorPointId
        && Math.abs(existing.supportWeight - supportWeight) <= 1e-9;
      if (!sameObjective) return json({ error: '课程目标编码已用于不同配置' }, 409);
      return json({ objective: existing, duplicate: true, draft: !existing.isActive });
    }

    const co = await prisma.courseObjective.create({
      data: { code, name, description, indicatorPointId, supportWeight, isActive: false },
    });

    return json({ objective: co, duplicate: false, draft: true }, 201);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return json({ error: '课程目标编码已存在，请刷新后核对配置' }, 409);
    }
    console.error('POST /api/obe/course-objectives error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
