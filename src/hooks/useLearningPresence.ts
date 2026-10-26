'use client';

import { useEffect } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  buildPresenceClientEventId,
  capPresenceDuration,
  PRESENCE_BUCKET_MAX_DURATION_SECONDS,
  PRESENCE_CLIENT_FLUSH_MS,
  shouldSendPresence,
  type PresenceEventType,
} from '@/lib/learning-presence-shared';

export type LearningPresenceTarget = {
  eventType: PresenceEventType;
  targetType: string;
  targetId: string;
  moduleId?: string;
  chapterId?: string;
  metadata?: Record<string, unknown>;
};

type PresenceSlot = 'page' | 'section' | 'session';

type SlotState = {
  target: LearningPresenceTarget;
  visibleMs: number;
  runningSince: number | null;
  lastSentAt: number | null;
  lastSentDuration: number;
};

const slots = new Map<PresenceSlot, SlotState>();
const recentSentAt = new Map<string, number>();
const pendingAssign = new Map<PresenceSlot, ReturnType<typeof setTimeout>>();
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let flushInFlight = false;
let nextAttemptAt = 0;

const SLOT_DELAY_MS: Record<PresenceSlot, number> = {
  page: 800,
  section: 1500,
  session: 0,
};

function targetKey(target: LearningPresenceTarget): string {
  return `${target.eventType}:${target.targetType}:${target.targetId}`;
}

function sameTarget(left: LearningPresenceTarget, right: LearningPresenceTarget): boolean {
  return left.eventType === right.eventType
    && left.targetType === right.targetType
    && left.targetId === right.targetId;
}

function dwellSeconds(state: SlotState, now: number): number {
  const running = state.runningSince != null && typeof document !== 'undefined' && document.visibilityState === 'visible'
    ? Math.max(0, now - state.runningSince)
    : 0;
  return capPresenceDuration(Math.round((state.visibleMs + running) / 1000));
}

function freeze(state: SlotState, now: number): void {
  if (state.runningSince != null) {
    state.visibleMs += Math.max(0, now - state.runningSince);
    state.runningSince = null;
  }
  if (state.visibleMs > PRESENCE_BUCKET_MAX_DURATION_SECONDS * 1000) {
    state.visibleMs = PRESENCE_BUCKET_MAX_DURATION_SECONDS * 1000;
  }
}

function resume(state: SlotState, now: number): void {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  if (state.runningSince == null) state.runningSince = now;
}

function authorizationHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token || token === 'cookie-session' || !token.includes('.')) return {};
  return { Authorization: `Bearer ${token}` };
}

type PendingEvent = {
  state: SlotState;
  duration: number;
};

async function postPresence(pending: PendingEvent[], now: number): Promise<boolean | null> {
  const events = pending.map((item) => ({
    clientEventId: buildPresenceClientEventId(item.state.target.eventType, item.state.target.targetId, now),
    eventType: item.state.target.eventType,
    targetType: item.state.target.targetType,
    targetId: item.state.target.targetId,
    moduleId: item.state.target.moduleId,
    chapterId: item.state.target.chapterId,
    duration: item.duration,
    clientTime: new Date(now).toISOString(),
    metadata: {
      source: item.state.target.eventType === 'SECTION_VISIT' ? 'classroom-presence' : 'student-presence',
      ...item.state.target.metadata,
    },
  }));
  const body = JSON.stringify({ events });
  if (typeof fetch !== 'function') return null;
  try {
    const response = await fetch('/api/learning-events/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorizationHeaders() },
      body,
      credentials: 'same-origin',
      keepalive: true,
    });
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) return null;
    return true;
  } catch {
    return null;
  }
}

function collectDue(now: number, closingSlots: PresenceSlot[]): PendingEvent[] {
  const closing = new Set(closingSlots);
  const sectionActive = slots.has('section');
  const due: PendingEvent[] = [];
  for (const [slot, state] of slots) {
    if (slot === 'session' && sectionActive) continue;
    const duration = dwellSeconds(state, now);
    const runningMs = state.runningSince != null ? Math.max(0, now - state.runningSince) : 0;
    const settled = state.visibleMs + runningMs >= 30 * 60 * 1000;
    const send = shouldSendPresence({
      eventType: state.target.eventType,
      durationSeconds: duration,
      lastSentDuration: state.lastSentAt == null ? null : state.lastSentDuration,
      lastSentAtMs: state.lastSentAt,
      nowMs: now,
      closing: closing.has(slot),
      // A tab left open overnight reports about every 10 minutes, not every 3.
      minGapMs: settled ? 10 * 60 * 1000 : undefined,
    });
    if (!send) continue;
    const key = targetKey(state.target);
    const recent = recentSentAt.get(key);
    if (recent != null && now - recent < 5000 && duration - state.lastSentDuration < 60) continue;
    due.push({ state, duration });
  }
  return due;
}

