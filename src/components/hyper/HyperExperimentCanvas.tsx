'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Camera, Cpu, Maximize2, Waypoints, ZoomIn, ZoomOut } from 'lucide-react';
import type { SimulatorState } from '@/lib/simulator';
import { cn } from '@/lib/utils';

// ── 共阴数码管段码 → 字符 ──
const SEGMENT_MAP: Record<number, string> = {
  0x3f: '0', 0x06: '1', 0x5b: '2', 0x4f: '3', 0x66: '4', 0x6d: '5', 0x7d: '6',
  0x07: '7', 0x7f: '8', 0x6f: '9', 0x77: 'A', 0x7c: 'b', 0x39: 'C', 0x5e: 'd',
  0x79: 'E', 0x71: 'F',
};
const VALID_SEGMENT_CODES = Object.keys(SEGMENT_MAP).map(Number);
const STEPPER_PATTERNS = [0xf1, 0xf3, 0xf2, 0xf6, 0xf4, 0xfc, 0xf8, 0xf9];

type Peripheral = 'led' | 'segment' | 'stepper' | 'buzzer';

function ledBitsFromState(state: SimulatorState | null): number[] {
  const value = state?.portValues?.P1 ?? 0xff;
  // 8051 LED 低电平点亮
  return Array.from({ length: 8 }, (_, index) => ((value >> (7 - index)) & 1) === 0 ? 1 : 0);
}

// 依据端口状态自动判断当前活跃外设，避免定时器/数码管类实验画布上"什么都没有"
function detectPeripheral(state: SimulatorState | null): Peripheral {
  if (!state) return 'led';
  const p0 = state.portValues?.P0 ?? 0xff;
  const p1 = state.portValues?.P1 ?? 0xff;
  const p2 = state.portValues?.P2 ?? 0xff;
  if (p0 !== 0xff && VALID_SEGMENT_CODES.includes(p0)) return 'segment';
  if (STEPPER_PATTERNS.includes(p1)) return 'stepper';
  if (p2 !== 0xff && p2 !== 0x00) return 'buzzer';
  return 'led';
}

const PERIPHERAL_LABEL: Record<Peripheral, string> = {
  led: 'P1 · LED 阵列',
  segment: 'P0 · 数码管',
  stepper: 'P1 · 步进电机',
  buzzer: 'P2 · 蜂鸣器',
};

// ─────────────────────────── LED 板：真实实验图 ───────────────────────────
function RealisticBoard({ bits }: { bits: number[] }) {
  return (
    <svg viewBox="0 0 620 420" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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

// ─────────────────────────── LED 板：准确接线图 ───────────────────────────
function SchematicBoard({ bits }: { bits: number[] }) {
  return (
    <svg viewBox="0 0 620 420" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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

// ─────────────────────────── 数码管（深色霓虹）───────────────────────────
// 段顺序：a b c d e f g（bit0..bit6）
const SEG_PATHS: Record<string, string> = {
  a: 'M18 10 L62 10 L54 18 L26 18 Z',
  b: 'M64 12 L70 18 L70 46 L62 52 L58 46 L58 20 Z',
  c: 'M64 56 L70 62 L70 90 L64 96 L58 90 L58 62 Z',
  d: 'M26 90 L54 90 L62 98 L18 98 Z',
  e: 'M16 56 L22 62 L22 90 L16 96 L10 90 L10 62 Z',
  f: 'M16 12 L22 20 L22 46 L16 52 L10 46 L10 18 Z',
  g: 'M18 54 L26 48 L54 48 L62 54 L54 60 L26 60 Z',
};
const DIGIT_SEGMENTS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'], '1': ['b', 'c'], '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'], '4': ['f', 'g', 'b', 'c'], '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'd', 'c'], '7': ['a', 'b', 'c'], '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'], 'A': ['a', 'b', 'c', 'e', 'f', 'g'], 'b': ['f', 'g', 'e', 'c', 'd'],
  'C': ['a', 'f', 'e', 'd'], 'd': ['b', 'c', 'd', 'e', 'g'], 'E': ['a', 'f', 'g', 'e', 'd'], 'F': ['a', 'f', 'g', 'e'],
};

function SegmentDisplay({ digit }: { digit: string }) {
  const lit = new Set(DIGIT_SEGMENTS[digit] ?? []);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-white/[0.08] bg-[#05080a] p-6 shadow-[inset_0_2px_18px_rgba(0,0,0,0.6)]">
        <svg viewBox="0 0 80 108" className="h-40 w-28" aria-hidden="true">
          {Object.entries(SEG_PATHS).map(([seg, d]) => (
            <path
              key={seg}
              d={d}
              fill={lit.has(seg) ? '#ff4d4d' : '#2a1414'}
              style={lit.has(seg) ? { filter: 'drop-shadow(0 0 6px #ff4d4d)' } : undefined}
            />
          ))}
        </svg>
      </div>
      <span className="font-mono text-[11px] text-slate-400">字符 “{digit === ' ' ? '空' : digit}” · P0</span>
    </div>
  );
}

// ─────────────────────────── 步进电机（四相）───────────────────────────
function StepperDisplay({ p1 }: { p1: number }) {
  // 高 4 位驱动 A/B/C/D 相，低电平有效
  const phases = ['A', 'B', 'C', 'D'].map((name, i) => ({ name, active: ((p1 >> (7 - i)) & 1) === 0 }));
  const activeIdx = phases.findIndex(p => p.active);
  const angle = activeIdx >= 0 ? activeIdx * 90 : 0;
  const pos = [{ x: 90, y: 24 }, { x: 156, y: 90 }, { x: 90, y: 156 }, { x: 24, y: 90 }];
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 180 180" className="h-44 w-44" aria-hidden="true">
        <circle cx="90" cy="90" r="70" fill="none" stroke="#1e2b30" strokeWidth="2" />
        {phases.map((p, i) => (
          <g key={p.name}>
            <circle cx={pos[i].x} cy={pos[i].y} r="16" fill={p.active ? '#22d3ee' : '#12242a'} stroke={p.active ? '#67e8f9' : '#28414a'} strokeWidth="2" style={p.active ? { filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.6))' } : undefined} />
            <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" fill={p.active ? '#001014' : '#5a7278'} fontFamily="monospace" fontSize="13" fontWeight="700">{p.name}</text>
          </g>
        ))}
        <g transform={`rotate(${angle} 90 90)`} style={{ transition: 'transform 0.15s ease-out' }}>
          <line x1="90" y1="90" x2="90" y2="40" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
          <circle cx="90" cy="90" r="7" fill="#22d3ee" />
        </g>
      </svg>
      <span className="font-mono text-[11px] text-slate-400">当前相：{activeIdx >= 0 ? `${phases[activeIdx].name} 相` : '—'} · P1[7:4]</span>
    </div>
  );
}

