import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sanitizeMetadata } from '@/lib/classroom';
import {
  capPresenceDuration,
  isPresenceEventType,
  PRESENCE_BUCKET_MS,
  PRESENCE_CLIENT_FLUSH_MS,
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
  bucketed?: boolean;
}): PresenceDecision {
  const duration = capPresenceDuration(input.incomingDuration);
  const metadata = withFlushedAt(input.incomingMetadata, input.nowMs);
  if (!input.existing) {
    if (input.insertsRemaining <= 0) return { action: 'skip', reason: 'cap' };
    return { action: 'insert', duration, metadata };
  }
  const stored = capPresenceDuration(input.existing.duration);
  // New clients send an observed cumulative total per bucket, including final
  // tails shorter than a minute. Keep the write gap for both protocols.
  if (duration - stored < (input.bucketed ? 1 : PRESENCE_MIN_DURATION_DELTA_SECONDS)) {
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

export type PresenceReceipt = {
  eventType: string;
  targetType: string;
  targetId: string;
  bucket: number;
  // Null means there is no persisted row (for example, the row quota was hit).
  duration: number | null;
  retryAfterMs?: number;
};

/** Legacy callers use receipt time. Explicit bucket identities must never be
 * reassigned on retry: that would count the same observed time twice. */
function eventBucket(event: NormalizedPresenceEvent, nowMs: number): { bucket: number; bucketed: boolean } | null {
  let metadata: Record<string, unknown> = {};
  if (event.metadata) {
    try {
      const parsed: unknown = JSON.parse(event.metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch { /* legacy metadata is not a bucket claim */ }
  }
  if (!Object.prototype.hasOwnProperty.call(metadata, 'presenceBucket')) {
    return { bucket: presenceBucket(nowMs), bucketed: false };
  }
  const bucket = metadata.presenceBucket;
  const observedAt = event.clientTime?.getTime();
  if (typeof bucket !== 'number' || !Number.isSafeInteger(bucket)
    || observedAt == null || !Number.isFinite(observedAt)
    // Allow small device clock skew, but never move a retry to receipt time.
    || observedAt > nowMs + 60_000 || observedAt < nowMs - 60 * 60 * 1000
    || presenceBucket(observedAt) !== bucket) return null;
  return { bucket, bucketed: true };
}

export async function savePresenceEvents(
  userId: string,
  classId: string | null,
  events: NormalizedPresenceEvent[],
  nowMs = Date.now(),
): Promise<{ accepted: number; coalesced: number; ignored: number; receipts: PresenceReceipt[] }> {
  if (events.length === 0) return { accepted: 0, coalesced: 0, ignored: 0, receipts: [] };

  const byId = new Map<string, NormalizedPresenceEvent & { id: string; duration: number; bucket: number; bucketed: boolean }>();
  for (const event of events) {
    if (!isPresenceEventType(event.eventType)) continue;
    const identity = eventBucket(event, nowMs);
    if (!identity) continue;
    const id = presenceEventId(userId, event.eventType, event.targetType, event.targetId, identity.bucket);
    const duration = Math.min(capPresenceDuration(event.duration), identity.bucketed ? PRESENCE_BUCKET_MS / 1000 : Infinity);
    const previous = byId.get(id);
    if (!previous || duration >= previous.duration) {
      byId.set(id, { ...event, id, duration, ...identity });
    }
  }
  const prepared = [...byId.values()];
  if (prepared.length === 0) return { accepted: 0, coalesced: 0, ignored: events.length, receipts: [] };

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
  const updates: Array<{ id: string; duration: number; metadata: string; previous: { duration: number | null; metadata: string | null } }> = [];
  let coalesced = 0;
  let ignored = events.length - prepared.length;

  for (const event of prepared) {
    const decision = decidePresenceWrite({
      existing: existingById.get(event.id) ?? null,
      incomingDuration: event.duration,
      incomingMetadata: event.metadata,
      nowMs,
      insertsRemaining,
      bucketed: event.bucketed,
    });
    if (decision.action === 'skip') {
      if (decision.reason === 'cap') ignored += 1;
      else coalesced += 1;
      continue;
    }
    if (decision.action === 'insert') {
      insertsRemaining -= 1;
      const { bucket: _bucket, bucketed: _bucketed, ...row } = event;
      inserts.push({
        ...row,
        userId,
        classId,
        duration: decision.duration,
        metadata: decision.metadata,
      });
      continue;
    }
    updates.push({ id: event.id, duration: decision.duration, metadata: decision.metadata, previous: existingById.get(event.id)! });
  }

  let accepted = 0;
  if (inserts.length > 0) {
    const created = await prisma.learningEvent.createMany({ data: inserts, skipDuplicates: true });
    accepted += created.count;
    coalesced += inserts.length - created.count;
  }
  for (const update of updates) {
    // Compare-and-set also protects the write gap: a racing request must not
    // overwrite a newer total or immediately rewrite its flush timestamp.
    const result = await prisma.learningEvent.updateMany({
      where: { id: update.id, userId, duration: update.previous.duration, metadata: update.previous.metadata },
      data: { duration: update.duration, metadata: update.metadata },
    });
    accepted += result.count;
    coalesced += 1 - result.count;
  }

  const bucketed = prepared.filter((event) => event.bucketed);
  // Read back after writes, including createMany conflicts and racing updates.
  // A successful HTTP response is not proof that a throttled tail was stored.
  const persisted = bucketed.length > 0 ? await prisma.learningEvent.findMany({
    where: { id: { in: bucketed.map((event) => event.id) }, userId },
    select: { id: true, duration: true, metadata: true },
  }) : [];
  const persistedById = new Map(persisted.map((row) => [row.id, row]));
  const receipts: PresenceReceipt[] = bucketed.map((event) => {
    const row = persistedById.get(event.id);
    const duration = row ? capPresenceDuration(row.duration) : null;
    const flushedAt = readFlushedAt(row?.metadata ?? null);
    const retryAfterMs = duration != null && duration >= event.duration ? undefined
      : !row ? PRESENCE_CLIENT_FLUSH_MS
        : Math.max(1000, (flushedAt ?? nowMs) + PRESENCE_MIN_WRITE_GAP_MS - nowMs);
    return { eventType: event.eventType, targetType: event.targetType, targetId: event.targetId,
      bucket: event.bucket, duration, ...(retryAfterMs == null ? {} : { retryAfterMs }) };
  });
  return { accepted, coalesced, ignored, receipts };
}
