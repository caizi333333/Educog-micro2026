import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export async function GET(request: Request) {
  // 检查是否已经初始化
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  // 生产环境必须显式配置初始化密钥，避免默认密钥暴露初始化入口。
  const initSecret =
    process.env.INIT_SECRET ||
    (process.env.NODE_ENV === 'production' ? undefined : 'init-educog-2024');

  if (!initSecret) {
    return jsonResponse({ error: '初始化密钥未配置' }, 500);
  }

  if (process.env.NODE_ENV === 'production' && initSecret.length < 32) {
    return jsonResponse({ error: '初始化密钥长度不足' }, 500);
  }

  if (secret !== initSecret) {
    return jsonResponse({ error: '未授权' }, 401);
  }

  try {
    
    // 检查是否已有管理员
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (existingAdmin) {
      return jsonResponse({ 
        message: '数据库已初始化',
        users: await prisma.user.count()
      });
    }
    
    // 创建默认用户
    const users = [
      {
        email: 'admin@educog.com',
        username: 'admin',
        password: await bcrypt.hash('admin123456', 10),
        name: '系统管理员',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const
      },
      {
        email: 'teacher@educog.com',
        username: 'teacher',
        password: await bcrypt.hash('teacher123456', 10),
        name: '张老师',
        role: 'TEACHER' as const,
        status: 'ACTIVE' as const,
        teacherId: 'T001',
        department: '计算机科学系',
        title: '副教授'
      },
      {
        email: 'student@educog.com',
        username: 'student',
        password: await bcrypt.hash('student123456', 10),
        name: '李同学',
        role: 'STUDENT' as const,
        status: 'ACTIVE' as const,
        studentId: 'S202301001',
        class: '计科2023-1班',
        grade: '2023级',
        major: '计算机科学与技术'
      }
    ];
    
    // 批量创建用户
    for (const userData of users) {
      await prisma.user.create({ data: userData });
    }
    
    return jsonResponse({
      success: true,
      message: '初始化成功！',
      users: [
        { username: 'admin', password: 'admin123456', role: '管理员' },
        { username: 'teacher', password: 'teacher123456', role: '教师' },
        { username: 'student', password: 'student123456', role: '学生' }
      ]
    });
    
  } catch (error: any) {
    console.error('初始化失败:', error);
    return jsonResponse({ 
      error: '初始化失败',
      details: error.message 
    }, 500);
  }
}
