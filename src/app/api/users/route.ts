import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getPaginationParams, createPaginatedResponse, getPrismaSkipTake } from '@/lib/pagination';

const USER_LIST_FIELDS = new Set([
  'id', 'email', 'username', 'name', 'avatar', 'role', 'status', 'studentId', 'teacherId',
  'class', 'grade', 'major', 'department', 'title', 'createdAt', 'lastLoginAt',
]);
const USER_SORT_FIELDS = new Set(['createdAt', 'lastLoginAt', 'name', 'username', 'role', 'status']);
const USER_ROLES = new Set(['STUDENT', 'TEACHER', 'ADMIN']);
const USER_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'DELETED']);
const CREATE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const USER_RECEIPT_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  status: true,
  studentId: true,
  teacherId: true,
  createdAt: true,
} as const;

function createUserReceipt(user: unknown, duplicate: boolean, status = 200): NextResponse {
  return NextResponse.json({ success: true, duplicate, user }, { status });
}

function isPrismaConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

// 获取用户列表（需要管理员权限）
export async function GET(request: NextRequest) {
  try {
    // 验证权限
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: '无效的令牌' },
        { status: 401 }
      );
    }

    // 检查是否是管理员或教师
    if (payload.role !== 'ADMIN' && payload.role !== 'TEACHER') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      );
    }

    const accessibleClassIds = payload.role === 'TEACHER' ? await getAccessibleClassIds(payload) : null;
    const visibleStudentIds = accessibleClassIds
      ? (await prisma.classEnrollment.findMany({
        where: { classId: { in: accessibleClassIds }, role: 'STUDENT', status: 'ACTIVE' },
        select: { userId: true },
      })).map((item: { userId: string }) => item.userId)
      : null;

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const paginationParams = getPaginationParams(searchParams);
    if (!USER_SORT_FIELDS.has(paginationParams.sortBy || 'createdAt')) paginationParams.sortBy = 'createdAt';
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const requestedFields = searchParams.get('fields')?.split(',').map((field) => field.trim()).filter(Boolean);
    if (requestedFields?.some((field) => !USER_LIST_FIELDS.has(field))) {
      return NextResponse.json({ error: '包含不允许返回的用户字段' }, { status: 400 });
    }
    const fields = requestedFields;

    // 构建查询条件
    const where: any = {};

    if (visibleStudentIds) {
      where.OR = [
        { id: { in: visibleStudentIds } },
        { id: payload.userId },
      ];
    }
    
    if (role && !USER_ROLES.has(role)) {
      return NextResponse.json({ error: '无效的角色筛选条件' }, { status: 400 });
    }
    if (role) {
      where.role = role;
    }
    
    if (status && !USER_STATUSES.has(status)) {
      return NextResponse.json({ error: '无效的状态筛选条件' }, { status: 400 });
    }
    if (status) {
      where.status = status;
    }
    
    if (search) {
      const searchOr = [
        { email: { contains: search } },
        { username: { contains: search } },
        { name: { contains: search } },
        { studentId: { contains: search } },
        { teacherId: { contains: search } }
      ];
      where.AND = [...(where.AND || []), { OR: searchOr }];
    }

    // 构建字段选择
    const select = fields && fields.length > 0 ? 
      fields.reduce((acc, field) => ({ ...acc, [field]: true }), { id: true }) :
      {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        studentId: true,
        teacherId: true,
        class: true,
        grade: true,
        major: true,
        department: true,
        title: true,
        createdAt: true,
        lastLoginAt: true,
        classEnrollments: {
          where: { status: 'ACTIVE' },
          select: {
            classId: true,
            role: true,
            status: true,
            classGroup: {
              select: {
                id: true,
                name: true,
                courseName: true,
                semester: true,
              }
            }
          }
        },
        _count: {
          select: {
            quizAttempts: true,
            experiments: true,
            achievements: true
          }
        }
      };

    // 查询用户
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select,
        ...getPrismaSkipTake(paginationParams),
        orderBy: { [paginationParams.sortBy || 'createdAt']: paginationParams.sortOrder || 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return NextResponse.json(createPaginatedResponse(users, total, paginationParams));
  } catch (error: unknown) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}

