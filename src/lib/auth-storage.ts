export type AuthStorageMode = 'persistent' | 'session';

const ACCESS_TOKEN_KEY = 'accessToken';
const AUTH_SESSION_KEY = 'authSession';
const USER_KEY = 'user';
// 兼容现有业务页的同步“是否已登录”判断。这不是令牌，
// middleware 会把 HttpOnly cookie 中的真实令牌注入后续 API 请求。
const COOKIE_AUTH_MARKER = 'cookie-session';

export function getLoginCookieOptions(
  rememberDevice: boolean,
  maxAge: number,
) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(rememberDevice ? { maxAge } : {}),
  };
}

export function getLogoutCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}

function getBrowserStorage(mode: AuthStorageMode): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return mode === 'persistent' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStorageItem(mode: AuthStorageMode, key: string): string | null {
  try {
    return getBrowserStorage(mode)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function getStoredAccessToken(): string | null {
  // 兼容部署前已建立的登录态；新登录不再写入这两个键。
  const legacyToken = readStorageItem('session', ACCESS_TOKEN_KEY)
    ?? readStorageItem('persistent', ACCESS_TOKEN_KEY);
  if (legacyToken) return legacyToken;
  const marker = readStorageItem('session', AUTH_SESSION_KEY)
    ?? readStorageItem('persistent', AUTH_SESSION_KEY);
  return marker ? COOKIE_AUTH_MARKER : null;
}

export function getStoredUser(): string | null {
  return readStorageItem('session', USER_KEY)
    ?? readStorageItem('persistent', USER_KEY);
}

export function getStoredAuthMode(): AuthStorageMode | null {
  if (readStorageItem('persistent', AUTH_SESSION_KEY)
    || readStorageItem('persistent', ACCESS_TOKEN_KEY)) return 'persistent';
  if (readStorageItem('session', AUTH_SESSION_KEY)
    || readStorageItem('session', ACCESS_TOKEN_KEY)) return 'session';
  return null;
}

export function storeAuth(
  _accessToken: string,
  user: unknown,
  mode: AuthStorageMode,
): void {
  if (typeof window === 'undefined') return;
  const target = getBrowserStorage(mode);
  const other = getBrowserStorage(mode === 'persistent' ? 'session' : 'persistent');
  const session = getBrowserStorage('session');
  if (!target || !other || !session) return;

  // JWT 仅由 HttpOnly cookie 承载；这里只保存无敏感会话标记。
  other.removeItem(ACCESS_TOKEN_KEY);
  target.removeItem(ACCESS_TOKEN_KEY);
  other.removeItem(AUTH_SESSION_KEY);
  other.removeItem(USER_KEY);
  target.setItem(AUTH_SESSION_KEY, '1');
  // 用户摘要仅留在当前浏览器会话，“记住设备”只延长 HttpOnly cookie。
  session.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user: unknown, fallbackMode: AuthStorageMode = 'session'): void {
  void fallbackMode;
  getBrowserStorage('session')?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  for (const mode of ['persistent', 'session'] as const) {
    try {
      const storage = getBrowserStorage(mode);
      storage?.removeItem(ACCESS_TOKEN_KEY);
      storage?.removeItem(AUTH_SESSION_KEY);
      storage?.removeItem(USER_KEY);
    } catch {
      // One unavailable storage must not prevent clearing the other one.
    }
  }

  // 清理旧版本曾由浏览器脚本写入的可读 accessToken Cookie。
  // 新版本的 HttpOnly Cookie 仍由 /api/auth/logout 在服务端统一撤销。
  if (typeof document !== 'undefined') {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    document.cookie = `${ACCESS_TOKEN_KEY}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${secure}`;
  }
}
