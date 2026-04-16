'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 定时器/计数器交互动画
 * 展示 T0 定时器从初值递增到溢出(0xFFFF→0x0000)触发中断的过程
 */
export default function TimerCounterAnim() {
  const INIT_TH = 0xFC;
  const INIT_TL = 0x18;
  const [th, setTh] = useState(INIT_TH);
  const [tl, setTl] = useState(INIT_TL);
  const [tf, setTf] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [overflowFlash, setOverflowFlash] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const count = (th << 8) | tl;
  const progress = ((count - ((INIT_TH << 8) | INIT_TL)) / (0x10000 - ((INIT_TH << 8) | INIT_TL))) * 100;

  const tick = useCallback(() => {
    setTl(prev => {
      const newTl = (prev + 1) & 0xFF;
      if (newTl === 0) {
        setTh(prevTh => {
          const newTh = (prevTh + 1) & 0xFF;
          if (newTh === 0) {
            // Overflow!
            setTf(true);
            setOverflowFlash(true);
            setPlaying(false);
            setTimeout(() => setOverflowFlash(false), 800);
          }
          return newTh;
        });
      }
      return newTl;
    });
    setTickCount(c => c + 1);
  }, []);

  // Fast ticking: skip by 16 each step to make it visible
  const fastTick = useCallback(() => {
    for (let i = 0; i < 16; i++) tick();
  }, [tick]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(fastTick, 50);
    return () => clearInterval(id);
  }, [playing, fastTick]);

  const reset = () => {
    setTh(INIT_TH); setTl(INIT_TL); setTf(false);
    setPlaying(false); setOverflowFlash(false); setTickCount(0);
  };

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">定时器 T0 方式1 — 16位计数</div>

      {/* TH0:TL0 display */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <div className="text-center">
          <div className="text-[8px] text-[#585b70] mb-0.5">TH0</div>
          <div className={cn(
            'px-2 py-1 rounded font-mono text-sm font-bold transition-colors',
            overflowFlash ? 'bg-red-500/20 text-red-400' : 'bg-[#313244] text-[#f9e2af]'
          )}>
            {th.toString(16).toUpperCase().padStart(2, '0')}
          </div>
        </div>
        <div className="text-[#585b70] text-lg font-mono">:</div>
        <div className="text-center">
          <div className="text-[8px] text-[#585b70] mb-0.5">TL0</div>
          <div className={cn(
            'px-2 py-1 rounded font-mono text-sm font-bold transition-colors',
            overflowFlash ? 'bg-red-500/20 text-red-400' : 'bg-[#313244] text-[#f9e2af]'
          )}>
            {tl.toString(16).toUpperCase().padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[8px] text-[#585b70] mb-0.5">
          <span>0x{((INIT_TH << 8) | INIT_TL).toString(16).toUpperCase()}</span>
          <span>→ 溢出 0xFFFF</span>
        </div>
        <div className="h-2 bg-[#313244] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-75',
              overflowFlash ? 'bg-red-500' : 'bg-gradient-to-r from-[#89b4fa] to-[#cba6f7]'
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Status flags */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#585b70]">TR0:</span>
          <span className={cn('text-[9px] font-bold font-mono', playing ? 'text-[#a6e3a1]' : 'text-[#585b70]')}>
            {playing ? '1' : '0'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#585b70]">TF0:</span>
          <span className={cn(
            'text-[9px] font-bold font-mono',
            tf ? 'text-red-400' : 'text-[#585b70]'
          )}>
            {tf ? '1 溢出!' : '0'}
          </span>
        </div>
        <span className="text-[8px] text-[#585b70] font-mono">+{tickCount}</span>
      </div>

      {/* Overflow interrupt indicator */}
      {overflowFlash && (
        <div className="mb-2 text-center py-1 rounded bg-red-500/10 border border-red-500/20">
          <span className="text-[9px] text-red-400 font-bold animate-pulse">
            TF0=1 → 触发定时器0中断 (000BH)
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-1.5">
        <button onClick={() => { if (!tf) setPlaying(!playing); }}
          disabled={tf}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] disabled:opacity-30 transition-colors">
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? '暂停' : '启动'}
        </button>
        <button onClick={() => { if (!playing && !tf) fastTick(); }}
          disabled={playing || tf}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] disabled:opacity-30 transition-colors">
          <SkipForward className="w-3 h-3" /> +16
        </button>
        <button onClick={reset}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <RotateCcw className="w-3 h-3" /> 重置
        </button>
      </div>
    </div>
  );
}
