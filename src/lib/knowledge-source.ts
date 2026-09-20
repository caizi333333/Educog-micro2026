// Single source of truth for knowledge graph reads.
//
// Reads the Prisma KnowledgeNode table when it has any rows; otherwise falls
// back to the static knowledgePoints array in src/lib/knowledge-points.ts.
// Any DB error also falls back to static — the page must not blank if Postgres
// hiccups. Result cached in-process for 30s to avoid hammering the DB on every
// request.

import { prisma } from '@/lib/prisma';
import { knowledgePoints, resolveKnowledgeResourceHref, type KnowledgePoint, type KnowledgePointResource } from '@/lib/knowledge-points';

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

function isKnowledgeResource(value: unknown): value is KnowledgePointResource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const resource = value as Record<string, unknown>;
  return typeof resource.title === 'string'
    && typeof resource.type === 'string'
    && ['video', 'animation', 'slide', 'quiz', 'document', 'experiment', 'image'].includes(resource.type)
    && (resource.url === undefined || typeof resource.url === 'string')
    && (resource.refId === undefined || typeof resource.refId === 'string')
    && (resource.duration === undefined || (typeof resource.duration === 'number' && Number.isFinite(resource.duration)));
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
    // The write API accepts JSON null and [] as clearing the resource field.
    // Do not reinterpret an explicit empty value as permission to restore it.
    resources: Array.isArray(row.resources) ? row.resources.filter(isKnowledgeResource) : row.resources === null ? [] : undefined,
    prerequisites: row.prerequisites ?? [],
    appliedIn: row.appliedIn ?? [],
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

// These four old, unlinked placeholders were replaced by verified course
// resources. Match their complete visible identity, not a teacher's custom URL.
const legacyResourceReplacements: Readonly<Record<string, { refId: string; type: KnowledgePointResource['type']; title: string; replacementRefId: string }>> = {
  '3.5': { refId: 'ch03-ppt-s5', type: 'slide', title: '3.5 控制转移指令 课件', replacementRefId: 'course-lab-carry-branch' },
  '3.6': { refId: 'ch03-ppt-s6', type: 'slide', title: '3.6 位操作指令 课件', replacementRefId: 'course-lab-carry-branch' },
  '4.2': { refId: 'ch04-ppt-s2', type: 'slide', title: '4.2 C51数据类型 课件', replacementRefId: 'course-lab-c51-basics' },
  '5.4': { refId: 'anim-interrupt-response', type: 'animation', title: '中断响应全过程时序动画', replacementRefId: 'anim-interrupt-flow' },
};

function mergeCourseResources(base: KnowledgePoint, overlay: KnowledgePoint): KnowledgePointResource[] | undefined {
  if (overlay.resources === undefined) return base.resources;
  // A missing item may have been deliberately removed. Only replace existing
  // legacy placeholders; never fill gaps in a teacher-maintained resource array.
  const merged = overlay.resources.map((resource) => {
    if (!resource.refId || resource.url || resolveKnowledgeResourceHref(resource, overlay.chapter) !== null) return resource;
    const alias = legacyResourceReplacements[base.id];
    const matchesAlias = alias && resource.refId === alias.refId
      && resource.type === alias.type && resource.title === alias.title;
    const replacement = base.resources?.find((candidate) => candidate.refId === (matchesAlias ? alias.replacementRefId : resource.refId));
    if (!replacement || resolveKnowledgeResourceHref(replacement, base.chapter) === null) return resource;
    const oldSlideTitle = base.level === 1
      ? `第${base.chapter}章 ${base.name} 课件PPT`
      : `${base.id} ${base.name} 课件`;
    const matchesOldSlide = resource.type === 'slide' && resource.title === oldSlideTitle;
    const matchesOldDocument = resource.type === 'document' && (
      (resource.refId === 'doc-dev-workflow' && resource.title === '嵌入式系统开发流程指南')
      || (resource.refId === 'doc-report-template' && resource.title === '技术报告写作规范模板')
    );
    return matchesAlias || matchesOldSlide || matchesOldDocument ? replacement : resource;
  });
  const seen = new Set<string>();
  return merged.filter((resource) => {
    const signature = JSON.stringify(Object.entries(resource).sort(([left], [right]) => left.localeCompare(right)));
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
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
    if (!overlay) return base;
    const point = { ...base, ...withoutUndefined(overlay), resources: mergeCourseResources(base, overlay) };
    // Keep the teacher's text while displaying the shipped erratum next to the
    // actual source it qualifies. Do not attach it to a custom replacement URL.
    const correctedSource = base.resources?.find((resource) => resource.refId === 'course-lab-c51-basics');
    if (base.id === '4.2' && correctedSource && base.description
      && point.resources?.some((resource) => resource.refId === correctedSource.refId && resource.url === correctedSource.url)
      && !point.description?.includes(base.description)) {
      point.description = [point.description, `课程资料阅读提示：${base.description}`].filter(Boolean).join('\n\n');
    }
    return point;
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
