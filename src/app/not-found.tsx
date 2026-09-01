import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CircuitBoard, Home } from 'lucide-react';

export default function NotFound(): JSX.Element {
  return (
    <section
      aria-labelledby="not-found-title"
      className="relative isolate flex min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#070a0d] px-5 py-12 text-slate-50 sm:px-8"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-12 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-3xl items-center">
        <div className="w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c1117]/95 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/[0.08] px-6 py-5 sm:px-9">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200">
                <CircuitBoard className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">EduCog · 404</p>
                <p className="mt-1 text-xs text-slate-400">路由自检已完成</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-9 sm:px-9 sm:py-12">
            <p className="font-mono text-6xl font-semibold tracking-tighter text-white sm:text-8xl">404</p>
            <h1 id="not-found-title" className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              这个页面不存在或已调整
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              请检查访问地址，或从下方入口继续学习。这不会改变已保存的测评、实验和任务记录。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#001014] transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1117]"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                返回课程首页
              </Link>
              <Link
                href="/tasks"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <BookOpen className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                返回我的任务
              </Link>
              <Link
                href="/simulation"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/[0.14] bg-transparent px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                进入实验仿真
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
