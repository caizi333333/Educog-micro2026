'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { type SimulatorState } from '@/lib/simulator';

interface MemoryViewerProps {
  simulatorState: SimulatorState | null;
  changedAddresses?: Set<number>;
  className?: string;
}

const BYTES_PER_ROW = 16;
const RAM_SIZE = 128; // 经典 8051 内部 RAM 00H-7FH，一屏全览

// ── 8051 内部 RAM 分区（区名/范围/主题色）──
interface Zone {
  key: string;
  start: number;
  end: number;
  name: string;
  detail: string;
  color: string; // 竖色条与区名颜色
}

const ZONES: Zone[] = [
  { key: 'regs', start: 0x00, end: 0x1f, name: '寄存器组', detail: 'R0-R7 × 4组（RS1/RS0选择）', color: '#89b4fa' },
  { key: 'bits', start: 0x20, end: 0x2f, name: '位寻址区', detail: '位地址00H-7FH', color: '#cba6f7' },
  { key: 'user', start: 0x30, end: 0x7f, name: '用户数据区', detail: '数据/堆栈', color: '#94e2d5' },
];

const zoneOf = (addr: number): Zone => ZONES.find(z => addr >= z.start && addr <= z.end) ?? ZONES[2];

/** 单元的悬浮提示：地址/分区角色 + 十六进制/十进制/二进制/ASCII */
function cellTooltip(addr: number, val: number, isSP: boolean): string {
  const zone = zoneOf(addr);
  const lines: string[] = [];
  let role = zone.name;
  if (addr <= 0x1f) role = `寄存器组${addr >> 3} 的 R${addr & 7}`;
  else if (addr <= 0x2f) {
    const b0 = (addr - 0x20) * 8;
    role = `位寻址区 · 位地址${b0.toString(16).toUpperCase().padStart(2, '0')}H-${(b0 + 7).toString(16).toUpperCase().padStart(2, '0')}H`;
  }
  lines.push(`${addr.toString(16).toUpperCase().padStart(2, '0')}H · ${role}${isSP ? '（SP 栈顶）' : ''}`);
  lines.push(`十六进制 0x${val.toString(16).toUpperCase().padStart(2, '0')} · 十进制 ${val}`);
  lines.push(`二进制 ${val.toString(2).padStart(8, '0')}`);
  lines.push(`ASCII ${val >= 0x20 && val <= 0x7e ? `'${String.fromCharCode(val)}'` : '（不可打印）'}`);
  return lines.join('\n');
}

const FLASH_MS = 550;   // 刚写入：琥珀底闪烁
const FADE_MS = 1600;   // 渐隐窗口：淡琥珀 → 恢复常态

