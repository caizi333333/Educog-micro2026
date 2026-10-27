/**
 * Client-safe classroom presence helpers.
 *
 * This module is imported by the browser hook `useLearningPresence`. It must
 * not import Node built-ins, Prisma, or other server modules — Next's client
 * compiler cannot bundle `node:` URIs such as `node:crypto`. Hashing and
 * database writes live in `learning-presence.ts`.
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

export const STUDIED_EVENT_TYPES = ['SECTION_VISIT', 'COMPLETE_QUIZ', 'RESOURCE_OPENED', 'RESOURCE_COMPLETED', 'PRACTICE_CLEAR'] as const;
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
