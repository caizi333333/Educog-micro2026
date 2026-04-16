'use client';

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type ExecutionTraceEntry } from '@/lib/simulator';

interface ExecutionTraceProps {
  traceLog: ExecutionTraceEntry[];
  className?: string;
}

const fmt = (v: number, pad = 2) => v.toString(16).toUpperCase().padStart(pad, '0');

function TraceEntry({ entry }: { entry: ExecutionTraceEntry }) {
  const hasChanges = entry.regChanges.length > 0 || entry.portChanges.length > 0
    || entry.memChanges.length > 0 || entry.flagChanges.length > 0;

  // Filter out PC from displayed reg changes (it always changes)
  const regChanges = entry.regChanges.filter(c => c.name !== 'PC');

  return (
    <div className="group">
      {/* Main instruction line */}
      <div className="flex items-baseline gap-2 py-0.5 px-2 hover:bg-[#313244]/30 rounded">
        <span className="text-[#585b70] text-[10px] font-mono w-8 text-right flex-shrink-0">
          #{String(entry.step).padStart(3, '0')}
        </span>
        <span className="text-[#89b4fa] text-[10px] font-mono w-10 flex-shrink-0">
          {fmt(entry.pc, 4)}H
        </span>
        <span className="text-[#cdd6f4] text-[11px] font-mono truncate">
          {entry.instruction}
        </span>
      </div>

      {/* Changes sub-lines */}
      {hasChanges && (
        <div className="ml-[52px] pb-0.5 space-y-0">
          {regChanges.map((c, i) => (
            <div key={`r${i}`} className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-[#45475a]">{'\u2514\u2500'}</span>
              <span className="text-[#f9e2af]">{c.name}</span>
              <span className="text-[#585b70]">{fmt(c.from)}</span>
              <span className="text-[#6c7086]">{'\u2192'}</span>
              <span className="text-amber-300 font-semibold">{fmt(c.to)}</span>
            </div>
          ))}
          {entry.portChanges.map((c, i) => (
            <div key={`p${i}`} className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-[#45475a]">{'\u2514\u2500'}</span>
              <span className="text-[#74c7ec]">{c.port}</span>
              <span className="text-[#585b70]">{fmt(c.from)}</span>
              <span className="text-[#6c7086]">{'\u2192'}</span>
              <span className="text-[#89dceb] font-semibold">{fmt(c.to)}</span>
            </div>
          ))}
          {entry.memChanges.map((c, i) => (
            <div key={`m${i}`} className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-[#45475a]">{'\u2514\u2500'}</span>
              <span className="text-[#a6e3a1]">[{fmt(c.addr)}H]</span>
              <span className="text-[#585b70]">{fmt(c.from)}</span>
              <span className="text-[#6c7086]">{'\u2192'}</span>
              <span className="text-emerald-300 font-semibold">{fmt(c.to)}</span>
            </div>
          ))}
          {entry.flagChanges.map((c, i) => (
            <div key={`f${i}`} className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-[#45475a]">{'\u2514\u2500'}</span>
              <span className="text-[#cba6f7]">{c.flag}</span>
              <span className="text-[#585b70]">{c.from ? '1' : '0'}</span>
              <span className="text-[#6c7086]">{'\u2192'}</span>
              <span className="text-[#cba6f7] font-semibold">{c.to ? '1' : '0'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ traceLog }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [traceLog.length]);

  if (traceLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6c7086] py-12">
        <div className="w-12 h-12 rounded-xl bg-[#313244]/50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#45475a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
          </svg>
        </div>
        <p className="text-xs font-medium">等待执行追踪</p>
        <p className="text-[10px] mt-1 text-[#45475a]">单步执行后查看指令追踪记录</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-1 space-y-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 py-1 border-b border-[#313244]/50 mb-1">
          <span className="text-[9px] font-bold text-[#6c7086] uppercase tracking-wider">
            执行追踪
          </span>
          <span className="text-[9px] text-[#45475a] font-mono">
            {traceLog.length} 步
          </span>
        </div>

        {traceLog.map((entry, i) => (
          <TraceEntry key={i} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
};

export default ExecutionTrace;
