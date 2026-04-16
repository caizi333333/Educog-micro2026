import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // 从Authorization header或cookies中获取token
    const authorization = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    let token = '';
    
    // 优先从Authorization header获取
    if (authorization && authorization.startsWith('Bearer ')) {
      token = authorization.substring(7);
    } 
    // 如果header中没有，从cookies中获取
    else if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) {
          acc[key] = value;
        }
        return acc;
      }, {});
      token = cookies.accessToken || '';
    }
    
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    // 从数据库获取最新的用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
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
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '用户不存在或已禁用' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    // 如果是token验证错误，返回401
    if (error instanceof Error && (error.message.includes('token') || error.message.includes('令牌'))) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}