// ─────────────────────────── 蜂鸣器 ───────────────────────────
function BuzzerDisplay({ p2, active }: { p2: number; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={cn(
        'flex h-28 w-28 items-center justify-center rounded-full border-4 transition-all',
        active
          ? 'animate-pulse border-amber-400 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,0.4)]'
          : 'border-[#28414a] bg-[#0e1a1e]',
      )}>
        <span className={cn('text-4xl', active ? 'text-amber-300' : 'text-slate-600')}>{active ? '♪' : '○'}</span>
      </div>
      <span className="font-mono text-[11px] text-slate-400">
        {active ? `发声中 · P2 = 0x${p2.toString(16).toUpperCase().padStart(2, '0')}` : '静音'}
      </span>
    </div>
  );
}

// ─────────────────────────── 逻辑分析仪波形条 ───────────────────────────
const PORT_NAMES = ['P0', 'P1', 'P2', 'P3'] as const;

function formatLaneLabel(pins: { port: number; bit: number }[]): string {
  // 同端口的连续 8 位 → 紧凑写成 Pn[7:0]
  const byPort = new Map<number, number[]>();
  for (const p of pins) { (byPort.get(p.port) ?? byPort.set(p.port, []).get(p.port)!).push(p.bit); }
  const parts: string[] = [];
  for (const [port, bits] of byPort) {
    const sorted = [...bits].sort((a, b) => a - b);
    if (sorted.length === 8) parts.push(`${PORT_NAMES[port]}[7:0]`);
    else parts.push(`${PORT_NAMES[port]}.${sorted.join('/')}`);
  }
  return parts.join(' ');
}

