'use client';

import { useEffect } from 'react';
import { getStoredAccessToken, getStoredUser } from '@/lib/auth-storage';
import {
  buildPresenceClientEventId,
  PRESENCE_BUCKET_MS,
  PRESENCE_CLIENT_FLUSH_MS,
  PRESENCE_MAX_PER_REQUEST,
  presenceBucket,
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
type PresenceRecord = {
  target: LearningPresenceTarget;
  bucket: number;
  clientTime: number;
  activeMs: number;
  acknowledged: number | null;
  lastSentAt: number | null;
  retryAt: number;
};
type Receipt = {
  eventType: string;
  targetType: string;
  targetId: string;
  bucket: number;
  duration: number | null;
  retryAfterMs?: number;
};

// Presence is an estimate of recent foreground interaction, never a grade.
// A visible but untouched page stops accruing time after two minutes. A delayed
// timer after sleep is not evidence that the intervening time was spent learning.
const IDLE_MS = 2 * 60 * 1000;
const SAMPLE_MS = 30_000;
const MAX_SAMPLE_GAP_MS = 60_000;
const RETAIN_BUCKETS = 4;
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
const SLOT_DELAY_MS: Record<PresenceSlot, number> = { page: 800, section: 1500, session: 0 };
const slots = new Map<PresenceSlot, LearningPresenceTarget>();
const records = new Map<string, PresenceRecord>();
const pendingAssign = new Map<PresenceSlot, ReturnType<typeof setTimeout>>();
const inputDocuments = new Set<Document>();
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let flushInFlight = false;
let nextAttemptAt = 0;
let sampledAt = 0;
let activeUntil = 0;
let pageHidden = false;
let generation = 0;
let authScope: string | null = null;

function targetKey(target: LearningPresenceTarget): string {
  return JSON.stringify([target.eventType, target.targetType, target.targetId]);
}

function foreground(): boolean {
  return !pageHidden && document.visibilityState === 'visible';
}

function eligibleTargets(): LearningPresenceTarget[] {
  return [...slots].filter(([slot]) => slot !== 'session' || !slots.has('section')).map(([, target]) => target);
}

function recordFor(target: LearningPresenceTarget, time: number): PresenceRecord {
  const bucket = presenceBucket(time);
  const key = `${targetKey(target)}:${bucket}`;
  let record = records.get(key);
  if (!record) {
    record = { target, bucket, clientTime: time, activeMs: 0, acknowledged: null, lastSentAt: null, retryAt: 0 };
    records.set(key, record);
  }
  return record;
}

function storedUserId(): string | undefined {
  try {
    const id = (JSON.parse(getStoredUser() ?? 'null') as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  } catch { return undefined; }
}

function syncAuthScope(now: number): string | null {
  const token = getStoredAccessToken();
  const userId = storedUserId();
  const scope = JSON.stringify([token, userId]);
  if (authScope !== scope) {
    records.clear();
    generation += 1;
    flushInFlight = false;
    nextAttemptAt = 0;
    sampledAt = now;
    // Account changes invalidate the old observation lease as well as its queue.
    if (authScope !== null) activeUntil = now;
    authScope = scope;
  }
  return token;
}

function sample(now: number): void {
  syncAuthScope(now);
  const elapsed = now - sampledAt;
  if (foreground() && elapsed >= 0 && elapsed <= MAX_SAMPLE_GAP_MS) {
    const end = Math.min(now, activeUntil);
    for (const target of eligibleTargets()) {
      let start = sampledAt;
      while (start < end) {
        const boundary = (presenceBucket(start) + 1) * PRESENCE_BUCKET_MS;
        const until = Math.min(end, boundary);
        recordFor(target, start).activeMs += until - start;
        start = until;
      }
    }
  }
  sampledAt = now;
  // Expired unsent observations are discarded, never moved into a new bucket.
  for (const [key, record] of records) {
    if (now - record.clientTime > 60 * 60_000 || record.bucket < presenceBucket(now) - RETAIN_BUCKETS || record.bucket > presenceBucket(now)) records.delete(key);
  }
}

function durationOf(record: PresenceRecord): number {
  return Math.min(PRESENCE_BUCKET_MS / 1000, Math.floor(record.activeMs / 1000));
}

function isClosing(record: PresenceRecord, now: number): boolean {
  return record.bucket !== presenceBucket(now)
    || !foreground() || now >= activeUntil
    || !eligibleTargets().some((target) => targetKey(target) === targetKey(record.target));
}

function dueRecords(now: number): PresenceRecord[] {
  return [...records.values()].filter((record) => {
    if (now < record.retryAt) return false;
    const duration = durationOf(record);
    if (record.acknowledged == null) {
      return record.target.eventType !== 'SESSION_HEARTBEAT' || duration >= 60;
    }
    if (duration <= record.acknowledged) return false;
    if (record.retryAt > 0 || isClosing(record, now)) return true;
    return duration - record.acknowledged >= 60
      && now - (record.lastSentAt ?? 0) >= PRESENCE_CLIENT_FLUSH_MS;
  }).slice(0, PRESENCE_MAX_PER_REQUEST);
}

async function flush(): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  sample(now);
  const scope = getStoredAccessToken();
  if (flushInFlight || now < nextAttemptAt) return;
  const due = dueRecords(now);
  if (!due.length || typeof fetch !== 'function') { maybeStop(); return; }
  const snapshots = due.map((record) => ({ record, duration: durationOf(record) }));
  const run = generation;
  flushInFlight = true;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = fetch('/api/learning-events/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(scope && scope !== 'cookie-session' && scope.includes('.') ? { Authorization: `Bearer ${scope}` } : {}),
      },
      body: JSON.stringify({ expectedUserId: storedUserId(), events: snapshots.map(({ record, duration }) => ({
        clientEventId: buildPresenceClientEventId(record.target.eventType, record.target.targetId, record.clientTime),
        ...record.target,
        duration,
        clientTime: new Date(record.clientTime).toISOString(),
        metadata: {
          source: record.target.eventType === 'SECTION_VISIT' ? 'classroom-presence' : 'student-presence',
          ...record.target.metadata,
          presenceBucket: record.bucket,
        },
      })) }),
      credentials: 'same-origin',
      keepalive: true,
      signal: controller.signal,
    }).then(async (response) => ({
      response,
      body: response.ok ? await response.json() as { receipts?: Receipt[] } : null,
    }));
    const { response, body } = await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('Presence request timed out')); }, 20_000);
      }),
    ]);
    if (run !== generation) return;
    if (!response.ok) {
      nextAttemptAt = Date.now() + (response.status === 401 || response.status === 403 ? 5 * 60_000 : PRESENCE_CLIENT_FLUSH_MS);
      return;
    }
    // A HTTP success alone is not an acknowledgement: the server may have
    // coalesced a write inside its 90-second gap or reached its row quota.
    for (const { record, duration } of snapshots) {
      const receipt = body?.receipts?.find((item) => item.bucket === record.bucket
        && item.eventType === record.target.eventType && item.targetType === record.target.targetType
        && item.targetId === record.target.targetId);
      if (receipt && typeof receipt.duration === 'number' && Number.isFinite(receipt.duration)) {
        record.acknowledged = Math.max(record.acknowledged ?? 0, Math.min(duration, receipt.duration));
        record.lastSentAt = now;
      }
      record.retryAt = record.acknowledged != null && record.acknowledged >= duration
        ? 0 : Date.now() + Math.max(1000, receipt?.retryAfterMs ?? PRESENCE_CLIENT_FLUSH_MS);
    }
    nextAttemptAt = 0;
  } catch {
    if (run === generation) nextAttemptAt = Date.now() + PRESENCE_CLIENT_FLUSH_MS;
  } finally {
    if (timeout != null) clearTimeout(timeout);
    if (run === generation) {
      flushInFlight = false;
      maybeStop();
    }
  }
}

