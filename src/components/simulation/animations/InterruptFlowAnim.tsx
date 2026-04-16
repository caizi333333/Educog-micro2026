'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 中断响应流程交互动画
 * 展示 8051 中断从触发到返回的完整过程
 */

type Phase =
  | 'idle'        // 主程序运行中
  | 'triggered'   // 中断触发
  | 'push_pc'     // 保存PC到堆栈
  | 'jump_isr'    // 跳转到中断向量
  | 'exec_isr'    // 执行ISR
  | 'reti'        // RETI指令
  | 'pop_pc'      // 恢复PC
  | 'resume';     // 恢复主程序

const PHASES: { phase: Phase; label: string; detail: string; duration: number }[] = [
  { phase: 'idle',      label: '主程序执行',    detail: 'PC=0030H, 执行 MAIN_LOOP', duration: 1200 },
  { phase: 'triggered', label: '中断触发',      detail: 'TF0=1, 定时器0溢出', duration: 1000 },
  { phase: 'push_pc',   label: '保存断点',      detail: 'PUSH PC → 堆栈 (SP+2)', duration: 1000 },
  { phase: 'jump_isr',  label: '跳转中断向量',   detail: 'PC ← 000BH (T0中断入口)', duration: 1000 },
  { phase: 'exec_isr',  label: '执行中断服务',   detail: '执行 T0_ISR 程序...', duration: 1500 },
  { phase: 'reti',      label: 'RETI 返回',    detail: 'POP PC, 恢复中断系统', duration: 1000 },
  { phase: 'pop_pc',    label: '恢复断点',      detail: 'PC ← 堆栈 (SP-2)', duration: 800 },
  { phase: 'resume',    label: '继续主程序',    detail: 'PC=0030H, 继续执行', duration: 1200 },
];

export default function InterruptFlowAnim() {
  const [phaseIdx, setPhaseIdx] = useState(-1); // -1 = not started
  const [playing, setPlaying] = useState(false);
  const [sp, setSp] = useState(0x07);
  const [pc, setPc] = useState(0x0030);

  const current = phaseIdx >= 0 ? PHASES[phaseIdx] : null;

  const advancePhase = useCallback(() => {
    setPhaseIdx(prev => {
      const next = prev + 1;
      if (next >= PHASES.length) {
        setPlaying(false);
        return prev;
      }
      // Update SP/PC based on phase
      const p = PHASES[next];
      if (p.phase === 'push_pc')  { setSp(0x09); }
      if (p.phase === 'jump_isr') { setPc(0x000B); }
      if (p.phase === 'pop_pc')   { setSp(0x07); }
      if (p.phase === 'resume')   { setPc(0x0030); }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!playing || phaseIdx < 0) return;
    const dur = PHASES[Math.min(phaseIdx, PHASES.length - 1)]?.duration || 1000;
    const id = setTimeout(() => {
      if (phaseIdx < PHASES.length - 1) advancePhase();
      else setPlaying(false);
    }, dur);
    return () => clearTimeout(id);
  }, [playing, phaseIdx, advancePhase]);

  const start = () => {
    if (phaseIdx < 0) setPhaseIdx(0);
    if (phaseIdx >= PHASES.length - 1) {
      reset(); setTimeout(() => { setPhaseIdx(0); setPlaying(true); }, 50); return;
    }
    setPlaying(true);
    if (phaseIdx < 0) setPhaseIdx(0);
  };

  const reset = () => {
    setPhaseIdx(-1); setPlaying(false); setSp(0x07); setPc(0x0030);
  };

  const phaseColor = (phase?: Phase) => {
    if (!phase) return 'text-[#585b70]';
    switch (phase) {
      case 'idle': case 'resume': return 'text-[#a6e3a1]';
      case 'triggered': return 'text-red-400';
      case 'push_pc': case 'pop_pc': return 'text-[#f9e2af]';
      case 'jump_isr': case 'reti': return 'text-[#89b4fa]';
      case 'exec_isr': return 'text-[#cba6f7]';
      default: return 'text-[#a6adc8]';
    }
  };

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">中断响应流程 — 定时器0中断</div>

      {/* Flow steps */}
      <div className="space-y-0.5 mb-2">
        {PHASES.map((p, i) => {
          const isActive = i === phaseIdx;
          const isDone = i < phaseIdx;
          return (
            <div key={i} className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300',
              isActive ? 'bg-[#313244]/80' : '',
            )}>
              {/* Step indicator */}
              <div className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all flex-shrink-0',
                isDone
                  ? 'bg-[#a6e3a1]/20 border-[#a6e3a1]/30 text-[#a6e3a1]'
                  : isActive
                    ? 'bg-[#89b4fa]/20 border-[#89b4fa]/40 text-[#89b4fa] animate-pulse'
                    : 'bg-[#1e1e2e] border-[#45475a] text-[#585b70]',
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-[9px] font-semibold transition-colors',
                  isActive ? phaseColor(p.phase) : isDone ? 'text-[#6c7086]' : 'text-[#585b70]',
                )}>
                  {p.label}
                </div>
                {isActive && (
                  <div className="text-[8px] text-[#a6adc8] mt-0.5">{p.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Register status */}
      <div className="flex items-center justify-around mb-2 px-2 py-1.5 bg-[#1e1e2e] rounded border border-[#313244]">
        <div className="text-center">
          <div className="text-[8px] text-[#585b70]">PC</div>
          <div className="text-[10px] font-mono font-bold text-[#89b4fa]">
            {pc.toString(16).toUpperCase().padStart(4, '0')}H
          </div>
        </div>
        <div className="w-px h-6 bg-[#313244]" />
        <div className="text-center">
          <div className="text-[8px] text-[#585b70]">SP</div>
          <div className="text-[10px] font-mono font-bold text-[#f9e2af]">
            {sp.toString(16).toUpperCase().padStart(2, '0')}H
          </div>
        </div>
        <div className="w-px h-6 bg-[#313244]" />
        <div className="text-center">
          <div className="text-[8px] text-[#585b70]">TF0</div>
          <div className={cn(
            'text-[10px] font-mono font-bold',
            phaseIdx >= 1 && phaseIdx <= 5 ? 'text-red-400' : 'text-[#585b70]'
          )}>
            {phaseIdx >= 1 && phaseIdx <= 5 ? '1' : '0'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button onClick={start}
          className="flex items-center gap-1 px-3 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <Play className="w-3 h-3" />
          {phaseIdx >= PHASES.length - 1 ? '重新演示' : phaseIdx < 0 ? '开始演示' : playing ? '播放中...' : '继续'}
        </button>
        <button onClick={reset}
          className="flex items-center gap-1 px-3 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <RotateCcw className="w-3 h-3" /> 重置
        </button>
      </div>
    </div>
  );
}
