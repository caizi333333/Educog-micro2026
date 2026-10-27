import { normalizeLearningEventInput } from '@/lib/classroom';
import { prisma } from '@/lib/prisma';
import { presenceBucket, PRESENCE_BUCKET_MS, savePresenceEvents, type NormalizedPresenceEvent } from '@/lib/learning-presence';

jest.mock('@/lib/prisma', () => ({
  prisma: { learningEvent: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn(), updateMany: jest.fn() } },
}));

type Row = NormalizedPresenceEvent & { id: string; userId: string; classId: string | null };
const db = prisma.learningEvent as unknown as {
  count: jest.Mock; findMany: jest.Mock; createMany: jest.Mock; updateMany: jest.Mock;
};
const start = Math.floor(1_800_000_000_000 / PRESENCE_BUCKET_MS) * PRESENCE_BUCKET_MS;
let rows: Map<string, Row>;

function event(duration: number, observedAt = start + 10_000, targetId = 'chapter-3'): NormalizedPresenceEvent {
  return normalizeLearningEventInput({
    eventType: 'SECTION_VISIT', targetType: 'KNOWLEDGE_POINT', targetId,
    moduleId: 'u3-overview', chapterId: '3', duration,
    clientTime: new Date(observedAt).toISOString(),
    metadata: { source: 'classroom-presence', presenceBucket: presenceBucket(observedAt) },
  })!;
}

beforeEach(() => {
  rows = new Map();
  jest.clearAllMocks();
  db.count.mockResolvedValue(0);
  db.findMany.mockImplementation(async ({ where }) => [...rows.values()].filter((row) => where.id.in.includes(row.id) && row.userId === where.userId));
  db.createMany.mockImplementation(async ({ data }) => {
    let count = 0;
    for (const row of data) {
      if (!rows.has(row.id)) { rows.set(row.id, { ...row }); count += 1; }
    }
    return { count };
  });
  db.updateMany.mockImplementation(async ({ where, data }) => {
    const row = rows.get(where.id);
    if (!row || row.userId !== where.userId || row.duration !== where.duration || row.metadata !== where.metadata) return { count: 0 };
    rows.set(row.id, { ...row, ...data });
    return { count: 1 };
  });
});

