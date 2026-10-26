import { act, renderHook } from '@testing-library/react';
import { resetLearningPresenceForTests, useLearningPresence } from '@/hooks/useLearningPresence';

describe('useLearningPresence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetLearningPresenceForTests();
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  afterEach(() => {
    resetLearningPresenceForTests();
    jest.useRealTimers();
  });

  it('records a classroom section once, then waits before sending a longer dwell', async () => {
    const target = {
      eventType: 'SECTION_VISIT' as const,
      targetType: 'KNOWLEDGE_POINT',
      targetId: '3.1#addressing',
      chapterId: '3',
      moduleId: 'u3-overview',
      metadata: { source: 'lesson-notes', sectionId: 'addressing' },
    };
    renderHook(() => useLearningPresence('section', target));

    await act(async () => {
      jest.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.events[0]).toMatchObject({
      eventType: 'SECTION_VISIT',
      targetId: '3.1#addressing',
      chapterId: '3',
    });

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(180_000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const dwell = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body as string);
    expect(dwell.events[0].duration).toBeGreaterThanOrEqual(60);
  });
});