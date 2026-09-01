'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

function squareWavePath(phase: number) {
  const steps: string[] = [];
  const period = 80;
  const hi = 40;
  const lo = 120;
  let y = lo;
  const offset = (phase * 4) % period;
  steps.push(`M${-offset} ${y}`);
  for (let index = 0; index < 8; index += 1) {
    const x = -offset + index * period;
    const nextY = index % 2 === 0 ? hi : lo;
    steps.push(`L${x} ${y} L${x} ${nextY}`);
    y = nextY;
  }
  steps.push(`L${-offset + 8 * period} ${y}`);
  return steps.join(' ');
}

export function LabScene() {
  const [wave, setWave] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setWave((value) => value + 1), 120);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative hidden overflow-hidden border-r border-cyan-300/15 bg-[#070a0d] lg:block">
      <div className="absolute inset-0 circuit-grid opacity-70" />
      <div className="absolute left-8 right-8 top-8 z-10 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
            <BookOpen className="h-4 w-4 text-cyan-100" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">EduCog·芯智育才</div>
            <div className="font-mono text-[11px] text-slate-500">8051 MCU Teaching Platform</div>
          </div>
        </div>
        <div className="text-right font-mono text-[10px] leading-5 text-slate-500">
          <div>GUILIN UNIVERSITY OF AEROSPACE TECHNOLOGY</div>
          <div>微控制器智慧教育平台</div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-10">
        <div className="w-full max-w-[560px] space-y-4">
          <div className="rounded-md border border-white/[0.08] bg-[#090d12] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="font-mono text-[11px] text-slate-400">CH1 · 5V/DIV · 1ms/DIV</span>
              </div>
              <span className="font-mono text-[11px] text-slate-600">TRIGGER: AUTO</span>
            </div>
            <svg viewBox="0 0 480 160" className="h-40 w-full rounded bg-[#030506]">
              <defs>
                <pattern id={`lab-grid-${wave}`} width="48" height="20" patternUnits="userSpaceOnUse">
                  <path d="M48 0 L0 0 0 20" fill="none" stroke="#0f3340" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="480" height="160" fill={`url(#lab-grid-${wave})`} />
              <line x1="0" y1="80" x2="480" y2="80" stroke="#1a4a5c" strokeWidth="0.5" />
              <path d={squareWavePath(wave)} fill="none" stroke="#06b6d4" strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 4px #06b6d4)' }} />
              <text x="8" y="16" fill="#0891b2" fontFamily="monospace" fontSize="9">P1.0 OUTPUT</text>
            </svg>
          </div>

          <div className="grid gap-4 rounded-md border border-white/[0.08] bg-[#090d12] p-5 md:grid-cols-[190px_1fr]">
            <svg viewBox="0 0 190 130" className="h-[130px] w-full rounded bg-[#0d3a2a]" aria-hidden="true">
              <path d="M20 22 L62 22 L62 66 L106 66" fill="none" stroke="#06b6d4" strokeWidth="1.2" />
              <path d="M168 34 L144 34 L144 76 L124 76" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
              <rect x="70" y="42" width="56" height="44" fill="#0a0a0a" stroke="#2a2a2a" />
              <text x="98" y="67" textAnchor="middle" fill="#e2e8f0" fontFamily="monospace" fontSize="8">AT89C52</text>
              <circle cx="158" cy="58" r="5" fill="#ef4444" className="pulse-dot" style={{ filter: wave % 2 ? 'drop-shadow(0 0 8px #ef4444)' : undefined, opacity: wave % 2 ? 1 : 0.3 }} />
            </svg>
            <div className="grid content-center gap-2 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-slate-500">VCC</span><span className="stat-glow text-cyan-200">5.00 V</span></div>
              <div className="flex justify-between"><span className="text-slate-500">XTAL</span><span className="stat-glow text-cyan-200">11.0592 MHz</span></div>
              <div className="flex justify-between"><span className="text-slate-500">STATUS</span><span className="stat-glow-emerald text-emerald-300">READY</span></div>
              <div className="mt-2 border-t border-white/[0.08] pt-3 text-slate-500">接线完成 · 仿真内核在线</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-8 right-8 flex justify-between font-mono text-[10px] text-slate-600">
        <span>EduCog-Micro · Hyper Frontend</span>
        <span>8051 LAB · STATION READY</span>
      </div>
    </div>
  );
}
