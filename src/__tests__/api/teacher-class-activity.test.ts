import { NextRequest } from 'next/server';
import { GET } from '@/app/api/teacher/class-activity/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as any;

function request(url: string, token: string | null) {
  return new NextRequest(url, {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/teacher/class-activity', () => {
  const asOf = new Date('2026-10-27T10:00:00.000Z');
  const since = new Date('2026-10-20T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(asOf.getTime());
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'sunyancai@qust.edu.cn', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([
      { id: 'class-1', name: '机电2401', courseName: '微控制器', semester: '2026-2027-1' },
    ]);
    mockPrisma.classEnrollment.findMany.mockResolvedValue([
      {
        user: {
          id: 'student-1',
          name: '测试学生',
          username: 'TEST0872001',
          studentId: 'TEST0872001',
          lastLoginAt: new Date('2026-10-26T08:00:00.000Z'),
        },
      },
      {
        user: {
          id: 'student-2',
          name: '还没学',
          username: 'S002',
          studentId: 'S002',
          lastLoginAt: null,
        },
      },
    ]);
    mockPrisma.learningEvent.groupBy.mockResolvedValue([
      {
        userId: 'student-1',
        eventType: 'SECTION_VISIT',
        targetId: '3.1#addressing',
        chapterId: '3',
        _max: { createdAt: new Date('2026-10-26T09:00:00.000Z') },
        _sum: { duration: 180 },
        _count: { _all: 2 },
      },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists studied and not-studied students for a class the teacher owns', async () => {
    const response = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-1', 'teacher-token'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.studiedCount).toBe(1);
    expect(data.notStudiedCount).toBe(1);
    expect(data.asOf).toBe(asOf.toISOString());
    expect(data.students[0]).toMatchObject({
      username: 'TEST0872001',
      studied: true,
      durationSeconds: 180,
      recentTargets: [expect.objectContaining({ targetId: '3.1#addressing' })],
    });
    expect(data.students[1]).toMatchObject({ username: 'S002', studied: false });
    expect(mockPrisma.learningEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        classId: 'class-1',
        userId: { in: ['student-1', 'student-2'] },
        createdAt: { gte: since, lte: asOf },
      }),
    }));
  });

  it('removes old login timestamps without changing learning-event classifications', async () => {
    mockPrisma.classEnrollment.findMany.mockResolvedValue([
      { user: { id: 'student-1', name: '已学', username: 'learner', studentId: 'S001', lastLoginAt: new Date(since.getTime() - 1) } },
      { user: { id: 'student-2', name: '未学', username: 'quiet', studentId: 'S002', lastLoginAt: new Date(since.getTime() - 1) } },
    ]);
    const response = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-1', 'teacher-token'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ studiedCount: 1, notStudiedCount: 1 });
    expect(data.students[0]).toMatchObject({ id: 'student-1', studied: true, lastActiveAt: '2026-10-26T09:00:00.000Z' });
    expect(data.students[1]).toMatchObject({ id: 'student-2', studied: false, lastActiveAt: null });
  });

  it('includes boundary logins as activity while keeping login-only students not studied', async () => {
    mockPrisma.classEnrollment.findMany.mockResolvedValue([
      { user: { id: 'start', name: '起点', username: 'start', studentId: 'S001', lastLoginAt: since } },
      { user: { id: 'end', name: '终点', username: 'end', studentId: 'S002', lastLoginAt: asOf } },
      { user: { id: 'future', name: '未来', username: 'future', studentId: 'S003', lastLoginAt: new Date(asOf.getTime() + 1) } },
    ]);
    mockPrisma.learningEvent.groupBy.mockResolvedValue([]);
    const response = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-1', 'teacher-token'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toMatchObject({ studiedCount: 0, notStudiedCount: 3 });
    expect(data.students.map(({ id, lastActiveAt }: { id: string; lastActiveAt: string | null }) => [id, lastActiveAt]))
      .toEqual([['end', asOf.toISOString()], ['start', since.toISOString()], ['future', null]]);
  });

  it('rejects a student and a class outside the teacher scope', async () => {
    mockVerifyToken.mockResolvedValueOnce({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    const student = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-1', 'student-token'));
    expect(student.status).toBe(403);

    mockPrisma.classGroup.findMany.mockResolvedValueOnce([]);
    const outsider = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-9', 'teacher-token'));
    expect(outsider.status).toBe(403);
    expect(mockPrisma.learningEvent.groupBy).not.toHaveBeenCalled();
  });
});
