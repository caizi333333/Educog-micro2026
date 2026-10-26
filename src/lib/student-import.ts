import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const STUDENT_IMPORT_ROW_LIMIT = 30;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{3,31}$/;
const BCRYPT_PASSWORD_MAX_BYTES = 72;

export type StudentImportStatus = 'created' | 'enrolled' | 'unchanged' | 'error';

export type StudentImportRowResult = {
  line: number;
  studentId: string;
  name: string;
  status: StudentImportStatus;
  message: string;
};

export type StudentImportResult =
  | { ok: false; status: number; error: string }
  | {
    ok: true;
    className: string;
    summary: { created: number; enrolled: number; unchanged: number; failed: number };
    rows: StudentImportRowResult[];
  };

type ParsedStudentRow = {
  line: number;
  studentId: string;
  name: string;
  className: string;
  error: string | null;
};

type ColumnKey = 'studentId' | 'name' | 'className';

/**
 * Build the internal mailbox used when a teacher creates a student from a student ID.
 * Students sign in with the student ID, so this address is not shown as the login name.
 */
export function studentAccountEmail(studentId: string): string {
  return `${studentId.toLowerCase()}@students.educog.local`;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function headerKey(value: string): ColumnKey | null {
  const key = value.trim().toLowerCase();
  if (key === 'studentid' || key === '学号' || key === '学生学号') return 'studentId';
  if (key === 'name' || key === '姓名' || key === '名字') return 'name';
  if (key === 'class' || key === '班级' || key === '班级名称') return 'className';
  return null;
}

/**
 * Parse a teacher CSV of studentId, name, and optional class.
 * Row errors stay on the row so one bad line does not discard the rest.
 */
export function parseStudentImportCsv(csv: string): { error: string | null; rows: ParsedStudentRow[] } {
  const lines = stripBom(csv).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const occupied: Array<{ line: number; cells: string[] }> = [];
  lines.forEach((line, index) => {
    if (line.trim()) occupied.push({ line: index + 1, cells: splitCsvLine(line) });
  });
  if (occupied.length === 0) return { error: 'CSV 没有学生数据', rows: [] };

  const firstKeys = occupied[0].cells.map((cell) => headerKey(cell));
  const hasHeader = firstKeys[0] === 'studentId' && firstKeys.includes('name');
  const dataLines = hasHeader ? occupied.slice(1) : occupied;
  if (dataLines.length === 0) return { error: 'CSV 只有表头，没有学生数据', rows: [] };
  if (dataLines.length > STUDENT_IMPORT_ROW_LIMIT) {
    return { error: `一次最多导入 ${STUDENT_IMPORT_ROW_LIMIT} 名学生`, rows: [] };
  }

  const columnIndex: Record<ColumnKey, number> = hasHeader
    ? {
      studentId: firstKeys.indexOf('studentId'),
      name: firstKeys.indexOf('name'),
      className: firstKeys.indexOf('className'),
    }
    : { studentId: 0, name: 1, className: 2 };

  const seen = new Set<string>();
  const rows = dataLines.map(({ line, cells }) => {
    const studentId = (cells[columnIndex.studentId] ?? '').trim();
    const name = (cells[columnIndex.name] ?? '').trim();
    const className = columnIndex.className >= 0 ? (cells[columnIndex.className] ?? '').trim() : '';
    let error: string | null = null;
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      error = '学号需为 4–32 位字母、数字、下划线或连字符';
    } else if (!name || name.length > 40) {
      error = '姓名不能为空，且不超过 40 个字';
    } else if (className.length > 100) {
      error = '班级名称过长';
    } else if (seen.has(studentId)) {
      error = 'CSV 中学号重复';
    }
    if (!error) seen.add(studentId);
    return { line, studentId, name, className, error };
  });
  return { error: null, rows };
}

function validateInitialPassword(password: string): string | null {
  if (password.length < 6) return '初始密码长度至少为 6 位';
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_PASSWORD_MAX_BYTES) return '初始密码不能超过 72 字节';
  return null;
}

async function actorCanManageClass(
  classGroup: { id: string; teacherId: string | null },
  actor: { userId: string; role: string },
): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'TEACHER') return false;
  if (classGroup.teacherId === actor.userId) return true;
  const enrollment = await prisma.classEnrollment.findFirst({
    where: { classId: classGroup.id, userId: actor.userId, role: 'TEACHER', status: 'ACTIVE' },
    select: { id: true },
  });
  return Boolean(enrollment);
}

type ExistingStudent = {
  id: string;
  name: string | null;
  role: string;
  status: string;
  studentId: string | null;
};

