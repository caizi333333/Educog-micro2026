import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const authHeader = request.headers.get('authorization');
  
  return NextResponse.json({
    message: '中间件测试端点',
    hasRefreshToken: !!refreshToken,
    hasAuthHeader: !!authHeader,
    cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
    headers: {
      authorization: authHeader ? 'present' : 'missing',
      host: request.headers.get('host'),
      'user-agent': request.headers.get('user-agent'),
    },
    url: request.url,
    pathname: new URL(request.url).pathname,
    timestamp: new Date().toISOString(),
  });
}