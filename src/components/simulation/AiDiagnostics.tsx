'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, AlertTriangle, CheckCircle2, BookOpen, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateAssemblyCode, type ValidationResult } from '@/lib/syntax-validator';

interface Props {
  code: string;
  fault: string;
  experimentTitle?: string;
}

interface Chapter {
  chapter: string;
  title: string;
}

// AI 返回的通用兜底话术（DeepSeek 无响应时），识别后不展示，避免"AI 不干活"
function isFallbackAnswer(a: string): boolean {
  return /感谢您的提问|暂时无法|建议您查阅相关章节内容，或通过仿真实验/.test(a);
}

// 仿真页内嵌的代码诊断：本地静态语法检查打底（始终可用、能定位到行），
// AI 深度分析（/api/ai/chat · DeepSeek）作为叠加，共同构成实验流程内的智能辅助。
export default function AiDiagnostics({ code, fault, experimentTitle }: Props) {
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState('');
  const [asked, setAsked] = useState(false);

  const buildQuestion = () => {
    const parts = [
      `请作为8051单片机汇编助教，分析下面这段代码${experimentTitle ? `（实验：${experimentTitle}）` : ''}。`,
      '1) 判断是否存在语法或逻辑问题；2) 若程序无法得到预期结果，说明原因并定位到具体行；3) 给出具体的修改建议。请用简洁中文分点回答，不要复述整段代码。',
      '',
      '代码：',
      '```asm',
      code.trim(),
      '```',
    ];
    if (fault) parts.push('', `当前仿真报错：${fault}`);
    return parts.join('\n');
  };

  const analyze = async () => {
    if (!code.trim()) {
      setError('代码为空，请先编写或加载实验代码');
      return;
    }
    setError('');
    setAsked(true);
    // 1) 本地静态检查（同步、即时、始终可用）
    setValidation(validateAssemblyCode(code));
    // 2) AI 深度分析
    setLoading(true);
    setAnswer('');
    setAiUnavailable(false);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: buildQuestion() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
      const a: string = json.data?.answer || '';
      if (!a || isFallbackAnswer(a)) {
        setAiUnavailable(true);
      } else {
        setAnswer(a);
        setChapters(Array.isArray(json.data?.relevantChapters) ? json.data.relevantChapters : []);
      }
    } catch {
      setAiUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const errs = validation?.errors ?? [];
  const warns = validation?.warnings ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[11px] font-semibold text-[#cdd6f4]">AI 助教 · 代码诊断</span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-[#6c7086]">
          先做静态语法检查定位问题，再结合课程知识给出修改建议。
        </p>
        <button
          onClick={analyze}
          disabled={loading}
          className={cn(
            'mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all',
            loading
              ? 'cursor-not-allowed bg-white/[0.05] text-[#6c7086]'
              : 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20 hover:bg-cyan-400/25',
          )}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {loading ? '分析中…' : fault ? '诊断当前报错' : '分析当前代码'}
        </button>
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 space-y-3">
        {!asked && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[#6c7086]">
            <Sparkles className="h-7 w-7 opacity-30" />
            <p className="text-[11px]">点击上方按钮，诊断你的代码</p>
            {fault && <p className="max-w-[240px] text-[10px] text-[#f38ba8]/80">检测到报错，可直接点击诊断</p>}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-[#f38ba8]/20 bg-[#f38ba8]/5 p-2.5 text-[11px] text-[#f38ba8]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 静态检查结果 */}
        {validation && !error && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold text-[#89b4fa]">静态语法检查</div>
            {errs.length === 0 && warns.length === 0 ? (
              <div className="flex items-center gap-1.5 rounded-md border border-[#a6e3a1]/20 bg-[#a6e3a1]/5 px-2.5 py-1.5 text-[11px] text-[#a6e3a1]">
                <CheckCircle2 className="h-3.5 w-3.5" /> 语法检查通过，未发现明显问题
              </div>
            ) : (
              <div className="space-y-1">
                {errs.map((e, i) => (
                  <div key={`e${i}`} className="flex items-start gap-1.5 rounded-md border border-[#f38ba8]/15 bg-[#f38ba8]/5 px-2 py-1 text-[10px] text-[#f38ba8]">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span><span className="font-mono text-[#f38ba8]/70">[第{e.line}行]</span> {e.message}</span>
                  </div>
                ))}
                {warns.map((w, i) => (
                  <div key={`w${i}`} className="flex items-start gap-1.5 rounded-md border border-[#f9e2af]/15 bg-[#f9e2af]/5 px-2 py-1 text-[10px] text-[#f9e2af]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span><span className="font-mono text-[#f9e2af]/70">[第{w.line}行]</span> {w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI 深度分析 */}
        {answer && !error && (
          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
              <Sparkles className="h-3 w-3" /> AI 深度分析
            </div>
            <div className="whitespace-pre-wrap rounded-md border border-white/[0.06] bg-[#181825] p-2.5 text-[11px] leading-relaxed text-[#cdd6f4]">
              {answer}
            </div>
            {chapters.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[#89b4fa]">
                  <BookOpen className="h-3 w-3" /> 相关章节
                </div>
                <div className="flex flex-wrap gap-1">
                  {chapters.map((c, i) => (
                    <span key={i} className="rounded border border-[#45475a] bg-[#313244] px-1.5 py-0.5 text-[9px] text-[#a6adc8]">
                      {c.chapter} {c.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-[9px] italic text-[#585b70]">AI 生成内容仅供参考，请结合原理自行判断。</p>
          </div>
        )}

        {aiUnavailable && !error && (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-[#6c7086]">
            AI 深度分析暂不可用，已给出静态语法检查结果。
          </div>
        )}
      </div>
    </div>
  );
}
