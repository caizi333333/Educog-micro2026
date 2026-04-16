'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 堆栈 PUSH/POP 交互动画
 * 可视化 LCALL/RET 过程中堆栈的变化
 */
export default function StackPushPopAnim() {
  const RAM_START = 0x07;
  const STACK_SIZE = 8;
  const [sp, setSp] = useState(RAM_START);
  const [stack, setStack] = useState<{ addr: number; value: string; label: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const push = (value: string, label: string) => {
    if (sp >= RAM_START + STACK_SIZE) return;
    const newSp = sp + 1;
    setSp(newSp);
    setStack(prev => [...prev, { addr: newSp, value, label }]);
    setLog(prev => [...prev, `PUSH ${label} (${value}) → [${newSp.toString(16).toUpperCase()}H]`]);
  };

  const pop = () => {
    if (stack.length === 0) return;
    const item = stack[stack.length - 1];
    setStack(prev => prev.slice(0, -1));
    setSp(prev => prev - 1);
    setLog(prev => [...prev, `POP ← [${item.addr.toString(16).toUpperCase()}H] = ${item.value} (${item.label})`]);
  };

  const simulateLCALL = () => {
    push('30H', 'PCL');
    setTimeout(() => push('00H', 'PCH'), 300);
    setTimeout(() => setLog(prev => [...prev, '→ PC = 0100H (跳转子程序)']), 600);
  };

  const simulateRET = () => {
    if (stack.length < 2) return;
    pop();
    setTimeout(() => pop(), 300);
    setTimeout(() => setLog(prev => [...prev, '→ PC = 0030H (返回主程序)']), 600);
  };

  const reset = () => {
    setSp(RAM_START); setStack([]); setLog([]);
  };

  return (
    <div className="bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[10px] font-bold text-[#cdd6f4] mb-2">堆栈操作 — LCALL/RET</div>

      <div className="flex gap-3">
        {/* Stack visualization */}
        <div className="flex-1">
          <div className="text-[8px] text-[#585b70] mb-1 text-center">RAM 堆栈区</div>
          <div className="space-y-px">
            {Array.from({ length: STACK_SIZE }, (_, i) => {
              const addr = RAM_START + STACK_SIZE - i;
              const item = stack.find(s => s.addr === addr);
              const isSP = addr === sp;
              return (
                <div key={addr} className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[8px] font-mono transition-all',
                  item ? 'bg-[#89b4fa]/10 border border-[#89b4fa]/20' : 'bg-[#1e1e2e] border border-[#313244]',
                )}>
                  <span className="text-[#585b70] w-6">{addr.toString(16).toUpperCase()}H</span>
                  <span className={cn('flex-1', item ? 'text-[#89b4fa] font-bold' : 'text-[#313244]')}>
                    {item ? `${item.value}` : '--'}
                  </span>
                  {item && <span className="text-[7px] text-[#6c7086]">{item.label}</span>}
                  {isSP && <span className="text-[#f9e2af] text-[7px] font-bold">← SP</span>}
                </div>
              );
            })}
          </div>
          <div className="text-center mt-1">
            <span className="text-[8px] font-mono text-[#f9e2af]">
              SP = {sp.toString(16).toUpperCase()}H
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1 justify-center">
          <button onClick={simulateLCALL}
            disabled={sp >= RAM_START + STACK_SIZE - 1}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium bg-[#a6e3a1]/10 hover:bg-[#a6e3a1]/20 text-[#a6e3a1] border border-[#a6e3a1]/20 disabled:opacity-30 transition-colors">
            <ArrowDown className="w-3 h-3" /> LCALL
          </button>
          <button onClick={simulateRET}
            disabled={stack.length < 2}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium bg-[#89b4fa]/10 hover:bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/20 disabled:opacity-30 transition-colors">
            <ArrowUp className="w-3 h-3" /> RET
          </button>
          <button onClick={() => push(`${Math.floor(Math.random()*256).toString(16).toUpperCase()}H`, 'ACC')}
            disabled={sp >= RAM_START + STACK_SIZE}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium bg-[#cba6f7]/10 hover:bg-[#cba6f7]/20 text-[#cba6f7] border border-[#cba6f7]/20 disabled:opacity-30 transition-colors">
            <ArrowDown className="w-3 h-3" /> PUSH
          </button>
          <button onClick={pop}
            disabled={stack.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium bg-[#f9e2af]/10 hover:bg-[#f9e2af]/20 text-[#f9e2af] border border-[#f9e2af]/20 disabled:opacity-30 transition-colors">
            <ArrowUp className="w-3 h-3" /> POP
          </button>
          <button onClick={reset}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
            <RotateCcw className="w-3 h-3" /> 重置
          </button>
        </div>
      </div>

      {/* Operation log */}
      {log.length > 0 && (
        <div className="mt-2 max-h-14 overflow-auto bg-[#1e1e2e] rounded border border-[#313244] p-1.5">
          {log.slice(-4).map((l, i) => (
            <div key={i} className="text-[8px] font-mono text-[#a6adc8]">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
