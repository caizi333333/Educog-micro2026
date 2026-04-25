import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getPaginationParams, createPaginatedResponse, getPrismaSkipTake } from '@/lib/pagination';

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
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const fields = searchParams.get('fields')?.split(',');

    // 构建查询条件
    const where: any = {};

    if (visibleStudentIds) {
      where.OR = [
        { id: { in: visibleStudentIds } },
        { id: payload.userId },
      ];
    }
    
    if (role) {
      where.role = role;
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '获取用户列表失败' },
      { status: 400 }
    );
  }
}

// 创建用户（管理员功能）
export async function POST(request: NextRequest) {
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

    const body = await request.json();
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
    const hashedPassword = await bcrypt.hash(body.password || '123456', 10);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        password: hashedPassword,
        name: body.name,
        role: body.role || 'STUDENT',
        status: body.status || 'ACTIVE',
        studentId: body.studentId,
        teacherId: body.teacherId,
        class: classGroup?.name ?? null,
        grade: body.grade,
        major: body.major,
        department: body.department,
        title: body.title
      }
    });

    if (classGroup) {
      await prisma.classEnrollment.upsert({
        where: { classId_userId: { classId: classGroup.id, userId: user.id } },
        update: { role: user.role === 'TEACHER' ? 'TEACHER' : 'STUDENT', status: 'ACTIVE' },
        create: {
          classId: classGroup.id,
          userId: user.id,
          role: user.role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
          status: 'ACTIVE',
        },
      });
    }

    // 记录活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'CREATE_USER',
        details: JSON.stringify({ 
          createdUserId: user.id,
          username: user.username,
          role: user.role,
          classId: classGroup?.id ?? null
        })
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '创建用户失败' },
      { status: 400 }
    );
  }
}
