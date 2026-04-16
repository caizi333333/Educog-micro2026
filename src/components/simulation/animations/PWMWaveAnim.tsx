'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * PWM 波形交互动画
 * 拖动滑块改变占空比，实时显示波形、平均电压和 LED 亮度
 */
export default function PWMWaveAnim() {
  const [duty, setDuty] = useState(50); // 0~100
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const periods = 3;
    const periodW = W / periods;
    const highW = (duty / 100) * periodW;
    const topY = 8;
    const botY = H - 8;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#313244';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, topY); ctx.lineTo(W, topY);
    ctx.moveTo(0, botY); ctx.lineTo(W, botY);
    ctx.moveTo(0, (topY + botY) / 2); ctx.lineTo(W, (topY + botY) / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // PWM waveform
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, botY);
    for (let p = 0; p < periods; p++) {
      const x0 = p * periodW;
      // Rising edge
      ctx.lineTo(x0, botY);
      ctx.lineTo(x0, topY);
      // High period
      ctx.lineTo(x0 + highW, topY);
      // Falling edge
      ctx.lineTo(x0 + highW, botY);
      // Low period
      ctx.lineTo(x0 + periodW, botY);
    }
    ctx.stroke();

    // Fill high portions
    ctx.fillStyle = 'rgba(137,180,250,0.1)';
    for (let p = 0; p < periods; p++) {
      const x0 = p * periodW;
      ctx.fillRect(x0, topY, highW, botY - topY);
    }

    // Average voltage line
    const avgY = botY - (duty / 100) * (botY - topY);
    ctx.strokeStyle = '#f9e2af';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, avgY);
    ctx.lineTo(W, avgY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = '#f9e2af';
    ctx.font = '9px monospace';
    ctx.fillText(`Vavg=${((duty / 100) * 5).toFixed(1)}V`, W - 52, avgY - 3);

  }, [duty]);

  const ledBrightness = duty / 100;

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">PWM 脉宽调制 — 占空比控制</div>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        width={252}
        height={60}
        className="w-full rounded border border-[#313244] mb-2"
      />

      {/* Duty slider */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] text-[#585b70] w-10 flex-shrink-0">占空比</span>
        <input
          type="range"
          min={0} max={100} value={duty}
          onChange={e => setDuty(Number(e.target.value))}
          className="flex-1 h-1 accent-[#89b4fa] bg-[#313244] rounded-lg cursor-pointer"
        />
        <span className="text-[10px] font-mono font-bold text-[#89b4fa] w-10 text-right">{duty}%</span>
      </div>

      {/* LED brightness demo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#585b70]">LED效果:</span>
          <div
            className="w-6 h-6 rounded-full border border-red-900/50 transition-all duration-200"
            style={{
              backgroundColor: `rgba(239, 68, 68, ${ledBrightness})`,
              boxShadow: ledBrightness > 0.1
                ? `0 0 ${ledBrightness * 12}px rgba(239, 68, 68, ${ledBrightness * 0.7})`
                : 'none',
            }}
          />
        </div>
        <div className="text-[9px] font-mono text-[#a6adc8]">
          Vavg = 5V x {duty}% = <span className="text-[#f9e2af] font-bold">{((duty / 100) * 5).toFixed(2)}V</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1 mt-2">
        {[0, 25, 50, 75, 100].map(d => (
          <button key={d} onClick={() => setDuty(d)}
            className={cn(
              'flex-1 py-0.5 rounded text-[8px] font-mono transition-colors',
              duty === d
                ? 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
                : 'bg-[#313244] text-[#585b70] hover:text-[#a6adc8]'
            )}>
            {d}%
          </button>
        ))}
      </div>
    </div>
  );
}
