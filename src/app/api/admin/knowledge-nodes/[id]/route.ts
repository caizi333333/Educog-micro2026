// PATCH = update node fields; DELETE = remove node (rejects if any other node
// has it as a parent or in prerequisites; caller must reassign first).
//
// Auth: TEACHER or ADMIN. Edits invalidate the in-process read cache so the
// next /api/knowledge-graph call sees the change.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { invalidateKnowledgeCache } from '@/lib/knowledge-source';
import type { KnowledgePointResource } from '@/lib/knowledge-points';

interface UpdateBody {
  name?: string;
  level?: 1 | 2 | 3;
  chapter?: number;
  description?: string | null;
  graphNodeId?: string | null;
  parentId?: string | null;
  resources?: KnowledgePointResource[] | null;
  prerequisites?: string[];
  appliedIn?: string[];
}

async function authorize(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, error: '未授权' };
  }
  const token = authorization.substring(7);
  const payload = await verifyToken(token);
  if (!payload) {
    return { ok: false as const, status: 401, error: '令牌无效' };
  }
  if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
    return { ok: false as const, status: 403, error: '权限不足' };
  }
  return { ok: true as const, payload };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const existing = await prisma.knowledgeNode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `节点 ${id} 不存在` }, { status: 404 });
    }

    const body = (await request.json()) as UpdateBody;
    if (body.level !== undefined && ![1, 2, 3].includes(body.level)) {
      return NextResponse.json({ error: 'level 必须是 1/2/3' }, { status: 400 });
    }
    if (body.parentId) {
      if (body.parentId === id) {
        return NextResponse.json({ error: '不能把自己设为父节点' }, { status: 400 });
      }
      const parent = await prisma.knowledgeNode.findUnique({ where: { id: body.parentId } });
      if (!parent) {
        return NextResponse.json({ error: `父节点 ${body.parentId} 不存在` }, { status: 400 });
      }
    }

    const data: Prisma.KnowledgeNodeUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.level !== undefined) data.level = body.level;
    if (body.chapter !== undefined) data.chapter = body.chapter;
    if (body.description !== undefined) data.description = body.description;
    if (body.graphNodeId !== undefined) data.graphNodeId = body.graphNodeId;
    if (body.parentId !== undefined) data.parentId = body.parentId;
    if (body.resources !== undefined) {
      data.resources = body.resources === null
        ? Prisma.JsonNull
        : (body.resources as unknown as Prisma.InputJsonValue);
    }
    if (body.prerequisites !== undefined) data.prerequisites = body.prerequisites;
    if (body.appliedIn !== undefined) data.appliedIn = body.appliedIn;

    const updated = await prisma.knowledgeNode.update({ where: { id }, data });
    invalidateKnowledgeCache();
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('admin/knowledge-nodes PATCH error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    const existing = await prisma.knowledgeNode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `节点 ${id} 不存在` }, { status: 404 });
    }

    const childCount = await prisma.knowledgeNode.count({ where: { parentId: id } });
    if (childCount > 0) {
      return NextResponse.json(
        { error: `节点 ${id} 还有 ${childCount} 个下级节点，请先迁移或删除它们` },
        { status: 409 },
      );
    }
    const referencingPrereqs = await prisma.knowledgeNode.count({
      where: { prerequisites: { has: id } },
    });
    if (referencingPrereqs > 0) {
      return NextResponse.json(
        { error: `节点 ${id} 还被 ${referencingPrereqs} 个节点列为前置，请先解除引用` },
        { status: 409 },
      );
    }

    await prisma.knowledgeNode.delete({ where: { id } });
    invalidateKnowledgeCache();
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    console.error('admin/knowledge-nodes DELETE error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
