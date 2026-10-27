import { act, renderHook } from '@testing-library/react';
import { resetLearningPresenceForTests, useLearningPresence } from '@/hooks/useLearningPresence';
import { clearStoredAuth, storeAuth } from '@/lib/auth-storage';
import { PRESENCE_BUCKET_MS, presenceBucket } from '@/lib/learning-presence-shared';

const target = {
  eventType: 'SECTION_VISIT' as const,
  targetType: 'KNOWLEDGE_POINT',
  targetId: '3.1#addressing',
  chapterId: '3',
  moduleId: 'u3-overview',
  metadata: { source: 'lesson-notes', sectionId: 'addressing' },
};
const second = { ...target, targetId: '3.2#jump' };
type SentEvent = typeof target & { duration: number; clientTime: string; metadata: { presenceBucket: number } };

function sent(): SentEvent[] {
  return (global.fetch as jest.Mock).mock.calls.flatMap((call) => JSON.parse(call[1].body).events);
}
function success(body: string) {
  return { ok: true, status: 200, json: async () => ({ receipts: JSON.parse(body).events.map((event: SentEvent) => ({
    eventType: event.eventType, targetType: event.targetType, targetId: event.targetId,
    bucket: event.metadata.presenceBucket, duration: event.duration,
  })) }) };
}
async function advance(ms: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
}

// DOM-generated trusted input cannot be constructed by JS. Invoke the actual
// registered listener with the browser's event shape to exercise that boundary.
function trustedInput(doc: Document = document) {
  const spy = doc.addEventListener as jest.Mock;
  const listener = [...spy.mock.calls].reverse().find((call) => call[0] === 'pointerdown')?.[1] as EventListener;
  expect(listener).toBeDefined();
  act(() => listener({ isTrusted: true, currentTarget: doc } as unknown as Event));
}
async function activeFor(ms: number, doc: Document = document) {
  for (let remaining = ms; remaining > 0;) {
    trustedInput(doc);
    const step = Math.min(30_000, remaining);
    await advance(step);
    remaining -= step;
  }
}
function persistedTotal(events = sent()) {
  const buckets = new Map<string, number>();
  for (const event of events) {
    const key = `${event.targetId}:${event.metadata.presenceBucket}`;
    buckets.set(key, Math.max(buckets.get(key) ?? 0, event.duration));
  }
  return [...buckets.values()].reduce((sum, value) => sum + value, 0);
}

