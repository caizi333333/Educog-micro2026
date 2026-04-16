'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Network,
  Bot,
  FlaskConical,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Feature list for the brand panel                                   */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: Network,
    title: '知识图谱导航',
    desc: '可视化知识结构，智能规划学习路径',
  },
  {
    icon: Bot,
    title: 'AI 智能助教',
    desc: '24/7 实时答疑，个性化学习辅导',
  },
  {
    icon: FlaskConical,
    title: '实验仿真',
    desc: '在线 8051 仿真器，随时随地动手实践',
  },
  {
    icon: BarChart3,
    title: '学情分析',
    desc: '多维度学习数据，精准掌握学习进度',
  },
];

/* ------------------------------------------------------------------ */
/*  Dot-grid / circuit-board decorative SVG                            */
/* ------------------------------------------------------------------ */
function DotGrid() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-[0.07]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="dot-pattern"
          x="0"
          y="0"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */
export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loginForm, setLoginForm] = useState({
    emailOrUsername: '',
    password: '',
  });

  /* ---- login handler (preserved) ---- */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginForm.emailOrUsername || !loginForm.password) {
      toast({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登录失败');
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // 注意：document.cookie 不支持设置 "Secure=false" / "HttpOnly"。
      // - Secure：仅在 https 下追加 `; Secure`
      // - HttpOnly：必须由服务端 Set-Cookie 设置（客户端 JS 无法设置）
      const secureAttr = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `accessToken=${data.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${secureAttr}`;

      toast({ title: '成功', description: '登录成功！' });

      if (data.firstLoginAchievement) {
        setTimeout(() => {
          toast({
            title: '恭喜！解锁新成就',
            description: `您已解锁成就："${data.firstLoginAchievement.name}" - ${data.firstLoginAchievement.description}`,
            duration: 5000,
          });
        }, 1000);
      }

      setTimeout(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const from = searchParams.get('from');

        if (from && from !== '/login' && from !== '/register') {
          window.location.href = from;
        } else if (data.user.role === 'ADMIN') {
          window.location.href = '/admin/users';
        } else {
          window.location.href = '/';
        }
      }, data.firstLoginAchievement ? 1500 : 500);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';
      if (errorMessage.includes('Invalid credentials')) {
        toast({
          title: '用户名或密码错误，请重新输入',
          description: '请检查您的登录信息是否正确',
          variant: 'destructive',
          duration: 4000,
        });
      } else if (errorMessage.includes('Network')) {
        toast({
          title: '网络连接失败',
          description: '请检查您的网络连接后重试',
          variant: 'destructive',
          duration: 4000,
        });
      } else {
        toast({
          title: '登录失败',
          description: '请稍后重试或联系管理员',
          variant: 'destructive',
          duration: 4000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex min-h-screen w-full">
      {/* ============================================================ */}
      {/*  LEFT PANEL -- brand showcase (hidden on mobile)              */}
      {/* ============================================================ */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 px-12 py-10 text-white">
        {/* decorative dot grid */}
        <DotGrid />

        {/* decorative blurred circles */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-purple-400/20 blur-3xl"
        />

        {/* top area */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold tracking-tight">芯智育才</h1>
          <p className="mt-3 text-xl font-light text-blue-100">
            8051 微控制器智慧教育平台
          </p>
        </div>

        {/* feature highlights */}
        <div className="relative z-10 space-y-6">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold">{f.title}</p>
                <p className="text-sm text-blue-200">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* bottom area */}
        <p className="relative z-10 text-sm text-blue-200/80">
          桂林航天工业学院
        </p>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL -- login form                                    */}
      {/* ============================================================ */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-[45%]">
        {/* Mobile-only brand header */}
        <div className="mb-10 flex flex-col items-center lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600">
            <Network className="h-7 w-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">芯智育才</h1>
          <p className="text-sm text-gray-500">8051 微控制器智慧教育平台</p>
        </div>

        <div className="w-full max-w-sm">
          {/* heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              欢迎回来
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              登录您的账号以继续学习
            </p>
          </div>

          {/* form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* username / email */}
            <div className="space-y-2">
              <Label
                htmlFor="login-email"
                className="text-sm font-medium text-gray-700"
              >
                邮箱或用户名
              </Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  id="login-email"
                  type="text"
                  placeholder="请输入邮箱或用户名"
                  autoComplete="username"
                  value={loginForm.emailOrUsername}
                  onChange={(e) =>
                    setLoginForm({
                      ...loginForm,
                      emailOrUsername: e.target.value,
                    })
                  }
                  disabled={loading}
                  className="h-11 border-gray-300 bg-gray-50 pl-10 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-blue-500"
                />
              </div>
            </div>

            {/* password */}
            <div className="space-y-2">
              <Label
                htmlFor="login-password"
                className="text-sm font-medium text-gray-700"
              >
                密码
              </Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  disabled={loading}
                  className="h-11 border-gray-300 bg-gray-50 pl-10 pr-10 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-blue-500"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* remember me + forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(v) => setRememberMe(v === true)}
                />
                <Label
                  htmlFor="remember"
                  className="cursor-pointer text-sm text-gray-600"
                >
                  记住我
                </Label>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                忘记密码?
              </button>
            </div>

            {/* submit */}
            <Button
              type="submit"
              disabled={loading}
              aria-label={loading ? '正在登录，请稍候' : '登录到系统'}
              className="h-11 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-base font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  登录中...
                </>
              ) : (
                <>
                  登录
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>

            {/* sr-only live region */}
            <div className="sr-only" aria-live="polite">
              {loading ? '正在处理登录请求' : '准备登录'}
            </div>
          </form>

          {/* divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">或</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* register link */}
          <p className="text-center text-sm text-gray-500">
            还没有账号?{' '}
            <a
              href="/register"
              className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              立即注册
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