async function flush(closingSlots: PresenceSlot[] = []): Promise<void> {
  if (flushInFlight || typeof window === 'undefined') return;
  const now = Date.now();
  if (now < nextAttemptAt) return;
  const due = collectDue(now, closingSlots);
  if (due.length === 0) return;
  flushInFlight = true;
  try {
    const result = await postPresence(due, now);
    if (result === true) {
      nextAttemptAt = 0;
      for (const item of due) {
        item.state.lastSentAt = now;
        item.state.lastSentDuration = item.duration;
        recentSentAt.set(targetKey(item.state.target), now);
      }
      return;
    }
    nextAttemptAt = Date.now() + (result === false ? 5 * 60 * 1000 : PRESENCE_CLIENT_FLUSH_MS);
  } finally {
    flushInFlight = false;
  }
}

function onVisibility(): void {
  const now = Date.now();
  if (document.visibilityState === 'hidden') {
    for (const state of slots.values()) freeze(state, now);
    void flush([...slots.keys()]);
    return;
  }
  for (const state of slots.values()) resume(state, now);
}

function commitAssign(slot: PresenceSlot, target: LearningPresenceTarget | null): void {
  const now = Date.now();
  const current = slots.get(slot);
  if (!target) {
    if (!current) return;
    freeze(current, now);
    void flush([slot]);
    slots.delete(slot);
    return;
  }
  if (current && sameTarget(current.target, target)) {
    current.target = target;
    return;
  }
  if (current) {
    freeze(current, now);
    void flush([slot]);
  }
  slots.set(slot, {
    target,
    visibleMs: 0,
    runningSince: typeof document !== 'undefined' && document.visibilityState === 'visible' ? now : null,
    lastSentAt: null,
    lastSentDuration: 0,
  });
  void flush();
}

function scheduleAssign(slot: PresenceSlot, target: LearningPresenceTarget | null): void {
  const waiting = pendingAssign.get(slot);
  if (waiting) clearTimeout(waiting);
  const delay = target ? SLOT_DELAY_MS[slot] : 0;
  const handle = setTimeout(() => {
    pendingAssign.delete(slot);
    commitAssign(slot, target);
  }, delay);
  pendingAssign.set(slot, handle);
}

function ensureRunning(): void {
  if (timer != null || typeof window === 'undefined') return;
  timer = setInterval(() => { void flush(); }, 30_000);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onVisibility);
}

function maybeStop(): void {
  if (subscribers > 0 || typeof window === 'undefined') return;
  if (timer != null) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onVisibility);
}

export function resetLearningPresenceForTests(): void {
  for (const handle of pendingAssign.values()) clearTimeout(handle);
  pendingAssign.clear();
  slots.clear();
  recentSentAt.clear();
  subscribers = 0;
  flushInFlight = false;
  nextAttemptAt = 0;
  if (timer != null) clearInterval(timer);
  timer = null;
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  if (typeof window !== 'undefined') window.removeEventListener('pagehide', onVisibility);
}

export function useLearningPresence(slot: PresenceSlot, target: LearningPresenceTarget | null): void {
  const serialized = target
    ? JSON.stringify({
      eventType: target.eventType,
      targetType: target.targetType,
      targetId: target.targetId,
      moduleId: target.moduleId ?? null,
      chapterId: target.chapterId ?? null,
      metadata: target.metadata ?? null,
    })
    : '';

  useEffect(() => {
    subscribers += 1;
    ensureRunning();
    const parsed: LearningPresenceTarget | null = serialized
      ? JSON.parse(serialized) as LearningPresenceTarget
      : null;
    scheduleAssign(slot, parsed);
    return () => {
      const waiting = pendingAssign.get(slot);
      if (waiting) {
        clearTimeout(waiting);
        pendingAssign.delete(slot);
      }
      commitAssign(slot, null);
      subscribers = Math.max(0, subscribers - 1);
      maybeStop();
    };
  }, [serialized, slot]);
}
