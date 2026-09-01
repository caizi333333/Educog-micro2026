'use client';

import Link from 'next/link';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BrainCircuit, Loader2, LogIn } from 'lucide-react';
import AIAssistant from '@/components/AIAssistant';

export default function AiAssistantPageWrapper(): React.JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6" role="status" aria-live="polite">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-200 motion-reduce:animate-none" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-200">正在确认 AI 助教访问权限</p>
          <p className="mt-1 text-xs text-slate-500">确认账号后再读取本人的问答与诊断上下文。</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div role="alert" className="w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08]">
            <BrainCircuit className="h-5 w-5 text-cyan-200" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-50">登录后使用 AI 助教</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            登录用于隔离个人问答与诊断上下文；返回后可继续进入智能问答或错误诊断。
          </p>
          <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-50/75">
            AI 只提供解释和提示，不直接修改测验得分、实验完成状态或教师评价。
          </p>
          <Link
            href="/login?from=%2Fai-assistant"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            登录并返回
          </Link>
        </div>
      </div>
    );
  }

  // 账号或角色变化时重建本地对话与请求引用，避免上一账号的未决结果回填。
  return <AIAssistant key={`${user.id}:${user.role}`} />;
}
