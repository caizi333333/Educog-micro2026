'use client';

import Link from 'next/link';
import { Cpu, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// 'notes' 不在主导航里出现，传入时四个导航项都不高亮——讲解笔记是课程内容的
// 补充页，不占主导航的位置。
type PublicPage = 'welcome' | 'course' | 'login' | 'notes';

export function PublicSiteHeader({ active, floating = false }: { active: PublicPage; floating?: boolean }) {
  const navItem = (page: PublicPage) => cn(
    'inline-flex min-h-11 items-center rounded-md px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70',
    active === page ? 'bg-white/[0.07] text-cyan-100' : 'text-slate-300 hover:bg-white/[0.05] hover:text-cyan-100',
  );

  return (
    <header className={cn(
      'z-40 border-b border-white/[0.08] bg-[#080c11]/92 backdrop-blur-xl',
      floating ? 'absolute inset-x-0 top-0' : 'sticky top-0',
    )}>
      <nav aria-label="平台主导航" className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/welcome"
          aria-label="芯智育才平台介绍"
          className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
        >
          <span className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
            <Cpu className="h-[18px] w-[18px] text-cyan-100" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-wide text-slate-50 sm:text-base">芯智育才</span>
            <span className="hidden font-mono text-xs uppercase tracking-[0.14em] text-slate-400 sm:block">8051 Teaching Lab</span>
          </span>
        </Link>
        <span className="flex items-center gap-1 sm:gap-2">
          <Link href="/welcome" className={cn(navItem('welcome'), 'hidden sm:inline-flex')}>平台介绍</Link>
          <Link href="/" className={navItem('course')}>公开课程</Link>
          <Link
            href="/login?role=teacher&from=%2Fteacher"
            className={cn(navItem('login'), 'border border-cyan-300/25 bg-cyan-300/[0.08] px-3 font-medium text-cyan-100')}
          >
            {active === 'course' ? '教师登录' : '登录'}
          </Link>
          {active !== 'login' && (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:inline-flex"
            >
              学生登录
            </Link>
          )}
        </span>
      </nav>
    </header>
  );
}

export function EvidenceIdentity({
  kind,
  compact = false,
}: {
  kind: 'demo' | 'engineering' | 'teaching' | 'pending';
  compact?: boolean;
}) {
  const content = {
    demo: ['演示样板', '用于说明教学流程，不代表教学成效'],
    engineering: ['工程自测', '用于功能验证，不等同于真实课堂结果'],
    teaching: ['真实教学记录', '仅展示已保存、可复核的教学过程数据'],
    pending: ['待采集', '当前没有可核验结果，不生成成效数值'],
  }[kind];
  const tone = kind === 'teaching'
    ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100'
    : kind === 'pending'
      ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100'
      : 'border-cyan-300/22 bg-cyan-300/[0.07] text-cyan-100';

  return (
    <span className={cn('inline-flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5', tone)} role="note">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">{content[0]}</strong>
        {!compact && <span className="ml-1 text-current/80">· {content[1]}</span>}
      </span>
    </span>
  );
}
