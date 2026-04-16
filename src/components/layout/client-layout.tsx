'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReactNode } from 'react';
import { useRouteErrorHandler } from '@/components/error-boundary';

export function ClientLayout({ children }: { children: ReactNode }) {
  // 添加路由错误处理
  useRouteErrorHandler();
  
  return <AppLayout>{children}</AppLayout>;
}
