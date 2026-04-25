import { NextRequest } from 'next/server';
import { GET as getClasses, POST as createClass } from '@/app/api/classes/route';
import { POST as joinClass } from '@/app/api/classes/join/route';
import { POST as saveLearningEvents } from '@/app/api/learning-events/batch/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const resolved = (value: any) => jest.fn().mockResolvedValue(value);
  const mockPrisma = {
    user: { update: resolved({}) },
    userActivity: { create: resolved({}) },
    classGroup: {
      findUnique: resolved(null),
      findMany: resolved([]),
      create: resolved({}),
    },
    classEnrollment: {
      findFirst: resolved(null),
      findMany: resolved([]),
      upsert: resolved({}),
      count: resolved(0),
    },
    learningEvent: {
      create: resolved({}),
      createMany: resolved({ count: 0 }),
      findMany: resolved([]),
    },
    $transaction: jest.fn(),
  };

  mockPrisma.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(mockPrisma);
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });

  return { prisma: mockPrisma };
});

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as any;

const request = (url: string, method: string, token: string | null, body?: unknown) => new NextRequest(url, {
  method,
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'content-type': 'application/json' } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
}) as any;

describe('Classroom and learning record APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    });
  });

  it('教师只能查看自己名下的教学班', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([
      { id: 'class-1', name: '机电2401', inviteCode: 'EDU2401' },
    ]);

    const response = await getClasses(request('http://localhost:3000/api/classes', 'GET', 'teacher-token'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.classes).toHaveLength(1);
    expect(mockPrisma.classGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        OR: expect.any(Array),
      }),
    }));
  });

  it('教师创建班级时生成邀请码、教师归班并记录行为', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    const createdClass = {
      id: 'class-1',
      name: '机电2401',
      inviteCode: 'EDU2401',
      courseName: '8051单片机原理与应用',
      semester: '2025-2026-2',
      teacherId: 'teacher-1',
      status: 'ACTIVE',
    };
    mockPrisma.classGroup.findUnique.mockResolvedValue(null);
    mockPrisma.classGroup.create.mockResolvedValue(createdClass);
    mockPrisma.classEnrollment.upsert.mockResolvedValue({
      id: 'enrollment-1',
      userId: 'teacher-1',
      classId: 'class-1',
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    const response = await createClass(request('http://localhost:3000/api/classes', 'POST', 'teacher-token', {
      name: '机电2401',
      semester: '2025-2026-2',
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.class.id).toBe('class-1');
    expect(mockPrisma.classGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: '机电2401',
        teacherId: 'teacher-1',
        status: 'ACTIVE',
      }),
    });
    expect(mockPrisma.classEnrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: 'teacher-1', role: 'TEACHER' }),
    }));
    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'teacher-1', classId: 'class-1', eventType: 'CREATE_CLASS' }),
    }));
  });

  it('学生使用有效邀请码加入班级并写入行为记录', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    const classGroup = {
      id: 'class-1',
      name: '机电2401',
      courseName: '8051单片机原理与应用',
      semester: '2025-2026-2',
      status: 'ACTIVE',
    };
    mockPrisma.classGroup.findUnique.mockResolvedValue(classGroup);
    mockPrisma.classEnrollment.upsert.mockResolvedValue({
      id: 'enrollment-1',
      userId: 'student-1',
      classId: 'class-1',
      role: 'STUDENT',
      status: 'ACTIVE',
    });

    const response = await joinClass(request('http://localhost:3000/api/classes/join', 'POST', 'student-token', {
      classInviteCode: 'EDU2401',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.classEnrollment.classGroup.id).toBe('class-1');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { class: '机电2401' },
    });
    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-1', classId: 'class-1', eventType: 'JOIN_CLASS' }),
    }));
  });

  it('批量行为日志只信任 token 中的 userId，并过滤敏感 metadata', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [
        {
          userId: 'malicious-user',
          eventType: 'SCROLL_PROGRESS',
          targetType: 'CHAPTER',
          targetId: 'chapter-1',
          chapterId: 'chapter-1',
          progress: 42,
          metadata: {
            source: 'reader',
            token: 'should-not-save',
            userId: 'should-not-save',
          },
        },
      ],
    }));
    const data = await response.json();
    const saved = mockPrisma.learningEvent.createMany.mock.calls[0][0].data[0];

    expect(response.status).toBe(200);
    expect(data.accepted).toBe(1);
    expect(saved.userId).toBe('student-1');
    expect(saved.classId).toBe('class-1');
    expect(saved.metadata).toContain('reader');
    expect(saved.metadata).not.toContain('should-not-save');
  });
});
