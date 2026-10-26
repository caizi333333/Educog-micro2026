import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sanitizeMetadata } from '@/lib/classroom';

/**
 * Presence rows share one LearningEvent per student, target, and 15-minute
 * bucket. Duration grows on that row instead of inserting a heartbeat each
 * minute, so a full class left on a lesson cannot multiply Neon writes by the
 * polling rate.
 */
export const PRESENCE_EVENT_TYPES = ['PAGE_VIEW', 'SECTION_VISIT', 'SESSION_HEARTBEAT'] as const;
export type PresenceEventType = typeof PRESENCE_EVENT_TYPES[number];

export const PRESENCE_BUCKET_MS = 15 * 60 * 1000;
export const PRESENCE_MIN_WRITE_GAP_MS = 90 * 1000;
export const PRESENCE_MIN_DURATION_DELTA_SECONDS = 60;
export const PRESENCE_BUCKET_MAX_DURATION_SECONDS = 15 * 60 + 45;
export const PRESENCE_HOURLY_NEW_ROW_CAP = 24;
export const PRESENCE_MAX_NEW_ROWS_PER_REQUEST = 4;
export const PRESENCE_MAX_PER_REQUEST = 8;
export const PRESENCE_CLIENT_FLUSH_MS = 180 * 1000;
export const PRESENCE_SUMMARY_WINDOW_DAYS = 7;

export const STUDIED_EVENT_TYPES = ['SECTION_VISIT', 'COMPLETE_QUIZ', 'RESOURCE_OPENED', 'RESOURCE_COMPLETED'] as const;
export const ACTIVITY_EVENT_TYPES = [
  ...STUDIED_EVENT_TYPES,
  'PAGE_VIEW',
  'SESSION_HEARTBEAT',
  'LOGIN',
] as const;

const PRESENCE_TYPE_SET = new Set<string>(PRESENCE_EVENT_TYPES);
const STUDIED_TYPE_SET = new Set<string>(STUDIED_EVENT_TYPES);

export function isPresenceEventType(eventType: string): eventType is PresenceEventType {
  return PRESENCE_TYPE_SET.has(eventType);
}

export function presenceBucket(nowMs: number): number {
  return Math.floor(nowMs / PRESENCE_BUCKET_MS);
}

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

export function capPresenceDuration(duration: number | null | undefined): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 0;
  return Math.max(0, Math.min(PRESENCE_BUCKET_MAX_DURATION_SECONDS, Math.round(duration)));
}

export function buildPresenceClientEventId(eventType: string, targetId: string, nowMs: number): string {
  const safeTarget = targetId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  const raw = `presence-${eventType}-${safeTarget}-${Math.floor(nowMs / 1000)}`;
  return (raw.length >= 8 ? raw : `${raw}-event`).slice(0, 160);
}

export function shouldSendPresence(input: {
  eventType: PresenceEventType;
  durationSeconds: number;
  lastSentDuration: number | null;
  lastSentAtMs: number | null;
  nowMs: number;
  closing: boolean;
  minGapMs?: number;
}): boolean {
  const duration = capPresenceDuration(input.durationSeconds);
  if (input.lastSentAtMs == null) {
    if (input.eventType === 'SESSION_HEARTBEAT') return duration >= PRESENCE_MIN_DURATION_DELTA_SECONDS;
    return true;
  }
  const grew = duration - (input.lastSentDuration ?? 0) >= PRESENCE_MIN_DURATION_DELTA_SECONDS;
  if (!grew) return false;
  if (input.closing) return true;
  return input.nowMs - input.lastSentAtMs >= (input.minGapMs ?? PRESENCE_CLIENT_FLUSH_MS);
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

export type ClassActivityRosterStudent = {
  id: string;
  name: string;
  username: string;
  studentId: string | null;
  lastLoginAt: Date | null;
};

export type ClassActivityEventGroup = {
  userId: string;
  eventType: string;
  targetId: string;
  chapterId: string | null;
  lastAt: Date | null;
  durationSeconds: number;
  count: number;
};

export type ClassActivityStudent = {
  id: string;
  name: string;
  username: string;
  studentId: string | null;
  lastActiveAt: string | null;
  studied: boolean;
  durationSeconds: number;
  quizCompletions: number;
  recentTargets: Array<{
    targetId: string;
    chapterId: string | null;
    eventType: string;
    lastAt: string | null;
    durationSeconds: number;
  }>;
};

function latestIso(times: Array<Date | null | undefined>): string | null {
  let latest = 0;
  for (const time of times) {
    const value = time?.getTime() ?? 0;
    if (value > latest) latest = value;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

export function buildClassActivity(
  roster: ClassActivityRosterStudent[],
  groups: ClassActivityEventGroup[],
): { students: ClassActivityStudent[]; studied: number; notStudied: number } {
  const byUser = new Map<string, ClassActivityEventGroup[]>();
  for (const group of groups) {
    const list = byUser.get(group.userId) ?? [];
    list.push(group);
    byUser.set(group.userId, list);
  }

  const students = roster.map((student) => {
    const events = byUser.get(student.id) ?? [];
    const studiedEvents = events.filter((event) => STUDIED_TYPE_SET.has(event.eventType));
    const sectionEvents = events.filter((event) => event.eventType === 'SECTION_VISIT');
    const quizEvents = events.filter((event) => event.eventType === 'COMPLETE_QUIZ');
    const recentTargets = [...sectionEvents, ...quizEvents]
      .sort((left, right) => (right.lastAt?.getTime() ?? 0) - (left.lastAt?.getTime() ?? 0))
      .slice(0, 5)
      .map((event) => ({
        targetId: event.targetId,
        chapterId: event.chapterId,
        eventType: event.eventType,
        lastAt: event.lastAt ? event.lastAt.toISOString() : null,
        durationSeconds: event.durationSeconds,
      }));
    return {
      id: student.id,
      name: student.name,
      username: student.username,
      studentId: student.studentId,
      lastActiveAt: latestIso([student.lastLoginAt, ...events.map((event) => event.lastAt)]),
      studied: studiedEvents.length > 0,
      durationSeconds: sectionEvents.reduce((sum, event) => sum + event.durationSeconds, 0),
      quizCompletions: quizEvents.reduce((sum, event) => sum + event.count, 0),
      recentTargets,
    };
  });

  students.sort((left, right) => {
    const leftTime = left.lastActiveAt ? new Date(left.lastActiveAt).getTime() : 0;
    const rightTime = right.lastActiveAt ? new Date(right.lastActiveAt).getTime() : 0;
    return rightTime - leftTime;
  });

  const studied = students.filter((student) => student.studied).length;
  return { students, studied, notStudied: students.length - studied };
}
