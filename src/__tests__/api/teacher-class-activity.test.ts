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
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('lists studied and not-studied students for a class the teacher owns', async () => {
    const response = await GET(request('http://localhost:3000/api/teacher/class-activity?classId=class-1', 'teacher-token'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.studiedCount).toBe(1);
    expect(data.notStudiedCount).toBe(1);
    expect(data.students[0]).toMatchObject({
      username: 'TEST0872001',
      studied: true,
      durationSeconds: 180,
      recentTargets: [expect.objectContaining({ targetId: '3.1#addressing' })],
    });
    expect(data.students[1]).toMatchObject({ username: 'S002', studied: false });
    expect(mockPrisma.learningEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ classId: 'class-1' }),
    }));
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
