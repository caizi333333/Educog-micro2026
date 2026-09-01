import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAllowedRolesForPath,
  getRoleMismatchReasonForPath,
} from '@/lib/role-access';
import { verifyEdgeAccessToken } from '@/lib/edge-jwt';

// 不需要认证的公开路径
const publicPaths = [
  '/login', 
  '/register', 
  '/welcome', 
  '/privacy',
  '/terms',
  '/clear-auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/experiments',
  '/api/quiz/questions'
];

const publicExactPaths = ['/', ...publicPaths];
const administratorOnlyDiagnosticPaths = ['/auth-test', '/api/init', '/api/middleware-test'];

// 静态资源路径
const staticPaths = ['/_next', '/favicon.ico', '/public', '/resources', '/prinx'];

function redirectToRoleLogin(request: NextRequest, reason?: string): NextResponse {
  const url = new URL('/login', request.url);
  const returnSearchParams = new URLSearchParams(request.nextUrl.searchParams);
  returnSearchParams.delete('_rsc');
  const returnSearch = returnSearchParams.toString();
  const returnPath = `${request.nextUrl.pathname}${returnSearch ? `?${returnSearch}` : ''}`;
  url.searchParams.set('from', returnPath);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

function getAccessToken(request: NextRequest): string | null {
  // 浏览器登录以 HttpOnly cookie 为准；Authorization 仅用于非浏览器客户端。
  const cookieToken = request.cookies.get('accessToken')?.value;
  if (cookieToken) return cookieToken;
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const headerToken = authorization.slice('Bearer '.length).trim();
    if (headerToken) return headerToken;
  }
  return null;
}

function continueRequest(request: NextRequest, accessToken?: string | null): NextResponse {
  if (!accessToken || !request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  const headers = new Headers(request.headers);
  // 业务接口暂保留 Bearer 校验口径，真实 JWT 只在服务端中间件内注入。
  headers.set('authorization', `Bearer ${accessToken}`);
  return NextResponse.next({ request: { headers } });
}

function rejectUnauthenticated(request: NextRequest, message = '未授权'): NextResponse {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: message }, { status: 401 });
  }
  return redirectToRoleLogin(request);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const { searchParams } = request.nextUrl;

  // 跳过静态资源
  if (staticPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查是否是公开路径
  const isPublicPath =
    publicExactPaths.includes(pathname);

  // 如果是公开路径，允许访问
  if (isPublicPath) {
    // 对于登录和注册页面，暂时不做重定向，让用户可以正常访问
    // 这样可以避免token验证问题导致的重定向循环
    return continueRequest(request, getAccessToken(request));
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) return rejectUnauthenticated(request);

  const payload = await verifyEdgeAccessToken(accessToken);
  if (!payload) return rejectUnauthenticated(request, '令牌无效');

  if (administratorOnlyDiagnosticPaths.includes(pathname) && payload.role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }
    return redirectToRoleLogin(request, 'admin-role');
  }

  // 教师端与管理端共用一套路径角色策略，避免页面入口和接口权限口径分离。
  const allowedRoles = getAllowedRolesForPath(pathname);
  if (allowedRoles) {
    if (!allowedRoles.includes(payload.role)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
      return redirectToRoleLogin(request, getRoleMismatchReasonForPath(pathname));
    }
  }

  const response = continueRequest(request, accessToken);
  if (searchParams.has('_rsc')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-RSC-Request', 'true');
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  return response;
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
