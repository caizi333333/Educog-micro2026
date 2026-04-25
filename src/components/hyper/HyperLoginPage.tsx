'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  Lock,
  Moon,
  Shield,
  Sun,
  BookOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type LoginRole = 'student' | 'teacher' | 'admin';

function squareWavePath(phase: number) {
  const steps: string[] = [];
  const period = 80;
  const hi = 40;
  const lo = 120;
  let y = lo;
  const offset = (phase * 4) % period;
  steps.push(`M${-offset} ${y}`);
  for (let index = 0; index < 8; index += 1) {
    const x = -offset + index * period;
    const nextY = index % 2 === 0 ? hi : lo;
    steps.push(`L${x} ${y} L${x} ${nextY}`);
    y = nextY;
  }
  steps.push(`L${-offset + 8 * period} ${y}`);
  return steps.join(' ');
}

function LabScene() {
  const [wave, setWave] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setWave((value) => value + 1), 120);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative hidden overflow-hidden border-r border-cyan-300/15 bg-[#070a0d] lg:block">
      <div className="absolute inset-0 circuit-grid opacity-70" />
      <div className="absolute left-8 right-8 top-8 z-10 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
            <BookOpen className="h-4 w-4 text-cyan-100" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">EduCog·芯智育才</div>
            <div className="font-mono text-[11px] text-slate-500">8051 MCU Teaching Platform</div>
          </div>
        </div>
        <div className="text-right font-mono text-[10px] leading-5 text-slate-500">
          <div>GUILIN UNIVERSITY OF AEROSPACE TECHNOLOGY</div>
          <div>微控制器智慧教育平台</div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-10">
        <div className="w-full max-w-[560px] space-y-4">
          <div className="rounded-md border border-white/[0.08] bg-[#090d12] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="font-mono text-[11px] text-slate-400">CH1 · 5V/DIV · 1ms/DIV</span>
              </div>
              <span className="font-mono text-[11px] text-slate-600">TRIGGER: AUTO</span>
            </div>
            <svg viewBox="0 0 480 160" className="h-40 w-full rounded bg-[#030506]">
              <defs>
                <pattern id="login-grid" width="48" height="20" patternUnits="userSpaceOnUse">
                  <path d="M48 0 L0 0 0 20" fill="none" stroke="#0f3340" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="480" height="160" fill="url(#login-grid)" />
              <line x1="0" y1="80" x2="480" y2="80" stroke="#1a4a5c" strokeWidth="0.5" />
              <path d={squareWavePath(wave)} fill="none" stroke="#06b6d4" strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }} />
              <text x="8" y="16" fill="#0891b2" fontFamily="monospace" fontSize="9">P1.0 OUTPUT</text>
            </svg>
          </div>

          <div className="grid gap-4 rounded-md border border-white/[0.08] bg-[#090d12] p-5 md:grid-cols-[190px_1fr]">
            <svg viewBox="0 0 190 130" className="h-[130px] w-full rounded bg-[#0d3a2a]" aria-hidden="true">
              <path d="M20 22 L62 22 L62 66 L106 66" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
              <path d="M168 34 L144 34 L144 76 L124 76" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
              <rect x="70" y="42" width="56" height="44" fill="#0a0a0a" stroke="#2a2a2a" />
              <text x="98" y="67" textAnchor="middle" fill="#e2e8f0" fontFamily="monospace" fontSize="8">AT89C52</text>
              <circle cx="158" cy="58" r="5" fill="#ef4444" style={{ filter: wave % 2 ? 'drop-shadow(0 0 5px #ef4444)' : undefined, opacity: wave % 2 ? 1 : 0.3 }} />
            </svg>
            <div className="grid content-center gap-2 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">VCC</span><span className="text-cyan-200">5.00 V</span></div>
              <div className="flex justify-between"><span className="text-slate-500">XTAL</span><span className="text-cyan-200">11.0592 MHz</span></div>
              <div className="flex justify-between"><span className="text-slate-500">STATUS</span><span className="text-emerald-300">READY</span></div>
              <div className="mt-2 border-t border-white/[0.08] pt-3 text-slate-500">接线完成 · 仿真内核在线 · 等待登录</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-8 right-8 flex justify-between font-mono text-[10px] text-slate-600">
        <span>EduCog-Micro · Hyper Frontend</span>
        <span>8051 LAB · STATION READY</span>
      </div>
    </div>
  );
}

export function HyperLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<LoginRole>('student');
  const [school, setSchool] = useState('桂林航天工业学院');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailOrUsername || !password) {
      toast({ title: '登录信息不完整', description: '请填写账号和密码。', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '登录失败');

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      const maxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
      const secureAttr = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `accessToken=${data.accessToken}; path=/; max-age=${maxAge}; SameSite=Lax${secureAttr}`;

      toast({ title: '登录成功', description: '正在进入工作台。' });

      const searchParams = new URLSearchParams(window.location.search);
      const from = searchParams.get('from');
      if (from && from !== '/login' && from !== '/register') {
        window.location.href = from;
      } else if (data.user.role === 'ADMIN') {
        window.location.href = '/admin/users';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      toast({
        title: '登录失败',
        description: error instanceof Error ? error.message : '请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const accountLabel = role === 'student' ? '学号 / 邮箱 / 用户名' : role === 'teacher' ? '工号 / 邮箱 / 用户名' : '管理员账号 / 邮箱';

  return (
    <div className="grid min-h-screen bg-[#070a0d] text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <LabScene />
      <main className="relative flex items-center justify-center px-6 py-10">
        <div className="absolute right-6 top-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/[0.08]"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            主题
          </button>
        </div>

        <div className="w-full max-w-[390px]">
          <div className="mb-8">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200">Sign in · 登录</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">欢迎回到工作台</h1>
            <p className="mt-2 text-sm text-slate-400">使用校园账号进入 8051 单片机实验平台。</p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {[
              ['student', GraduationCap, '学生'],
              ['teacher', BookOpen, '教师'],
              ['admin', Shield, '管理员'],
            ].map(([key, Icon, label]) => (
              <button
                key={key as string}
                type="button"
                onClick={() => setRole(key as LoginRole)}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border text-sm transition ${
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

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">学校</span>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">{accountLabel}</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={emailOrUsername}
                  onChange={(event) => setEmailOrUsername(event.target.value)}
                  autoComplete="username"
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                  placeholder={role === 'student' ? '例如 2023050118' : '输入账号'}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">密码</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="button"
              onClick={() => setRemember((value) => !value)}
              className="flex items-center gap-2 text-sm text-slate-400"
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${remember ? 'border-cyan-300 bg-cyan-300 text-[#001014]' : 'border-white/[0.16]'}`}>
                {remember && <Check className="h-3 w-3" />}
              </span>
              记住此设备
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '登录中...' : '进入工作台'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
