'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Lock,
  Shield,
  BookOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LabScene } from '@/components/shared/LabScene';
import { getAllowedRolesForPath, type ApplicationRole } from '@/lib/role-access';
import { clearStoredAuth, storeAuth } from '@/lib/auth-storage';
import {
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
} from '@/lib/client-fetch';

type LoginRole = 'student' | 'teacher' | 'admin';

const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
  }).passthrough(),
});
const loginErrorSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});
export const LOGIN_REQUEST_TIMEOUT_MS = CLIENT_WRITE_TIMEOUT_MS;

const ROLE_TO_SERVER = {
  student: 'STUDENT',
  teacher: 'TEACHER',
  admin: 'ADMIN',
} as const satisfies Record<LoginRole, 'STUDENT' | 'TEACHER' | 'ADMIN'>;

export function getDefaultLoginLandingPath(role: 'STUDENT' | 'TEACHER' | 'ADMIN'): string {
  if (role === 'ADMIN') return '/admin/users';
  if (role === 'TEACHER') return '/teacher';
  return '/';
}

export function getSafeLoginReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const base = 'https://educog.local';
    const parsed = new URL(value, base);
    if (parsed.origin !== base || parsed.pathname === '/login' || parsed.pathname === '/register') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

const SERVER_TO_LOGIN_ROLE: Record<ApplicationRole, LoginRole> = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

function getLoginRolePolicy(path: string | null, reason: string | null) {
  const pathRoles = getAllowedRolesForPath(path);
  const allowedServerRoles = pathRoles
    ?? (reason === 'admin-role'
      ? ['ADMIN'] as const
      : reason === 'teacher-role'
        ? ['TEACHER', 'ADMIN'] as const
        : reason === 'student-role'
          ? ['STUDENT'] as const
          : null);
  const preferredRole = allowedServerRoles?.[0] ? SERVER_TO_LOGIN_ROLE[allowedServerRoles[0]] : 'student';
  let message = '';
  if (allowedServerRoles?.length === 1 && allowedServerRoles[0] === 'STUDENT') {
    message = reason === 'student-role'
      ? '当前账号没有学生权限，请使用学生账号登录。'
      : '该页面仅限学生访问，请使用学生账号登录。';
  } else if (allowedServerRoles?.length === 1 && allowedServerRoles[0] === 'ADMIN') {
    message = reason === 'admin-role'
      ? '当前账号没有管理员权限，请使用管理员账号登录。'
      : '该页面仅限管理员访问，请使用管理员账号登录。';
  } else if (allowedServerRoles) {
    message = reason === 'teacher-role'
      ? '当前账号没有所需权限，请使用教师或管理员账号登录。'
      : '该页面需要教师或管理员权限，请使用对应账号登录。';
  }
  return { allowedServerRoles, preferredRole, message };
}

function getRequestedLoginRole(
  value: string | null,
  allowedServerRoles: readonly ApplicationRole[] | null,
  fallback: LoginRole,
): LoginRole {
  if (value !== 'student' && value !== 'teacher' && value !== 'admin') return fallback;
  if (allowedServerRoles && !allowedServerRoles.includes(ROLE_TO_SERVER[value])) return fallback;
  return value;
}

