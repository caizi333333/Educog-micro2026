import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sanitizeMetadata } from '@/lib/classroom';
import {
  capPresenceDuration,
  isPresenceEventType,
  PRESENCE_EVENT_TYPES,
  PRESENCE_HOURLY_NEW_ROW_CAP,
  PRESENCE_MAX_NEW_ROWS_PER_REQUEST,
  PRESENCE_MIN_DURATION_DELTA_SECONDS,
  PRESENCE_MIN_WRITE_GAP_MS,
  presenceBucket,
} from '@/lib/learning-presence-shared';

/**
 * Server-only presence persistence.
 *
 * Rows still share one LearningEvent per student, target, and 15-minute
 * bucket. Duration grows on that row instead of inserting a heartbeat each
 * minute. `node:crypto` and Prisma stay in this file so the lesson-notes
 * client bundle never loads them. Browser code imports
 * `@/lib/learning-presence-shared`.
 */
export {
  ACTIVITY_EVENT_TYPES,
  buildClassActivity,
  buildPresenceClientEventId,
  capPresenceDuration,
  isPresenceEventType,
  PRESENCE_BUCKET_MAX_DURATION_SECONDS,
  PRESENCE_BUCKET_MS,
  PRESENCE_CLIENT_FLUSH_MS,
  PRESENCE_EVENT_TYPES,
  PRESENCE_HOURLY_NEW_ROW_CAP,
  PRESENCE_MAX_NEW_ROWS_PER_REQUEST,
  PRESENCE_MAX_PER_REQUEST,
  PRESENCE_MIN_DURATION_DELTA_SECONDS,
  PRESENCE_MIN_WRITE_GAP_MS,
  PRESENCE_SUMMARY_WINDOW_DAYS,
  presenceBucket,
  shouldSendPresence,
  STUDIED_EVENT_TYPES,
} from '@/lib/learning-presence-shared';

export type {
  ClassActivityEventGroup,
  ClassActivityRosterStudent,
  ClassActivityStudent,
  PresenceEventType,
} from '@/lib/learning-presence-shared';

export function presenceEventId(
  userId: string,
  eventType: string,
  targetType: string,
  targetId: string,
  bucket: number,
): string {
  const digest = createHash('sha256')
    .update(`${userId}:${eventType}:${targetType}:${targetId}:${bucket}`)
    .digest('hex')
    .slice(0, 28);
  return `le_${digest}`;
}

type PresenceDecision =
  | { action: 'insert'; duration: number; metadata: string }
  | { action: 'update'; duration: number; metadata: string }
  | { action: 'skip'; reason: 'unchanged' | 'gap' | 'cap' };

function readFlushedAt(metadata: string | null): number | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const flushedAt = (parsed as { flushedAt?: unknown }).flushedAt;
    if (typeof flushedAt !== 'string') return null;
    const time = new Date(flushedAt).getTime();
    return Number.isNaN(time) ? null : time;
  } catch {
    return null;
  }
}

function withFlushedAt(metadata: string | null, nowMs: number): string {
  let parsed: Record<string, unknown> = {};
  if (metadata) {
    try {
      const value: unknown = JSON.parse(metadata);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = { ...(value as Record<string, unknown>) };
      }
    } catch {
      parsed = {};
    }
  }
  delete parsed.flushedAt;
  parsed.flushedAt = new Date(nowMs).toISOString();
  return sanitizeMetadata(parsed) ?? JSON.stringify({ flushedAt: parsed.flushedAt });
}

export function decidePresenceWrite(input: {
  existing: { duration: number | null; metadata: string | null } | null;
  incomingDuration: number | null;
  incomingMetadata: string | null;
  nowMs: number;
  insertsRemaining: number;
}): PresenceDecision {
  const duration = capPresenceDuration(input.incomingDuration);
  const metadata = withFlushedAt(input.incomingMetadata, input.nowMs);
  if (!input.existing) {
    if (input.insertsRemaining <= 0) return { action: 'skip', reason: 'cap' };
    return { action: 'insert', duration, metadata };
  }
  const stored = capPresenceDuration(input.existing.duration);
  if (duration - stored < PRESENCE_MIN_DURATION_DELTA_SECONDS) {
    return { action: 'skip', reason: 'unchanged' };
  }
  const flushedAt = readFlushedAt(input.existing.metadata);
  if (flushedAt != null && input.nowMs - flushedAt < PRESENCE_MIN_WRITE_GAP_MS) {
    return { action: 'skip', reason: 'gap' };
  }
  return { action: 'update', duration, metadata };
}

