'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, AlertTriangle, CheckCircle2, BookOpen, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateAssemblyCode, type ValidationResult } from '@/lib/syntax-validator';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { emitIlabStep } from '@/lib/ilab/beacon-client';
import type { SimulatorState } from '@/lib/simulator';
import type { DiagnosisResult } from '@/lib/experiment-diagnosis';
import type { AiCodeReview } from '@/lib/ai-code-review';

interface Props {
  code: string;
  fault: string;
  experimentTitle?: string;
  experimentId?: string | null;
  simulatorState?: SimulatorState | null;
}

interface Chapter {
  chapter: string;
  title: string;
}

// AI 返回的通用兜底话术（外部模型无响应时），识别后不展示，避免"AI 不干活"
function isFallbackAnswer(a: string): boolean {
  return /感谢您的提问|暂时无法|建议您查阅相关章节内容，或通过仿真实验/.test(a);
}

// 仿真页内嵌的代码诊断：本地静态语法检查打底（始终可用、能定位到行），
// AI 深度分析（/api/ai/chat · 智谱 GLM）作为叠加，共同构成实验流程内的智能辅助。
export default function AiDiagnostics({ code, fault, experimentTitle, experimentId, simulatorState }: Props) {
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState('');
  const [asked, setAsked] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<DiagnosisResult | null>(null);
  const [liveQuota, setLiveQuota] = useState<{ dailyLimit: number; usedToday: number } | null>(null);
  const [liveError, setLiveError] = useState('');
  const [liveQuestion, setLiveQuestion] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<(AiCodeReview & { cached?: boolean }) | null>(null);
  const [reviewError, setReviewError] = useState('');

  const requestReview = async () => {
    if (!experimentId) return;
    setReviewError('');
    setReviewLoading(true);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      const res = await fetch('/api/experiments/ai-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ experimentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
      setReview(json);
      emitIlabStep('ai_review');
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : '评价请求失败');
    } finally {
      setReviewLoading(false);
    }
  };

  // 从仿真状态提取诊断快照（只取模型判断需要的关键状态，避免全量序列化）
  const buildSnapshot = () => {
    if (!simulatorState) return null;
    const s = simulatorState;
    const currentInstruction =
      s.currentLine >= 0 && s.memory?.[s.currentLine] ? s.memory[s.currentLine] : '';
    return {
      registers: { A: s.registers.A, B: s.registers.B, SP: s.registers.SP, DPTR: (s.registers.DPH << 8) | s.registers.DPL },
      portValues: s.portValues,
      pc: s.pc,
      currentLine: s.currentLine,
      currentInstruction,
      uartTail: `TX:${s.uart.transmitBuffer.slice(-400)} | RX:${s.uart.receiveBuffer.slice(-400)}`,
      timers: {
        TMOD: s.timers.TMOD, TCON: s.timers.TCON,
        TR0: s.timers.TR0, TR1: s.timers.TR1,
        overflow0: s.timers.overflowCount0, overflow1: s.timers.overflowCount1,
      },
      environment: s.environment ?? undefined,
      deviceNotes: [
        s.buzzer.active ? '蜂鸣器激活中' : '蜂鸣器静默',
        `串口 SBUF=0x${s.uart.SBUF.toString(16).padStart(2, '0')} TI=${s.uart.TI} RI=${s.uart.RI}`,
        s.terminated ? '程序已终止' : '程序运行中/暂停',
      ],
    };
  };

  const diagnoseLive = async () => {
    if (!experimentId) {
      setLiveError('当前不在实验模式下，无实验上下文可诊断');
      return;
    }
    setLiveError('');
    setLiveLoading(true);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      const res = await fetch('/api/ai/experiment-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          experimentId,
          code: code.slice(0, 24000),
          question: liveQuestion.trim() || undefined,
          snapshot: buildSnapshot() ?? {},
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
      setLiveResult(json);
      if (json.quota) setLiveQuota(json.quota);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : '诊断请求失败');
    } finally {
      setLiveLoading(false);
    }
  };

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
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
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

        {/* 实时仿真诊断：AI 读取当前仿真快照（寄存器/端口/串口/环境），长在实验流程里 */}
        {experimentId && (
          <div className="mt-2 rounded-md border border-cyan-300/15 bg-cyan-400/[0.04] p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-cyan-300">实时仿真诊断</span>
              {liveQuota && (
                <span className="text-[9px] text-[#6c7086]">今日 {liveQuota.usedToday}/{liveQuota.dailyLimit}</span>
              )}
            </div>
            <input
              value={liveQuestion}
              onChange={(e) => setLiveQuestion(e.target.value)}
              placeholder="卡在哪了？（可留空，直接读状态诊断）"
              maxLength={400}
              className="mb-1.5 w-full rounded border border-white/[0.08] bg-[#181825] px-2 py-1 text-[10px] text-[#cdd6f4] placeholder:text-[#585b70] focus:border-cyan-300/40 focus:outline-none"
            />
            <button
              onClick={diagnoseLive}
              disabled={liveLoading}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all',
                liveLoading
                  ? 'cursor-not-allowed bg-white/[0.05] text-[#6c7086]'
                  : 'bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/30 hover:bg-cyan-400/30',
              )}
            >
              {liveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {liveLoading ? '读取仿真状态诊断中…' : 'AI 读当前状态诊断'}
            </button>
            <p className="mt-1 text-[9px] leading-3.5 text-[#585b70]">
              将当前寄存器/端口/串口/环境读数连同代码发给 AI，只给排查方向不给答案。
            </p>
          </div>
        )}

        {/* AI 代码评价：对已提交代码按 rubric 分项评分（入库留痕，可复看） */}
        {experimentId && (
          <button
            onClick={requestReview}
            disabled={reviewLoading}
            className={cn(
              'mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all',
              reviewLoading
                ? 'cursor-not-allowed bg-white/[0.05] text-[#6c7086]'
                : 'bg-[#f9e2af]/15 text-[#f9e2af] ring-1 ring-[#f9e2af]/25 hover:bg-[#f9e2af]/25',
            )}
          >
            {reviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {reviewLoading ? 'AI 评审中…' : review ? '刷新 AI 代码评价' : '获取 AI 代码评价（须已提交）'}
          </button>
        )}
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

        {liveError && (
          <div className="flex items-start gap-2 rounded-md border border-[#f38ba8]/20 bg-[#f38ba8]/5 p-2.5 text-[11px] text-[#f38ba8]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{liveError}</span>
          </div>
        )}

        {/* 实时诊断结构化结果 */}
        {liveResult && (
          <div className="space-y-2 rounded-md border border-cyan-300/20 bg-cyan-400/[0.04] p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
              <Sparkles className="h-3 w-3" /> 仿真状态诊断
            </div>
            {liveResult.observation && (
              <div className="text-[10px] leading-relaxed text-[#a6adc8]">
                <span className="font-semibold text-[#89b4fa]">现象：</span>{liveResult.observation}
              </div>
            )}
            <div className="text-[11px] leading-relaxed text-[#cdd6f4]">
              <span className="font-semibold text-[#f9e2af]">判断：</span>{liveResult.diagnosis}
            </div>
            {liveResult.hints.length > 0 && (
              <ol className="list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-[#cdd6f4]">
                {liveResult.hints.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
            )}
            {liveResult.nextCheck && (
              <div className="rounded border border-[#45475a] bg-[#181825] px-2 py-1.5 text-[10px] text-[#a6e3a1]">
                <span className="font-semibold">下一步自查：</span>{liveResult.nextCheck}
              </div>
            )}
            <p className="text-[9px] italic text-[#585b70]">诊断仅指方向不给答案，请自行修改验证。</p>
          </div>
        )}

        {reviewError && (
          <div className="flex items-start gap-2 rounded-md border border-[#f38ba8]/20 bg-[#f38ba8]/5 p-2.5 text-[11px] text-[#f38ba8]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{reviewError}</span>
          </div>
        )}

        {/* AI 代码评价 rubric 结果 */}
        {review && (
          <div className="space-y-2 rounded-md border border-[#f9e2af]/20 bg-[#f9e2af]/[0.04] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[#f9e2af]">AI 代码评价</span>
              <span className="rounded bg-[#f9e2af]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#f9e2af]">
                {review.overall} 分{review.cached ? ' · 缓存' : ''}
              </span>
            </div>
            <div className="space-y-1.5">
              {review.dimensions.map((d, i) => (
                <div key={i} className="rounded border border-white/[0.06] bg-[#181825] px-2 py-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-[#cdd6f4]">{d.name}</span>
                    <span className={cn('font-mono', d.score >= 80 ? 'text-[#a6e3a1]' : d.score >= 60 ? 'text-[#f9e2af]' : 'text-[#f38ba8]')}>
                      {d.score}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-white/[0.06]">
                    <div
                      className={cn('h-1 rounded-full', d.score >= 80 ? 'bg-[#a6e3a1]' : d.score >= 60 ? 'bg-[#f9e2af]' : 'bg-[#f38ba8]')}
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[9px] leading-relaxed text-[#a6adc8]">{d.comment}</p>
                </div>
              ))}
            </div>
            {review.summary && (
              <p className="text-[10px] leading-relaxed text-[#cdd6f4]"><span className="font-semibold">总评：</span>{review.summary}</p>
            )}
            {review.suggestions.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-[9px] leading-relaxed text-[#a6adc8]">
                {review.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <p className="text-[9px] italic text-[#585b70]">AI 辅助评价已存入实验记录，最终成绩以教师评定为准。</p>
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
              <Sparkles className="h-3 w-3" /> AI 解释
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
            AI 解释暂不可用，已给出静态语法检查结果；程序是否正确以编译、仿真与教师评价为准。
          </div>
        )}
      </div>
    </div>
  );
}
