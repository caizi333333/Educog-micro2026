'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LED 流水灯交互动画
 * 展示 P1 口 8 位输出控制 LED 的过程，可视化 RL A 指令的移位效果
 */
export default function LEDShiftAnim() {
  const [bits, setBits] = useState(0b00000001); // A register
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);

  const rotateLeft = useCallback(() => {
    setBits(prev => ((prev << 1) | (prev >> 7)) & 0xFF);
    setStep(s => s + 1);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(rotateLeft, 500);
    return () => clearInterval(id);
  }, [playing, rotateLeft]);

  const reset = () => { setBits(0b00000001); setStep(0); setPlaying(false); };

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">LED 流水灯 — RL A 循环左移</div>

      {/* LED row */}
      <div className="flex justify-between mb-2 px-1">
        {Array.from({ length: 8 }, (_, i) => {
          const bitIdx = 7 - i;
          const on = (bits >> bitIdx) & 1;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-[8px] text-[#585b70] font-mono">P1.{bitIdx}</div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border transition-all duration-300',
                  on
                    ? 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                    : 'bg-[#1e1e2e] border-[#45475a]'
                )}
              />
              <div className="text-[8px] font-mono text-[#6c7086]">{on}</div>
            </div>
          );
        })}
      </div>

      {/* Register display */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-[9px] text-[#f9e2af] font-mono font-bold">A =</span>
        <div className="flex gap-px">
          {Array.from({ length: 8 }, (_, i) => {
            const bitIdx = 7 - i;
            const on = (bits >> bitIdx) & 1;
            return (
              <span
                key={i}
                className={cn(
                  'w-4 h-4 flex items-center justify-center text-[9px] font-mono font-bold rounded-sm transition-colors',
                  on ? 'bg-[#f9e2af]/20 text-[#f9e2af]' : 'bg-[#313244] text-[#585b70]'
                )}
              >
                {on}
              </span>
            );
          })}
        </div>
        <span className="text-[9px] text-[#89b4fa] font-mono">
          0x{bits.toString(16).toUpperCase().padStart(2, '0')}
        </span>
      </div>

      {/* Instruction indicator */}
      <div className="text-center mb-2">
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#a6e3a1]/10 text-[#a6e3a1] border border-[#a6e3a1]/20">
          RL A  ; 步骤 #{step}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1.5">
        <button onClick={() => setPlaying(!playing)}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? '暂停' : '播放'}
        </button>
        <button onClick={() => { if (!playing) rotateLeft(); }}
          disabled={playing}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] disabled:opacity-30 transition-colors">
          <SkipForward className="w-3 h-3" /> 单步
        </button>
        <button onClick={reset}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <RotateCcw className="w-3 h-3" /> 重置
        </button>
      </div>
    </div>
  );
}