export type NormalizedPresenceEvent = {
  eventType: string;
  targetType: string;
  targetId: string;
  moduleId: string | null;
  chapterId: string | null;
  experimentId: string | null;
  quizId: string | null;
  duration: number | null;
  progress: number | null;
  clientTime: Date | null;
  metadata: string | null;
};

export async function savePresenceEvents(
  userId: string,
  classId: string | null,
  events: NormalizedPresenceEvent[],
  nowMs = Date.now(),
): Promise<{ accepted: number; coalesced: number; ignored: number }> {
  if (events.length === 0) return { accepted: 0, coalesced: 0, ignored: 0 };

  const bucket = presenceBucket(nowMs);
  const byId = new Map<string, NormalizedPresenceEvent & { id: string; duration: number }>();
  for (const event of events) {
    if (!isPresenceEventType(event.eventType)) continue;
    const id = presenceEventId(userId, event.eventType, event.targetType, event.targetId, bucket);
    const duration = capPresenceDuration(event.duration);
    const previous = byId.get(id);
    if (!previous || duration >= previous.duration) {
      byId.set(id, { ...event, id, duration });
    }
  }
  const prepared = [...byId.values()];
  if (prepared.length === 0) return { accepted: 0, coalesced: 0, ignored: events.length };

  const hourAgo = new Date(nowMs - 60 * 60 * 1000);
  const hourlyCount = await prisma.learningEvent.count({
    where: {
      userId,
      createdAt: { gte: hourAgo },
      eventType: { in: [...PRESENCE_EVENT_TYPES] },
    },
  });
  let insertsRemaining = Math.max(0, Math.min(
    PRESENCE_MAX_NEW_ROWS_PER_REQUEST,
    PRESENCE_HOURLY_NEW_ROW_CAP - hourlyCount,
  ));

  const existingRows = await prisma.learningEvent.findMany({
    where: { id: { in: prepared.map((event) => event.id) }, userId },
    select: { id: true, duration: true, metadata: true },
  });
  const existingById = new Map(existingRows.map((row) => [row.id, row]));

  const inserts: Array<NormalizedPresenceEvent & { id: string; userId: string; classId: string | null; duration: number; metadata: string }> = [];
  const updates: Array<{ id: string; duration: number; metadata: string }> = [];
  let coalesced = 0;
  let ignored = events.length - prepared.length;

  for (const event of prepared) {
    const decision = decidePresenceWrite({
      existing: existingById.get(event.id) ?? null,
      incomingDuration: event.duration,
      incomingMetadata: event.metadata,
      nowMs,
      insertsRemaining,
    });
    if (decision.action === 'skip') {
      if (decision.reason === 'cap') ignored += 1;
      else coalesced += 1;
      continue;
    }
    if (decision.action === 'insert') {
      insertsRemaining -= 1;
      inserts.push({
        ...event,
        userId,
        classId,
        duration: decision.duration,
        metadata: decision.metadata,
      });
      continue;
    }
    updates.push({ id: event.id, duration: decision.duration, metadata: decision.metadata });
  }

  let accepted = 0;
  if (inserts.length > 0) {
    const created = await prisma.learningEvent.createMany({ data: inserts, skipDuplicates: true });
    accepted += created.count;
    coalesced += inserts.length - created.count;
  }
  for (const update of updates) {
    await prisma.learningEvent.update({
      where: { id: update.id },
      data: { duration: update.duration, metadata: update.metadata },
    });
    accepted += 1;
  }

  return { accepted, coalesced, ignored };
}
