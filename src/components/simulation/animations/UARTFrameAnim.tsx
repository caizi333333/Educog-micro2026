'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * UART 串口数据帧交互动画
 * 展示一个完整数据帧的发送过程: 起始位→8位数据→停止位
 */
export default function UARTFrameAnim() {
  const DATA_BYTE = 0x41; // 'A' = 01000001
  const BITS = [
    { label: '起始', value: 0, type: 'start' as const },
    ...Array.from({ length: 8 }, (_, i) => ({
      label: `D${i}`,
      value: (DATA_BYTE >> i) & 1,
      type: 'data' as const,
    })),
    { label: '停止', value: 1, type: 'stop' as const },
  ];

  const [activeIdx, setActiveIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const advance = useCallback(() => {
    setActiveIdx(prev => {
      if (prev >= BITS.length - 1) { setPlaying(false); return prev; }
      return prev + 1;
    });
  }, [BITS.length]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(advance, 400);
    return () => clearInterval(id);
  }, [playing, advance]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const bitW = W / (BITS.length + 1); // +1 for idle at start
    const highY = 10;
    const lowY = H - 10;

    ctx.clearRect(0, 0, W, H);

    // Idle high before frame
    ctx.strokeStyle = '#585b70';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, highY); ctx.lineTo(W, highY);
    ctx.moveTo(0, lowY); ctx.lineTo(W, lowY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#585b70';
    ctx.font = '8px monospace';
    ctx.fillText('1', 1, highY - 2);
    ctx.fillText('0', 1, lowY + 9);

    // Waveform
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Idle high
    ctx.moveTo(0, highY);
    ctx.lineTo(bitW * 0.5, highY);

    for (let i = 0; i < BITS.length; i++) {
      const x = (i + 0.5) * bitW;
      const y = BITS[i].value ? highY : lowY;
      const prevY = i === 0 ? highY : (BITS[i - 1].value ? highY : lowY);
      if (y !== prevY) ctx.lineTo(x, y);
      ctx.lineTo(x + bitW, y);

      // Color active region
      if (i <= activeIdx) {
        const color = BITS[i].type === 'start' ? '#a6e3a1' : BITS[i].type === 'stop' ? '#f38ba8' : '#89b4fa';
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + bitW, y);
      } else {
        ctx.strokeStyle = '#45475a';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + bitW, y);
      }
    }
    // Idle high after frame
    const lastY = BITS[BITS.length - 1].value ? highY : lowY;
    if (lastY !== highY) ctx.lineTo((BITS.length + 0.5) * bitW, highY);
    ctx.lineTo(W, highY);
    ctx.strokeStyle = activeIdx >= BITS.length - 1 ? '#585b70' : '#45475a';
    ctx.stroke();

  }, [activeIdx, BITS]);

  const reset = () => { setActiveIdx(-1); setPlaying(false); };
  const start = () => {
    if (activeIdx >= BITS.length - 1) { reset(); setTimeout(() => { setActiveIdx(0); setPlaying(true); }, 50); return; }
    if (activeIdx < 0) setActiveIdx(0);
    setPlaying(true);
  };

  const activeBit = activeIdx >= 0 && activeIdx < BITS.length ? BITS[activeIdx] : null;

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">UART 数据帧 — 发送 &apos;A&apos; (0x41)</div>

      {/* Waveform */}
      <canvas ref={canvasRef} width={252} height={50}
        className="w-full rounded border border-[#313244] mb-2" />

      {/* Bit cells */}
      <div className="flex gap-px mb-2">
        {BITS.map((bit, i) => {
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          const color = bit.type === 'start' ? 'green' : bit.type === 'stop' ? 'red' : 'blue';
          const colors = {
            green: { active: 'bg-[#a6e3a1]/20 border-[#a6e3a1]/40 text-[#a6e3a1]', done: 'text-[#a6e3a1]/50' },
            red:   { active: 'bg-[#f38ba8]/20 border-[#f38ba8]/40 text-[#f38ba8]', done: 'text-[#f38ba8]/50' },
            blue:  { active: 'bg-[#89b4fa]/20 border-[#89b4fa]/40 text-[#89b4fa]', done: 'text-[#89b4fa]/50' },
          };
          return (
            <div key={i} className={cn(
              'flex-1 text-center py-1 rounded-sm border text-[8px] font-mono transition-all',
              isActive
                ? colors[color].active + ' font-bold'
                : isDone
                  ? 'bg-[#1e1e2e] border-[#313244] ' + colors[color].done
                  : 'bg-[#1e1e2e] border-[#313244] text-[#45475a]',
            )}>
              <div>{bit.value}</div>
              <div className="text-[7px] mt-0.5 opacity-70">{bit.label}</div>
            </div>
          );
        })}
      </div>

      {/* Active description */}
      <div className="text-center mb-2 h-5">
        {activeBit && (
          <span className={cn('text-[9px] px-2 py-0.5 rounded', {
            'bg-[#a6e3a1]/10 text-[#a6e3a1]': activeBit.type === 'start',
            'bg-[#f38ba8]/10 text-[#f38ba8]': activeBit.type === 'stop',
            'bg-[#89b4fa]/10 text-[#89b4fa]': activeBit.type === 'data',
          })}>
            {activeBit.type === 'start' ? '起始位: TXD拉低, 通知接收方' :
             activeBit.type === 'stop'  ? '停止位: TXD拉高, 帧结束' :
             `数据位 ${activeBit.label}: ${activeBit.value} (LSB先发)`}
          </span>
        )}
      </div>

      {/* Data summary */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[9px] text-[#585b70]">
          波特率: <span className="text-[#f9e2af] font-mono">9600bps</span>
        </span>
        <span className="text-[9px] text-[#585b70]">
          数据: <span className="text-[#89b4fa] font-mono">0x41 = &apos;A&apos;</span>
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button onClick={start}
          className="flex items-center gap-1 px-3 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <Play className="w-3 h-3" />
          {activeIdx >= BITS.length - 1 ? '重新演示' : '发送'}
        </button>
        <button onClick={reset}
          className="flex items-center gap-1 px-3 py-1 rounded text-[9px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
          <RotateCcw className="w-3 h-3" /> 重置
        </button>
      </div>
    </div>
  );
}