describe('useLearningPresence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-27T08:00:00.000Z'));
    resetLearningPresenceForTests();
    clearStoredAuth();
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementation((_url: string, options: { body: string }) => Promise.resolve(success(options.body)));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    jest.spyOn(document, 'addEventListener');
  });
  afterEach(() => {
    resetLearningPresenceForTests();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('records the section visit, then batches observed active duration', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ eventType: 'SECTION_VISIT', targetId: target.targetId, duration: 0 });
    await activeFor(210_000);
    expect(sent()).toHaveLength(2);
    expect(sent()[1].duration).toBeGreaterThanOrEqual(180);
  });

  it('continues beyond 945 seconds without repeating previous-bucket duration', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(40 * 60_000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    const events = sent();
    expect(new Set(events.map((event) => event.metadata.presenceBucket)).size).toBe(3);
    expect(Math.max(...events.map((event) => event.duration))).toBeLessThanOrEqual(900);
    expect(persistedTotal()).toBeGreaterThanOrEqual(2398); // floor only once per bucket
    expect(persistedTotal()).toBeLessThanOrEqual(2400);
    expect(events.at(-1)!.duration).toBeLessThan(900);
  });

  it('stops an untouched page after two minutes and does not create overnight buckets', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await advance(3 * 60 * 60_000);
    expect(persistedTotal()).toBeLessThanOrEqual(120);
    expect(new Set(sent().map((event) => event.metadata.presenceBucket)).size).toBe(1);
    const previous = persistedTotal();
    trustedInput();
    await activeFor(60_000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(persistedTotal() - previous).toBe(60);
  });

  it('ignores synthetic input as evidence of continued activity', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    for (let i = 0; i < 20; i += 1) {
      document.dispatchEvent(new Event('pointerdown'));
      await advance(30_000);
    }
    expect(persistedTotal()).toBeLessThanOrEqual(120);
  });

  it('excludes background time and pagehide time even if visibilityState stays visible', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(60_000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(10 * 60_000);
    expect(persistedTotal()).toBe(60);
    act(() => window.dispatchEvent(new Event('pageshow')));
    await activeFor(60_000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await advance(5 * 60_000);
    expect(persistedTotal()).toBe(120);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await activeFor(30_000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(persistedTotal()).toBe(150);
  });

  it('discards unobserved timer gaps after sleep instead of backfilling them', async () => {
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(60_000);
    jest.setSystemTime(Date.now() + 60 * 60_000);
    trustedInput();
    await activeFor(60_000);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(persistedTotal()).toBeLessThanOrEqual(120);
    expect(persistedTotal()).toBeGreaterThanOrEqual(60);
  });

  it('attributes rapid section switches and reentry to their own cumulative record', async () => {
    const hook = renderHook(({ current }) => useLearningPresence('section', current), { initialProps: { current: target } });
    await advance(1500);
    await activeFor(45_000);
    hook.rerender({ current: second });
    await advance(1500);
    await activeFor(30_000);
    hook.rerender({ current: target });
    await advance(1500);
    await activeFor(45_000);
    hook.unmount();
    await advance(30_000);
    const firstEvents = sent().filter((event) => event.targetId === target.targetId);
    expect(Math.max(...firstEvents.map((event) => event.duration))).toBe(90);
    expect(persistedTotal(sent().filter((event) => event.targetId === second.targetId))).toBe(30);
    expect(persistedTotal()).toBe(120);
  });

  it('preserves closing observations through failed requests and across bucket rollover', async () => {
    jest.setSystemTime(new Date('2026-10-27T08:14:00.000Z'));
    const hook = renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(30_000);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('lost response'));
    hook.unmount();
    await advance(0);
    const lost = sent().at(-1)!;
    await advance(4 * 60_000);
    const retried = sent().at(-1)!;
    expect(retried).toEqual(lost);
    expect(retried.metadata.presenceBucket).toBe(presenceBucket(new Date('2026-10-27T08:14:00Z').getTime()));
    expect(retried.duration).toBe(30);
    expect(persistedTotal()).toBe(30);
  });

  it('retries small closing tails only after the server receipt write-gap expires', async () => {
    const hook = renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(30_000);
    (global.fetch as jest.Mock).mockImplementationOnce((_url: string, options: { body: string }) => {
      const reply = success(options.body);
      return Promise.resolve({ ...reply, json: async () => ({ receipts: [{ eventType: target.eventType,
        targetType: target.targetType, targetId: target.targetId, bucket: sent().at(-1)!.metadata.presenceBucket,
        duration: 0, retryAfterMs: 60_000 }] }) });
    });
    hook.unmount();
    await advance(0);
    const count = sent().length;
    await advance(59_000);
    expect(sent()).toHaveLength(count);
    await advance(31_000);
    expect(sent()).toHaveLength(count + 1);
    expect(sent().at(-1)!.duration).toBe(30);
  });

  it('retains a new section while an old request is in flight', async () => {
    let resolve!: (value: unknown) => void;
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const hook = renderHook(({ current }) => useLearningPresence('section', current), { initialProps: { current: target } });
    await advance(1500);
    const initialBody = (global.fetch as jest.Mock).mock.calls[0][1].body;
    await advance(10_000);
    hook.rerender({ current: second });
    await advance(1500);
    await act(async () => resolve(success(initialBody)));
    await activeFor(30_000);
    hook.unmount();
    await advance(30_000);
    expect(persistedTotal(sent().filter((event) => event.targetId === target.targetId))).toBe(10);
    expect(persistedTotal(sent().filter((event) => event.targetId === second.targetId))).toBe(30);
  });

  it('observes trusted input inside visible same-origin lesson frames', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    jest.spyOn(frameDoc, 'addEventListener');
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(5 * 60_000, frameDoc);
    act(() => window.dispatchEvent(new Event('pagehide')));
    await advance(0);
    expect(persistedTotal()).toBe(300);
    frame.remove();
  });

  it('does not let hidden lesson frames keep a visible page active', async () => {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    document.body.appendChild(frame);
    const frameDoc = frame.contentDocument!;
    jest.spyOn(frameDoc, 'addEventListener');
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(5 * 60_000, frameDoc);
    expect(persistedTotal()).toBeLessThanOrEqual(120);
    frame.remove();
  });

  it('does not start visits while hidden or double count a session alongside a section', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    renderHook(() => {
      useLearningPresence('section', target);
      useLearningPresence('session', { eventType: 'SESSION_HEARTBEAT', targetType: 'SESSION', targetId: 'session' });
    });
    await advance(PRESENCE_BUCKET_MS);
    expect(sent()).toHaveLength(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await activeFor(180_000);
    expect(sent().length).toBeGreaterThan(0);
    expect(sent().every((event) => event.eventType === 'SECTION_VISIT')).toBe(true);
  });
  it('clears a pending cookie-session backlog when the signed-in student changes', async () => {
    storeAuth('unused', { id: 'student-a' }, 'session');
    const hook = renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    await activeFor(30_000);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    hook.unmount();
    await advance(0);
    const count = sent().length;
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).expectedUserId).toBe('student-a');
    storeAuth('unused', { id: 'student-b' }, 'session');
    renderHook(() => useLearningPresence('section', second));
    await advance(1500);
    await activeFor(240_000);
    expect(sent().slice(count).length).toBeGreaterThan(0);
    expect(sent().slice(count).every((event) => event.targetId === second.targetId)).toBe(true);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)![1].body).expectedUserId).toBe('student-b');
  });

  it('times out a hung request and retries its original observations without blocking sampling', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    renderHook(() => useLearningPresence('section', target));
    await advance(1500);
    const initial = sent()[0];
    await activeFor(240_000);
    expect(sent().length).toBeGreaterThan(1);
    expect(sent()[1].clientTime).toBe(initial.clientTime);
    expect(sent()[1].metadata.presenceBucket).toBe(initial.metadata.presenceBucket);
    expect(sent()[1].duration).toBeGreaterThanOrEqual(180);
  });

});
