import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LabScene } from '@/components/shared/LabScene';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <div className="grid min-h-[100dvh] overflow-x-hidden bg-[#070a0d] text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <LabScene />
      <main className="relative flex items-start justify-center overflow-auto px-4 py-6 sm:px-6 sm:py-10 lg:items-center">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 sm:mb-8">
            <Link
              href="/login"
              className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-300 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 返回登录
            </Link>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200">
              Accounts · 账号
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">自助注册已关闭</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              学生账号由任课教师或管理员创建后发放。请使用学号或用户名，加上教师告知的密码登录。不提供微信登录。
            </p>
          </div>
          <div className="rounded-md border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-50" role="status">
            教师请先在班级页建立测试班，再用 CSV（学号、姓名、班级）导入 5–10 名学生。
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0d]"
            >
              立即登录
            </Link>
            <Link
              href="/login?role=teacher&from=%2Fteacher%2Fclasses"
              className="inline-flex min-h-11 items-center rounded-md border border-white/[0.12] px-4 text-sm text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            >
              教师去建班
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
