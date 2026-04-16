import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 不需要认证的公开路径
const publicPaths = [
  '/login', 
  '/register', 
  '/welcome', 
  '/privacy', 
  '/terms', 
  '/clear-auth',
  '/auth-test',
  '/api/auth/login', 
  '/api/auth/register', 
  '/api/health', 
  '/api/init', 
  '/api/auth/validate',
  '/api/middleware-test'
];

// 管理员路径
const adminPaths = ['/admin'];

// 静态资源路径
const staticPaths = ['/_next', '/favicon.ico', '/public'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { searchParams } = request.nextUrl;

  // 跳过静态资源
  if (staticPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 处理 Next.js 路由预取请求
  if (searchParams.has('_rsc')) {
    const response = NextResponse.next();
    // 设置适当的缓存控制头，防止预取请求中断
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-RSC-Request', 'true');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // 确保RSC请求不被重定向或拦截
    return response;
  }

  // 检查是否是公开路径
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));

  // 获取令牌 - 优先从cookies获取，然后从headers获取
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const accessTokenFromCookie = request.cookies.get('accessToken')?.value;
  const authHeader = request.headers.get('authorization');
  const accessTokenFromHeader = authHeader?.replace('Bearer ', '');
  
  // 优先使用cookie中的token，因为这是登录后设置的
  const accessToken = accessTokenFromCookie || accessTokenFromHeader;
  const hasToken = !!(refreshToken || accessToken);
  
  // 如果是公开路径，允许访问
  if (isPublicPath) {
    // 对于登录和注册页面，暂时不做重定向，让用户可以正常访问
    // 这样可以避免token验证问题导致的重定向循环
    return NextResponse.next();
  }

  // 如果没有令牌，重定向到登录页
  if (!hasToken) {
    // API路由返回401而不是重定向
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }
    
    // 其他页面重定向到登录页
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // 检查管理员权限 - 解析 JWT payload 验证角色（仅 accessToken 含 role 字段）
  if (adminPaths.some(path => pathname.startsWith(path))) {
    try {
      // refreshToken payload 不含 role，必须用 accessToken
      const token = accessToken || '';
      if (!token) {
        // 无 accessToken 但有 refreshToken：放行让前端走 refresh 流程
        return NextResponse.next();
      }
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) throw new Error('Invalid token');
      const payload = JSON.parse(atob(payloadBase64));
      const role = payload.role as string;
      if (role !== 'ADMIN' && role !== 'TEACHER') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/', request.url));
      }
      // /admin (system admin) requires ADMIN role specifically
      if (pathname === '/admin' || (pathname.startsWith('/admin') && !pathname.startsWith('/admin/users'))) {
        if (role !== 'ADMIN') {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
          }
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    } catch {
      // Token parse failure — redirect to login
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: '令牌无效' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};