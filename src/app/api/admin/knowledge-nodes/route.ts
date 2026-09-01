// Admin/teacher CRUD on the KnowledgeNode Prisma table.
// POST = create; the per-id route handles PATCH/DELETE.
//
// Auth: TEACHER or ADMIN role. Writes here are the source of truth once the
// table is seeded — fetchKnowledgePoints() prefers DB over static.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { invalidateKnowledgeCache, validateKnowledgeNodeShape } from '@/lib/knowledge-source';
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

function normalizedList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function matchesCreateRequest(existing: Record<string, unknown>, data: Record<string, unknown>): boolean {
  return existing.name === data.name
    && existing.level === data.level
    && existing.chapter === data.chapter
    && (existing.description ?? null) === data.description
    && (existing.graphNodeId ?? null) === data.graphNodeId
    && (existing.parentId ?? null) === data.parentId
    && sameJson(existing.resources, data.resources)
    && sameJson(existing.prerequisites, data.prerequisites)
    && sameJson(existing.appliedIn, data.appliedIn);
}

export async function POST(request: NextRequest) {
  let candidateId: string | null = null;
  let createCandidate: Record<string, unknown> | null = null;
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
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const level = body.level;
    const chapter = body.chapter;
    const parentId = typeof body.parentId === 'string' ? body.parentId.trim() || null : null;
    const graphNodeId = typeof body.graphNodeId === 'string' ? body.graphNodeId.trim() || null : null;
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;
    const prerequisites = normalizedList(body.prerequisites);
    const appliedIn = normalizedList(body.appliedIn);
    if (!id || !name || level === undefined || chapter === undefined) {
      return NextResponse.json({ error: '缺少必填字段：id、name、level、chapter' }, { status: 400 });
    }
    if (prerequisites === null || appliedIn === null) {
      return NextResponse.json({ error: '前置知识点和实验关联必须是字符串数组' }, { status: 400 });
    }
    if (body.resources !== undefined && !Array.isArray(body.resources)) {
      return NextResponse.json({ error: '资源字段必须是数组' }, { status: 400 });
    }

    const validationError = validateKnowledgeNodeShape({
      id,
      name,
      level,
      chapter,
      parentId,
      prerequisites,
      appliedIn,
    });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const references = Array.from(new Set([...(parentId ? [parentId] : []), ...prerequisites]));
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

    const comparableData = {
      id,
      name,
      level,
      chapter,
      description,
      graphNodeId,
      parentId,
      resources: body.resources ?? null,
      prerequisites,
      appliedIn,
    };
    const data = {
      ...comparableData,
      resources: body.resources
        ? (body.resources as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
    candidateId = id;
    createCandidate = comparableData as unknown as Record<string, unknown>;
    const exists = await prisma.knowledgeNode.findUnique({ where: { id } });
    if (exists) {
      if (matchesCreateRequest(exists as unknown as Record<string, unknown>, comparableData as unknown as Record<string, unknown>)) {
        return NextResponse.json({ success: true, duplicate: true, data: exists });
      }
      return NextResponse.json({ error: `节点 ${id} 已存在且内容不同` }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const node = await tx.knowledgeNode.create({ data });
      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'KNOWLEDGE_NODE_CREATE',
          details: JSON.stringify({ nodeId: id }),
        },
      });
      return node;
    });
    invalidateKnowledgeCache();
    return NextResponse.json({ success: true, duplicate: false, data: created }, { status: 201 });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      if (candidateId && createCandidate) {
        const existing = await prisma.knowledgeNode.findUnique({ where: { id: candidateId } });
        if (existing && matchesCreateRequest(existing as unknown as Record<string, unknown>, createCandidate)) {
          return NextResponse.json({ success: true, duplicate: true, data: existing });
        }
      }
      return NextResponse.json({ error: '节点编号已存在，请刷新后核对' }, { status: 409 });
    }
    console.error('admin/knowledge-nodes POST error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