export function HyperLoginPage() {
  const searchParams = useSearchParams();
  const returnPath = getSafeLoginReturnPath(searchParams?.get('from') ?? null);
  const roleReason = searchParams?.get('reason') ?? null;
  const rolePolicy = getLoginRolePolicy(returnPath, roleReason);
  const preferredLoginRole = getRequestedLoginRole(
    searchParams?.get('role') ?? null,
    rolePolicy.allowedServerRoles,
    rolePolicy.preferredRole,
  );
  const { toast } = useToast();
  const [role, setRole] = useState<LoginRole>(() => preferredLoginRole);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorField, setErrorField] = useState<'account' | 'password' | 'form' | null>(null);
  const accountInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setRole(preferredLoginRole);
  }, [preferredLoginRole]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const submittedAccount = String(formData.get('emailOrUsername') ?? emailOrUsername).trim();
    const submittedPassword = String(formData.get('password') ?? password);

    setFormError('');
    setErrorField(null);
    setEmailOrUsername(submittedAccount);
    setPassword(submittedPassword);

    if (!submittedAccount || !submittedPassword) {
      setFormError('请填写账号和密码。');
      if (!submittedAccount) {
        setErrorField('account');
        accountInputRef.current?.focus();
      } else {
        setErrorField('password');
        passwordInputRef.current?.focus();
      }
      return;
    }

    try {
      setLoading(true);
      const response = await fetchClientRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: submittedAccount,
          password: submittedPassword,
          expectedRole: ROLE_TO_SERVER[role],
          rememberDevice: remember,
        }),
      }, LOGIN_REQUEST_TIMEOUT_MS);
      const raw: unknown = await response.json();
      if (!response.ok) {
        const parsedError = loginErrorSchema.safeParse(raw);
        if (response.status === 503 || (parsedError.success && parsedError.data.code === 'AUTH_SERVICE_UNAVAILABLE')) {
          throw new Error('登录服务暂时不可用，请稍后重试；账号与密码未被修改。');
        }
        throw new Error(parsedError.success ? parsedError.data.error ?? '账号或密码不正确' : '登录服务返回异常');
      }
      const parsed = loginResponseSchema.safeParse(raw);
      if (!parsed.success) throw new Error('登录服务返回异常，请稍后重试');
      const data = parsed.data;

      if (data.user.role !== ROLE_TO_SERVER[role]) {
        clearStoredAuth();
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        throw new Error('当前账号与所选登录角色不一致，请切换正确的角色或账号');
      }

      storeAuth('', data.user, remember ? 'persistent' : 'session');

      toast({ title: '登录成功', description: '正在进入工作台。' });

      if (returnPath) {
        window.location.href = returnPath;
      } else {
        window.location.href = getDefaultLoginLandingPath(data.user.role);
      }
    } catch (error) {
      const message = error instanceof ClientRequestTimeoutError
        ? '登录响应超时，请检查网络后重试；请勿连续重复提交。'
        : error instanceof Error ? error.message : '请稍后重试。';
      setFormError(message);
      setErrorField('form');
      window.requestAnimationFrame(() => formErrorRef.current?.focus());
    } finally {
      setLoading(false);
    }
  };

  const accountLabel = role === 'student' ? '学号 / 邮箱 / 用户名' : role === 'teacher' ? '工号 / 邮箱 / 用户名' : '管理员账号 / 邮箱';
  const submitLabel = role === 'student' ? '进入学习空间' : role === 'teacher' ? '进入教师工作台' : '进入管理后台';

  return (
    <div className="grid min-h-[100dvh] overflow-x-hidden bg-[#070a0d] text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <LabScene />
      <main className="relative flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-[390px]">
          <div className="mb-8">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200">Sign in · 登录</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">欢迎回到工作台</h1>
            <p className="mt-2 text-sm text-slate-400">使用校园账号进入 8051 单片机实验平台。</p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2" role="group" aria-label="登录角色">
            {[
              ['student', GraduationCap, '学生'],
              ['teacher', BookOpen, '教师'],
              ['admin', Shield, '管理员'],
            ].map(([key, Icon, label]) => (
              <button
                key={key as string}
                type="button"
                onClick={() => {
                  setRole(key as LoginRole);
                  setFormError('');
                  setErrorField(null);
                }}
                aria-pressed={role === key}
                disabled={loading || (rolePolicy.allowedServerRoles
                  ? !rolePolicy.allowedServerRoles.includes(ROLE_TO_SERVER[key as LoginRole])
                  : false)}
                aria-describedby={rolePolicy.message ? 'role-account-required' : undefined}
                className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border px-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d] disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 ${
                  role === key
                    ? 'border-cyan-300/40 bg-cyan-300/[0.12] text-cyan-100'
                    : 'border-white/[0.1] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label as string}
              </button>
            ))}
          </div>

          {rolePolicy.message && (
            <p id="role-account-required" className="mb-4 rounded-md border border-amber-300/30 bg-amber-300/[0.1] px-3 py-2 text-sm leading-6 text-amber-100" role="alert">
              {rolePolicy.message}
            </p>
          )}

          <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">学校（当前平台）</span>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="school"
                  name="school"
                  value="桂林航天工业学院"
                  readOnly
                  aria-readonly="true"
                  autoComplete="organization"
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">{accountLabel}</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  ref={accountInputRef}
                  id="emailOrUsername"
                  name="emailOrUsername"
                  value={emailOrUsername}
                  onChange={(event) => {
                    setEmailOrUsername(event.target.value);
                    setFormError('');
                    setErrorField(null);
                  }}
                  autoComplete="username"
                  disabled={loading}
                  aria-invalid={errorField === 'account'}
                  aria-describedby={formError ? 'login-error' : undefined}
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder={role === 'student' ? '例如 2023050118' : '输入账号'}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">密码</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFormError('');
                    setErrorField(null);
                  }}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={loading}
                  aria-invalid={errorField === 'password'}
                  aria-describedby={formError ? 'login-error' : undefined}
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="button"
              onClick={() => setRemember((value) => !value)}
              disabled={loading}
              aria-pressed={remember}
              aria-label="在此设备保持登录"
              aria-describedby="remember-device-description"
              className="flex min-h-11 items-center gap-2 rounded-md text-left text-sm text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${remember ? 'border-cyan-300 bg-cyan-300 text-[#001014]' : 'border-white/[0.16]'}`}>
                {remember && <Check className="h-3 w-3" />}
              </span>
              <span className="flex flex-col items-start">
                <span>在此设备保持登录</span>
                <span id="remember-device-description" className="text-xs leading-5 text-slate-500">
                  {remember ? '关闭浏览器后仍保持登录，最长 7 天' : '仅保留到本次浏览器会话结束'}
                </span>
              </span>
            </button>

            {formError && (
              <p ref={formErrorRef} id="login-error" tabIndex={-1} className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 outline-none focus-visible:ring-2 focus-visible:ring-red-300" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '正在验证账号…' : submitLabel}
            </button>
          </form>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-5 text-sm">
            <Link href="/welcome" className="inline-flex min-h-11 items-center rounded px-1 text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
              返回平台介绍
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center rounded px-1 text-cyan-200 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
              创建学生账号
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
