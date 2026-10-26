import * as bcrypt from 'bcryptjs';
import { createMockPrismaClient, setupPrismaMock } from '@/__tests__/utils/test-mocks';
import { importClassStudents, parseStudentImportCsv, studentAccountEmail } from '@/lib/student-import';

jest.mock('bcryptjs');
jest.mock('@/lib/prisma', () => {
  const prismaProxy = new Proxy({}, {
    get(_target, prop) {
      return (globalThis as { __mockPrisma?: Record<string, unknown> }).__mockPrisma?.[prop as string];
    },
  });
  return { prisma: prismaProxy };
});

const mockPrisma = createMockPrismaClient();
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('parseStudentImportCsv', () => {
  it('reads a Chinese header and skips a repeated student id', () => {
    const parsed = parseStudentImportCsv('学号,姓名,班级\n20260001,张三,测试班\n20260001,李四,测试班\n');
    expect(parsed.error).toBeNull();
    expect(parsed.rows).toEqual([
      { line: 2, studentId: '20260001', name: '张三', className: '测试班', error: null },
      { line: 3, studentId: '20260001', name: '李四', className: '测试班', error: 'CSV 中学号重复' },
    ]);
  });

  it('accepts a headerless sheet and rejects an oversized batch', () => {
    expect(parseStudentImportCsv('20260008,王五').rows[0]).toMatchObject({
      studentId: '20260008',
      name: '王五',
      className: '',
      error: null,
    });
    const lines = ['学号,姓名', ...Array.from({ length: 31 }, (_item, index) => `2026${String(index).padStart(4, '0')},学生${index}`)];
    expect(parseStudentImportCsv(lines.join('\n')).error).toBe('一次最多导入 30 名学生');
  });
});

describe('importClassStudents', () => {
  const classGroup = { id: 'class-1', name: '测试班', teacherId: 'teacher-1', status: 'ACTIVE' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return arg(mockPrisma);
      return arg;
    });
    mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
    setupPrismaMock(mockPrisma, 'classGroup', 'findUnique', classGroup);
    setupPrismaMock(mockPrisma, 'user', 'findUnique', null);
    setupPrismaMock(mockPrisma, 'user', 'create', { id: 'student-new' });
    setupPrismaMock(mockPrisma, 'classEnrollment', 'create', { id: 'enrollment-1' });
    setupPrismaMock(mockPrisma, 'userActivity', 'create', { id: 'activity-1' });
  });

  it('creates a student account and enrollment for the teacher class', async () => {
    const result = await importClassStudents({
      classId: 'class-1',
      actor: { userId: 'teacher-1', role: 'TEACHER' },
      csv: '学号,姓名,班级\n20260001,张三,测试班\n',
      initialPassword: 'Lab2026',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toEqual({ created: 1, enrolled: 0, unchanged: 0, failed: 0 });
    expect(result.rows[0]).toMatchObject({ status: 'created', studentId: '20260001' });
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        username: '20260001',
        studentId: '20260001',
        email: studentAccountEmail('20260001'),
        password: 'hashed-password',
        role: 'STUDENT',
        class: '测试班',
      }),
    }));
    expect(mockPrisma.classEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ classId: 'class-1', userId: 'student-new', role: 'STUDENT' }),
    }));
  });

  it('does not let a teacher import into someone else class', async () => {
    setupPrismaMock(mockPrisma, 'classGroup', 'findUnique', { ...classGroup, teacherId: 'other-teacher' });
    setupPrismaMock(mockPrisma, 'classEnrollment', 'findFirst', null);

    const result = await importClassStudents({
      classId: 'class-1',
      actor: { userId: 'teacher-1', role: 'TEACHER' },
      csv: '20260001,张三,测试班',
      initialPassword: 'Lab2026',
    });

    expect(result).toEqual({ ok: false, status: 403, error: '无权管理该班级' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('reports a class-column mismatch without creating an account', async () => {
    const result = await importClassStudents({
      classId: 'class-1',
      actor: { userId: 'teacher-1', role: 'TEACHER' },
      csv: '学号,姓名,班级\n20260001,张三,其他班\n',
      initialPassword: 'Lab2026',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({ status: 'error' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
