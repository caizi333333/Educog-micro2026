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

export interface KnowledgeNodeShapeInput {
  id: string;
  name: string;
  level: number;
  chapter: number;
  parentId?: string | null;
  prerequisites?: string[];
  appliedIn?: string[];
}

export function validateKnowledgeNodeShape(input: KnowledgeNodeShapeInput): string | null {
  const id = input.id.trim();
  const name = input.name.trim();
  const parentId = input.parentId?.trim() || null;
  const idParts = id.split('.');

  if (!/^\d+(?:\.\d+){0,2}$/.test(id)) return '节点编号应采用“章.节.知识点”格式';
  if (!name) return '节点名称不能为空';
  if (name.length > 120) return '节点名称不能超过120个字符';
  if (![1, 2, 3].includes(input.level)) return '节点级别必须是1、2或3';
  if (!Number.isInteger(input.chapter) || input.chapter < 1 || input.chapter > 20) {
    return '章节编号必须是1至20之间的整数';
  }
  if (idParts.length !== input.level) return `L${input.level} 节点编号应包含 ${input.level} 级编号`;
  if (Number(idParts[0]) !== input.chapter) return '节点编号所属章节必须与章节字段一致';

  const expectedParentId = input.level === 1 ? null : idParts.slice(0, -1).join('.');
  if (parentId !== expectedParentId) {
    return input.level === 1
      ? 'L1章节节点不能设置父节点'
      : `父节点必须是 ${expectedParentId}`;
  }

  const prerequisites = input.prerequisites ?? [];
  if (prerequisites.includes(id)) return '节点不能把自己设为前置知识点';
  if (prerequisites.some((item) => !/^\d+(?:\.\d+){0,2}$/.test(item))) {
    return '前置知识点包含无效编号';
  }
  if ((input.appliedIn ?? []).some((item) => !/^(?:exp|proj)\d{2}$/.test(item))) {
    return '实验关联编号应采用 exp02 或 proj01 格式';
  }
  return null;
}

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

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

/**
 * Merge DB customizations onto the shipped course catalog. A partially seeded
 * table must never shrink the learner-facing graph from 279 nodes to whichever
 * handful happened to be inserted. Invalid rows are ignored; a prerequisite
 * cycle rejects the DB snapshot and keeps the known-good static catalog.
 */
export function mergeKnowledgePointCatalog(databasePoints: KnowledgePoint[]): KnowledgePoint[] {
  const staticIds = new Set(knowledgePoints.map((point) => point.id));
  const databaseById = new Map<string, KnowledgePoint>();

  databasePoints.forEach((point) => {
    if (databaseById.has(point.id)) return;
    if (validateKnowledgeNodeShape(point)) return;
    databaseById.set(point.id, point);
  });

  const availableIds = new Set([...staticIds, ...databaseById.keys()]);
  databaseById.forEach((point, id) => {
    const referencesExist = (!point.parentId || availableIds.has(point.parentId))
      && (point.prerequisites ?? []).every((prerequisiteId) => availableIds.has(prerequisiteId));
    if (!referencesExist) databaseById.delete(id);
  });

  const merged = knowledgePoints.map((base) => {
    const overlay = databaseById.get(base.id);
    return overlay ? { ...base, ...withoutUndefined(overlay) } : base;
  });
  databaseById.forEach((point, id) => {
    if (!staticIds.has(id)) merged.push(point);
  });
  merged.sort((left, right) => left.chapter - right.chapter || left.id.localeCompare(right.id, undefined, { numeric: true }));

  const mergedById = new Map(merged.map((point) => [point.id, point]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    const cyclic = (mergedById.get(id)?.prerequisites ?? []).some(hasCycle);
    active.delete(id);
    visited.add(id);
    return cyclic;
  };
  return merged.some((point) => hasCycle(point.id)) ? knowledgePoints : merged;
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
    const points = mergeKnowledgePointCatalog(rows.map(rowToKnowledgePoint));
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
