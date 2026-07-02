'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, Camera, Car, Cpu, Keyboard,
  Lightbulb, Maximize2, Radio, TerminalSquare, Thermometer, Waypoints, Zap,
  ZoomIn, ZoomOut, type LucideIcon,
} from 'lucide-react';
import type { SimulatorState } from '@/lib/simulator';
import {
  getExperimentConfig,
  type BitMapEntry, type KeyMapEntry, type PeripheralConfig, type PortName,
} from '@/lib/experiment-config';
import { cn } from '@/lib/utils';

// ── 共阴数码管段码 → 字符 ──
const SEGMENT_MAP: Record<number, string> = {
  0x3f: '0', 0x06: '1', 0x5b: '2', 0x4f: '3', 0x66: '4', 0x6d: '5', 0x7d: '6',
  0x07: '7', 0x7f: '8', 0x6f: '9', 0x77: 'A', 0x7c: 'b', 0x39: 'C', 0x5e: 'd',
  0x79: 'E', 0x71: 'F',
};
const VALID_SEGMENT_CODES = Object.keys(SEGMENT_MAP).map(Number);
const STEPPER_PATTERNS = [0xf1, 0xf3, 0xf2, 0xf6, 0xf4, 0xfc, 0xf8, 0xf9];

type Peripheral = 'led' | 'segment' | 'stepper' | 'buzzer' | 'serial' | 'keys' | 'bitpanel';

function portValue(state: SimulatorState | null, port: PortName): number {
  return state?.portValues?.[port] ?? 0xff;
}

function ledBitsFromState(state: SimulatorState | null, port: PortName): number[] {
  const value = portValue(state, port);
  // 8051 LED 低电平点亮
  return Array.from({ length: 8 }, (_, index) => ((value >> (7 - index)) & 1) === 0 ? 1 : 0);
}

// 无实验声明时的回落逻辑：依据端口值启发式猜测活跃外设（自定义代码场景）
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
  serial: 'P3 · 串口终端',
  keys: 'P3 · 按键输入',
  bitpanel: '端口状态面板',
};

// BitPanel 图标名 → lucide 组件
const BIT_ICONS: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  zap: Zap,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  radio: Radio,
  alert: AlertTriangle,
  thermometer: Thermometer,
  car: Car,
};

// ─────────────────────────── LED 板：真实实验图 ───────────────────────────
function RealisticBoard({ bits, portName }: { bits: number[]; portName: PortName }) {
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
        <text x="84" y="45" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="8">DIP-40 · {portName} LED BUS</text>
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
function SchematicBoard({ bits, portName }: { bits: number[]; portName: PortName }) {
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
            <text x="25" y="25" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="9">{portName}.{7 - index}</text>
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

// ─────────────────────────── 数码管段形（共用） ───────────────────────────
// 段顺序：a b c d e f g（bit0..bit6），与实验代码里的共阴段码表一致（置1亮）
const SEG_PATHS: Record<string, string> = {
  a: 'M18 10 L62 10 L54 18 L26 18 Z',
  b: 'M64 12 L70 18 L70 46 L62 52 L58 46 L58 20 Z',
  c: 'M64 56 L70 62 L70 90 L64 96 L58 90 L58 62 Z',
  d: 'M26 90 L54 90 L62 98 L18 98 Z',
  e: 'M16 56 L22 62 L22 90 L16 96 L10 90 L10 62 Z',
  f: 'M16 12 L22 20 L22 46 L16 52 L10 46 L10 18 Z',
  g: 'M18 54 L26 48 L54 48 L62 54 L54 60 L26 60 Z',
};
const SEG_KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/** 单个数码管位：直接按段码字节逐段点亮（共阴：置1亮），青色发光贴合深色主题 */
function SegDigit({ value, scanning, name }: { value: number | null; scanning: boolean; name?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn(
        'rounded-lg border bg-[#05080a] p-2 shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)] transition-colors',
        scanning ? 'border-cyan-300/40' : 'border-white/[0.08]',
      )}>
        <svg viewBox="0 0 80 108" className="h-[5.5rem] w-16" aria-hidden="true">
          {SEG_KEYS.map((seg, i) => {
            const lit = value != null && ((value >> i) & 1) === 1;
            return (
              <path
                key={seg}
                d={SEG_PATHS[seg]}
                fill={lit ? '#22d3ee' : '#10222a'}
                style={lit ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.85))' } : undefined}
              />
            );
          })}
        </svg>
      </div>
      {/* 扫描位指示：当前被位选选通的位点亮 */}
      <span className={cn(
        'h-1 w-6 rounded-full transition-colors',
        scanning ? 'bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-[#1c2b31]',
      )} />
      {name && <span className="font-mono text-[9px] text-slate-500">{name}</span>}
    </div>
  );
}