const MemoryViewer: React.FC<MemoryViewerProps> = ({ simulatorState, changedAddresses }) => {
  const ram = simulatorState?.ram ?? null;
  const sp = simulatorState?.registers?.SP ?? 7;

  // ── 最近写入检测：组件自行对相邻两帧 ram 做差分，运行动画中也能高亮 ──
  // （props 的 changedAddresses 只在单步时更新，连续运行时靠这里）
  const prevRamRef = useRef<Uint8Array | null>(null);
  const [recentWrites, setRecentWrites] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!ram || typeof ram.length !== 'number') {
      prevRamRef.current = null;
      setRecentWrites(prev => (prev.size ? new Map() : prev));
      return;
    }
    const prev = prevRamRef.current;
    prevRamRef.current = ram.slice(0, RAM_SIZE);
    if (!prev) return;
    const now = Date.now();
    setRecentWrites(old => {
      let dirty = false;
      const next = new Map(old);
      const n = Math.min(RAM_SIZE, ram.length, prev.length);
      for (let i = 0; i < n; i++) {
        if (ram[i] !== prev[i]) { next.set(i, now); dirty = true; }
      }
      for (const [a, t] of next) {
        if (now - t > FADE_MS) { next.delete(a); dirty = true; }
      }
      return dirty ? next : old;
    });
  }, [ram]);

  // 停止运行后高亮也要按时渐隐：有存量高亮时开一个低频清理定时器
  useEffect(() => {
    if (recentWrites.size === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setRecentWrites(old => {
        const next = new Map(old);
        for (const [a, t] of next) if (now - t > FADE_MS) next.delete(a);
        return next.size !== old.size ? next : old;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [recentWrites.size]);

  const getMemoryByte = (addr: number): number => {
    if (!ram) return 0;
    return addr < ram.length ? ram[addr] : 0;
  };

  const nonZeroCount = useMemo(() => {
    if (!ram) return 0;
    let count = 0;
    const n = Math.min(RAM_SIZE, ram.length);
    for (let i = 0; i < n; i++) if (ram[i] !== 0) count++;
    return count;
  }, [ram]);

  // ── 分区跳转 chips：滚动到区头并短暂点亮该区 ──
  const zoneHeaderRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pulseZone, setPulseZone] = useState<string | null>(null);
  const jumpToZone = (key: string) => {
    zoneHeaderRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPulseZone(key);
    setTimeout(() => setPulseZone(k => (k === key ? null : k)), 1200);
  };

  const now = Date.now();

  return (
    <div className="h-full flex flex-col text-[11px] font-mono">
      {/* 最近写入的闪烁渐隐动画 */}
      <style>{`
        @keyframes memflash {
          0% { background-color: rgba(251, 191, 36, 0.55); }
          45% { background-color: rgba(251, 191, 36, 0.2); }
          70% { background-color: rgba(251, 191, 36, 0.45); }
          100% { background-color: rgba(251, 191, 36, 0.16); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#313244] flex-shrink-0 bg-[#181825]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-wider">内部 RAM 00-7F</span>
          <span className="text-[9px] text-[#45475a]">({nonZeroCount} 非零)</span>
        </div>
        {/* 分区快捷跳转 */}
        <div className="flex items-center gap-1">
          {ZONES.map(z => (
            <button
              key={z.key}
              onClick={() => jumpToZone(z.key)}
              title={`${z.name} ${z.start.toString(16).toUpperCase().padStart(2, '0')}H-${z.end.toString(16).toUpperCase().padStart(2, '0')}H`}
              className="flex items-center gap-1 rounded border border-[#313244] bg-[#1e1e2e] px-1.5 py-0.5 text-[9px] text-[#7f849c] transition-colors hover:border-[#45475a] hover:text-[#cdd6f4]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-[2px]" style={{ backgroundColor: z.color }} />
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center px-3 py-1 text-[#45475a] border-b border-[#313244]/30 flex-shrink-0 bg-[#181825]/50">
        <span className="w-[7px] flex-shrink-0" />
        <span className="w-10 flex-shrink-0 text-[10px]">ADDR</span>
        <div className="flex-1 flex">
          {Array.from({ length: BYTES_PER_ROW }, (_, i) => (
            <span key={i} className={cn(
              "w-[20px] text-center text-[10px]",
              i === 8 && "ml-1.5",
              i % 2 === 0 ? "text-[#585b70]" : "text-[#45475a]"
            )}>
              {i.toString(16).toUpperCase()}
            </span>
          ))}
        </div>
        <span className="w-[100px] pl-2 text-[10px]">ASCII</span>
      </div>

      {/* Memory rows（含分区标题分隔） */}
      <div className="flex-1 overflow-auto bg-[#1e1e2e]">
        {Array.from({ length: RAM_SIZE / BYTES_PER_ROW }, (_, row) => {
          const addr = row * BYTES_PER_ROW;
          const zone = zoneOf(addr);
          const rowHasSP = sp >= addr && sp < addr + BYTES_PER_ROW;
          const zonePulsing = pulseZone === zone.key;

          return (
            <React.Fragment key={row}>
              {/* 分区标题行：区起始处插入 */}
              {addr === zone.start && (
                <div
                  ref={el => { zoneHeaderRefs.current[zone.key] = el; }}
                  className="flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 select-none"
                >
                  <span className="inline-block h-2 w-[3px] rounded-sm" style={{ backgroundColor: zone.color }} />
                  <span className="text-[9px] font-semibold tracking-wide" style={{ color: zone.color }}>
                    {zone.name}
                  </span>
                  <span className="text-[9px] text-[#45475a]">
                    {zone.start.toString(16).toUpperCase().padStart(2, '0')}-{zone.end.toString(16).toUpperCase().padStart(2, '0')} · {zone.detail}
                  </span>
                  <span className="flex-1 border-t border-dashed border-[#313244]/60" />
                </div>
              )}

              <div
                className={cn(
                  "flex items-center px-3 py-[2px] transition-colors",
                  row % 2 === 0 ? "bg-[#1e1e2e]" : "bg-[#181825]/30",
                  rowHasSP && "bg-[#f38ba8]/5",
                  zonePulsing && "bg-white/[0.045]"
                )}
              >
                {/* 分区竖色条 */}
                <span
                  className="w-[3px] self-stretch flex-shrink-0 rounded-sm mr-1"
                  style={{ backgroundColor: zone.color, opacity: zonePulsing ? 0.9 : 0.35 }}
                />
                <span className="w-10 flex-shrink-0 text-[#89b4fa] text-[10px] font-semibold">
                  {addr.toString(16).toUpperCase().padStart(2, '0')}:
                </span>

                <div className="flex-1 flex">
                  {Array.from({ length: BYTES_PER_ROW }, (_, col) => {
                    const cellAddr = addr + col;
                    const val = getMemoryByte(cellAddr);
                    const isNonZero = val !== 0;
                    const isSP = cellAddr === sp;
                    const writtenAt = recentWrites.get(cellAddr);
                    const age = writtenAt != null ? now - writtenAt : Infinity;
                    const isFresh = age < FLASH_MS || changedAddresses?.has(cellAddr);
                    const isFading = !isFresh && age < FADE_MS;

                    return (
                      <span
                        key={col}
                        title={cellTooltip(cellAddr, val, isSP)}
                        style={isFresh ? { animation: `memflash ${FLASH_MS}ms ease-out both` } : undefined}
                        className={cn(
                          "w-[20px] text-center text-[10px] rounded-sm cursor-default transition-colors duration-700",
                          col === 8 && "ml-1.5",
                          isFresh
                            ? "text-amber-200 font-bold ring-1 ring-amber-400/50"
                            : isFading
                              ? "text-amber-300/90 font-semibold bg-amber-500/10"
                              : isSP
                                ? "text-[#f38ba8] font-bold bg-[#f38ba8]/15 ring-1 ring-[#f38ba8]/30"
                                : isNonZero
                                  ? "text-[#a6e3a1] font-medium"
                                  : "text-[#313244]"
                        )}
                      >
                        {val.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    );
                  })}
                </div>

                <span className="w-[100px] pl-2 text-[#585b70] text-[10px] tracking-wider">
                  {Array.from({ length: BYTES_PER_ROW }, (_, col) => {
                    const val = getMemoryByte(addr + col);
                    return val >= 0x20 && val <= 0x7e ? String.fromCharCode(val) : '·';
                  }).join('')}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-center gap-3 px-3 py-1.5 border-t border-[#313244] flex-shrink-0 bg-[#181825] text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-[#f38ba8]/30 ring-1 ring-[#f38ba8]/30" />
          <span className="text-[#585b70]">SP: <span className="text-[#f38ba8] font-bold">0x{sp.toString(16).toUpperCase().padStart(2, '0')}</span></span>
        </div>
        <span className="text-[#313244]">|</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-amber-400/40 ring-1 ring-amber-400/40" />
          <span className="text-[#585b70]">最近写入</span>
        </div>
        <span className="text-[#313244]">|</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-[#a6e3a1]/30" />
          <span className="text-[#585b70]">非零值</span>
        </div>
      </div>
    </div>
  );
};

export default MemoryViewer;
