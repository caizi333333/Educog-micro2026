'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { type SimulatorState } from '@/lib/simulator';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MemoryViewerProps {
  simulatorState: SimulatorState | null;
  changedAddresses?: Set<number>;
  className?: string;
}

const BYTES_PER_ROW = 16;
const TOTAL_ROWS = 8;
const MAX_ADDR = 256;

const MemoryViewer: React.FC<MemoryViewerProps> = ({ simulatorState, changedAddresses }) => {
  const [baseAddr, setBaseAddr] = useState(0);

  const getMemoryByte = (addr: number): number => {
    if (!simulatorState?.ram) return 0;
    if (addr < simulatorState.ram.length) return simulatorState.ram[addr];
    return 0;
  };

  const sp = simulatorState?.registers?.SP ?? 7;

  // Count non-zero bytes for summary
  const nonZeroCount = useMemo(() => {
    if (!simulatorState?.ram) return 0;
    let count = 0;
    for (let i = 0; i < simulatorState.ram.length; i++) {
      if (simulatorState.ram[i] !== 0) count++;
    }
    return count;
  }, [simulatorState?.ram]);

  const canPrev = baseAddr > 0;
  const canNext = baseAddr + BYTES_PER_ROW * TOTAL_ROWS < MAX_ADDR;

  return (
    <div className="h-full flex flex-col text-[11px] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#313244] flex-shrink-0 bg-[#181825]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-wider">内部 RAM</span>
          <span className="text-[9px] text-[#45475a]">({nonZeroCount} 非零)</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[#585b70] text-[10px]">地址:</span>
          <input
            type="text"
            value={`0x${baseAddr.toString(16).toUpperCase().padStart(2, '0')}`}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace('0x', ''), 16);
              if (!isNaN(val) && val >= 0 && val < MAX_ADDR) setBaseAddr(val & 0xF0);
            }}
            className="w-14 bg-[#313244] border border-[#45475a] rounded px-1.5 py-0.5 text-[#cdd6f4] text-center text-[10px] focus:outline-none focus:border-[#89b4fa] transition-colors"
          />
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center px-3 py-1 text-[#45475a] border-b border-[#313244]/30 flex-shrink-0 bg-[#181825]/50">
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

      {/* Memory rows */}
      <div className="flex-1 overflow-auto bg-[#1e1e2e]">
        {Array.from({ length: TOTAL_ROWS }, (_, row) => {
          const addr = baseAddr + row * BYTES_PER_ROW;
          if (addr >= MAX_ADDR) return null;

          // Check if this row contains the stack pointer
          const rowHasSP = sp >= addr && sp < addr + BYTES_PER_ROW;

          return (
            <div
              key={row}
              className={cn(
                "flex items-center px-3 py-[2px] transition-colors",
                row % 2 === 0 ? "bg-[#1e1e2e]" : "bg-[#181825]/30",
                rowHasSP && "bg-[#f38ba8]/5"
              )}
            >
              <span className="w-10 flex-shrink-0 text-[#89b4fa] text-[10px] font-semibold">
                {addr.toString(16).toUpperCase().padStart(2, '0')}:
              </span>

              <div className="flex-1 flex">
                {Array.from({ length: BYTES_PER_ROW }, (_, col) => {
                  const cellAddr = addr + col;
                  if (cellAddr >= MAX_ADDR) return <span key={col} className="w-[20px]" />;
                  const val = getMemoryByte(cellAddr);
                  const isNonZero = val !== 0;
                  const isSP = cellAddr === sp;
                  const isChanged = changedAddresses?.has(cellAddr);

                  return (
                    <span
                      key={col}
                      title={`${cellAddr.toString(16).toUpperCase().padStart(2, '0')}h = ${val} (0x${val.toString(16).toUpperCase().padStart(2, '0')})`}
                      className={cn(
                        "w-[20px] text-center text-[10px] rounded-sm transition-colors cursor-default",
                        isChanged
                          ? "text-amber-300 font-bold bg-amber-500/15 ring-1 ring-amber-500/30"
                          : isSP
                            ? "text-[#f38ba8] font-bold bg-[#f38ba8]/15 ring-1 ring-[#f38ba8]/30"
                            : isNonZero
                              ? "text-[#a6e3a1] font-medium"
                              : "text-[#313244]",
                        col === 8 && "ml-1.5"
                      )}
                    >
                      {val.toString(16).toUpperCase().padStart(2, '0')}
                    </span>
                  );
                })}
              </div>

              <span className="w-[100px] pl-2 text-[#585b70] text-[10px] tracking-wider">
                {Array.from({ length: BYTES_PER_ROW }, (_, col) => {
                  const cellAddr = addr + col;
                  if (cellAddr >= MAX_ADDR) return ' ';
                  const val = getMemoryByte(cellAddr);
                  return val >= 0x20 && val <= 0x7e ? String.fromCharCode(val) : '\u00B7';
                }).join('')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#313244] flex-shrink-0 bg-[#181825]">
        <button
          onClick={() => setBaseAddr(Math.max(0, baseAddr - BYTES_PER_ROW * TOTAL_ROWS))}
          disabled={!canPrev}
          className="flex items-center gap-0.5 text-[10px] text-[#6c7086] hover:text-[#cdd6f4] disabled:opacity-20 transition-colors px-1"
        >
          <ChevronLeft className="w-3 h-3" />
          上页
        </button>

        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-[#f38ba8]/30 ring-1 ring-[#f38ba8]/30" />
            <span className="text-[#585b70]">SP: <span className="text-[#f38ba8] font-bold">0x{sp.toString(16).toUpperCase().padStart(2, '0')}</span></span>
          </div>
          <span className="text-[#313244]">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm bg-[#a6e3a1]/30" />
            <span className="text-[#585b70]">非零值</span>
          </div>
        </div>

        <button
          onClick={() => setBaseAddr(Math.min(MAX_ADDR - BYTES_PER_ROW * TOTAL_ROWS, baseAddr + BYTES_PER_ROW * TOTAL_ROWS))}
          disabled={!canNext}
          className="flex items-center gap-0.5 text-[10px] text-[#6c7086] hover:text-[#cdd6f4] disabled:opacity-20 transition-colors px-1"
        >
          下页
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default MemoryViewer;