// 创建用户（管理员功能）
export async function POST(request: NextRequest) {
  let creationRequestKey: string | null = null;
  try {
    // 验证权限
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: '无效的令牌' },
        { status: 401 }
      );
    }

    // 只有管理员可以创建用户
    if (payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      );
    }

    const body = await request.json() as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = typeof body.role === 'string' ? body.role : 'STUDENT';
    const status = typeof body.status === 'string' ? body.status : 'ACTIVE';
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    if (!email || !username || !name || !password) {
      return NextResponse.json({ error: '邮箱、用户名、姓名和初始密码均为必填项' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '初始密码长度至少为6位' }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: '初始密码长度不能超过128位' }, { status: 400 });
    }
    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ error: '用户名长度应为3至50位' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: '姓名长度不能超过100位' }, { status: 400 });
    }
    if (!USER_ROLES.has(role) || !USER_STATUSES.has(status)) {
      return NextResponse.json({ error: '角色或账号状态无效' }, { status: 400 });
    }
    if (requestId && !CREATE_REQUEST_ID_PATTERN.test(requestId)) {
      return NextResponse.json({ error: '创建请求标识格式无效' }, { status: 400 });
    }
    creationRequestKey = requestId ? `${payload.userId}:${requestId}` : null;

    if (creationRequestKey) {
      const existingRequest = await prisma.user.findUnique({
        where: { creationRequestKey },
        select: USER_RECEIPT_SELECT,
      });
      if (existingRequest) return createUserReceipt(existingRequest, true);
    }

    const classId = typeof body.classId === 'string' && body.classId.trim() ? body.classId.trim() : null;
    const classGroup = classId
      ? await prisma.classGroup.findUnique({
        where: { id: classId },
        select: { id: true, name: true, status: true },
      })
      : null;

    if (classId && (!classGroup || classGroup.status !== 'ACTIVE')) {
      return NextResponse.json(
        { error: '班级不存在或已停用' },
        { status: 400 }
      );
    }

    // 这里可以调用register函数，但为了记录是管理员创建的，我们直接创建
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          name,
          role,
          status,
          creationRequestKey,
          studentId: typeof body.studentId === 'string' ? body.studentId.trim() || null : null,
          teacherId: typeof body.teacherId === 'string' ? body.teacherId.trim() || null : null,
          class: classGroup?.name ?? null,
          grade: typeof body.grade === 'string' ? body.grade.trim() || null : null,
          major: typeof body.major === 'string' ? body.major.trim() || null : null,
          department: typeof body.department === 'string' ? body.department.trim() || null : null,
          title: typeof body.title === 'string' ? body.title.trim() || null : null,
        },
        select: USER_RECEIPT_SELECT,
      });

      if (classGroup) {
        await tx.classEnrollment.upsert({
          where: { classId_userId: { classId: classGroup.id, userId: created.id } },
          update: { role: created.role === 'TEACHER' ? 'TEACHER' : 'STUDENT', status: 'ACTIVE' },
          create: {
            classId: classGroup.id,
            userId: created.id,
            role: created.role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
            status: 'ACTIVE',
          },
        });
      }

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'CREATE_USER',
          details: JSON.stringify({
            createdUserId: created.id,
            username: created.username,
            role: created.role,
            classId: classGroup?.id ?? null,
            requestId: requestId || null,
          }),
        },
      });
      return created;
    });

    return createUserReceipt(user, false, 201);
  } catch (error: unknown) {
    if (isPrismaConflict(error)) {
      if (creationRequestKey) {
        const existingRequest = await prisma.user.findUnique({
          where: { creationRequestKey },
          select: USER_RECEIPT_SELECT,
        });
        if (existingRequest) return createUserReceipt(existingRequest, true);
      }
      return NextResponse.json({ error: '邮箱或用户名已存在' }, { status: 409 });
    }
    console.error('创建用户失败:', error);
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}
