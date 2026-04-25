import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { getJwtSecret, getJwtRefreshSecret } from '@/lib/env';
import { normalizeLearningEventInput } from '@/lib/classroom';
import { prisma } from './prisma';

// JWT配置
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * 创建JWT令牌
 */
function createTokens(user: User): AuthTokens {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    getJwtRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

/**
 * 验证JWT令牌
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    if (!token || token.trim() === '') {
      return null;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    
    // 验证payload的必要字段
    if (!decoded.userId || !decoded.email) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * 用户注册
 */
export async function register(data: {
  email: string;
  username: string;
  password: string;
  name?: string;
  role?: 'STUDENT' | 'TEACHER';
  studentId?: string;
  teacherId?: string;
  class?: string;
  grade?: string;
  major?: string;
  department?: string;
  title?: string;
  classInviteCode?: string;
}) {
  // 检查邮箱是否已存在
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email }
  });
  if (existingEmail) {
    throw new Error('邮箱已被注册');
  }

  // 检查用户名是否已存在
  const existingUsername = await prisma.user.findUnique({
    where: { username: data.username }
  });
  if (existingUsername) {
    throw new Error('用户名已被使用');
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const classInviteCode = data.classInviteCode?.trim();

  const result = await prisma.$transaction(async (tx: any) => {
    const classGroup = classInviteCode
      ? await tx.classGroup.findUnique({
        where: { inviteCode: classInviteCode },
        select: { id: true, name: true, inviteCode: true, status: true },
      })
      : null;

    if (classInviteCode && (!classGroup || classGroup.status !== 'ACTIVE')) {
      throw new Error('班级邀请码无效或已停用');
    }

    // 公开注册只创建学生账号；教师/管理员由管理员创建。
    const user = await tx.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        name: data.name ?? null,
        role: 'STUDENT',
        studentId: data.studentId ?? null,
        teacherId: null,
        class: classGroup?.name ?? null,
        grade: data.grade ?? null,
        major: data.major ?? null,
        department: null,
        title: null
      }
    });

    const classEnrollment = classGroup
      ? await tx.classEnrollment.create({
        data: {
          userId: user.id,
          classId: classGroup.id,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          classId: true,
          role: true,
          status: true,
          joinedAt: true,
          classGroup: {
            select: {
              id: true,
              name: true,
              courseName: true,
              semester: true,
            },
          },
        },
      })
      : null;

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        details: JSON.stringify({ username: user.username, role: user.role, classId: classGroup?.id ?? null })
      }
    });

    const firstLoginAchievement = await tx.userAchievement.create({
      data: {
        userId: user.id,
        achievementId: 'first_login',
        name: '初次登录',
        description: '完成首次登录',
        icon: '🎯',
        category: '系统'
      }
    });

    await tx.userActivity.create({
      data: {
        userId: user.id,
        action: 'UNLOCK_ACHIEVEMENT',
        details: JSON.stringify({
          achievementId: 'first_login',
          name: '初次登录'
        })
      }
    });

    const registerEvent = normalizeLearningEventInput({
      eventType: 'REGISTER',
      targetType: 'USER',
      targetId: user.id,
      metadata: {
        source: 'public-register',
        classId: classGroup?.id ?? null,
      },
    }, user.id);

    if (registerEvent) {
      await tx.learningEvent.create({
        data: {
          userId: user.id,
          classId: classGroup?.id ?? null,
          ...registerEvent,
        },
      });
    }

    const tokens = createTokens(user);

    await tx.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return { user, tokens, firstLoginAchievement, classEnrollment };
  });

  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      username: result.user.username,
      name: result.user.name,
      role: result.user.role,
      studentId: result.user.studentId,
      teacherId: result.user.teacherId
    },
    ...result.tokens,
    firstLoginAchievement: result.firstLoginAchievement,
    classEnrollment: result.classEnrollment
  };
}

/**
 * 用户登录
 */
export async function login(emailOrUsername: string, password: string, ip?: string, userAgent?: string) {
  // 查找用户
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ],
      status: 'ACTIVE'
    }
  });

  if (!user) {
    throw new Error('用户不存在或账号已被禁用');
  }

  // 验证密码
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('密码错误');
  }

  // 检查是否首次登录
  const loginCount = await prisma.userActivity.count({
    where: {
      userId: user.id,
      action: 'LOGIN'
    }
  });

  const isFirstLogin = loginCount === 0;

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // 记录登录活动
  await prisma.userActivity.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      ip: ip ?? null,
      userAgent: userAgent ?? null
    }
  });

  // 如果是首次登录，解锁成就
  let firstLoginAchievement = null;
  if (isFirstLogin) {
    // 检查是否已有该成就
    const existingAchievement = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId: user.id,
          achievementId: 'first_login'
        }
      }
    });

    if (!existingAchievement) {
      firstLoginAchievement = await prisma.userAchievement.create({
        data: {
          userId: user.id,
          achievementId: 'first_login',
          name: '初次登录',
          description: '完成首次登录',
          icon: '🎯',
          category: '系统'
        }
      });

      // 记录解锁成就的活动
      await prisma.userActivity.create({
        data: {
          userId: user.id,
          action: 'UNLOCK_ACHIEVEMENT',
          details: JSON.stringify({
            achievementId: 'first_login',
            name: '初次登录'
          })
        }
      });
    }
  }

  // 创建令牌
  const tokens = createTokens(user);

  // 保存刷新令牌
  await prisma.session.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天
    }
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      studentId: user.studentId,
      teacherId: user.teacherId
    },
    ...tokens,
    firstLoginAchievement
  };
}

/**
 * 登出
 */
export async function logout(userId: string, refreshToken?: string) {
  // 删除刷新令牌
  if (refreshToken) {
    await prisma.session.deleteMany({
      where: {
        userId,
        token: refreshToken
      }
    });
  }

  // 记录登出活动
  await prisma.userActivity.create({
    data: {
      userId,
      action: 'LOGOUT'
    }
  });
}

/**
 * 刷新令牌
 */
export async function refreshTokens(refreshToken: string) {
  try {
    // 验证刷新令牌
    jwt.verify(refreshToken, getJwtRefreshSecret()) as { userId: string };

    // 查找会话
    const session = await prisma.session.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('刷新令牌无效或已过期');
    }

    // 删除旧会话
    await prisma.session.delete({
      where: { id: session.id }
    });

    // 创建新令牌
    const tokens = createTokens(session.user);

    // 保存新的刷新令牌
    await prisma.session.create({
      data: {
        userId: session.user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天
      }
    });

    return tokens;
  } catch (error) {
    throw new Error('刷新令牌失败');
  }
}

/**
 * 修改密码
 */
export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  // 验证旧密码
  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) {
    throw new Error('原密码错误');
  }

  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  // 删除所有会话（强制重新登录）
  await prisma.session.deleteMany({
    where: { userId }
  });

  // 记录活动
  await prisma.userActivity.create({
    data: {
      userId,
      action: 'CHANGE_PASSWORD'
    }
  });
}

/**
 * 重置密码（管理员功能）
 */
export async function resetPassword(userId: string, newPassword: string, adminId: string) {
  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  });

  // 删除所有会话
  await prisma.session.deleteMany({
    where: { userId }
  });

  // 记录活动
  await prisma.userActivity.create({
    data: {
      userId: adminId,
      action: 'RESET_PASSWORD',
      details: JSON.stringify({ targetUserId: userId })
    }
  });
}

// 导出辅助函数供测试使用
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    return false;
  }
}

export function generateTokens(user: User): AuthTokens {
  return createTokens(user);
}

export { prisma };
