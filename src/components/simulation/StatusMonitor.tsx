'use client';

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type SimulatorState } from '@/lib/simulator';

interface StatusMonitorProps {
  simulatorState: SimulatorState | null;
  previousState?: SimulatorState | null;
  result: any;
  currentLine: number;
  isRunning: boolean;
  className?: string;
}

/* ── Compact register cell ── */
function RegCell({ name, value, changed, compact, oldValue }: {
  name: string; value: string; changed?: boolean; compact?: boolean; oldValue?: string;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-md transition-all duration-300",
      compact ? "px-2 py-1" : "px-2.5 py-1.5",
      changed
        ? "bg-gradient-to-r from-amber-500/15 to-transparent ring-1 ring-amber-500/25 animate-[pulse_0.6s_ease-in-out_1]"
        : "hover:bg-[#313244]/50"
    )}>
      <span className={cn(
        "text-[10px] font-semibold uppercase tracking-wider",
        changed ? "text-amber-400" : "text-[#6c7086]"
      )}>
        {name}
      </span>
      {changed && oldValue ? (
        <span className="font-mono text-xs tabular-nums">
          <span className="text-[#585b70]">{oldValue}</span>
          <span className="text-[#6c7086] mx-0.5">{'\u2192'}</span>
          <span className="text-amber-300 font-bold">{value}</span>
        </span>
      ) : (
        <span className={cn(
          "font-mono text-xs tabular-nums",
          changed ? "text-amber-300 font-bold" : "text-[#cdd6f4]"
        )}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ── PSW flags ── */
type PSWType = { CY: boolean; AC: boolean; F0: boolean; RS1: boolean; RS0: boolean; OV: boolean; P: boolean };

function pswToNumber(psw?: PSWType): number {
  if (!psw) return 0;
  return (
    (psw.CY ? 0x80 : 0) | (psw.AC ? 0x40 : 0) | (psw.F0 ? 0x20 : 0) |
    (psw.RS1 ? 0x10 : 0) | (psw.RS0 ? 0x08 : 0) | (psw.OV ? 0x04 : 0) | (psw.P ? 0x01 : 0)
  );
}

function PSWFlags({ psw, prevPsw }: { psw?: PSWType; prevPsw?: PSWType }) {
  const flags: { name: string; key: keyof PSWType; bit: string }[] = [
    { name: 'CY', key: 'CY', bit: 'D7' },
    { name: 'AC', key: 'AC', bit: 'D6' },
    { name: 'F0', key: 'F0', bit: 'D5' },
    { name: 'RS1', key: 'RS1', bit: 'D4' },
    { name: 'RS0', key: 'RS0', bit: 'D3' },
    { name: 'OV', key: 'OV', bit: 'D2' },
    { name: '-', key: 'P', bit: 'D1' },
    { name: 'P', key: 'P', bit: 'D0' },
  ];
  return (
    <div className="grid grid-cols-8 gap-[3px]">
      {flags.map((f, i) => {
        const isSet = psw ? psw[f.key] : false;
        const wasSet = prevPsw ? prevPsw[f.key] : false;
        const changed = psw && prevPsw && isSet !== wasSet;
        return (
          <div key={i} className={cn(
            "flex flex-col items-center py-1.5 rounded-md transition-all duration-300 relative",
            isSet
              ? "bg-emerald-500/15 ring-1 ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
              : "bg-[#313244]/40",
            changed && "ring-2 ring-amber-400/50"
          )}>
            <span className={cn(
              "text-[9px] font-bold",
              isSet ? "text-emerald-400" : "text-[#585b70]"
            )}>{f.name}</span>
            <span className={cn(
              "font-mono text-sm font-black mt-0.5",
              isSet ? "text-emerald-300" : "text-[#45475a]"
            )}>{isSet ? 1 : 0}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── LED panel ── */
function LEDPanel({ value }: { value: number }) {
  return (
    <div className="bg-[#11111b] rounded-lg p-3 border border-[#313244]">
      <div className="flex items-center justify-center gap-3">
        {Array.from({ length: 8 }, (_, i) => {
          const bit = (value >> (7 - i)) & 1;
          const isOn = bit === 0; // Active low LEDs
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-4 h-4 rounded-full transition-all duration-300 border",
                isOn
                  ? "bg-red-500 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6),0_0_4px_rgba(239,68,68,0.8)]"
                  : "bg-[#313244] border-[#45475a]"
              )} />
              <span className="text-[8px] font-mono text-[#585b70]">D{7 - i}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Port bit bar ── */
function PortBar({ port, value, prevValue }: { port: string; value: number; prevValue?: number }) {
  const changed = prevValue !== undefined && prevValue !== value;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-[10px] font-bold transition-colors",
          changed ? "text-amber-400" : "text-[#a6adc8]"
        )}>{port}</span>
        <span className={cn(
          "font-mono text-[10px] px-1.5 py-0.5 rounded transition-all",
          changed ? "text-amber-300 bg-amber-500/10" : "text-[#89b4fa] bg-[#313244]"
        )}>
          {changed && prevValue !== undefined ? (
            <>
              <span className="text-[#585b70]">{prevValue.toString(16).toUpperCase().padStart(2, '0')}</span>
              <span className="text-[#6c7086] mx-0.5">{'\u2192'}</span>
              <span className="text-amber-300 font-semibold">{value.toString(16).toUpperCase().padStart(2, '0')}h</span>
            </>
          ) : (
            <>{value.toString(16).toUpperCase().padStart(2, '0')}h</>
          )}
        </span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: 8 }, (_, i) => {
          const bit = (value >> (7 - i)) & 1;
          const prevBit = prevValue !== undefined ? (prevValue >> (7 - i)) & 1 : bit;
          const bitChanged = bit !== prevBit;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-3 rounded-sm transition-all duration-200",
                bit
                  ? bitChanged ? "bg-amber-400/70" : "bg-emerald-500/60"
                  : "bg-[#313244]/60"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

const StatusMonitor: React.FC<StatusMonitorProps> = ({
  simulatorState,
  previousState,
  result,
  currentLine,
}) => {
  // Track previous state internally for change detection
  const prevRef = useRef<SimulatorState | null>(null);
  const prev = previousState ?? prevRef.current;

  useEffect(() => {
    if (simulatorState) {
      // Update prev after render so we compare current vs previous
      const timer = setTimeout(() => { prevRef.current = simulatorState; }, 600);
      return () => clearTimeout(timer);
    }
  }, [simulatorState]);

  if (!simulatorState && !result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6c7086] py-12">
        <div className="w-12 h-12 rounded-xl bg-[#313244]/50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#45475a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <p className="text-xs font-medium">等待程序执行</p>
        <p className="text-[10px] mt-1 text-[#45475a]">运行代码后查看寄存器状态</p>
      </div>
    );
  }

  const regs = simulatorState?.registers;
  const prevRegs = prev?.registers;
  const portValues = simulatorState?.portValues;
  const prevPortValues = prev?.portValues;
  const resultPorts = result?.portValues as Record<string, string> | undefined;

  const getPortValue = (port: string) => {
    if (resultPorts?.[port]) return parseInt((resultPorts[port] || '0xFF').replace('0x', ''), 16);
    if (portValues?.[port as keyof typeof portValues] !== undefined) return portValues[port as keyof typeof portValues];
    return 0xFF;
  };

  const getPrevPortValue = (port: string) => {
    if (prevPortValues?.[port as keyof typeof prevPortValues] !== undefined) return prevPortValues[port as keyof typeof prevPortValues];
    return undefined;
  };

  const p1Value = getPortValue('P1');
  const fmt = (v: number, pad = 2) => v.toString(16).toUpperCase().padStart(pad, '0');

  // Check which registers changed
  const regChanged = (name: string) => {
    if (!regs || !prevRegs) return false;
    return (regs as any)[name] !== (prevRegs as any)[name];
  };

  const pcChanged = prev && simulatorState && prev.pc !== simulatorState.pc;

  const getOldValue = (name: string, pad = 2): string | undefined => {
    if (!prevRegs || !regChanged(name)) return undefined;
    return `0x${fmt((prevRegs as any)[name] || 0, pad)}`;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Core Registers */}
        <section>
          <div className="text-[9px] font-bold text-[#6c7086] uppercase tracking-[0.15em] mb-1.5 px-1">
            核心寄存器
          </div>
          <div className="space-y-[2px] bg-[#181825] rounded-lg p-1 border border-[#313244]/50">
            <RegCell name="A" value={`0x${fmt(regs?.A || 0)}`} changed={regChanged('A')} oldValue={getOldValue('A')} />
            <RegCell name="B" value={`0x${fmt(regs?.B || 0)}`} changed={regChanged('B')} oldValue={getOldValue('B')} />
            <RegCell name="DPTR" value={`0x${fmt(((regs?.DPH || 0) << 8) | (regs?.DPL || 0), 4)}`} changed={regChanged('DPH') || regChanged('DPL')} oldValue={regChanged('DPH') || regChanged('DPL') ? `0x${fmt(((prevRegs?.DPH || 0) << 8) | (prevRegs?.DPL || 0), 4)}` : undefined} />
            <RegCell name="SP" value={`0x${fmt(regs?.SP || 7)}`} changed={regChanged('SP')} oldValue={getOldValue('SP')} />
            <RegCell name="PC" value={`0x${fmt(simulatorState?.pc || 0, 4)}`} changed={!!pcChanged} oldValue={pcChanged && prev ? `0x${fmt(prev.pc, 4)}` : undefined} />
          </div>
        </section>

        {/* R0-R7 */}
        <section>
          <div className="text-[9px] font-bold text-[#6c7086] uppercase tracking-[0.15em] mb-1.5 px-1">
            工作寄存器
          </div>
          <div className="grid grid-cols-4 gap-[2px] bg-[#181825] rounded-lg p-1 border border-[#313244]/50">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <RegCell
                key={i}
                name={`R${i}`}
                value={fmt((regs as any)?.[`R${i}`] || 0)}
                changed={regChanged(`R${i}`)}
                oldValue={regChanged(`R${i}`) && prevRegs ? fmt((prevRegs as any)?.[`R${i}`] || 0) : undefined}
                compact
              />
            ))}
          </div>
        </section>

        {/* PSW */}
        <section>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[9px] font-bold text-[#6c7086] uppercase tracking-[0.15em]">PSW 标志位</span>
            <span className="font-mono text-[10px] text-[#89b4fa]">
              {fmt(pswToNumber(simulatorState?.psw))}h
            </span>
          </div>
          <PSWFlags psw={simulatorState?.psw} prevPsw={prev?.psw} />
        </section>

        {/* LED */}
        <section>
          <div className="text-[9px] font-bold text-[#6c7086] uppercase tracking-[0.15em] mb-1.5 px-1">
            LED 显示 (P1)
          </div>
          <LEDPanel value={p1Value} />
        </section>

        {/* Ports */}
        <section>
          <div className="text-[9px] font-bold text-[#6c7086] uppercase tracking-[0.15em] mb-1.5 px-1">
            I/O 端口
          </div>
          <div className="space-y-2 bg-[#181825] rounded-lg p-2.5 border border-[#313244]/50">
            {['P0', 'P1', 'P2', 'P3'].map(p => (
              <PortBar key={p} port={p} value={getPortValue(p)} prevValue={getPrevPortValue(p)} />
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
};

export default StatusMonitor;
export { RegCell, PSWFlags, LEDPanel, PortBar };