async function saveStudentRow(
  tx: Prisma.TransactionClient,
  classGroup: { id: string; name: string },
  actorUserId: string,
  passwordHash: string,
  row: ParsedStudentRow,
): Promise<StudentImportRowResult> {
  if (row.error) {
    return { line: row.line, studentId: row.studentId, name: row.name, status: 'error', message: row.error };
  }
  if (row.className && row.className !== classGroup.name) {
    return {
      line: row.line,
      studentId: row.studentId,
      name: row.name,
      status: 'error',
      message: `班级列「${row.className}」与当前班级「${classGroup.name}」不一致`,
    };
  }

  const email = studentAccountEmail(row.studentId);
  const byStudentId = await tx.user.findUnique({
    where: { studentId: row.studentId },
    select: { id: true, name: true, role: true, status: true, studentId: true },
  });
  const byUsername = byStudentId
    ? null
    : await tx.user.findUnique({
      where: { username: row.studentId },
      select: { id: true, name: true, role: true, status: true, studentId: true },
    });
  const existing: ExistingStudent | null = byStudentId ?? byUsername;
  if (!existing) {
    const emailOwner = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner) {
      return { line: row.line, studentId: row.studentId, name: row.name, status: 'error', message: '学号对应的内部邮箱已被占用' };
    }
    const created = await tx.user.create({
      data: {
        email,
        username: row.studentId,
        password: passwordHash,
        name: row.name,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: row.studentId,
        class: classGroup.name,
      },
      select: { id: true },
    });
    await tx.classEnrollment.create({
      data: { classId: classGroup.id, userId: created.id, role: 'STUDENT', status: 'ACTIVE' },
    });
    await tx.userActivity.create({
      data: {
        userId: actorUserId,
        action: 'IMPORT_STUDENT',
        details: JSON.stringify({ classId: classGroup.id, studentUserId: created.id, studentId: row.studentId, created: true }),
      },
    });
    return {
      line: row.line,
      studentId: row.studentId,
      name: row.name,
      status: 'created',
      message: '已创建并加入班级。请使用本次初始密码登录',
    };
  }

  if (existing.role !== 'STUDENT') {
    return { line: row.line, studentId: row.studentId, name: row.name, status: 'error', message: '该学号或用户名已被教师或管理员占用' };
  }
  if (existing.status !== 'ACTIVE') {
    return { line: row.line, studentId: row.studentId, name: row.name, status: 'error', message: '账号已停用，不能导入' };
  }
  if (existing.studentId && existing.studentId !== row.studentId) {
    return { line: row.line, studentId: row.studentId, name: row.name, status: 'error', message: '用户名已对应其他学号' };
  }

  if (!existing.studentId) {
    await tx.user.update({
      where: { id: existing.id },
      data: { studentId: row.studentId, name: existing.name?.trim() ? existing.name : row.name, class: classGroup.name },
    });
  } else {
    await tx.user.update({
      where: { id: existing.id },
      data: { class: classGroup.name },
    });
  }

  const enrollment = await tx.classEnrollment.findUnique({
    where: { classId_userId: { classId: classGroup.id, userId: existing.id } },
    select: { role: true, status: true },
  });
  if (enrollment?.role === 'STUDENT' && enrollment.status === 'ACTIVE') {
    return {
      line: row.line,
      studentId: row.studentId,
      name: row.name,
      status: 'unchanged',
      message: '已在班级中，密码未改',
    };
  }
  await tx.classEnrollment.upsert({
    where: { classId_userId: { classId: classGroup.id, userId: existing.id } },
    update: { role: 'STUDENT', status: 'ACTIVE' },
    create: { classId: classGroup.id, userId: existing.id, role: 'STUDENT', status: 'ACTIVE' },
  });
  await tx.userActivity.create({
    data: {
      userId: actorUserId,
      action: 'IMPORT_STUDENT',
      details: JSON.stringify({ classId: classGroup.id, studentUserId: existing.id, studentId: row.studentId, created: false }),
    },
  });
  return {
    line: row.line,
    studentId: row.studentId,
    name: row.name,
    status: 'enrolled',
    message: '已加入班级。已有账号请使用原密码登录',
  };
}

/**
 * Create or enroll up to 30 students for one class the actor already manages.
 * The shared initial password applies only to newly created accounts.
 */
export async function importClassStudents(input: {
  classId: string;
  actor: { userId: string; role: string };
  csv: string;
  initialPassword: string;
}): Promise<StudentImportResult> {
  const passwordError = validateInitialPassword(input.initialPassword);
  if (passwordError) return { ok: false, status: 400, error: passwordError };
  if (input.csv.length > 20_000) return { ok: false, status: 400, error: 'CSV 内容过长' };

  const parsed = parseStudentImportCsv(input.csv);
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };

  const classGroup = await prisma.classGroup.findUnique({
    where: { id: input.classId },
    select: { id: true, name: true, teacherId: true, status: true },
  });
  if (!classGroup || classGroup.status !== 'ACTIVE') {
    return { ok: false, status: 404, error: '班级不存在或已归档' };
  }
  if (!await actorCanManageClass(classGroup, input.actor)) {
    return { ok: false, status: 403, error: input.actor.role === 'TEACHER' ? '无权管理该班级' : '权限不足' };
  }

  const passwordHash = await bcrypt.hash(input.initialPassword, 10);
  const rows: StudentImportRowResult[] = [];
  for (const row of parsed.rows) {
    try {
      const saved = await prisma.$transaction((tx) => saveStudentRow(tx, classGroup, input.actor.userId, passwordHash, row));
      rows.push(saved);
    } catch (error) {
      const conflict = typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
      rows.push({
        line: row.line,
        studentId: row.studentId,
        name: row.name,
        status: 'error',
        message: conflict ? '学号、用户名或邮箱已被占用' : '导入该行失败，请稍后重试',
      });
    }
  }

  const summary = {
    created: rows.filter((row) => row.status === 'created').length,
    enrolled: rows.filter((row) => row.status === 'enrolled').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    failed: rows.filter((row) => row.status === 'error').length,
  };
  return { ok: true, className: classGroup.name, summary, rows };
}
