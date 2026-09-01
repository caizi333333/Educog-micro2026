'use client';

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-300/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70';

function EmptyStateAction({ action, className }: { action: { label: string; onClick?: () => void; href?: string }; className?: string }) {
  if (action.href) {
    return (
      <Link href={action.href} className={cn(ACTION_CLASS, className)}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cn(ACTION_CLASS, className)}>
      {action.label}
    </button>
  );
}

interface EmptyStateProps {
  /** 引导性图标（可选），如 Inbox / Trophy / BarChart3 */
  icon?: LucideIcon;
  /** 一句话说明当前是什么情况 */
  title: string;
  /** 可选的补充说明/下一步引导 */
  description?: string;
  /** 可选操作按钮（如"去测评"、"新建班级"）：onClick 用于就地操作，href 用于跳转 */
  action?: { label: string; onClick?: () => void; href?: string };
  /** 居中大号变体：用于"未选中任何项"这类占满整个面板的引导态（如详情面板默认态） */
  centered?: boolean;
  className?: string;
}

/**
 * 统一空状态展示：替代各 Hyper 页面里各自写的"暂无数据"文案，
 * 视觉对齐现有约定（border-white/[0.08] + bg-white/[0.035] 卡片）。
 */
export function EmptyState({ icon: Icon, title, description, action, centered, className }: EmptyStateProps) {
  if (centered) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[360px] flex-col items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] p-8 text-center text-slate-500',
          className,
        )}
      >
        {Icon && <Icon aria-hidden="true" className="h-7 w-7 text-cyan-200" />}
        <div className="mt-3 text-base font-semibold text-slate-100">{title}</div>
        {description && <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</p>}
        {action && <EmptyStateAction action={action} className="mt-4" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-sm text-slate-400',
        (Icon || description || action) && 'flex flex-col items-start gap-2',
        className,
      )}
    >
      {Icon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
          <Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />
        </div>
      )}
      <div>
        <p className="font-medium text-slate-200">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p>}
      </div>
      {action && <EmptyStateAction action={action} className="mt-1" />}
    </div>
  );
}

export default EmptyState;
