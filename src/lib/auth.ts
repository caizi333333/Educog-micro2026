import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getJwtSecret, getJwtRefreshSecret } from '@/lib/env';
import { normalizeLearningEventInput } from '@/lib/classroom';
import { prisma } from './prisma';

// JWT配置
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURES_PER_SOURCE = 8;
const LOGIN_FAILURES_PER_ACCOUNT = 24;
const INVALID_CREDENTIALS_MESSAGE = '账号或密码不正确，或账号已停用';
const LOGIN_RATE_LIMIT_MESSAGE = '登录尝试过于频繁，请稍后再试';

function getRefreshSigningSecret(): string {
  const refreshSecret = getJwtRefreshSecret();
  if (process.env.NODE_ENV === 'production' && refreshSecret === getJwtSecret()) {
    throw new Error('JWT_REFRESH_SECRET 必须与 JWT_SECRET 分别配置');
  }
  return refreshSecret;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sid?: string;
  authVersion?: number;
  iat?: number;
  exp?: number;
}

/**
 * 创建JWT令牌
 */
type TokenSubject = Pick<User, 'id' | 'email' | 'role' | 'authVersion'>;
type IssuedTokens = AuthTokens & { sessionId: string };

function createTokens(user: TokenSubject): IssuedTokens {
  const sessionId = randomUUID();
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    sid: sessionId,
    authVersion: user.authVersion,
  };

  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN
  });

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      type: 'refresh',
      sid: sessionId,
      authVersion: user.authVersion,
    },
    getRefreshSigningSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken, sessionId };
}

/**
 * 验证JWT令牌
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  let decoded: JWTPayload;
  try {
    if (!token || token.trim() === '') {
      return null;
    }

    decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    
    // 验证payload的必要字段
    if (!decoded.userId || !decoded.email || !decoded.sid) {
      return null;
    }

  } catch {
    return null;
  }

  // JWT 签名只能证明令牌由平台签发；账号停用、角色变化和密码修改仍需以数据库当前状态为准。
  // 数据库异常故意不在这里吞掉，让调用接口返回 500，而不是把短暂故障误判成登录失效。
  const currentSession = await prisma.session.findUnique({
    where: { id: decoded.sid },
    select: {
      userId: true,
      expiresAt: true,
      user: {
        select: { email: true, role: true, status: true, authVersion: true },
      },
    },
  });
  if (
    !currentSession
    || currentSession.userId !== decoded.userId
    || currentSession.expiresAt <= new Date()
    || currentSession.user.status !== 'ACTIVE'
    || currentSession.user.email !== decoded.email
    || currentSession.user.role !== decoded.role
    || currentSession.user.authVersion !== (decoded.authVersion ?? 0)
  ) {
    return null;
  }

  return decoded;
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
        category: '系统',
        points: 0,
        source: 'SYSTEM',
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
        id: tokens.sessionId,
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
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    firstLoginAchievement: result.firstLoginAchievement,
    classEnrollment: result.classEnrollment
  };
}

/**
 * 用户登录
 */
export type LoginExpectedRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

