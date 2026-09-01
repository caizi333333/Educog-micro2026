// PATCH = update node fields; DELETE = remove node (rejects if any other node
// has it as a parent or in prerequisites; caller must reassign first).
//
// Auth: TEACHER or ADMIN. Edits invalidate the in-process read cache so the
// next /api/knowledge-graph call sees the change.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { invalidateKnowledgeCache, validateKnowledgeNodeShape } from '@/lib/knowledge-source';
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

function normalizedList(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
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
    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json({ error: '节点名称格式无效' }, { status: 400 });
    }
    if (body.level !== undefined && ![1, 2, 3].includes(body.level)) {
      return NextResponse.json({ error: '节点级别必须是1、2或3' }, { status: 400 });
    }
    if (body.chapter !== undefined && !Number.isInteger(body.chapter)) {
      return NextResponse.json({ error: '章节编号必须是整数' }, { status: 400 });
    }
    if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== 'string') {
      return NextResponse.json({ error: '父节点编号格式无效' }, { status: 400 });
    }
    if (body.resources !== undefined && body.resources !== null && !Array.isArray(body.resources)) {
      return NextResponse.json({ error: '资源字段必须是数组' }, { status: 400 });
    }

    const prerequisites = normalizedList(body.prerequisites);
    const appliedIn = normalizedList(body.appliedIn);
    if (prerequisites === null || appliedIn === null) {
      return NextResponse.json({ error: '前置知识点和实验关联必须是字符串数组' }, { status: 400 });
    }

    const finalNode = {
      id,
      name: body.name !== undefined ? body.name.trim() : existing.name,
      level: body.level ?? existing.level,
      chapter: body.chapter ?? existing.chapter,
      parentId: body.parentId !== undefined ? body.parentId?.trim() || null : existing.parentId,
      prerequisites: prerequisites ?? existing.prerequisites,
      appliedIn: appliedIn ?? existing.appliedIn,
    };
    const validationError = validateKnowledgeNodeShape(finalNode);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const references = Array.from(new Set([
      ...(finalNode.parentId ? [finalNode.parentId] : []),
      ...finalNode.prerequisites,
    ]));
    if (references.length > 0) {
      const found = await prisma.knowledgeNode.findMany({
        where: { id: { in: references } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((item) => item.id));
      const missing = references.filter((referenceId) => !foundIds.has(referenceId));
      if (missing.length > 0) {
        return NextResponse.json({ error: `引用的节点不存在：${missing.join('、')}` }, { status: 400 });
      }
    }

    const data: Prisma.KnowledgeNodeUpdateInput = {};
    if (body.name !== undefined) data.name = finalNode.name;
    if (body.level !== undefined) data.level = finalNode.level;
    if (body.chapter !== undefined) data.chapter = finalNode.chapter;
    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (body.graphNodeId !== undefined) {
      data.graphNodeId = typeof body.graphNodeId === 'string' ? body.graphNodeId.trim() || null : null;
    }
    if (body.parentId !== undefined) data.parentId = finalNode.parentId;
    if (body.resources !== undefined) {
      data.resources = body.resources === null
        ? Prisma.JsonNull
        : (body.resources as unknown as Prisma.InputJsonValue);
    }
    if (prerequisites !== undefined) data.prerequisites = prerequisites;
    if (appliedIn !== undefined) data.appliedIn = appliedIn;

    const nextDescription = body.description !== undefined
      ? (typeof body.description === 'string' ? body.description.trim() || null : null)
      : existing.description;
    const nextGraphNodeId = body.graphNodeId !== undefined
      ? (typeof body.graphNodeId === 'string' ? body.graphNodeId.trim() || null : null)
      : existing.graphNodeId;
    const nextResources = body.resources !== undefined ? body.resources : existing.resources;
    const unchanged = existing.name === finalNode.name
      && existing.level === finalNode.level
      && existing.chapter === finalNode.chapter
      && (existing.description ?? null) === (nextDescription ?? null)
      && (existing.graphNodeId ?? null) === (nextGraphNodeId ?? null)
      && (existing.parentId ?? null) === (finalNode.parentId ?? null)
      && sameJson(existing.resources, nextResources)
      && sameJson(existing.prerequisites, finalNode.prerequisites)
      && sameJson(existing.appliedIn, finalNode.appliedIn);
    if (unchanged) {
      return NextResponse.json({ success: true, duplicate: true, data: existing });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const node = await tx.knowledgeNode.update({ where: { id }, data });
      await tx.userActivity.create({
        data: {
          userId: auth.payload.userId,
          action: 'KNOWLEDGE_NODE_UPDATE',
          details: JSON.stringify({ nodeId: id, updatedFields: Object.keys(data) }),
        },
      });
      return node;
    });
    invalidateKnowledgeCache();
    return NextResponse.json({ success: true, duplicate: false, data: updated });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: '节点字段与现有数据冲突' }, { status: 409 });
    }
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
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.knowledgeNode.findUnique({ where: { id } });
      if (!existing) return { kind: 'duplicate' as const };

      const childCount = await tx.knowledgeNode.count({ where: { parentId: id } });
      if (childCount > 0) return { kind: 'children' as const, count: childCount };

      const referencingPrereqs = await tx.knowledgeNode.count({
        where: { prerequisites: { has: id } },
      });
      if (referencingPrereqs > 0) return { kind: 'prerequisites' as const, count: referencingPrereqs };

      await tx.knowledgeNode.delete({ where: { id } });
      await tx.userActivity.create({
        data: {
          userId: auth.payload.userId,
          action: 'KNOWLEDGE_NODE_DELETE',
          details: JSON.stringify({ nodeId: id }),
        },
      });
      return { kind: 'deleted' as const };
    });

    if (outcome.kind === 'children') {
      return NextResponse.json(
        { error: `节点 ${id} 还有 ${outcome.count} 个下级节点，请先迁移或删除它们` },
        { status: 409 },
      );
    }
    if (outcome.kind === 'prerequisites') {
      return NextResponse.json(
        { error: `节点 ${id} 还被 ${outcome.count} 个节点列为前置，请先解除引用` },
        { status: 409 },
      );
    }
    if (outcome.kind === 'deleted') invalidateKnowledgeCache();
    return NextResponse.json({
      success: true,
      duplicate: outcome.kind === 'duplicate',
      deleted: id,
    });
  } catch (err) {
    console.error('admin/knowledge-nodes DELETE error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
