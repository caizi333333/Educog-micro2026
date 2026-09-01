'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clearStoredAuth } from '@/lib/auth-storage';

function safeClearAuthReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const base = 'https://educog.local';
    const parsed = new URL(value, base);
    if (parsed.origin !== base || ['/login', '/register', '/clear-auth'].includes(parsed.pathname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function getClearAuthDestination(search: string): string {
  const source = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const returnPath = safeClearAuthReturnPath(source.get('from'));
  if (!returnPath) return '/welcome';
  const target = new URLSearchParams({ from: returnPath });
  const role = source.get('role');
  const reason = source.get('reason');
  if (role === 'student' || role === 'teacher' || role === 'admin') target.set('role', role);
  if (reason === 'student-role' || reason === 'teacher-role' || reason === 'admin-role') target.set('reason', reason);
  return `/login?${target.toString()}`;
}

export default function ClearAuthPage() {
  const [destination, setDestination] = useState('/welcome');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    const nextDestination = getClearAuthDestination(window.location.search);
    setDestination(nextDestination);

    const clearAuth = async () => {
      clearStoredAuth();
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          signal: controller.signal,
        });
      } catch {
        // 本地登录态已经清除；服务端退出失败不应把用户困在过渡页。
      } finally {
        window.clearTimeout(timeoutId);
        if (active) window.location.replace(nextDestination);
      }
    };
    void clearAuth();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);
  
  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden px-6">
      <div className="max-w-sm text-center">
        <p className="text-sm text-slate-300" role="status">正在安全退出并清除本机登录状态…</p>
        <Link
          href={destination}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        >
          若未自动返回，点击这里
        </Link>
      </div>
    </div>
  );
}
