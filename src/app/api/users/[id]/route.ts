import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

const USER_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
const USER_UPDATE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

function isPrismaConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function cleanOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value.trim() || null : null;
}

// 获取单个用户信息
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
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

    // 检查权限：用户只能查看自己的信息，管理员和教师可以查看所有人
    if (
      payload.userId !== id && 
      payload.role !== 'ADMIN' && 
      payload.role !== 'TEACHER'
    ) {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      );
    }

    if (payload.role === 'TEACHER' && payload.userId !== id) {
      const accessibleClassIds = await getAccessibleClassIds(payload);
      const enrollmentCount = await prisma.classEnrollment.count({
        where: {
          userId: id,
          classId: { in: accessibleClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      });
      if (enrollmentCount === 0) {
        return NextResponse.json(
          { error: '无权查看该学生' },
          { status: 403 }
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
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
        updatedAt: true,
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
              },
            },
          },
        },
        _count: {
          select: {
            experiments: true,
            activities: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 如果是查看自己的信息，获取更多统计数据
    if (payload.userId === id) {
      const stats = await prisma.userExperiment.groupBy({
        by: ['status'],
        where: { userId: id },
        _count: true
      });

      return NextResponse.json({
        ...user,
        stats: {
          completedExperiments: stats.find((s: any) => s.status === 'COMPLETED')?._count || 0,
          inProgressExperiments: stats.find((s: any) => s.status === 'IN_PROGRESS')?._count || 0,
          totalActivities: user._count.activities
        }
      });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

// 更新用户信息
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // 检查权限：用户只能更新自己的部分信息，管理员可以更新所有信息
    const isAdmin = payload.role === 'ADMIN';
    const isSelf = payload.userId === id;

    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      );
    }

    // 检查用户是否存在且未被软删除
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { status: true, role: true, email: true },
    });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const body = await request.json() as Record<string, unknown>;
    const requestedRole = body.role;
    const requestedStatus = body.status;
    if (requestedRole !== undefined && (
      typeof requestedRole !== 'string'
      || !USER_ROLES.includes(requestedRole as (typeof USER_ROLES)[number])
    )) {
      return NextResponse.json({ error: '账号角色无效' }, { status: 400 });
    }
    if (requestedStatus !== undefined && (
      typeof requestedStatus !== 'string'
      || !USER_UPDATE_STATUSES.includes(requestedStatus as (typeof USER_UPDATE_STATUSES)[number])
    )) {
      return NextResponse.json({ error: '账号状态无效；删除账号请使用删除操作' }, { status: 400 });
    }
    if (isSelf && isAdmin && requestedRole !== undefined && requestedRole !== 'ADMIN') {
      return NextResponse.json({ error: '不能降低自己的管理员角色' }, { status: 400 });
    }
    if (isSelf && isAdmin && requestedStatus !== undefined && requestedStatus !== 'ACTIVE') {
      return NextResponse.json({ error: '不能停用自己的管理员账号' }, { status: 400 });
    }

    const finalRole = typeof requestedRole === 'string' ? requestedRole : existing.role;
    const classId = isAdmin && typeof body.classId === 'string' && body.classId.trim()
      ? body.classId.trim()
      : null;
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
    if (classGroup && finalRole === 'ADMIN') {
      return NextResponse.json({ error: '管理员账号不能加入教学班级' }, { status: 400 });
    }

    const removesActiveAdmin = existing.role === 'ADMIN' && (
      (typeof requestedRole === 'string' && requestedRole !== 'ADMIN')
      || (typeof requestedStatus === 'string' && requestedStatus !== 'ACTIVE')
    );
    if (removesActiveAdmin) {
      const activeAdminCount = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdminCount <= 1) {
        return NextResponse.json({ error: '至少需要保留一个可用的管理员账号' }, { status: 409 });
      }
    }

    // 准备更新数据
    const updateData: Prisma.UserUpdateInput = {};

    // 所有用户都可以更新的字段
    if (isSelf || isAdmin) {
      if (body.name !== undefined) {
        const name = cleanOptionalText(body.name);
        if (!name) return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
        if (name.length > 100) return NextResponse.json({ error: '姓名长度不能超过100位' }, { status: 400 });
        updateData.name = name;
      }
      if (body.avatar !== undefined) updateData.avatar = cleanOptionalText(body.avatar);
    }

    if (isSelf && payload.role === 'STUDENT') {
      if (body.studentId !== undefined) updateData.studentId = cleanOptionalText(body.studentId);
      if (body.grade !== undefined) updateData.grade = cleanOptionalText(body.grade);
      if (body.major !== undefined) updateData.major = cleanOptionalText(body.major);
    }

    if (isSelf && payload.role === 'TEACHER') {
      if (body.department !== undefined) updateData.department = cleanOptionalText(body.department);
      if (body.title !== undefined) updateData.title = cleanOptionalText(body.title);
    }

    // 只有管理员可以更新的字段
    if (isAdmin) {
      if (body.email !== undefined) {
        const email = cleanOptionalText(body.email);
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
        }
        updateData.email = email;
      }
      if (body.username !== undefined) {
        const username = cleanOptionalText(body.username);
        if (!username || username.length < 3 || username.length > 50) {
          return NextResponse.json({ error: '用户名长度应为3至50位' }, { status: 400 });
        }
        updateData.username = username;
      }
      if (typeof requestedRole === 'string') updateData.role = requestedRole;
      if (typeof requestedStatus === 'string') updateData.status = requestedStatus;
      if (body.studentId !== undefined) updateData.studentId = cleanOptionalText(body.studentId);
      if (body.teacherId !== undefined) updateData.teacherId = cleanOptionalText(body.teacherId);
      if (body.grade !== undefined) updateData.grade = cleanOptionalText(body.grade);
      if (body.major !== undefined) updateData.major = cleanOptionalText(body.major);
      if (body.department !== undefined) updateData.department = cleanOptionalText(body.department);
      if (body.title !== undefined) updateData.title = cleanOptionalText(body.title);
    }

    const updatedFields = [...Object.keys(updateData), ...(classGroup ? ['classId'] : [])];
    const invalidatesAuthentication = (
      (typeof requestedRole === 'string' && requestedRole !== existing.role)
      || (typeof requestedStatus === 'string' && requestedStatus !== existing.status)
      || (typeof updateData.email === 'string' && updateData.email !== existing.email)
    );
    if (invalidatesAuthentication) updateData.authVersion = { increment: 1 };

    if (updatedFields.length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: classGroup ? { ...updateData, class: classGroup.name } : updateData,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
        },
      });

      if (typeof requestedRole === 'string' && requestedRole !== existing.role) {
        await tx.classEnrollment.updateMany({
          where: { userId: id, status: 'ACTIVE' },
          data: requestedRole === 'ADMIN'
            ? { status: 'REMOVED' }
            : { role: requestedRole === 'TEACHER' ? 'TEACHER' : 'STUDENT' },
        });
      }

      if (classGroup) {
        await tx.classEnrollment.upsert({
          where: { classId_userId: { classId: classGroup.id, userId: id } },
          update: { role: updatedUser.role === 'TEACHER' ? 'TEACHER' : 'STUDENT', status: 'ACTIVE' },
          create: {
            classId: classGroup.id,
            userId: id,
            role: updatedUser.role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
            status: 'ACTIVE',
          },
        });
      }

      if (invalidatesAuthentication) {
        await tx.session.deleteMany({ where: { userId: id } });
      }

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'UPDATE_PROFILE',
          details: JSON.stringify({
            targetUserId: id,
            updatedFields,
            authenticationInvalidated: invalidatesAuthentication,
          }),
        },
      });
      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      user,
      reauthenticationRequired: invalidatesAuthentication && isSelf,
    });
  } catch (error: unknown) {
    if (isPrismaConflict(error)) {
      return NextResponse.json({ error: '邮箱、用户名、学号或工号已被使用' }, { status: 409 });
    }
    console.error('更新用户信息失败:', error);
    return NextResponse.json(
      { error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}

// 删除用户（软删除）
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // 只有管理员可以删除用户
    if (payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '权限不足' },
        { status: 403 }
      );
    }

    // 不能删除自己
    if (payload.userId === id) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      );
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, status: true },
      });
      if (!target) return { kind: 'not-found' as const };
      if (target.status === 'DELETED') return { kind: 'duplicate' as const };

      if (target.role === 'ADMIN') {
        const activeAdminCount = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdminCount <= 1) return { kind: 'last-admin' as const };
      }

      if (target.role === 'TEACHER') {
        const activeTeachingClassCount = await tx.classGroup.count({
          where: { teacherId: id, status: 'ACTIVE' },
        });
        if (activeTeachingClassCount > 0) {
          return { kind: 'active-classes' as const, count: activeTeachingClassCount };
        }
      }

      const deleted = await tx.user.updateMany({
        where: { id, status: { not: 'DELETED' } },
        data: { status: 'DELETED', class: null, authVersion: { increment: 1 } },
      });
      if (deleted.count === 0) return { kind: 'duplicate' as const };

      await tx.session.deleteMany({ where: { userId: id } });
      await tx.classEnrollment.updateMany({
        where: { userId: id, status: 'ACTIVE' },
        data: { status: 'REMOVED' },
      });
      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'DELETE_USER',
          details: JSON.stringify({ deletedUserId: id }),
        },
      });
      return { kind: 'deleted' as const };
    });

    if (outcome.kind === 'not-found') {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    if (outcome.kind === 'last-admin') {
      return NextResponse.json({ error: '至少需要保留一个可用的管理员账号' }, { status: 409 });
    }
    if (outcome.kind === 'active-classes') {
      return NextResponse.json(
        { error: `该教师仍负责 ${outcome.count} 个有效班级，请先转移班级负责人` },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      duplicate: outcome.kind === 'duplicate',
      message: outcome.kind === 'duplicate' ? '用户此前已删除' : '用户已删除',
    });
  } catch (error: unknown) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    );
  }
}
