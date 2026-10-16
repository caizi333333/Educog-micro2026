import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleIlabEntry } from '@/lib/ilab/service';
import { getIlabConfig, isIlabConfigured } from '@/lib/ilab/config';
import { getLoginCookieOptions } from '@/lib/auth-storage';

const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * 实验空间落地入口：用户在 ilab-x.com 点击「我要做实验」后携带 ticket 跳转至此。
 * GET /ilab/entry?ticket=XXX → 换 access_token → 建影子账号会话 → 重定向进实验页。
 * ticket 两分钟过期，这里必须立即完成换取，不能放进队列。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = getIlabConfig();
  const url = new URL(request.url);
  const home = new URL('/', request.url);

  if (!isIlabConfigured(config)) {
    home.searchParams.set('ilab', 'disabled');
    return NextResponse.redirect(home, { status: 302 });
  }
  const ticket = url.searchParams.get('ticket');
  if (!ticket) {
    home.searchParams.set('ilab', 'missing_ticket');
    return NextResponse.redirect(home, { status: 302 });
  }

  try {
    const { accessToken, refreshToken, experimentId } = await handleIlabEntry(ticket);
    const target = new URL('/simulation', request.url);
    target.searchParams.set('experiment', experimentId);
    target.searchParams.set('from', 'ilab');
    const response = NextResponse.redirect(target, { status: 302 });
    response.cookies.set('accessToken', accessToken, getLoginCookieOptions(true, ACCESS_TOKEN_MAX_AGE));
    response.cookies.set('refreshToken', refreshToken, getLoginCookieOptions(true, REFRESH_TOKEN_MAX_AGE));
    return response;
  } catch (error) {
    const target = new URL('/ilab/error', request.url);
    target.searchParams.set('reason', 'entry_failed');
    const response = NextResponse.redirect(target, { status: 302 });
    response.headers.set('X-Ilab-Error', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
    return response;
  }
}
