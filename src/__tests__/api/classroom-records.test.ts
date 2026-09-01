import { NextRequest } from 'next/server';
import { GET as getClasses, POST as createClass } from '@/app/api/classes/route';
import { GET as getClassDetail } from '@/app/api/classes/[id]/route';
import { POST as joinClass } from '@/app/api/classes/join/route';
import { POST as enrollStudent } from '@/app/api/classes/[id]/enrollments/route';
import { DELETE as removeStudent } from '@/app/api/classes/[id]/enrollments/[userId]/route';
import { POST as saveLearningEvents } from '@/app/api/learning-events/batch/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_CHILD_NODE_IDS,
  ADDRESSING_GRAPH_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_ROOT_NODE_ID,
  ADDRESSING_TASK_PRESET,
  buildTaskNavigationReceipt,
  buildTaskResourceEvidence,
} from '@/lib/lesson-tasks';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
  const resolved = (value: any) => jest.fn().mockResolvedValue(value);
  const mockPrisma = {
    user: { findFirst: resolved(null), findMany: resolved([]), update: resolved({}) },
    userActivity: { create: resolved({}), findMany: resolved([]) },
    classGroup: {
      findUnique: resolved(null),
      findMany: resolved([]),
      create: resolved({}),
    },
    classEnrollment: {
      findFirst: resolved(null),
      findUnique: resolved(null),
      findMany: resolved([]),
      upsert: resolved({}),
      update: resolved({}),
      count: resolved(0),
    },
    learningEvent: {
      create: resolved({}),
      createMany: resolved({ count: 0 }),
      findMany: resolved([]),
    },
    learningPath: { findFirst: resolved(null) },
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
    mockPrisma.classGroup.findUnique.mockResolvedValue(null);
    mockPrisma.classGroup.findMany.mockResolvedValue([]);
    mockPrisma.classEnrollment.findUnique.mockResolvedValue(null);
    mockPrisma.classEnrollment.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.learningEvent.findMany.mockResolvedValue([]);
    mockPrisma.userActivity.findMany.mockResolvedValue([]);
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
    expect(data.dataProvenance).toMatchObject({ mode: 'DEMO', label: '演示数据' });
    expect(data.classes).toHaveLength(1);
    expect(mockPrisma.classGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        OR: expect.any(Array),
      }),
    }));
  });

  it('班级下钻与列表使用同一服务端数据身份', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    mockPrisma.classGroup.findUnique.mockResolvedValue({
      id: 'class-1',
      name: '机电2401',
      inviteCode: 'EDU2401',
      courseName: '8051单片机原理与应用',
      semester: '2025-2026-2',
      status: 'ACTIVE',
      teacher: null,
      enrollments: [],
    });

    const response = await getClassDetail(
      request('http://localhost:3000/api/classes/class-1', 'GET', 'admin-token'),
      { params: Promise.resolve({ id: 'class-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dataProvenance).toMatchObject({ mode: 'DEMO', label: '演示数据' });
    expect(data.class).toMatchObject({ id: 'class-1', name: '机电2401' });
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

  it('重复创建请求应恢复原班级且不得再次写入', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    const existingClass = {
      id: 'class-existing', name: '机电2401', inviteCode: 'EDU2401', teacherId: 'teacher-1',
      courseName: '微控制器原理及应用技术', semester: null, status: 'ACTIVE',
      creationRequestKey: 'teacher-1:create_request_001', createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.classGroup.findUnique.mockResolvedValue(existingClass);

    const response = await createClass(request('http://localhost:3000/api/classes', 'POST', 'teacher-token', {
      name: '机电2401', requestId: 'create_request_001',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, duplicate: true, class: { id: 'class-existing' } });
    expect(mockPrisma.classGroup.findUnique).toHaveBeenCalledWith({
      where: { creationRequestKey: 'teacher-1:create_request_001' },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('并发创建触发唯一约束时应按同一请求编号恢复结果', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    const restoredClass = {
      id: 'class-race', name: '机电2401', inviteCode: 'RACE2401', teacherId: 'teacher-1',
      courseName: '微控制器原理及应用技术', semester: null, status: 'ACTIVE',
      creationRequestKey: 'teacher-1:create_request_race', createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.classGroup.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(restoredClass);
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    const response = await createClass(request('http://localhost:3000/api/classes', 'POST', 'teacher-token', {
      name: '机电2401', requestId: 'create_request_race',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, duplicate: true, class: { id: 'class-race' } });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('学生邀请码格式错误时不查询班级也不写入记录', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });

    const response = await joinClass(request('http://localhost:3000/api/classes/join', 'POST', 'student-token', {
      classInviteCode: 'abc',
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('班级邀请码格式无效');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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
      classInviteCode: 'edu24x7m',
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.classEnrollment.classGroup.id).toBe('class-1');
    expect(mockPrisma.classGroup.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { inviteCode: 'EDU24X7M' },
    }));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'student-1' },
      data: { class: '机电2401' },
    });
    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-1', classId: 'class-1', eventType: 'JOIN_CLASS' }),
    }));
  });

  it('保留七位历史邀请码兼容且仍执行同一服务端校验', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classGroup.findUnique.mockResolvedValue({
      id: 'class-legacy',
      name: '机电2401',
      courseName: '8051单片机原理与应用',
      semester: '2025-2026-2',
      status: 'ACTIVE',
    });
    mockPrisma.classEnrollment.upsert.mockResolvedValue({
      id: 'enrollment-legacy',
      userId: 'student-1',
      classId: 'class-legacy',
      role: 'STUDENT',
      status: 'ACTIVE',
    });

    const response = await joinClass(request('http://localhost:3000/api/classes/join', 'POST', 'student-token', {
      classInviteCode: 'edu2401',
    }));

    expect(response.status).toBe(200);
    expect(mockPrisma.classGroup.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { inviteCode: 'EDU2401' },
    }));
  });

  it('教师手动加人时拒绝未激活学生，且多个标识必须指向同一账号', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classGroup.findUnique.mockResolvedValue({ id: 'class-1', name: '机电2401', status: 'ACTIVE' });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'student-1', name: '学生甲', username: 'student-a', studentId: 'S001', role: 'STUDENT', status: 'INACTIVE',
    });

    const response = await enrollStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments', 'POST', 'teacher-token', {
        username: 'student-a', studentId: 'S001',
      }),
      { params: Promise.resolve({ id: 'class-1' }) },
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ username: 'student-a' }, { studentId: 'S001' }] },
    }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('教师使用统一标识加人时应阻止歧义账号', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classGroup.findUnique.mockResolvedValue({ id: 'class-1', name: '机电2401', status: 'ACTIVE' });
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'student-1', name: '学生甲', username: 'S001', studentId: 'A001', role: 'STUDENT', status: 'ACTIVE' },
      { id: 'student-2', name: '学生乙', username: 'student-b', studentId: 'S001', role: 'STUDENT', status: 'ACTIVE' },
    ]);

    const response = await enrollStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments', 'POST', 'teacher-token', { locator: 'S001' }),
      { params: Promise.resolve({ id: 'class-1' }) },
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ username: 'S001' }, { studentId: 'S001' }] },
      take: 2,
    }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('教师手动加人应在同一事务中恢复学籍并记录教学事件', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classGroup.findUnique.mockResolvedValue({ id: 'class-1', name: '机电2401', status: 'ACTIVE' });
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'student-1', name: '学生甲', username: 'student-a', studentId: 'S001', role: 'STUDENT', status: 'ACTIVE',
    });
    mockPrisma.classEnrollment.upsert.mockResolvedValue({ id: 'enrollment-1', classId: 'class-1', userId: 'student-1' });

    const response = await enrollStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments', 'POST', 'teacher-token', { userId: 'student-1' }),
      { params: Promise.resolve({ id: 'class-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'teacher-1', action: 'ADD_STUDENT_TO_CLASS' }),
    }));
    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-1', classId: 'class-1', eventType: 'JOIN_CLASS' }),
    }));
  });

  it('学生已经在班时重复添加应直接恢复结果且不重复记录事件', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classGroup.findUnique.mockResolvedValue({ id: 'class-1', name: '机电2401', status: 'ACTIVE' });
    const student = {
      id: 'student-1', name: '学生甲', username: 'student-a', studentId: 'S001', role: 'STUDENT', status: 'ACTIVE',
    };
    const enrollment = { id: 'enrollment-1', classId: 'class-1', userId: 'student-1', role: 'STUDENT', status: 'ACTIVE' };
    mockPrisma.user.findFirst.mockResolvedValue(student);
    mockPrisma.classEnrollment.findUnique.mockResolvedValue(enrollment);

    const response = await enrollStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments', 'POST', 'teacher-token', { userId: 'student-1' }),
      { params: Promise.resolve({ id: 'class-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, duplicate: true, enrollment: { id: 'enrollment-1' } });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it('教师移除学生后同步兼容字段并记录事件', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1', classId: 'class-1', userId: 'student-1', role: 'STUDENT', status: 'ACTIVE',
    });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue(null);

    const response = await removeStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments/student-1', 'DELETE', 'teacher-token'),
      { params: Promise.resolve({ id: 'class-1', userId: 'student-1' }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'student-1' }, data: { class: null } });
    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'teacher-1', action: 'REMOVE_STUDENT_FROM_CLASS' }),
    }));
    expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'student-1', classId: 'class-1', eventType: 'LEAVE_CLASS' }),
    }));
  });

  it('学生已移除时重复请求应恢复结果且不重复记录事件', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    mockPrisma.classGroup.findMany.mockResolvedValue([{ id: 'class-1' }]);
    mockPrisma.classEnrollment.findUnique.mockResolvedValue({
      id: 'enrollment-1', classId: 'class-1', userId: 'student-1', role: 'STUDENT', status: 'REMOVED',
    });

    const response = await removeStudent(
      request('http://localhost:3000/api/classes/class-1/enrollments/student-1', 'DELETE', 'teacher-token'),
      { params: Promise.resolve({ id: 'class-1', userId: 'student-1' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, duplicate: true });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it('批量行为日志只信任 token 中的 userId，并过滤敏感 metadata', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningEvent.createMany.mockResolvedValue({ count: 1 });

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [
        {
          clientEventId: 'scroll:chapter-1:001',
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

  it('AI 赞踩反馈应保留 vote 并返回可核验回执', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningEvent.createMany.mockResolvedValue({ count: 1 });

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'ai-feedback:assistant-1:up',
        eventType: 'AI_FEEDBACK',
        targetType: 'AI_ASSISTANT',
        targetId: 'assistant-1',
        metadata: { vote: 'up' },
      }],
    }));
    const data = await response.json();
    const saved = mockPrisma.learningEvent.createMany.mock.calls[0][0].data[0];

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ success: true, accepted: 1, duplicates: 0, ignored: 0 });
    expect(JSON.parse(saved.metadata)).toEqual({ vote: 'up' });
  });

  it('损坏的学习事件 JSON 应返回参数错误而不是服务器错误', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    const response = await saveLearningEvents(new NextRequest('http://localhost:3000/api/learning-events/batch', {
      method: 'POST',
      headers: { authorization: 'Bearer student-token', 'content-type': 'application/json' },
      body: 'invalid json',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: '学习行为参数格式无效' });
  });

  it('重复 clientEventId 应由服务端幂等忽略', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningEvent.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.learningEvent.findMany.mockImplementation(async (args: any) => [{
      id: args.where.id.in[0],
      eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '3.1',
      moduleId: null, chapterId: null, experimentId: null, quizId: null,
      duration: null, progress: null, clientTime: null, metadata: null,
    }]);
    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'generic-resource-view:chapter-1',
        eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '3.1',
      }],
    }));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.accepted).toBe(0);
    expect(data.duplicates).toBe(1);
    expect(mockPrisma.learningEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('并发写入同一学习事件编号但内容不同时应在写入后复核并返回冲突', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async (args: any) => [{
        id: args.where.id.in[0],
        eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '2.1',
        moduleId: null, chapterId: null, experimentId: null, quizId: null,
        duration: null, progress: null, clientTime: null, metadata: null,
      }]);
    mockPrisma.learningEvent.createMany.mockResolvedValue({ count: 0 });

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'generic-resource-view:chapter-1',
        eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '3.1',
      }],
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(mockPrisma.learningEvent.createMany).toHaveBeenCalled();
    expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledTimes(2);
  });

  it('重复 clientEventId 若对应不同内容应返回冲突', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningEvent.findMany.mockImplementation(async (args: any) => [{
      id: args.where.id.in[0],
      eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '2.1',
      moduleId: null, chapterId: null, experimentId: null, quizId: null,
      duration: null, progress: null, clientTime: null, metadata: null,
    }]);

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'generic-resource-view:chapter-1',
        eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '3.1',
      }],
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(mockPrisma.learningEvent.createMany).not.toHaveBeenCalled();
  });

  it('带任务上下文的完成事件必须匹配当前步骤、类型和目标资源', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    const graphStep = ADDRESSING_TASK_PRESET.steps[0];
    const animationStep = ADDRESSING_TASK_PRESET.steps[1];
    const graphCompletionMetadata = {
      source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
      rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
      visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
      pathId: 'path-addressing',
      stepId: 'addressing-graph',
    };
    expect(buildTaskResourceEvidence(graphStep, 'path-addressing')).toMatchObject({
      clientEventId: 'resource-complete:path-addressing:addressing-graph',
      eventType: 'RESOURCE_COMPLETED', targetType: 'GRAPH', targetId: '3.1',
    });
    expect(buildTaskNavigationReceipt(graphStep, 'path-addressing')).toEqual({
      clientEventId: 'resource-open:path-addressing:addressing-graph',
      eventType: 'RESOURCE_OPENED', targetType: 'GRAPH', targetId: '3.1',
      metadata: { source: 'tasks-page', pathId: 'path-addressing', stepId: 'addressing-graph' },
    });
    expect(buildTaskResourceEvidence(animationStep, 'path-addressing')).toMatchObject({
      clientEventId: 'resource-complete:path-addressing:addressing-animation',
      eventType: 'RESOURCE_COMPLETED', targetType: 'ANIMATION', targetId: 'anim-addressing-modes',
    });

    mockPrisma.learningPath.findFirst.mockResolvedValueOnce({
      id: 'path-addressing',
      status: 'ACTIVE',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: 0,
    });
    mockPrisma.learningEvent.createMany.mockResolvedValueOnce({ count: 1 });
    const validGraphCompletion = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...buildTaskResourceEvidence(graphStep, 'path-addressing'),
        metadata: graphCompletionMetadata,
      }],
    }));
    expect(validGraphCompletion.status).toBe(200);

    mockPrisma.learningPath.findFirst.mockResolvedValueOnce({
      id: 'path-addressing',
      status: 'COMPLETED',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: ADDRESSING_TASK_PRESET.steps.length,
    });
    const completedPathReplay = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...buildTaskResourceEvidence(graphStep, 'path-addressing'),
        metadata: graphCompletionMetadata,
      }],
    }));
    expect(completedPathReplay.status).toBe(409);
    await expect(completedPathReplay.json()).resolves.toMatchObject({ code: 'TASK_PATH_COMPLETED' });

    mockPrisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-addressing',
      status: 'ACTIVE',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: 3,
    });

    const forged = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'resource-complete:path-addressing:wrong-step',
        eventType: 'RESOURCE_COMPLETED', targetType: 'ANIMATION', targetId: 'anim-addressing-modes',
        metadata: { pathId: 'path-addressing', stepId: 'addressing-animation' },
      }],
    }));
    expect(forged.status).toBe(400);

    mockPrisma.userActivity.findMany.mockResolvedValue([{
      details: JSON.stringify({
        pathId: 'path-addressing',
        quizId: 'quiz-ch3-addressing',
        assessmentMode: 'initial',
        weakAreas: ['3.1.1'],
      }),
    }]);
    const incompleteRemediation = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'resource-complete:path-addressing:remediation',
        eventType: 'RESOURCE_COMPLETED', targetType: 'REMEDIATION', targetId: '3.1',
        metadata: { pathId: 'path-addressing', stepId: 'addressing-remediation' },
      }],
    }));
    expect(incompleteRemediation.status).toBe(409);
    await expect(incompleteRemediation.json()).resolves.toMatchObject({ code: 'REMEDIATION_REVIEW_INCOMPLETE' });

    mockPrisma.learningEvent.createMany.mockResolvedValueOnce({ count: 1 });
    const valid = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        clientEventId: 'resource-complete:path-addressing:remediation',
        eventType: 'RESOURCE_COMPLETED', targetType: 'REMEDIATION', targetId: '3.1',
        metadata: {
          pathId: 'path-addressing', stepId: 'addressing-remediation',
          weakAreas: ['3.1.1'], reviewedWeakAreas: ['3.1.1'], confirmedNoWeakNodes: false,
        },
      }],
    }));
    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toMatchObject({ accepted: 1, ignored: 0 });
  });

  it('图谱完成凭据必须精确覆盖七个子节点且不能重复', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-addressing',
      status: 'ACTIVE',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: 0,
    });
    mockPrisma.learningEvent.findMany.mockResolvedValue([]);
    const graphStep = ADDRESSING_TASK_PRESET.steps[0];
    const completion = buildTaskResourceEvidence(graphStep, 'path-addressing');
    const metadataBase = {
      source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
      rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
      pathId: 'path-addressing',
      stepId: 'addressing-graph',
    };

    const invalidSource = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: {
          ...metadataBase,
          source: 'tasks-page',
          visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
        },
      }],
    }));
    expect(invalidSource.status).toBe(422);
    await expect(invalidSource.json()).resolves.toMatchObject({
      code: 'GRAPH_REVIEW_INCOMPLETE',
      error: expect.stringContaining('来源无效'),
    });

    const invalidRoot = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: {
          ...metadataBase,
          rootNodeId: '3',
          visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
        },
      }],
    }));
    expect(invalidRoot.status).toBe(422);
    await expect(invalidRoot.json()).resolves.toMatchObject({
      code: 'GRAPH_REVIEW_INCOMPLETE',
      error: expect.stringContaining('根节点无效'),
    });

    const missingNode = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: { ...metadataBase, visitedNodeIds: ADDRESSING_GRAPH_CHILD_NODE_IDS.slice(0, -1) },
      }],
    }));
    expect(missingNode.status).toBe(422);
    await expect(missingNode.json()).resolves.toMatchObject({
      code: 'GRAPH_REVIEW_INCOMPLETE',
      error: expect.stringContaining('七个子节点'),
    });

    const duplicatedNode = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: {
          ...metadataBase,
          visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS.slice(0, -1), ADDRESSING_GRAPH_CHILD_NODE_IDS[0]],
        },
      }],
    }));
    expect(duplicatedNode.status).toBe(422);
    await expect(duplicatedNode.json()).resolves.toMatchObject({
      code: 'GRAPH_REVIEW_INCOMPLETE',
      error: expect.stringContaining('重复子节点'),
    });

    mockPrisma.learningEvent.createMany.mockResolvedValueOnce({ count: 1 });
    const complete = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: { ...metadataBase, visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS] },
      }],
    }));
    expect(complete.status).toBe(200);
    await expect(complete.json()).resolves.toMatchObject({ accepted: 1, duplicates: 0, ignored: 0 });
    const storedMetadata = JSON.parse(mockPrisma.learningEvent.createMany.mock.calls.at(-1)[0].data[0].metadata);
    expect(storedMetadata).toMatchObject({
      source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
      rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
      visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
    });
  });

  it('动画完成凭据必须精确覆盖七种寻址方式并保留服务端复核字段', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-addressing',
      status: 'ACTIVE',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: 1,
    });
    mockPrisma.learningEvent.findMany.mockResolvedValue([]);
    const animationStep = ADDRESSING_TASK_PRESET.steps[1];
    const completion = buildTaskResourceEvidence(animationStep, 'path-addressing');
    const metadataBase = {
      source: ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
      pathId: 'path-addressing',
      stepId: 'addressing-animation',
    };

    const incomplete = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: { ...metadataBase, visitedModes: ADDRESSING_GRAPH_CHILD_NODE_IDS.slice(0, -1) },
      }],
    }));
    expect(incomplete.status).toBe(422);
    await expect(incomplete.json()).resolves.toMatchObject({ code: 'ANIMATION_REVIEW_INCOMPLETE' });

    mockPrisma.learningEvent.createMany.mockResolvedValueOnce({ count: 1 });
    const complete = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [{
        ...completion,
        metadata: { ...metadataBase, visitedModes: [...ADDRESSING_GRAPH_CHILD_NODE_IDS] },
      }],
    }));
    expect(complete.status).toBe(200);
    const storedMetadata = JSON.parse(mockPrisma.learningEvent.createMany.mock.calls.at(-1)[0].data[0].metadata);
    expect(storedMetadata).toMatchObject({
      source: ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
      visitedModes: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
    });
  });

  it('重复提交同一图谱完成确认应返回幂等重复回执', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockPrisma.classEnrollment.findFirst.mockResolvedValue({ classId: 'class-1' });
    mockPrisma.learningPath.findFirst.mockResolvedValue({
      id: 'path-addressing',
      status: 'ACTIVE',
      modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      currentModule: 0,
    });
    const graphStep = ADDRESSING_TASK_PRESET.steps[0];
    const completion = {
      ...buildTaskResourceEvidence(graphStep, 'path-addressing'),
      metadata: {
        source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
        rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
        visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
        pathId: 'path-addressing',
        stepId: 'addressing-graph',
      },
    };
    mockPrisma.learningEvent.findMany.mockImplementation(async (args: any) => [{
      id: args.where.id.in[0],
      eventType: 'RESOURCE_COMPLETED', targetType: 'GRAPH', targetId: '3.1',
      moduleId: null, chapterId: null, experimentId: null, quizId: null,
      duration: null, progress: null, clientTime: null,
      metadata: JSON.stringify(completion.metadata),
    }]);
    mockPrisma.learningEvent.createMany.mockResolvedValue({ count: 0 });

    const response = await saveLearningEvents(request('http://localhost:3000/api/learning-events/batch', 'POST', 'student-token', {
      events: [completion],
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ accepted: 0, duplicates: 1, ignored: 0 });
    expect(mockPrisma.learningEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});
