// One-shot admin seed of the KnowledgeNode Prisma table from the canonical
// static knowledgePoints array. Idempotent — re-running re-syncs the latest
// edits made in src/lib/knowledge-points.ts back to the DB.
//
// ADMIN role only. POST with Authorization: Bearer <accessToken>.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { knowledgePoints } from '@/lib/knowledge-points';
import { invalidateKnowledgeCache } from '@/lib/knowledge-source';

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
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可执行' }, { status: 403 });
    }

    let inserted = 0;
    let updated = 0;
    for (const point of knowledgePoints) {
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

      const existing = await prisma.knowledgeNode.findUnique({ where: { id: point.id } });
      if (existing) {
        await prisma.knowledgeNode.update({ where: { id: point.id }, data });
        updated++;
      } else {
        await prisma.knowledgeNode.create({ data: { id: point.id, ...data } });
        inserted++;
      }
    }
    const total = await prisma.knowledgeNode.count();
    invalidateKnowledgeCache();
    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total,
      message: `Seed done: ${inserted} inserted, ${updated} updated, ${total} total in DB.`,
    });
  } catch (err) {
    console.error('seed-knowledge error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