function inputDocumentVisible(input: Document): boolean {
  // An inner classroom may be srcdoc inside an overview iframe. Its events do
  // not bubble across documents, and an outer lesson pane can hide the whole
  // subtree while every element inside the inner frame still looks visible.
  let current = input;
  const visited = new Set<Document>();
  while (current !== document) {
    if (visited.has(current)) return false;
    visited.add(current);
    try {
      const frame = current.defaultView?.frameElement;
      if (!frame) return false;
      for (let element: Element | null = frame; element; element = element.parentElement) {
        const style = element.ownerDocument.defaultView?.getComputedStyle(element);
        if (element.hasAttribute('hidden') || style?.display === 'none' || style?.visibility === 'hidden') return false;
      }
      current = frame.ownerDocument;
    } catch { return false; } // A changed origin must never supply learning evidence.
  }
  return true;
}

function onInput(event: Event): void {
  if (!event.isTrusted || !foreground()) return;
  const input = event.currentTarget as Document;
  if (!inputDocuments.has(input) || !inputDocumentVisible(input)) return;
  const now = Date.now();
  sample(now); // settle the old lease before starting another; do not fill idle gaps
  activeUntil = now + IDLE_MS;
}

function onFrameLoad(event: Event): void {
  if ((event.target as Element | null)?.tagName === 'IFRAME') attachInputs();
}

