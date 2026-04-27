// Admin/teacher CRUD on the KnowledgeNode Prisma table.
// POST = create; the per-id route handles PATCH/DELETE.
//
// Auth: TEACHER or ADMIN role. Writes here are the source of truth once the
// table is seeded — fetchKnowledgePoints() prefers DB over static.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { invalidateKnowledgeCache } from '@/lib/knowledge-source';
import type { KnowledgePointResource } from '@/lib/knowledge-points';

interface CreateBody {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  chapter: number;
  description?: string;
  graphNodeId?: string;
  parentId?: string;
  resources?: KnowledgePointResource[];
  prerequisites?: string[];
  appliedIn?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = (await request.json()) as Partial<CreateBody>;
    if (!body.id || !body.name || !body.level || !body.chapter) {
      return NextResponse.json(
        { error: '缺少必填字段：id, name, level, chapter' },
        { status: 400 },
      );
    }
    if (![1, 2, 3].includes(body.level)) {
      return NextResponse.json({ error: 'level 必须是 1/2/3' }, { status: 400 });
    }
    const exists = await prisma.knowledgeNode.findUnique({ where: { id: body.id } });
    if (exists) {
      return NextResponse.json({ error: `节点 ${body.id} 已存在` }, { status: 409 });
    }
    if (body.parentId) {
      const parent = await prisma.knowledgeNode.findUnique({ where: { id: body.parentId } });
      if (!parent) {
        return NextResponse.json({ error: `父节点 ${body.parentId} 不存在` }, { status: 400 });
      }
    }

    const created = await prisma.knowledgeNode.create({
      data: {
        id: body.id,
        name: body.name,
        level: body.level,
        chapter: body.chapter,
        description: body.description ?? null,
        graphNodeId: body.graphNodeId ?? null,
        parentId: body.parentId ?? null,
        resources: body.resources
          ? (body.resources as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        prerequisites: body.prerequisites ?? [],
        appliedIn: body.appliedIn ?? [],
      },
    });
    invalidateKnowledgeCache();
    return NextResponse.json({ success: true, data: created });
  } catch (err) {
    console.error('admin/knowledge-nodes POST error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
