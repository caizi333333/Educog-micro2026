import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MIN_SECRET_LENGTH = 16;
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

function authorizeInitialization(request: Request): NextResponse | null {
  const configuredSecret = process.env.INIT_SECRET?.trim() ?? '';
  if (configuredSecret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: '初始化入口未配置' }, { status: 503 });
  }

  const providedSecret = request.headers.get('x-init-secret')?.trim()
    || '';
  if (!secretsMatch(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return null;
}

function readBootstrapPasswords(): { admin: string; teacher: string; student: string } | null {
  const credentials = {
    admin: process.env.INIT_ADMIN_PASSWORD?.trim() ?? '',
    teacher: process.env.INIT_TEACHER_PASSWORD?.trim() ?? '',
    student: process.env.INIT_STUDENT_PASSWORD?.trim() ?? '',
  };
  return Object.values(credentials).every((value) => value.length >= MIN_BOOTSTRAP_PASSWORD_LENGTH)
    ? credentials
    : null;
}

export async function GET(request: Request) {
  const denied = authorizeInitialization(request);
  if (denied) return denied;

  try {
    const [existingAdmin, userCount] = await Promise.all([
      prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }),
      prisma.user.count(),
    ]);
    return NextResponse.json({
      initialized: Boolean(existingAdmin),
      users: userCount,
      message: existingAdmin ? '数据库已初始化' : '数据库尚未初始化',
    });
  } catch (error) {
    console.error('检查初始化状态失败:', error);
    return NextResponse.json({ error: '初始化状态检查失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = authorizeInitialization(request);
  if (denied) return denied;

  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (existingAdmin) {
      return NextResponse.json({ success: true, message: '数据库已初始化' });
    }

    const passwords = readBootstrapPasswords();
    if (!passwords) {
      return NextResponse.json({
        error: `初始化账号密码未配置或少于${MIN_BOOTSTRAP_PASSWORD_LENGTH}位`,
      }, { status: 503 });
    }

    const users = [
      {
        email: 'admin@educog.com',
        username: 'admin',
        password: await bcrypt.hash(passwords.admin, 10),
        name: '系统管理员',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const,
      },
      {
        email: 'teacher@educog.com',
        username: 'teacher',
        password: await bcrypt.hash(passwords.teacher, 10),
        name: '张老师',
        role: 'TEACHER' as const,
        status: 'ACTIVE' as const,
        teacherId: 'T001',
        department: '计算机科学系',
        title: '副教授',
      },
      {
        email: 'student@educog.com',
        username: 'student',
        password: await bcrypt.hash(passwords.student, 10),
        name: '李同学',
        role: 'STUDENT' as const,
        status: 'ACTIVE' as const,
        studentId: 'S202301001',
        class: '计科2023-1班',
        grade: '2023级',
        major: '计算机科学与技术',
      },
    ];

    await prisma.$transaction(users.map((userData) => prisma.user.create({ data: userData })));

    return NextResponse.json({
      success: true,
      message: '初始化成功',
      users: [
        { username: 'admin', role: '管理员' },
        { username: 'teacher', role: '教师' },
        { username: 'student', role: '学生' },
      ],
    }, { status: 201 });
  } catch (error) {
    console.error('初始化失败:', error);
    return NextResponse.json({ error: '初始化失败' }, { status: 500 });
  }
}
