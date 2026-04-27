// Single source of truth for knowledge graph reads.
//
// Reads the Prisma KnowledgeNode table when it has any rows; otherwise falls
// back to the static knowledgePoints array in src/lib/knowledge-points.ts.
// Any DB error also falls back to static — the page must not blank if Postgres
// hiccups. Result cached in-process for 30s to avoid hammering the DB on every
// request.

import { prisma } from '@/lib/prisma';
import { knowledgePoints, type KnowledgePoint, type KnowledgePointResource } from '@/lib/knowledge-points';

type CachedSnapshot = { points: KnowledgePoint[]; source: 'db' | 'static'; ts: number };
const TTL_MS = 30_000;
let cache: CachedSnapshot | null = null;

function rowToKnowledgePoint(row: {
  id: string;
  name: string;
  level: number;
  chapter: number;
  description: string | null;
  graphNodeId: string | null;
  parentId: string | null;
  resources: unknown;
  prerequisites: string[];
  appliedIn: string[];
}): KnowledgePoint {
  return {
    id: row.id,
    name: row.name,
    level: row.level as 1 | 2 | 3,
    chapter: row.chapter,
    description: row.description ?? undefined,
    graphNodeId: row.graphNodeId ?? undefined,
    parentId: row.parentId ?? undefined,
    resources: Array.isArray(row.resources) ? (row.resources as KnowledgePointResource[]) : undefined,
    prerequisites: row.prerequisites ?? [],
    appliedIn: row.appliedIn ?? [],
  };
}

export async function fetchKnowledgePoints(): Promise<{ points: KnowledgePoint[]; source: 'db' | 'static' }> {
  if (cache && Date.now() - cache.ts < TTL_MS) return { points: cache.points, source: cache.source };
  try {
    const count = await prisma.knowledgeNode.count();
    if (count === 0) {
      cache = { points: knowledgePoints, source: 'static', ts: Date.now() };
      return { points: knowledgePoints, source: 'static' };
    }
    const rows = await prisma.knowledgeNode.findMany({ orderBy: [{ chapter: 'asc' }, { id: 'asc' }] });
    const points = rows.map(rowToKnowledgePoint);
    cache = { points, source: 'db', ts: Date.now() };
    return { points, source: 'db' };
  } catch (err) {
    console.error('[knowledge-source] DB fetch failed, falling back to static:', err);
    return { points: knowledgePoints, source: 'static' };
  }
}

export function invalidateKnowledgeCache() {
  cache = null;
}