async function assertLoginAllowed(userId: string, ip?: string): Promise<void> {
  const windowStart = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MS);
  const latestSuccess = await prisma.userActivity.findFirst({
    where: { userId, action: 'LOGIN', createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const since = latestSuccess?.createdAt && latestSuccess.createdAt > windowStart
    ? latestSuccess.createdAt
    : windowStart;
  const baseWhere = { userId, action: 'LOGIN_FAILED', createdAt: { gte: since } };
  const [accountFailures, sourceFailures] = await Promise.all([
    prisma.userActivity.count({ where: baseWhere }),
    ip
      ? prisma.userActivity.count({ where: { ...baseWhere, ip } })
      : Promise.resolve(0),
  ]);

  if (
    accountFailures >= LOGIN_FAILURES_PER_ACCOUNT
    || sourceFailures >= LOGIN_FAILURES_PER_SOURCE
  ) {
    throw new Error(LOGIN_RATE_LIMIT_MESSAGE);
  }
}

export async function login(
  emailOrUsername: string,
  password: string,
  ip?: string,
  userAgent?: string,
  expectedRole?: LoginExpectedRole,
) {
  // 查找用户
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { username: emailOrUsername }
      ],
      status: 'ACTIVE'
    },
    // 登录只读取认证与响应所需字段，避免无关 User 列的迁移漂移阻断已有账号。
    // authVersion 必须保留，它承担密码/角色变化后的服务端令牌失效语义。
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      name: true,
      avatar: true,
      role: true,
      status: true,
      studentId: true,
      teacherId: true,
      authVersion: true
    }
  });

  if (!user) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  await assertLoginAllowed(user.id, ip);

  // 验证密码
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    await prisma.userActivity.create({
      data: {
        userId: user.id,
        action: 'LOGIN_FAILED',
        details: JSON.stringify({ reason: 'INVALID_CREDENTIALS' }),
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  // 角色必须在记录登录活动和创建会话之前校验，避免错误入口产生有效会话。
  if (expectedRole && user.role !== expectedRole) {
    throw new Error('当前账号与所选登录角色不一致，请切换正确的角色或账号');
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
          category: '系统',
          points: 0,
          source: 'SYSTEM',
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
      id: tokens.sessionId,
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
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    firstLoginAchievement
  };
}

/**
 * 登出
 */
export async function logout(userId?: string, refreshToken?: string, sessionId?: string): Promise<void> {
  let activityUserId = userId;

  if (sessionId && userId) {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  } else if (refreshToken) {
    if (userId) {
      // 访问令牌仍有效时同时约束用户和刷新令牌，避免误删其他会话。
      await prisma.session.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // 访问令牌失效后，仍允许凭浏览器中的 HttpOnly 刷新令牌撤销对应会话。
      const session = await prisma.session.findUnique({
        where: { token: refreshToken },
        select: { id: true, userId: true },
      });

      if (session) {
        activityUserId = session.userId;
        await prisma.session.deleteMany({
          where: {
            id: session.id,
            token: refreshToken,
          },
        });
      }
    }
  }

  if (activityUserId) {
    await prisma.userActivity.create({
      data: {
        userId: activityUserId,
        action: 'LOGOUT',
      },
    });
  }
}

/**
 * 刷新令牌
 */
export async function refreshTokens(refreshToken: string) {
  try {
    // 验证刷新令牌
    const decoded = jwt.verify(refreshToken, getRefreshSigningSecret()) as {
      userId?: string;
      type?: string;
      sid?: string;
      authVersion?: number;
    };
    if (!decoded.userId || decoded.type !== 'refresh' || !decoded.sid) {
      throw new Error('刷新令牌无效');
    }

    // 查找会话
    const session = await prisma.session.findUnique({
      where: { id: decoded.sid },
      select: {
        id: true,
        token: true,
        userId: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            authVersion: true,
          }
        }
      }
    });

    if (
      !session
      || session.token !== refreshToken
      || session.userId !== decoded.userId
      || session.expiresAt < new Date()
      || session.user.status !== 'ACTIVE'
      || session.user.authVersion !== (decoded.authVersion ?? 0)
    ) {
      throw new Error('刷新令牌无效或已过期');
    }

    // 创建新令牌
    const tokens = createTokens(session.user);

    await prisma.$transaction(async (tx) => {
      // 刷新令牌只能使用一次，并发重放只有一个请求可以轮换成功。
      const removed = await tx.session.deleteMany({
        where: { id: session.id, token: refreshToken },
      });
      if (removed.count !== 1) throw new Error('刷新令牌已使用');
      await tx.session.create({
        data: {
          id: tokens.sessionId,
          userId: session.user.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch (error) {
    throw new Error('刷新令牌失败');
  }
}

/**
 * 修改密码
 */
export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  if (oldPassword === newPassword) {
    throw new Error('新密码不能与当前密码相同');
  }
  if (newPassword.length < 6 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new Error('新密码应为6位以上且不超过72字节');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new Error('用户不存在');
  }

  // 验证旧密码
  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) {
    throw new Error('原密码错误');
  }

  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    // 以旧哈希作并发条件：两个同时到达的修改请求只能有一个成功。
    const updated = await tx.user.updateMany({
      where: { id: userId, password: user.password, status: 'ACTIVE' },
      data: { password: hashedPassword, authVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new Error('密码已发生变化，请重新登录后再试');
    }
    await tx.session.deleteMany({ where: { userId } });
    await tx.userActivity.create({
      data: { userId, action: 'CHANGE_PASSWORD' },
    });
  });
}

/**
 * 重置密码（管理员功能）
 */
export async function resetPassword(userId: string, newPassword: string, adminId: string) {
  if (newPassword.length < 6 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new Error('新密码应为6位以上且不超过72字节');
  }
  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { password: hashedPassword, authVersion: { increment: 1 } },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.userActivity.create({
      data: {
        userId: adminId,
        action: 'RESET_PASSWORD',
        details: JSON.stringify({ targetUserId: userId }),
      },
    });
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