describe('bucketed presence persistence and receipts', () => {
  it('preserves the bucket through input sanitization without accepting sensitive metadata', () => {
    const normalized = normalizeLearningEventInput({ ...event(30), metadata: { presenceBucket: presenceBucket(start), token: 'never-save' } });
    expect(JSON.parse(normalized!.metadata!)).toEqual({ presenceBucket: presenceBucket(start) });
  });

  it('accumulates separate bounded buckets beyond 945 seconds without duplicating a lost-ack retry', async () => {
    for (let bucketOffset = 0; bucketOffset < 3; bucketOffset += 1) {
      const observedAt = start + bucketOffset * PRESENCE_BUCKET_MS + 10_000;
      const payload = event(880, observedAt);
      await savePresenceEvents('student-a', 'class-a', [payload], observedAt + 880_000);
      // A retry delivered after the wall-clock boundary keeps its original row.
      const retry = await savePresenceEvents('student-a', 'class-a', [payload], observedAt + 920_000);
      expect(retry.accepted).toBe(0);
      expect(retry.receipts[0]).toMatchObject({ duration: 880, bucket: presenceBucket(observedAt) });
    }
    expect(rows.size).toBe(3);
    expect([...rows.values()].reduce((sum, row) => sum + (row.duration ?? 0), 0)).toBe(2640);
  });

  it('reports a throttled closing tail as unacknowledged and stores it after the write gap', async () => {
    await savePresenceEvents('student-a', 'class-a', [event(0)], start + 10_000);
    const tail = await savePresenceEvents('student-a', 'class-a', [event(25)], start + 35_000);
    expect(tail.receipts[0]).toMatchObject({ duration: 0, retryAfterMs: 65_000 });
    expect(tail.accepted).toBe(0);
    const retry = await savePresenceEvents('student-a', 'class-a', [event(25)], start + 100_000);
    expect(retry.receipts[0]).toMatchObject({ duration: 25 });
    expect(retry.receipts[0].retryAfterMs).toBeUndefined();
    expect(rows.size).toBe(1);
  });

  it.each([
    ['future', start + 90_001, presenceBucket(start)],
    ['expired', start - 60 * 60 * 1000 - 1, presenceBucket(start - 60 * 60 * 1000 - 1)],
    ['mismatched', start + 10_000, presenceBucket(start) - 1],
    ['fractional', start + 10_000, presenceBucket(start) + 0.5],
    ['missing time', null, presenceBucket(start)],
  ])('ignores an explicit %s bucket instead of moving it into a new bucket', async (_label, observedAt, bucket) => {
    const payload = { ...event(120), clientTime: observedAt == null ? null : new Date(observedAt), metadata: JSON.stringify({ presenceBucket: bucket }) };
    const result = await savePresenceEvents('student-a', 'class-a', [payload], start + 30_000);
    expect(result).toEqual({ accepted: 0, coalesced: 0, ignored: 1, receipts: [] });
    expect(db.createMany).not.toHaveBeenCalled();
  });

  it('accepts up to one minute of clock skew even across a boundary, without changing identity', async () => {
    const observedAt = start + PRESENCE_BUCKET_MS + 30_000;
    const result = await savePresenceEvents('student-a', 'class-a', [event(0, observedAt)], observedAt - 60_000);
    expect(result.receipts[0]).toMatchObject({ bucket: presenceBucket(observedAt), duration: 0 });
    const rejected = await savePresenceEvents('student-a', 'class-a', [event(0, observedAt)], observedAt - 60_001);
    expect(rejected.ignored).toBe(1);
  });

  it('bounds new-protocol duration to one actual bucket while leaving legacy semantics intact', async () => {
    const versioned = await savePresenceEvents('student-a', 'class-a', [event(9999)], start + 20_000);
    expect(versioned.receipts[0].duration).toBe(900);
    await savePresenceEvents('student-b', 'class-b', [{ ...event(9999), metadata: null, clientTime: null }], start + 20_000);
    expect([...rows.values()].find((row) => row.userId === 'student-b')?.duration).toBe(945);
    expect([...rows.values()].every((row) => !('bucketed' in row) && !('bucket' in row))).toBe(true);
  });

  it('keeps the per-request new-row cap and returns null receipts for unpersisted targets', async () => {
    const result = await savePresenceEvents('student-a', 'class-a', [1, 2, 3, 4, 5].map((i) => event(20, start + 10_000, `chapter-${i}`)), start + 30_000);
    expect(rows.size).toBe(4);
    expect(result.accepted).toBe(4);
    expect(result.receipts.filter((receipt) => receipt.duration === null)).toEqual([
      expect.objectContaining({ targetId: 'chapter-5', duration: null, retryAfterMs: 180_000 }),
    ]);
  });

  it('keeps the hourly quota but allows existing rows to grow', async () => {
    await savePresenceEvents('student-a', 'class-a', [event(0)], start + 10_000);
    db.count.mockResolvedValue(24);
    const result = await savePresenceEvents('student-a', 'class-a', [event(20), event(20, start + 10_000, 'new-chapter')], start + 100_000);
    expect(result.receipts).toEqual([
      expect.objectContaining({ targetId: 'chapter-3', duration: 20 }),
      expect.objectContaining({ targetId: 'new-chapter', duration: null, retryAfterMs: 180_000 }),
    ]);
  });

  it('does not lower a concurrent newer duration and returns the actual winning receipt', async () => {
    await savePresenceEvents('student-a', 'class-a', [event(0)], start + 10_000);
    const apply = db.updateMany.getMockImplementation()!;
    db.updateMany.mockImplementationOnce(async (args) => {
      const row = rows.get(args.where.id)!;
      rows.set(row.id, { ...row, duration: 200, metadata: JSON.stringify({ presenceBucket: presenceBucket(start), flushedAt: new Date(start + 190_000).toISOString() }) });
      return apply(args);
    });
    const result = await savePresenceEvents('student-a', 'class-a', [event(120)], start + 190_000);
    expect(result.accepted).toBe(0);
    expect(result.receipts[0].duration).toBe(200);
    expect([...rows.values()][0].duration).toBe(200);
  });

  it('does not claim a larger insert persisted when another request won the create race', async () => {
    db.createMany.mockImplementationOnce(async ({ data }) => {
      rows.set(data[0].id, { ...data[0], duration: 10 });
      return { count: 0 };
    });
    const result = await savePresenceEvents('student-a', 'class-a', [event(120)], start + 130_000);
    expect(result.receipts[0]).toMatchObject({ duration: 10, retryAfterMs: 90_000 });
    expect(result.accepted).toBe(0);
    const retry = await savePresenceEvents('student-a', 'class-a', [event(120)], start + 220_000);
    expect(retry.receipts[0].duration).toBe(120);
  });

  it('does not combine different students or targets', async () => {
    await savePresenceEvents('student-a', 'class-a', [event(60)], start + 70_000);
    await savePresenceEvents('student-b', 'class-b', [event(120)], start + 130_000);
    expect(rows.size).toBe(2);
    expect([...rows.values()].map((row) => [row.userId, row.classId, row.duration])).toEqual([
      ['student-a', 'class-a', 60], ['student-b', 'class-b', 120],
    ]);
  });
});
