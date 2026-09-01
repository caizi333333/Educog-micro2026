'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBannerProps {
  /** warning：部分数据降级/未同步；error：请求失败 */
  variant: 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES = {
  warning: {
    wrapper: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100',
    Icon: AlertTriangle,
  },
  error: {
    wrapper: 'border-red-300/25 bg-red-300/[0.08] text-red-100',
    Icon: AlertCircle,
  },
} as const;

/**
 * 统一警告/错误横幅：替代各 Hyper 页面里各自实现的黄/红提示条，
 * 语气分 warning（数据部分降级但页面仍可用）与 error（请求失败）。
 */
export function StatusBanner({ variant, children, className }: StatusBannerProps) {
  const { wrapper, Icon } = VARIANT_STYLES[variant];
  return (
    <div role="alert" aria-live="polite" className={cn('flex items-start gap-2 rounded-md border px-4 py-3 text-sm', wrapper, className)}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

type EvidenceReadinessProps = {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  className?: string;
};

/**
 * 将“当前有什么、还缺什么、下一步采什么”固定成同一口径，
 * 防止过程记录、演示记录和教学成效在不同页面被混为一谈。
 */
export function EvidenceReadiness({ mode, className }: EvidenceReadinessProps) {
  const isReal = mode === 'REAL';
  const items = [
    {
      code: 'RECORDED',
      title: '过程已记录',
      text: '任务触达、学习步骤、测验作答与实验完成状态。',
      Icon: CheckCircle2,
      style: 'border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-100',
    },
    {
      code: isReal ? 'CHECK' : 'INSUFFICIENT',
      title: isReal ? '仍需核验' : '成效证据不足',
      text: isReal
        ? '样本量、固定前后测编号、对象和计分口径仍须单独核对。'
        : '当前不是同口径真实前后测，不能据此计算教学增益。',
      Icon: AlertTriangle,
      style: 'border-amber-300/20 bg-amber-300/[0.055] text-amber-100',
    },
    {
      code: 'PENDING',
      title: '待真实采集',
      text: '真实成绩、课堂观察、问卷与可核验学生成果。',
      Icon: AlertCircle,
      style: 'border-cyan-300/20 bg-cyan-300/[0.045] text-cyan-100',
    },
  ];

  return (
    <section aria-label="教学证据状态" className={cn('grid overflow-hidden rounded-md border border-white/[0.08] bg-[#0c1117] md:grid-cols-3', className)}>
      {items.map(({ code, title, text, Icon, style }, index) => (
        <div key={code} className={cn('relative min-h-28 p-4', index > 0 && 'border-t border-white/[0.07] md:border-l md:border-t-0')}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400">{code}</span>
            <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border', style)}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
        </div>
      ))}
    </section>
  );
}

export default StatusBanner;