/**
 * 多位共阴数码管（动态扫描）。段码来自段码口、位选低电平选通；某位被选通瞬间
 * 锁存当时的段码字节（模拟人眼视觉暂留），全部数据取自真实端口值。
 */
function MultiSegmentDisplay({ segValue, selValue, cfg, active }: {
  segValue: number;
  selValue: number;
  cfg: NonNullable<PeripheralConfig['segment']>;
  active: boolean;
}) {
  const [latched, setLatched] = useState<(number | null)[]>(() => cfg.digitBits.map(() => null));
  const scanning = cfg.digitBits.map(bit => ((selValue >> bit) & 1) === 0);

  useEffect(() => {
    if (!active) {
      setLatched(cfg.digitBits.map(() => null));
      return;
    }
    setLatched(prev => {
      let changed = false;
      const next = prev.slice();
      cfg.digitBits.forEach((bit, i) => {
        if (((selValue >> bit) & 1) === 0 && next[i] !== segValue) {
          next[i] = segValue;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segValue, selValue, active]);

  const readout = latched.map(v => (v == null ? '·' : SEGMENT_MAP[v] ?? '?')).join(' ');

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 rounded-xl border border-white/[0.08] bg-[#070b0d] p-4">
        {cfg.digitBits.map((bit, i) => (
          <SegDigit key={bit} value={latched[i]} scanning={scanning[i]} name={cfg.digitNames?.[i]} />
        ))}
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
        <span>读数：<span className="text-cyan-200">{readout}</span></span>
        <span className="text-slate-600">|</span>
        <span>{cfg.segPort} 段码 0x{segValue.toString(16).toUpperCase().padStart(2, '0')}</span>
        <span>{cfg.digitPort} 位选 0x{selValue.toString(16).toUpperCase().padStart(2, '0')}</span>
      </div>
      {!active && <span className="text-[11px] text-slate-600">运行程序后按扫描位逐位点亮</span>}
    </div>
  );
}

// ─────────────────────────── 步进电机（四相） ───────────────────────────
// 相序表低4位（A/B/C/D=bit0..bit3，置1为该相通电），与实验代码 STEP_TAB_CW/CCW 一致
const STEP_PHASE_CW = [0x1, 0x3, 0x2, 0x6, 0x4, 0xc, 0x8, 0x9];
const STEP_PHASE_CCW = [0x9, 0x8, 0xc, 0x4, 0x6, 0x2, 0x3, 0x1];

/**
 * 配置驱动的步进电机视图：转子/方向/运行取程序自身变量（20H 步序、21H.0 方向、
 * 22H.0 运行，地址在实验配置中声明并与代码注释一致），相当于调试器 Watch，
 * 相位灯按代码相序表由步序还原（即中断服务程序 MOVC 查到的同一字节）。
 */
function StepperRig({ state, cfg }: {
  state: SimulatorState | null;
  cfg: NonNullable<PeripheralConfig['stepper']>;
}) {
  const ram = state?.ram;
  const step = (ram?.[cfg.stepAddr] ?? 0) & 0x07;
  const cw = ((ram?.[cfg.dirAddr] ?? 1) & 1) === 1;
  const running = ((ram?.[cfg.runAddr] ?? 0) & 1) === 1;
  const pattern = running ? (cw ? STEP_PHASE_CW : STEP_PHASE_CCW)[step] : 0;
  const phases = ['A', 'B', 'C', 'D'].map((name, i) => ({ name, active: ((pattern >> i) & 1) === 1 }));
  // 八拍 = 每拍 45°
  const angle = step * 45;
  const pos = [{ x: 90, y: 24 }, { x: 156, y: 90 }, { x: 90, y: 156 }, { x: 24, y: 90 }];
  const p1 = portValue(state, 'P1');

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 180 180" className="h-44 w-44" aria-hidden="true">
        <circle cx="90" cy="90" r="70" fill="none" stroke="#1e2b30" strokeWidth="2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={i}
            x1={90 + 64 * Math.sin(i * Math.PI / 4)} y1={90 - 64 * Math.cos(i * Math.PI / 4)}
            x2={90 + 70 * Math.sin(i * Math.PI / 4)} y2={90 - 70 * Math.cos(i * Math.PI / 4)}
            stroke={i === step && running ? '#22d3ee' : '#28414a'} strokeWidth="2"
          />
        ))}
        {phases.map((p, i) => (
          <g key={p.name}>
            <circle cx={pos[i].x} cy={pos[i].y} r="16" fill={p.active ? '#22d3ee' : '#12242a'} stroke={p.active ? '#67e8f9' : '#28414a'} strokeWidth="2" style={p.active ? { filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.6))' } : undefined} />
            <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" fill={p.active ? '#001014' : '#5a7278'} fontFamily="monospace" fontSize="13" fontWeight="700">{p.name}</text>
          </g>
        ))}
        <g transform={`rotate(${angle} 90 90)`} style={{ transition: 'transform 0.12s ease-out' }}>
          <line x1="90" y1="90" x2="90" y2="40" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
          <circle cx="90" cy="90" r="7" fill="#22d3ee" />
        </g>
      </svg>
      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
        <span className={cn(
          'rounded px-1.5 py-0.5',
          running ? 'bg-cyan-300/15 text-cyan-200' : 'bg-white/[0.05] text-slate-500',
        )}>
          {running ? (cw ? '顺时针' : '逆时针') : '停止'}
        </span>
        <span>步序 {step}</span>
        <span>P1 = 0x{p1.toString(16).toUpperCase().padStart(2, '0')}</span>
      </div>
    </div>
  );
}

/** 回落版步进电机（无实验声明的自定义代码）：沿用 P1 高4位低电平有效的旧判据 */
function StepperFallback({ p1 }: { p1: number }) {
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
/**
 * 蜂鸣器视图：频率是仿真器按引脚翻转间隔推算的真值；发声时声波弧线的
 * 动画速度/幅度随该真实频率缩放（频率越高波纹越快越密）。
 */
function BuzzerDisplay({ buzzer, pinLabel }: {
  buzzer: SimulatorState['buzzer'] | undefined;
  pinLabel: string;
}) {
  const active = buzzer?.active ?? false;
  const frequency = buzzer?.frequency ?? 0;
  // 动画周期与真实频率档位挂钩（400Hz→1s，2kHz→0.2s）
  const dur = active && frequency > 0 ? Math.min(1.2, Math.max(0.18, 400 / frequency)) : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{'@keyframes hyperBuzzArc{0%{opacity:.85;transform:scale(.9)}100%{opacity:0;transform:scale(1.18)}}'}</style>
      <div className="relative flex items-center justify-center">
        <div className={cn(
          'flex h-28 w-28 items-center justify-center rounded-full border-4 transition-all',
          active
            ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,0.4)]'
            : 'border-[#28414a] bg-[#0e1a1e]',
        )}>
          <span className={cn('text-4xl', active ? 'text-amber-300' : 'text-slate-600')}>{active ? '♪' : '○'}</span>
        </div>
        {active && [0, 1, 2].map(i => (
          <span
            key={i}
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-300/50"
            style={{
              animation: `hyperBuzzArc ${(dur * (1 + i * 0.35)).toFixed(2)}s ease-out infinite`,
              animationDelay: `${(i * dur * 0.3).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className={cn('font-mono text-lg font-semibold', active ? 'text-amber-300' : 'text-slate-600')}>
          {active ? `${frequency} Hz` : '静音'}
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          {pinLabel} 方波驱动{active ? ' · 发声中' : ''}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────── 交互按键条（真实端口位） ───────────────────────────
/**
 * 按键映射到真实端口位：普通键按下拉低、松开回高；momentary 键单击产生
 * 固定模型时长的低电平脉冲（短于代码消抖延时，单击只触发一次）。
 * 回调缺失时退化为只读电平显示。
 */
function KeyStrip({ keys, state, onSetPortBit, onPulsePortBit }: {
  keys: KeyMapEntry[];
  state: SimulatorState | null;
  onSetPortBit?: (port: PortName, bit: number, level: boolean) => void;
  onPulsePortBit?: (port: PortName, bit: number) => void;
}) {
  const interactive = !!onSetPortBit;
  const hasMomentary = keys.some(k => k.momentary);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-2">
        {keys.map(k => {
          const pressed = ((portValue(state, k.port) >> k.bit) & 1) === 0;
          const momentary = !!k.momentary && !!onPulsePortBit;
          return (
            <button
              key={`${k.port}.${k.bit}`}
              type="button"
              disabled={!interactive}
              onClick={momentary ? () => onPulsePortBit?.(k.port, k.bit) : undefined}
              onPointerDown={momentary ? undefined : () => onSetPortBit?.(k.port, k.bit, false)}
              onPointerUp={momentary ? undefined : () => onSetPortBit?.(k.port, k.bit, true)}
              onPointerLeave={momentary ? undefined : () => { if (pressed) onSetPortBit?.(k.port, k.bit, true); }}
              onPointerCancel={momentary ? undefined : () => onSetPortBit?.(k.port, k.bit, true)}
              className={cn(
                'flex min-w-[52px] select-none flex-col items-center gap-0.5 rounded-lg border px-2.5 py-2 transition-all',
                pressed
                  ? 'translate-y-[1px] border-cyan-300/50 bg-cyan-300/15 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                  : 'border-white/[0.1] bg-white/[0.04]',
                interactive ? 'cursor-pointer hover:border-cyan-300/30' : 'cursor-default',
              )}
            >
              <span className={cn('text-[12px] font-semibold', pressed ? 'text-cyan-200' : 'text-slate-300')}>{k.label}</span>
              <span className="font-mono text-[9px] text-slate-500">{k.port}.{k.bit}={pressed ? 0 : 1}</span>
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-slate-500">
        {!interactive
          ? '按键电平随程序运行呈现'
          : hasMomentary
            ? '单击 = 一次按键脉冲（运行中程序即时读到）'
            : '按住 = 拉低电平（运行中程序即时读到）'}
      </span>
    </div>
  );
}

// ─────────────────────────── 按键面板（exp05） ───────────────────────────
function KeysPanel({ state, cfg, onSetPortBit, onPulsePortBit }: {
  state: SimulatorState | null;
  cfg: PeripheralConfig;
  onSetPortBit?: (port: PortName, bit: number, level: boolean) => void;
  onPulsePortBit?: (port: PortName, bit: number) => void;
}) {
  const keyPort = cfg.keyValuePort;
  const keyVal = keyPort ? portValue(state, keyPort) : null;
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <Keyboard className="h-3.5 w-3.5 text-cyan-300" />
        矩阵键盘 · 列线电平
      </div>
      {cfg.keys && <KeyStrip keys={cfg.keys} state={state} onSetPortBit={onSetPortBit} onPulsePortBit={onPulsePortBit} />}
      {keyPort && keyVal != null && (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#070b0d] px-4 py-3">
          <span className="text-[10px] text-slate-500">键值输出 {keyPort}（键值 = 行×4 + 列）</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-semibold text-cyan-200">
              0x{keyVal.toString(16).toUpperCase().padStart(2, '0')}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 8 }, (_, i) => 7 - i).map(bit => (
                <span
                  key={bit}
                  title={`${keyPort}.${bit}`}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    ((keyVal >> bit) & 1) === 1
                      ? 'bg-cyan-300 shadow-[0_0_5px_rgba(34,211,238,0.7)]'
                      : 'bg-[#1c2b31]',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── 串口终端（exp09） ───────────────────────────
/** 渲染 uart.transmitBuffer 真实发送内容；光标闪烁为 CSS 动画（不含数据伪造） */
function SerialTerminal({ uart }: { uart: SimulatorState['uart'] | undefined }) {
  const buffer = uart?.transmitBuffer ?? '';
  const scon = uart?.SCON ?? 0;
  const mode = (scon >> 6) & 0x03;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [buffer]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-white/[0.1] bg-[#04080a] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#0b1216] px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#2f4348]" />
          <span className="h-2 w-2 rounded-full bg-[#2f4348]" />
          <span className="h-2 w-2 rounded-full bg-[#2f4348]" />
          <span className="ml-1 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <TerminalSquare className="h-3 w-3 text-cyan-300" />
            UART 监视器 · TXD (P3.1)
          </span>
        </div>
        <div ref={bodyRef} className="h-40 overflow-y-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[12px] leading-5 text-cyan-200">
          {buffer.length === 0
            ? <span className="text-slate-600">等待程序发送数据…</span>
            : buffer}
          <span className="animate-pulse text-cyan-300">▊</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          {uart?.baudRate ?? 9600} bps
        </span>
        <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          SCON 0x{scon.toString(16).toUpperCase().padStart(2, '0')} · 模式{mode}
        </span>
        <span className={cn(
          'rounded border px-1.5 py-0.5 font-mono text-[10px]',
          uart?.TI ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200' : 'border-white/[0.1] bg-white/[0.04] text-slate-500',
        )}>
          TI={uart?.TI ? 1 : 0}
        </span>
        <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
          已发送 {buffer.length} 字节
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────── 位状态面板（proj02/03/04） ───────────────────────────
/** 通用位面板：每一项都来自实验配置里与代码注释核对过的端口位声明 */
function BitPanel({ state, cfg }: { state: SimulatorState | null; cfg: PeripheralConfig }) {
  const entries = cfg.bitMap ?? [];
  const isOn = (e: BitMapEntry) => {
    const level = (portValue(state, e.port) >> e.bit) & 1;
    return e.activeLow ? level === 0 : level === 1;
  };

  // 小车行驶状态：由 L298N 四路控制位按代码子程序的真值组合推导
  let motionText: string | null = null;
  if (cfg.motion) {
    const bitOf = (pb: [PortName, number]) => ((portValue(state, pb[0]) >> pb[1]) & 1);
    const key = `${bitOf(cfg.motion.lf)}${bitOf(cfg.motion.lr)}${bitOf(cfg.motion.rf)}${bitOf(cfg.motion.rr)}`;
    motionText = ({
      '1010': '前进', '0101': '后退', '0010': '左转', '1000': '右转', '0000': '停止',
    } as Record<string, string>)[key] ?? '组合输出';
  }

  // 串口上报尾巴（proj04 JSON），取真实发送缓冲最后两行
  const uartTail = cfg.showUartTail
    ? (state?.uart?.transmitBuffer ?? '').split(/\r?\n/).filter(Boolean).slice(-2)
    : [];

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      {motionText && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2',
          motionText === '停止'
            ? 'border-white/[0.08] bg-white/[0.03]'
            : 'border-cyan-300/30 bg-cyan-300/[0.08]',
        )}>
          <Car className={cn('h-5 w-5', motionText === '停止' ? 'text-slate-500' : 'text-cyan-300')} />
          <span className="text-[12px] text-slate-300">行驶状态（由 IN1~IN4 组合推导）</span>
          <span className={cn(
            'ml-auto font-mono text-sm font-semibold',
            motionText === '停止' ? 'text-slate-400' : 'text-cyan-200',
          )}>
            {motionText}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5">
        {entries.map(e => {
          const Icon = BIT_ICONS[e.icon] ?? Activity;
          const on = isOn(e);
          return (
            <div
              key={`${e.port}.${e.bit}`}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                on ? 'border-cyan-300/30 bg-cyan-300/[0.07]' : 'border-white/[0.07] bg-white/[0.02]',
              )}
            >
              <Icon
                className={cn('h-4.5 w-4.5 shrink-0', on ? 'text-cyan-300' : 'text-slate-600')}
                style={on ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))' } : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-slate-200">{e.label}</div>
                <div className="font-mono text-[10px] text-slate-500">
                  {e.port}.{e.bit}{e.activeLow ? ' · 低电平有效' : ''}
                </div>
              </div>
              <span className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px]',
                on ? 'bg-cyan-300/15 text-cyan-200' : 'bg-white/[0.05] text-slate-500',
              )}>
                {on ? e.onText ?? '有效' : e.offText ?? '无效'}
              </span>
            </div>
          );
        })}
      </div>

      {(cfg.buses ?? []).map(bus => {
        const val = portValue(state, bus.port);
        return (
          <div key={bus.port} className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <span className="text-[11px] text-slate-400">{bus.label}</span>
            <span className="ml-auto font-mono text-[11px] text-cyan-200">
              {bus.port} = 0x{val.toString(16).toUpperCase().padStart(2, '0')}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 8 }, (_, i) => 7 - i).map(bit => (
                <span
                  key={bit}
                  className={cn('h-2 w-2 rounded-sm', ((val >> bit) & 1) ? 'bg-cyan-300/80' : 'bg-[#1c2b31]')}
                />
              ))}
            </div>
          </div>
        );
      })}

      {cfg.showUartTail && (
        <div className="rounded-lg border border-white/[0.07] bg-[#04080a] px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-500">
            <TerminalSquare className="h-3 w-3 text-cyan-300" />
            串口上报（TXD 实发数据）
          </div>
          {uartTail.length === 0
            ? <div className="font-mono text-[11px] text-slate-600">等待程序发送数据…</div>
            : uartTail.map((line, i) => (
              <div key={i} className="break-all font-mono text-[11px] leading-4 text-cyan-200">{line}</div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── 单个数码管（回落，自定义代码） ───────────────────────────
const DIGIT_SEGMENTS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'], '1': ['b', 'c'], '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'], '4': ['f', 'g', 'b', 'c'], '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'd', 'c'], '7': ['a', 'b', 'c'], '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'], 'A': ['a', 'b', 'c', 'e', 'f', 'g'], 'b': ['f', 'g', 'e', 'c', 'd'],
  'C': ['a', 'f', 'e', 'd'], 'd': ['b', 'c', 'd', 'e', 'g'], 'E': ['a', 'f', 'g', 'e', 'd'], 'F': ['a', 'f', 'g', 'e'],
};

function SegmentFallback({ digit }: { digit: string }) {
  const lit = new Set(DIGIT_SEGMENTS[digit] ?? []);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-white/[0.08] bg-[#05080a] p-6 shadow-[inset_0_2px_18px_rgba(0,0,0,0.6)]">
        <svg viewBox="0 0 80 108" className="h-40 w-28" aria-hidden="true">
          {Object.entries(SEG_PATHS).map(([seg, d]) => (
            <path
              key={seg}
              d={d}
              fill={lit.has(seg) ? '#22d3ee' : '#10222a'}
              style={lit.has(seg) ? { filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.85))' } : undefined}
            />
          ))}
        </svg>
      </div>
      <span className="font-mono text-[11px] text-slate-400">字符 “{digit === ' ' ? '空' : digit}” · P0</span>
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
export function HyperExperimentCanvas({ simulatorState, isRunning = false, experimentId = null, onSetPortBit, onPulsePortBit }: {
  simulatorState: SimulatorState | null;
  isRunning?: boolean;
  /** 当前加载的实验 ID：优先使用其 peripheral 声明，缺省回落端口启发式 */
  experimentId?: string | null;
  /** 交互按键回调（写端口位锁存）；缺省时按键面板退化为只读显示 */
  onSetPortBit?: (port: PortName, bit: number, level: boolean) => void;
  /** 瞬时按键回调（固定模型时长的低电平脉冲） */
  onPulsePortBit?: (port: PortName, bit: number) => void;
}) {
  const [mode, setMode] = useState<'schematic' | 'real'>('schematic');
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<number[][]>([]);

  // 实验声明的外设配置（缺省 undefined → 启发式回落）
  const peripheralCfg = useMemo<PeripheralConfig | undefined>(
    () => (experimentId ? getExperimentConfig(experimentId)?.peripheral : undefined),
    [experimentId],
  );
  const peripheral: Peripheral = peripheralCfg?.kind ?? detectPeripheral(simulatorState);
  const bottomLabel = peripheralCfg?.label ?? PERIPHERAL_LABEL[peripheral];

  const ledPort: PortName = peripheralCfg?.ledPort ?? 'P1';
  const bits = useMemo(() => ledBitsFromState(simulatorState, ledPort), [simulatorState, ledPort]);

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

  const p0 = portValue(simulatorState, 'P0');
  const p1 = portValue(simulatorState, 'P1');
  const p2 = portValue(simulatorState, 'P2');
  const isLed = peripheral === 'led';

  // 非 LED 视图主体
  const renderPeripheral = () => {
    switch (peripheral) {
      case 'segment':
        if (peripheralCfg?.segment) {
          return (
            <MultiSegmentDisplay
              key={experimentId ?? 'segment'}
              segValue={portValue(simulatorState, peripheralCfg.segment.segPort)}
              selValue={portValue(simulatorState, peripheralCfg.segment.digitPort)}
              cfg={peripheralCfg.segment}
              active={!!simulatorState}
            />
          );
        }
        return <SegmentFallback digit={SEGMENT_MAP[p0] ?? ' '} />;
      case 'stepper':
        if (peripheralCfg?.stepper) {
          return <StepperRig state={simulatorState} cfg={peripheralCfg.stepper} />;
        }
        return <StepperFallback p1={p1} />;
      case 'buzzer':
        return (
          <BuzzerDisplay
            buzzer={simulatorState?.buzzer}
            pinLabel={peripheralCfg?.buzzerPin ?? `P2 = 0x${p2.toString(16).toUpperCase().padStart(2, '0')}`}
          />
        );
      case 'serial':
        return <SerialTerminal uart={simulatorState?.uart} />;
      case 'keys':
        return peripheralCfg
          ? <KeysPanel state={simulatorState} cfg={peripheralCfg} onSetPortBit={onSetPortBit} onPulsePortBit={onPulsePortBit} />
          : null;
      case 'bitpanel':
        return peripheralCfg
          ? <BitPanel state={simulatorState} cfg={peripheralCfg} />
          : null;
      default:
        return null;
    }
  };

  // 部分实验附带控制按键（exp06 时钟设置、exp08 电机启停等），叠加在主体视图下方
  const extraKeys = !isLed && peripheral !== 'keys' && peripheralCfg?.keys?.length
    ? <KeyStrip keys={peripheralCfg.keys} state={simulatorState} onSetPortBit={onSetPortBit} onPulsePortBit={onPulsePortBit} />
    : null;

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
              <RealisticBoard bits={bits} portName={ledPort} />
            </div>
            <div className={cn('absolute inset-0 transition-opacity duration-300', mode === 'schematic' ? 'opacity-100' : 'opacity-0')}>
              <SchematicBoard bits={bits} portName={ledPort} />
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-4 pb-12"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
          >
            {renderPeripheral()}
            {extraKeys}
          </div>
        )}

        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[11px] text-cyan-100">
            <Cpu className="mr-1 inline h-3 w-3" />
            {bottomLabel}
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