// history: 每个样本为 [P0,P1,P2,P3]，扫描全部端口所有位，取发生过跳变的引脚
function WaveStrip({ history }: { history: number[][] }) {
  const lanes = useMemo(() => {
    if (history.length < 2) return [];
    const active: { port: number; bit: number }[] = [];
    for (let port = 0; port < 4; port++) {
      for (let bit = 0; bit < 8; bit++) {
        let seen0 = false, seen1 = false;
        for (const sample of history) { if ((sample[port] >> bit) & 1) seen1 = true; else seen0 = true; }
        if (seen0 && seen1) active.push({ port, bit });
      }
    }
    // 无任何跳变时，默认展示 P1.0 电平（保持一条基线）
    const target = active.length ? active : [{ port: 1, bit: 0 }];
    // 波形完全相同的引脚合并为一条（如闪烁时 P1 八位同步）
    const byWave = new Map<string, { port: number; bit: number }[]>();
    for (const pin of target) {
      const key = history.map(s => (s[pin.port] >> pin.bit) & 1).join('');
      const arr = byWave.get(key);
      if (arr) arr.push(pin); else byWave.set(key, [pin]);
    }
    return Array.from(byWave.entries()).slice(0, 4).map(([wave, pins]) => ({ wave, label: formatLaneLabel(pins) }));
  }, [history]);

  const W = 300, laneH = 26, pad = 4;
  return (
    <div className="border-t border-white/[0.08] bg-[#0a0f12] px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-cyan-300" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">逻辑分析仪 · 端口时序</span>
      </div>
      {lanes.length === 0 ? (
        <div className="py-3 text-center text-[11px] text-slate-600">运行程序后显示引脚电平波形</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${lanes.length * laneH}`} className="w-full" style={{ height: lanes.length * laneH }} preserveAspectRatio="none">
          {lanes.map((lane, li) => {
            const y0 = li * laneH + pad;
            const hi = y0 + 2, lo = y0 + laneH - pad - 6;
            const n = lane.wave.length;
            const step = W / Math.max(n - 1, 1);
            let d = '';
            for (let i = 0; i < n; i++) {
              const x = i * step;
              const y = lane.wave[i] === '1' ? hi : lo;
              if (i === 0) d += `M ${x} ${y}`;
              else d += ` L ${x} ${lane.wave[i - 1] === '1' ? hi : lo} L ${x} ${y}`;
            }
            return (
              <g key={li}>
                <text x="2" y={y0 + 11} fill="#5a7278" fontFamily="monospace" fontSize="9">{lane.label}</text>
                <path d={d} fill="none" stroke="#22d3ee" strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.5))' }} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────── 主组件 ───────────────────────────
export function HyperExperimentCanvas({ simulatorState, isRunning = false }: { simulatorState: SimulatorState | null; isRunning?: boolean }) {
  const [mode, setMode] = useState<'schematic' | 'real'>('schematic');
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<number[][]>([]);

  const bits = useMemo(() => ledBitsFromState(simulatorState), [simulatorState]);
  const peripheral = useMemo(() => detectPeripheral(simulatorState), [simulatorState]);

  // 采样 P0–P3 全部端口电平，驱动逻辑分析仪波形（每帧一个样本，保留最近 200 个）
  useEffect(() => {
    if (!simulatorState) { setHistory([]); return; }
    const pv = simulatorState.portValues;
    const sample = [pv?.P0 ?? 0xff, pv?.P1 ?? 0xff, pv?.P2 ?? 0xff, pv?.P3 ?? 0xff];
    setHistory(prev => {
      const next = prev.length >= 200 ? prev.slice(prev.length - 199) : prev.slice();
      next.push(sample);
      return next;
    });
  }, [simulatorState]);

  const p0 = simulatorState?.portValues?.P0 ?? 0xff;
  const p1 = simulatorState?.portValues?.P1 ?? 0xff;
  const p2 = simulatorState?.portValues?.P2 ?? 0xff;
  const isLed = peripheral === 'led';

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
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-1 text-[10px] font-medium text-cyan-200">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
              运行中
            </span>
          )}
          {isLed && (
            <div className="flex rounded-md border border-white/[0.1] bg-white/[0.04] p-0.5">
              {[
                ['real', Camera, '真实图'],
                ['schematic', Waypoints, '接线图'],
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
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {isLed ? (
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
          >
            <div className={cn('absolute inset-0 transition-opacity duration-300', mode === 'real' ? 'opacity-100' : 'opacity-0')}>
              <RealisticBoard bits={bits} />
            </div>
            <div className={cn('absolute inset-0 transition-opacity duration-300', mode === 'schematic' ? 'opacity-100' : 'opacity-0')}>
              <SchematicBoard bits={bits} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}>
            {peripheral === 'segment' && <SegmentDisplay digit={SEGMENT_MAP[p0] ?? ' '} />}
            {peripheral === 'stepper' && <StepperDisplay p1={p1} />}
            {peripheral === 'buzzer' && <BuzzerDisplay p2={p2} active={p2 !== 0xff && p2 !== 0x00} />}
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[11px] text-cyan-100">
            <Cpu className="mr-1 inline h-3 w-3" />
            {PERIPHERAL_LABEL[peripheral]}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1">
          <button
            onClick={() => setZoom(z => Math.min(2, +(z + 0.2).toFixed(2)))}
            title="放大"
            className="rounded-md border border-white/[0.08] bg-black/45 p-2 text-slate-300 hover:text-slate-100"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(2)))}
            title="缩小"
            className="rounded-md border border-white/[0.08] bg-black/45 p-2 text-slate-300 hover:text-slate-100"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            title="重置视图"
            className="rounded-md border border-white/[0.08] bg-black/45 p-2 text-slate-300 hover:text-slate-100"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <WaveStrip history={history} />
    </section>
  );
}
