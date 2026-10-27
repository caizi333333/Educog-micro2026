import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/experiment-diagnosis/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const mockChat = jest.fn();
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/ai/model-client', () => ({
  ZhipuClient: jest.fn().mockImplementation(() => ({ chat: mockChat })),
  resolveZhipuModel: () => 'test-model',
}));

function request(snapshot: unknown, token: string | null = 'test-token') {
  return new NextRequest('http://localhost/api/ai/experiment-diagnosis', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ experimentId: 'proj04', snapshot }),
  });
}

describe('experiment diagnosis request validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyToken as jest.Mock).mockResolvedValue({ userId: 'student-test', role: 'STUDENT' });
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(0);
    mockChat.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      observation: '观察端口', diagnosis: '检查时序', hints: ['单步观察'], nextCheck: '确认寄存器',
    }) } }] });
  });

  it('keeps sparse and mixed-value state records available to the diagnostic prompt', async () => {
    const response = await POST(request({
      registers: { A: 5, SP: '0x07' }, portValues: { P3: 255 },
      timers: { TR0: true, TH0: 42 }, environment: { temperature: 26, scenario: 'warm', extra: null },
    }));
    expect(response.status).toBe(200);
    const prompt = mockChat.mock.calls[0][0][1].content;
    expect(prompt).toContain('"SP":"0x07"');
    expect(prompt).toContain('"TR0":true');
    expect(prompt).toContain('"P3":255');
    expect(prompt).toContain('"scenario":"warm"');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-test', eventType: 'AI_DIAGNOSIS' }),
    }));
  });

  it('accepts an empty snapshot without inventing missing state', async () => {
    expect((await POST(request({}))).status).toBe(200);
    expect(mockChat.mock.calls[0][0][1].content).toContain('(无可用快照)');
  });

  it.each([
    { registers: { A: true } }, { portValues: { P3: '255' } }, { timers: { TR0: 'true' } },
    { unexpected: 'not allowed' }, { deviceNotes: Array(13).fill('note') },
  ])('rejects malformed snapshots before model calls or writes: %j', async (snapshot) => {
    const response = await POST(request(snapshot));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: '请求参数不合法', detail: expect.any(String) });
    expect(mockChat).not.toHaveBeenCalled();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it('still requires authentication before reading state', async () => {
    expect((await POST(request({}, null))).status).toBe(401);
    expect(mockChat).not.toHaveBeenCalled();
    expect(prisma.learningEvent.count).not.toHaveBeenCalled();
  });

  it('keeps the existing quota rejection before a model request', async () => {
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1000);
    expect((await POST(request({}))).status).toBe(429);
    expect(mockChat).not.toHaveBeenCalled();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
  });
});