function attachInputs(): void {
  const documents = new Set<Document>([document]);
  // Set iteration also visits newly discovered same-origin child documents.
  // Cross-origin frames return null or throw; neither is traversed.
  for (const parent of documents) {
    for (const frame of parent.querySelectorAll('iframe')) {
      try { if (frame.contentDocument) documents.add(frame.contentDocument); } catch { /* inaccessible frame */ }
    }
  }
  for (const old of inputDocuments) {
    if (documents.has(old)) continue;
    for (const event of INPUT_EVENTS) old.removeEventListener(event, onInput, true);
    old.removeEventListener('load', onFrameLoad, true);
    inputDocuments.delete(old);
  }
  for (const item of documents) {
    if (inputDocuments.has(item)) continue;
    for (const event of INPUT_EVENTS) item.addEventListener(event, onInput, { capture: true, passive: true });
    // Listen in every document: an inner frame's load does not propagate to
    // the app window. The interval remains a fallback for DOM-only changes.
    item.addEventListener('load', onFrameLoad, true);
    inputDocuments.add(item);
  }
}

function onVisibility(): void {
  const now = Date.now();
  // visibilityState is already hidden when this handler runs. Settle the
  // observed foreground interval first, then stop it explicitly.
  if (document.visibilityState === 'hidden') {
    const wasHidden = pageHidden;
    if (!wasHidden) sampleForegroundEnd(now);
    pageHidden = true;
  } else {
    pageHidden = false;
    sampledAt = now;
    activeUntil = now + IDLE_MS;
  }
  void flush();
}

function sampleForegroundEnd(now: number): void {
  // sample() checks foreground; visibilitychange has already changed the DOM
  // flag, so use the same accounting with an explicit observed interval.
  syncAuthScope(now);
  const end = Math.min(now, activeUntil);
  if (now >= sampledAt && now - sampledAt <= MAX_SAMPLE_GAP_MS) {
    for (const target of eligibleTargets()) {
      for (let start = sampledAt; start < end;) {
        const until = Math.min(end, (presenceBucket(start) + 1) * PRESENCE_BUCKET_MS);
        recordFor(target, start).activeMs += until - start;
        start = until;
      }
    }
  }
  sampledAt = now;
}

function onPageHide(): void {
  if (!pageHidden) sampleForegroundEnd(Date.now());
  pageHidden = true;
  void flush();
}

function onPageShow(): void {
  pageHidden = document.visibilityState !== 'visible';
  sampledAt = Date.now();
  activeUntil = sampledAt + IDLE_MS;
}

function commitAssign(slot: PresenceSlot, target: LearningPresenceTarget | null): void {
  const now = Date.now();
  sample(now);
  if (target) {
    slots.set(slot, target);
    if (foreground() && now < activeUntil && (slot !== 'session' || !slots.has('section'))) recordFor(target, now);
  } else slots.delete(slot);
  void flush();
}

function ensureRunning(): void {
  if (timer != null || typeof window === 'undefined') return;
  sampledAt = Date.now();
  activeUntil = sampledAt + IDLE_MS;
  pageHidden = document.visibilityState !== 'visible';
  syncAuthScope(sampledAt);
  attachInputs();
  timer = setInterval(() => { attachInputs(); void flush(); }, SAMPLE_MS);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
}

function stop(): void {
  if (timer != null) clearInterval(timer);
  timer = null;
  for (const item of inputDocuments) {
    for (const event of INPUT_EVENTS) item.removeEventListener(event, onInput, true);
    item.removeEventListener('load', onFrameLoad, true);
  }
  inputDocuments.clear();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
}

function maybeStop(): void {
  if (subscribers > 0 || flushInFlight || typeof window === 'undefined') return;
  const pending = [...records.values()].some((record) => record.acknowledged == null
    ? record.target.eventType !== 'SESSION_HEARTBEAT' || durationOf(record) >= 60
    : durationOf(record) > record.acknowledged);
  if (!pending) stop();
}

export function resetLearningPresenceForTests(): void {
  generation += 1;
  for (const handle of pendingAssign.values()) clearTimeout(handle);
  pendingAssign.clear();
  slots.clear();
  records.clear();
  subscribers = 0;
  flushInFlight = false;
  nextAttemptAt = 0;
  sampledAt = 0;
  activeUntil = 0;
  pageHidden = false;
  authScope = null;
  if (typeof window !== 'undefined') stop();
}

export function useLearningPresence(slot: PresenceSlot, target: LearningPresenceTarget | null): void {
  const serialized = target ? JSON.stringify(target) : '';
  useEffect(() => {
    subscribers += 1;
    ensureRunning();
    const parsed = serialized ? JSON.parse(serialized) as LearningPresenceTarget : null;
    const waiting = pendingAssign.get(slot);
    if (waiting) clearTimeout(waiting);
    pendingAssign.set(slot, setTimeout(() => {
      pendingAssign.delete(slot);
      commitAssign(slot, parsed);
    }, parsed ? SLOT_DELAY_MS[slot] : 0));
    return () => {
      const pending = pendingAssign.get(slot);
      if (pending) clearTimeout(pending);
      pendingAssign.delete(slot);
      commitAssign(slot, null);
      subscribers = Math.max(0, subscribers - 1);
      maybeStop();
    };
  }, [serialized, slot]);
}
