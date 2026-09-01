import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { knowledgePoints } from '@/lib/knowledge-points';
import { invalidateKnowledgeCache, validateKnowledgeNodeShape } from '@/lib/knowledge-source';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

type SeedReceipt = {
  requestId: string;
  inserted: number;
  updated: number;
  total: number;
};

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function parseReceipt(details: string | null, requestId: string): SeedReceipt | null {
  try {
    const value: unknown = JSON.parse(details ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (
      record.requestId !== requestId
      || typeof record.inserted !== 'number'
      || typeof record.updated !== 'number'
      || typeof record.total !== 'number'
    ) return null;
    return {
      requestId,
      inserted: record.inserted,
      updated: record.updated,
      total: record.total,
    };
  } catch {
    return null;
  }
}

function validateCanonicalKnowledge(): string | null {
  const ids = new Set(knowledgePoints.map((point) => point.id));
  if (ids.size !== knowledgePoints.length) return '静态课程定义包含重复节点编号';
  for (const point of knowledgePoints) {
    const shapeError = validateKnowledgeNodeShape(point);
    if (shapeError) return `${point.id}：${shapeError}`;
    const references = [point.parentId, ...(point.prerequisites ?? [])].filter((value): value is string => Boolean(value));
    const missing = references.find((id) => !ids.has(id));
    if (missing) return `${point.id} 引用了不存在的节点 ${missing}`;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'ADMIN') return json({ error: '仅管理员可执行' }, 403);

    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== 'object') return json({ error: '请求内容格式不正确' }, 400);
    const rawRequestId = (body as Record<string, unknown>).requestId;
    if (rawRequestId !== undefined && (typeof rawRequestId !== 'string' || !REQUEST_ID_PATTERN.test(rawRequestId))) {
      return json({ error: 'requestId 格式不正确' }, 400);
    }
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : null;

    if (requestId) {
      const priorActivity = await prisma.userActivity.findFirst({
        where: {
          userId: payload.userId,
          action: 'SEED_KNOWLEDGE',
          details: { contains: `\"requestId\":\"${requestId}\"` },
        },
        select: { details: true },
        orderBy: { createdAt: 'desc' },
      });
      const receipt = parseReceipt(priorActivity?.details ?? null, requestId);
      if (receipt) {
        return json({ success: true, duplicate: true, ...receipt, message: '该同步请求此前已完成' });
      }
    }

    const validationError = validateCanonicalKnowledge();
    if (validationError) return json({ error: `静态课程定义未通过校验：${validationError}` }, 409);

    const existingRows = await prisma.knowledgeNode.findMany({ select: { id: true } });
    const existingIds = new Set(existingRows.map((row) => row.id));
    const inserted = knowledgePoints.filter((point) => !existingIds.has(point.id)).length;
    const updated = knowledgePoints.length - inserted;
    const total = new Set([...existingIds, ...knowledgePoints.map((point) => point.id)]).size;
    const receipt: SeedReceipt = {
      requestId: requestId ?? `legacy_${Date.now()}`,
      inserted,
      updated,
      total,
    };

    const operations: Prisma.PrismaPromise<unknown>[] = knowledgePoints.map((point) => {
      const data = {
        name: point.name,
        level: point.level,
        chapter: point.chapter,
        description: point.description ?? null,
        graphNodeId: point.graphNodeId ?? null,
        parentId: point.parentId ?? null,
        resources: point.resources
          ? (point.resources as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        prerequisites: point.prerequisites ?? [],
        appliedIn: point.appliedIn ?? [],
      };
      return prisma.knowledgeNode.upsert({
        where: { id: point.id },
        update: data,
        create: { id: point.id, ...data },
      });
    });
    operations.push(prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'SEED_KNOWLEDGE',
        details: JSON.stringify(receipt),
      },
    }));
    await prisma.$transaction(operations);

    invalidateKnowledgeCache();
    return json({
      success: true,
      duplicate: false,
      ...receipt,
      message: `静态课程定义同步完成：${inserted} 个新增，${updated} 个覆盖，当前至少 ${total} 个节点。`,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return json({ error: '检测到并发同步，请使用原 requestId 重试以确认结果' }, 409);
    }
    console.error('seed-knowledge error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
