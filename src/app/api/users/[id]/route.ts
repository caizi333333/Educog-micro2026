import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '获取用户信息失败' },
      { status: 400 }
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

    const body = await request.json();
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

    // 准备更新数据
    const updateData: any = {};

    // 所有用户都可以更新的字段
    if (isSelf || isAdmin) {
      if (body.name !== undefined) updateData.name = body.name;
      if (body.avatar !== undefined) updateData.avatar = body.avatar;
    }

    if (isSelf && payload.role === 'STUDENT') {
      if (body.studentId !== undefined) updateData.studentId = body.studentId;
      if (body.grade !== undefined) updateData.grade = body.grade;
      if (body.major !== undefined) updateData.major = body.major;
    }

    if (isSelf && payload.role === 'TEACHER') {
      if (body.department !== undefined) updateData.department = body.department;
      if (body.title !== undefined) updateData.title = body.title;
    }

    // 只有管理员可以更新的字段
    if (isAdmin) {
      if (body.email !== undefined) updateData.email = body.email;
      if (body.username !== undefined) updateData.username = body.username;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.studentId !== undefined) updateData.studentId = body.studentId;
      if (body.teacherId !== undefined) updateData.teacherId = body.teacherId;
      if (body.grade !== undefined) updateData.grade = body.grade;
      if (body.major !== undefined) updateData.major = body.major;
      if (body.department !== undefined) updateData.department = body.department;
      if (body.title !== undefined) updateData.title = body.title;
    }

    // 更新用户
    const user = await prisma.user.update({
      where: { id: id },
      data: classGroup ? { ...updateData, class: classGroup.name } : updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        status: true
      }
    });

    if (classGroup) {
      await prisma.classEnrollment.upsert({
        where: { classId_userId: { classId: classGroup.id, userId: id } },
        update: { role: user.role === 'TEACHER' ? 'TEACHER' : 'STUDENT', status: 'ACTIVE' },
        create: {
          classId: classGroup.id,
          userId: id,
          role: user.role === 'TEACHER' ? 'TEACHER' : 'STUDENT',
          status: 'ACTIVE',
        },
      });
    }

    // 记录活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE_PROFILE',
        details: JSON.stringify({
          targetUserId: id,
          updatedFields: [...Object.keys(updateData), ...(classGroup ? ['classId'] : [])]
        })
      }
    });

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '更新用户信息失败' },
      { status: 400 }
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

    // 软删除：将状态设为DELETED
    await prisma.user.update({
      where: { id: id },
      data: { status: 'DELETED' }
    });

    // 删除所有会话
    await prisma.session.deleteMany({
      where: { userId: id }
    });

    // 记录活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'DELETE_USER',
        details: JSON.stringify({ deletedUserId: id })
      }
    });

    return NextResponse.json({
      success: true,
      message: '用户已删除'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '删除用户失败' },
      { status: 400 }
    );
  }
}
