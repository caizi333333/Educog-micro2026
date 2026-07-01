'use client';

import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
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
    <div className={cn('flex items-start gap-2 rounded-md border px-4 py-3 text-sm', wrapper, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default StatusBanner;
