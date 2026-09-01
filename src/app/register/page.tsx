'use client';

import { useRef, useState } from 'react';
import { storeAuth } from '@/lib/auth-storage';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { LabScene } from '@/components/shared/LabScene';
import {
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
} from '@/lib/client-fetch';
import {
  ArrowLeft,
  GraduationCap,
  Hash,
  Key,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
} from 'lucide-react';

type RegisterField = 'email' | 'username' | 'password' | 'confirmPassword' | 'form';

type RegisterResponse = {
  success?: boolean;
  error?: string;
  user?: unknown;
  firstLoginAchievement?: { name?: string; description?: string } | null;
};

const REGISTER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_PASSWORD_MAX_BYTES = 72;

function passwordByteLength(value: string): number {
  return new Blob([value]).size;
}

function parseRegisterResponse(value: unknown): RegisterResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RegisterResponse;
}

export default function RegisterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<RegisterField | null>(null);
  const submitInFlightRef = useRef(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const confirmPasswordRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    studentId: '',
    classInviteCode: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (formError) {
      setFormError(null);
      setErrorField(null);
    }
  };

  const showValidationError = (message: string, field: Exclude<RegisterField, 'form'>, input: HTMLInputElement | null): void => {
    setFormError(message);
    setErrorField(field);
    toast({ title: '请检查填写内容', description: message, variant: 'destructive' });
    input?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;

    if (!form.email.trim()) {
      showValidationError('请输入邮箱', 'email', emailRef.current);
      return;
    }
    if (!REGISTER_EMAIL_PATTERN.test(form.email.trim())) {
      showValidationError('邮箱格式不正确', 'email', emailRef.current);
      return;
    }
    if (!form.username.trim()) {
      showValidationError('请输入用户名', 'username', usernameRef.current);
      return;
    }
    if (!form.password) {
      showValidationError('请输入密码', 'password', passwordRef.current);
      return;
    }
    if (form.password.length < 6) {
      showValidationError('密码长度至少6位', 'password', passwordRef.current);
      return;
    }
    if (passwordByteLength(form.password) > BCRYPT_PASSWORD_MAX_BYTES) {
      showValidationError('密码不能超过72字节', 'password', passwordRef.current);
      return;
    }
    if (!form.confirmPassword) {
      showValidationError('请再次输入密码', 'confirmPassword', confirmPasswordRef.current);
      return;
    }
    if (form.password !== form.confirmPassword) {
      showValidationError('两次输入的密码不一致', 'confirmPassword', confirmPasswordRef.current);
      return;
    }

    let registrationSucceeded = false;
    try {
      submitInFlightRef.current = true;
      setLoading(true);
      setFormError(null);
      setErrorField(null);
      const res = await fetchClientRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          password: form.password,
          name: form.name,
          role: 'STUDENT',
          studentId: form.studentId,
          classInviteCode: form.classInviteCode,
        }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const data = parseRegisterResponse(await res.json().catch((): null => null));
      if (!res.ok || data?.success !== true || !data.user) {
        throw new Error(data?.error || (data ? '注册失败，请核对填写内容' : '服务返回格式异常，未能确认注册结果'));
      }

      storeAuth('', data.user, 'persistent');
      registrationSucceeded = true;

      toast({ title: '成功', description: '注册成功！' });

      const firstLoginAchievement = data.firstLoginAchievement;
      if (firstLoginAchievement) {
        setTimeout(() => {
          toast({
            title: '恭喜！解锁新成就',
            description: `您已解锁成就："${firstLoginAchievement.name ?? '首次登录'}"${firstLoginAchievement.description ? ` - ${firstLoginAchievement.description}` : ''}`,
            duration: 5000,
          });
        }, 1000);
      }

      setTimeout(() => {
        // 完整重载让 AuthProvider 从刚写入的令牌恢复新用户；仅做客户端路由
        // 跳转会保留注册前的空认证上下文，并把新用户再次弹回登录页。
        window.location.replace('/simulation');
      }, firstLoginAchievement ? 1500 : 500);
    } catch (error: unknown) {
      const message = error instanceof ClientRequestTimeoutError
        ? '注册请求超时，结果暂未确认。请先返回登录页尝试登录，不要连续重复注册。'
        : error instanceof TypeError
          ? '网络异常，注册结果暂未确认。请先返回登录页尝试登录，不要连续重复注册。'
          : error instanceof Error ? error.message : '注册失败，请稍后重试';
      setFormError(message);
      setErrorField('form');
      toast({ title: '注册失败', description: message, variant: 'destructive' });
    } finally {
      if (!registrationSucceeded) {
        submitInFlightRef.current = false;
        setLoading(false);
      }
    }
  };

  const inputClass =
    'min-h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="grid min-h-[100dvh] overflow-x-hidden bg-[#070a0d] text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <LabScene />
      <main className="relative flex items-start justify-center overflow-auto px-4 py-6 sm:px-6 sm:py-10 lg:items-center">
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/login"
              className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-300 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 返回登录
            </Link>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200">
              Sign up · 注册
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">加入芯智育才</h1>
            <p className="mt-2 text-sm text-slate-400">创建账号，开始 8051 单片机实验学习。</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={loading}>
            {formError && (
              <div id="register-form-error" role="alert" aria-live="assertive" className="rounded-md border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-sm text-red-200">
                {formError}
              </div>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">邮箱 *</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="请输入邮箱"
                  value={form.email}
                  onChange={set('email')}
                  disabled={loading}
                  aria-invalid={errorField === 'email'}
                  aria-describedby={errorField === 'email' ? 'register-form-error' : undefined}
                  className={inputClass}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">用户名 *</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  ref={usernameRef}
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="请输入用户名"
                  value={form.username}
                  onChange={set('username')}
                  disabled={loading}
                  aria-invalid={errorField === 'username'}
                  aria-describedby={errorField === 'username' ? 'register-form-error' : undefined}
                  className={inputClass}
                />
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="block">
                <label htmlFor="register-password" className="mb-2 block text-sm font-medium text-slate-300">密码 *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    ref={passwordRef}
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    placeholder="至少6位，最多72字节"
                    value={form.password}
                    onChange={set('password')}
                    disabled={loading}
                    aria-invalid={errorField === 'password'}
                    aria-describedby={errorField === 'password' ? 'register-password-help register-form-error' : 'register-password-help'}
                    className={inputClass}
                  />
                </div>
                <span id="register-password-help" className="mt-1.5 block text-xs leading-5 text-slate-500">至少 6 位，按 UTF-8 计算不超过 72 字节。</span>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">确认密码 *</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    ref={confirmPasswordRef}
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    placeholder="再次输入"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    disabled={loading}
                    aria-invalid={errorField === 'confirmPassword'}
                    aria-describedby={errorField === 'confirmPassword' ? 'register-form-error' : undefined}
                    className={inputClass}
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">姓名</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="请输入真实姓名"
                  value={form.name}
                  onChange={set('name')}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">学号</span>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="请输入学号"
                    value={form.studentId}
                    onChange={set('studentId')}
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">班级邀请码</span>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="教师提供的邀请码"
                    value={form.classInviteCode}
                    onChange={set('classInviteCode')}
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {loading ? '正在创建账号…' : '注册'}
            </button>

            <div className="flex min-h-11 items-center justify-center text-center text-sm text-slate-400">
              已有账号？{' '}
              <Link href="/login" className="inline-flex min-h-11 items-center rounded px-1 text-cyan-200 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
                立即登录
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
