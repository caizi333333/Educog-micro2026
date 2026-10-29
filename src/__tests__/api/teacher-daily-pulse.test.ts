import { NextRequest } from 'next/server';
import { GET } from '@/app/api/teacher/daily-pulse/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as unknown as {
  classGroup: { findMany: jest.Mock };
  classEnrollment: { findMany: jest.Mock };
  learningEvent: { groupBy: jest.Mock };
};

function request(url: string, token: string | null) {
  return new NextRequest(url, {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('GET /api/teacher/daily-pulse', () => {
  const asOf = '2026-10-28T16:30:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'sunyancai@qust.edu.cn', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([
      { id: 'old', name: '机电2401', courseName: '微控制器', semester: '2025-2026-2' },
      { id: 'c-872-1', name: '0872-001', courseName: '微控制器', semester: '2026-2027-1' },
      { id: 'c-3084-1', name: '3084-001', courseName: '微控制器', semester: '2026-2027-1' },
    ]);
    mockPrisma.classEnrollment.findMany.mockResolvedValue([
      {
        classId: 'c-872-1',
        user: {
          id: 'real',
          name: '正式甲',
          username: 'S001',
          studentId: 'S001',
          lastLoginAt: new Date('2026-10-28T16:10:00.000Z'),
        },
      },
      {
        classId: 'c-872-1',
        user: {
          id: 'smoke',
          name: '自测',
          username: 'TEST0872001',
          studentId: 'TEST0872001',
          lastLoginAt: new Date('2026-10-28T16:12:00.000Z'),
        },
      },
      {
        classId: 'c-872-1',
        user: {
          id: 'yesterday',
          name: '昨晚',
          username: 'S002',
          studentId: 'S002',
          lastLoginAt: new Date('2026-10-28T15:00:00.000Z'),
        },
      },
    ]);
    mockPrisma.learningEvent.groupBy.mockResolvedValue([
      {
        userId: 'real',
        classId: 'c-872-1',
        eventType: 'SECTION_VISIT',
        _max: { createdAt: new Date('2026-10-28T16:20:00.000Z') },
        _sum: { duration: 180 },
      },
      {
        userId: 'yesterday',
        classId: 'c-872-1',
        eventType: 'SECTION_VISIT',
        _max: { createdAt: new Date('2026-10-28T15:40:00.000Z') },
        _sum: { duration: 900 },
      },
    ]);
  });

  it('rejects a student before reading the roster', async () => {
    mockVerifyToken.mockResolvedValueOnce({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    const response = await GET(request(`http://localhost:3000/api/teacher/daily-pulse?asOf=${asOf}`, 'student-token'));
    expect(response.status).toBe(403);
    expect(mockPrisma.classGroup.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.classEnrollment.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.learningEvent.groupBy).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid token', async () => {
    const missing = await GET(request('http://localhost:3000/api/teacher/daily-pulse', null));
    expect(missing.status).toBe(401);
    mockVerifyToken.mockResolvedValueOnce(null);
    const invalid = await GET(request('http://localhost:3000/api/teacher/daily-pulse', 'bad-token'));
    expect(invalid.status).toBe(401);
  });

  it('summarizes the Shanghai day for official classes and ignores a history scope request', async () => {
    const response = await GET(request(
      `http://localhost:3000/api/teacher/daily-pulse?asOf=${asOf}&scope=history&classId=old`,
      'teacher-token',
    ));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dateKey).toBe('2026-10-29');
    expect(data.classes.map((classGroup: { code: string; availability: string }) => [classGroup.code, classGroup.availability])).toEqual([
      ['0872-001', 'visible'],
      ['0872-002', 'out-of-scope'],
      ['3084-001', 'visible'],
      ['3084-002', 'out-of-scope'],
    ]);
    expect(data.classes[0]).toMatchObject({
      label: '智工 0872-001',
      rosterCount: 2,
      loggedInCount: 1,
      studiedCount: 1,
    });
    expect(data.classes[0].students.map((student: { id: string }) => student.id)).toEqual(['real']);
    expect(data.classes[0].students[0]).toMatchObject({ studied: true, durationSeconds: 180 });
    expect(data.demo.count).toBe(1);
    expect(data.demo.students[0]).toMatchObject({ username: 'TEST0872001', classCode: '0872-001' });
    expect(mockPrisma.classEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        classId: { in: ['c-872-1', 'c-3084-1'] },
      }),
    }));
    expect(mockPrisma.learningEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        classId: { in: ['c-872-1', 'c-3084-1'] },
        createdAt: {
          gte: new Date('2026-10-28T16:00:00.000Z'),
          lte: new Date(asOf),
        },
      }),
    }));
    expect(JSON.stringify(data)).not.toContain('机电2401');
  });

  it('tells an admin that a missing official class is not created yet', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const response = await GET(request(`http://localhost:3000/api/teacher/daily-pulse?asOf=${asOf}`, 'admin-token'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.classes.map((classGroup: { availability: string }) => classGroup.availability)).toEqual([
      'visible', 'missing', 'visible', 'missing',
    ]);
  });

  it('rejects a bad asOf before querying enrollments', async () => {
    const response = await GET(request('http://localhost:3000/api/teacher/daily-pulse?asOf=yesterday', 'teacher-token'));
    expect(response.status).toBe(400);
    expect(mockPrisma.classEnrollment.findMany).not.toHaveBeenCalled();
  });
});
