import { NextRequest } from 'next/server';
import { GET } from '@/app/api/teacher/feedback/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteFeedback: { findMany: jest.fn() },
    classGroup: { findMany: jest.fn() },
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

describe('GET /api/teacher/feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
  });

  it('rejects students and missing sessions', async () => {
    const missing = await GET(new NextRequest('http://localhost/api/teacher/feedback'));
    expect(missing.status).toBe(401);

    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    const forbidden = await GET(new NextRequest('http://localhost/api/teacher/feedback', {
      headers: { authorization: 'Bearer valid-token' },
    }));
    expect(forbidden.status).toBe(403);
    expect(prisma.siteFeedback.findMany).not.toHaveBeenCalled();
  });

  it('lists newest first and redacts anonymous students', async () => {
    (prisma.siteFeedback.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'new-anon',
        anonymous: true,
        category: 'bug',
        body: '知识图谱在手机上拖不动。',
        pagePath: '/knowledge-graph',
        classId: 'class-1',
        createdAt: new Date('2026-10-27T02:00:00.000Z'),
        user: { name: '张三', username: 'zhangsan', studentId: '20240001' },
      },
      {
        id: 'older-named',
        anonymous: false,
        category: 'suggestion',
        body: '希望成绩页把错题再列出来。',
        pagePath: '/quiz',
        classId: 'class-1',
        createdAt: new Date('2026-10-27T01:00:00.000Z'),
        user: { name: '李四', username: 'lisi', studentId: '20240002' },
      },
    ]);
    (prisma.classGroup.findMany as jest.Mock).mockResolvedValue([{ id: 'class-1', name: '机电 1 班' }]);

    const response = await GET(new NextRequest('http://localhost/api/teacher/feedback', {
      headers: { authorization: 'Bearer valid-token' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.siteFeedback.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
    }));
    expect(payload.items.map((item: { id: string }) => item.id)).toEqual(['new-anon', 'older-named']);
    expect(payload.items[0]).toMatchObject({
      displayName: '匿名',
      studentName: null,
      studentId: null,
      className: '机电 1 班',
      anonymous: true,
    });
    expect(payload.items[1]).toMatchObject({
      displayName: '李四',
      studentName: '李四',
      studentId: '20240002',
      anonymous: false,
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('20240001');
    expect(serialized).not.toContain('张三');
    expect(serialized).not.toContain('zhangsan');
    expect(serialized).not.toContain('userId');
  });
});
