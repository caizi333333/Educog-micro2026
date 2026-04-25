'use client';

import { useMemo, useState } from 'react';
import { Camera, Maximize2, Waypoints, ZoomIn, ZoomOut } from 'lucide-react';
import type { SimulatorState } from '@/lib/simulator';
import { cn } from '@/lib/utils';

function ledBitsFromState(state: SimulatorState | null): number[] {
  const value = state?.portValues?.P1 ?? 0xff;
  return Array.from({ length: 8 }, (_, index) => ((value >> (7 - index)) & 1) === 0 ? 1 : 0);
}

function RealisticBoard({ bits }: { bits: number[] }) {
  return (
    <svg viewBox="0 0 620 420" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="desk-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#221a12" />
          <stop offset="1" stopColor="#0d0a07" />
        </linearGradient>
        <pattern id="holes" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.4" fill="#2a2420" />
        </pattern>
      </defs>
      <rect width="620" height="420" fill="url(#desk-bg)" />
      <rect x="50" y="80" width="520" height="250" rx="5" fill="#e8e5d8" stroke="#9f9784" />
      <rect x="70" y="104" width="480" height="190" fill="url(#holes)" opacity="0.65" />
      <line x1="70" y1="102" x2="550" y2="102" stroke="#c02020" />
      <line x1="70" y1="118" x2="550" y2="118" stroke="#1a6cc0" />
      <g transform="translate(226 165)">
        <rect width="168" height="66" rx="2" fill="#0a0a0a" />
        <text x="84" y="28" textAnchor="middle" fill="#e2e8f0" fontFamily="monospace" fontSize="12" fontWeight="700">AT89C52</text>
        <text x="84" y="45" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="8">DIP-40 · P1 LED BUS</text>
        {Array.from({ length: 20 }).map((_, i) => <rect key={`a${i}`} x={6 + i * 8} y="-4" width="3" height="4" fill="#888" />)}
        {Array.from({ length: 20 }).map((_, i) => <rect key={`b${i}`} x={6 + i * 8} y="66" width="3" height="4" fill="#888" />)}
      </g>
      <g transform="translate(150 310)">
        {bits.map((on, index) => (
          <g key={index} transform={`translate(${index * 38} 0)`}>
            <circle cx="8" cy="8" r="7" fill={on ? '#ff4040' : '#431616'} stroke="#8a2a2a" style={{ filter: on ? 'drop-shadow(0 0 7px #ff4040)' : undefined }} />
            <rect x="6" y="15" width="1.5" height="16" fill="#888" />
            <rect x="10" y="15" width="1.5" height="16" fill="#888" />
          </g>
        ))}
      </g>
      {bits.slice(0, 4).map((_, index) => (
        <path
          key={index}
          d={`M394 ${184 + index * 8} Q ${430 + index * 8} ${260 + index * 4} ${158 + index * 38} 310`}
          stroke={['#c02020', '#e8b84d', '#2a7a2a', '#1a6cc0'][index]}
          strokeWidth="2"
          fill="none"
          opacity="0.8"
        />
      ))}
    </svg>
  );
}

function SchematicBoard({ bits }: { bits: number[] }) {
  return (
    <svg viewBox="0 0 620 420" className="h-full w-full" aria-hidden="true">
      <rect width="620" height="420" fill="#111820" />
      <g transform="translate(195 58)">
        <rect width="230" height="238" rx="5" fill="#080b0f" stroke="#334155" />
        <circle cx="115" cy="24" r="6" fill="none" stroke="#475569" />
        <text x="115" y="112" textAnchor="middle" fill="#e2e8f0" fontFamily="monospace" fontSize="18" fontWeight="700">AT89C52</text>
        <text x="115" y="134" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="10">8051 MCU · 40-DIP</text>
        {Array.from({ length: 10 }).map((_, index) => (
          <g key={index}>
            <rect x="-18" y={44 + index * 17} width="18" height="8" fill={index < 8 ? '#06b6d4' : '#94a3b8'} opacity={index < 8 ? 1 : 0.5} />
            <rect x="230" y={44 + index * 17} width="18" height="8" fill={index % 2 ? '#f59e0b' : '#94a3b8'} opacity={index % 2 ? 1 : 0.5} />
          </g>
        ))}
      </g>
      <g transform="translate(120 338)">
        {bits.map((on, index) => (
          <g key={index} transform={`translate(${index * 50} 0)`}>
            <path d="M25 -42 L25 -14" stroke="#06b6d4" strokeWidth="1.6" />
            <circle cx="25" cy="0" r="10" fill={on ? '#ef4444' : '#351515'} stroke="#7f1d1d" style={{ filter: on ? 'drop-shadow(0 0 8px #ef4444)' : undefined }} />
            <text x="25" y="25" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="9">LED{index}</text>
          </g>
        ))}
      </g>
      {bits.map((_, index) => (
        <path
          key={index}
          d={`M195 ${106 + index * 17} C ${150 + index * 4} ${180 + index * 8}, ${145 + index * 50} 250, ${145 + index * 50} 296`}
          stroke={index % 2 ? '#f59e0b' : '#06b6d4'}
          strokeWidth="1.2"
          fill="none"
          opacity="0.8"
        />
      ))}
    </svg>
  );
}

export function HyperExperimentCanvas({ simulatorState }: { simulatorState: SimulatorState | null }) {
  const [mode, setMode] = useState<'schematic' | 'real'>('schematic');
  const bits = useMemo(() => ledBitsFromState(simulatorState), [simulatorState]);

  return (
    <section className="hidden min-w-[360px] flex-[1.05] flex-col overflow-hidden border-l border-white/[0.08] bg-[#0b1014] xl:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0e1317] px-3">
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-cyan-200" />
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100">Experiment View</div>
            <div className="text-[10px] text-slate-500">实验画布 · 接线与运行状态</div>
          </div>
        </div>
        <div className="flex rounded-md border border-white/[0.1] bg-white/[0.04] p-0.5">
          {[
            ['real', Camera, '真实实验图'],
            ['schematic', Waypoints, '准确接线图'],
          ].map(([key, Icon, label]) => (
            <button
              key={key as string}
              type="button"
              onClick={() => setMode(key as 'real' | 'schematic')}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded px-2 text-[11px]',
                mode === key ? 'bg-cyan-300 text-[#001014]' : 'text-slate-400 hover:text-slate-100',
              )}
            >
              <Icon className="h-3 w-3" />
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className={cn('absolute inset-0 transition-opacity duration-300', mode === 'real' ? 'opacity-100' : 'opacity-0')}>
          <RealisticBoard bits={bits} />
        </div>
        <div className={cn('absolute inset-0 transition-opacity duration-300', mode === 'schematic' ? 'opacity-100' : 'opacity-0')}>
          <SchematicBoard bits={bits} />
        </div>
        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="rounded-md border border-white/[0.08] bg-black/45 px-2 py-1 text-[11px] text-slate-300">
            {mode === 'real' ? '实验台视图' : '原理/接线图'}
          </span>
          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[11px] text-cyan-100">P1 LED</span>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1">
          {[ZoomIn, ZoomOut, Maximize2].map((Icon, index) => (
            <button key={index} className="rounded-md border border-white/[0.08] bg-black/45 p-2 text-slate-300 hover:text-slate-100">
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
