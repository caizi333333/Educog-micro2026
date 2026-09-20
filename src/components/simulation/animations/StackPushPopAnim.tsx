'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const RAM_START = 0x07;
const STACK_SIZE = 8;
const STEP_DELAY_MS = 300;
const EXAMPLE_RETURN_ADDRESS = 0x0030;
const EXAMPLE_CALL_TARGET = 0x0100;
const EXAMPLE_ACC = '55H';

type StackEntry = { addr: number; value: string; label: string };
type StackState = { stack: StackEntry[]; log: string[]; busy: boolean };
const emptyState = (): StackState => ({ stack: [], log: [], busy: false });
const hexWord = (value: number): string => `${value.toString(16).toUpperCase().padStart(4, '0')}H`;

/**
 * 堆栈 PUSH/POP 交互动画
 * 可视化 LCALL/RET 过程中堆栈的变化
 */
export default function StackPushPopAnim(): React.JSX.Element {
  const [state, setState] = useState<StackState>(emptyState);
  // Timed steps and rapid clicks share the same current state, never a render's snapshot.
  const stateRef = useRef(state);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const sequence = useRef(0);
  const { stack, log, busy } = state;
  const sp = RAM_START + stack.length;

  useEffect(() => {
    const pendingTimers = timers.current;
    return (): void => {
      sequence.current += 1;
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, []);

  const commit = (next: StackState): void => {
    stateRef.current = next;
    setState(next);
  };

  const schedule = (step: () => void, delay: number): void => {
    const currentSequence = sequence.current;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      if (currentSequence === sequence.current) step();
    }, delay);
    timers.current.add(timer);
  };

  const push = (value: string, label: string): void => {
    const current = stateRef.current;
    if (current.stack.length >= STACK_SIZE) return;
    const newSp = RAM_START + current.stack.length + 1;
    commit({
      ...current,
      stack: [...current.stack, { addr: newSp, value, label }],
      log: [...current.log, `PUSH ${label} (${value}) → [${newSp.toString(16).toUpperCase()}H]`],
    });
  };

  const pop = (): void => {
    const current = stateRef.current;
    const item = current.stack[current.stack.length - 1];
    if (!item) return;
    commit({
      ...current,
      stack: current.stack.slice(0, -1),
      log: [...current.log, `POP ← [${item.addr.toString(16).toUpperCase()}H] = ${item.value} (${item.label})`],
    });
  };

  const finishSequence = (message: string): void => {
    const current = stateRef.current;
    commit({ ...current, busy: false, log: [...current.log, message] });
  };

  const simulateLCALL = (): void => {
    const current = stateRef.current;
    if (current.busy || current.stack.length > STACK_SIZE - 2) return;
    commit({ ...current, busy: true });
    push(`${(EXAMPLE_RETURN_ADDRESS & 0xff).toString(16).toUpperCase().padStart(2, '0')}H`, 'PCL');
    schedule(() => push(`${(EXAMPLE_RETURN_ADDRESS >> 8).toString(16).toUpperCase().padStart(2, '0')}H`, 'PCH'), STEP_DELAY_MS);
    schedule(() => finishSequence(`→ PC = ${hexWord(EXAMPLE_CALL_TARGET)} (跳转子程序)`), STEP_DELAY_MS * 2);
  };

  const simulateRET = (): void => {
    const current = stateRef.current;
    if (current.busy || current.stack.length < 2) return;
    const highByte = parseInt(current.stack[current.stack.length - 1].value, 16);
    const lowByte = parseInt(current.stack[current.stack.length - 2].value, 16);
    const returnAddress = (highByte << 8) | lowByte;
    commit({ ...current, busy: true });
    pop();
    schedule(pop, STEP_DELAY_MS);
    schedule(() => finishSequence(`→ PC = ${hexWord(returnAddress)} (从堆栈恢复返回地址)`), STEP_DELAY_MS * 2);
  };

  const reset = (): void => {
    sequence.current += 1;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    commit(emptyState());
  };

  return (
    <div className="min-w-0 bg-[#181825] rounded-lg border border-[#313244] p-3">
      <div className="text-[14px] font-bold text-[#cdd6f4] mb-2">堆栈操作 — LCALL/RET</div>
      <p className="text-[12px] text-[#a6adc8] mb-2 break-words">示例：LCALL 将返回地址 0030H 压栈，再跳转至 0100H；PUSH 使用固定 ACC = 55H。仅展示 08H—0FH 共 8 个单元。</p>

      <div className="flex gap-3">
        {/* Stack visualization */}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-[#585b70] mb-1 text-center">RAM 堆栈区</div>
          <div className="space-y-px">
            {Array.from({ length: STACK_SIZE }, (_, i) => {
              const addr = RAM_START + STACK_SIZE - i;
              const item = stack.find(s => s.addr === addr);
              const isSP = addr === sp;
              return (
                <div key={addr} className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[12px] font-mono transition-all',
                  item ? 'bg-[#89b4fa]/10 border border-[#89b4fa]/20' : 'bg-[#1e1e2e] border border-[#313244]',
                )}>
                  <span className="text-[#585b70] w-6 shrink-0">{addr.toString(16).toUpperCase()}H</span>
                  <span className={cn('flex-1', item ? 'text-[#89b4fa] font-bold' : 'text-[#313244]')}>
                    {item ? `${item.value}` : '--'}
                  </span>
                  {item && <span className="text-[11px] text-[#6c7086]">{item.label}</span>}
                  {isSP && <span className="text-[#f9e2af] text-[11px] font-bold whitespace-nowrap">← SP</span>}
                </div>
              );
            })}
          </div>
          <div className="text-center mt-1">
            <span className="text-[12px] font-mono text-[#f9e2af]">
              SP = {sp.toString(16).toUpperCase()}H
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 flex-col gap-1 justify-center">
          <button onClick={simulateLCALL}
            disabled={busy || stack.length > STACK_SIZE - 2}
            className="flex min-h-11 items-center gap-1 px-2 py-1 rounded text-[12px] font-medium bg-[#a6e3a1]/10 hover:bg-[#a6e3a1]/20 text-[#a6e3a1] border border-[#a6e3a1]/20 disabled:opacity-30 transition-colors">
            <ArrowDown className="w-3 h-3" /> LCALL
          </button>
          <button onClick={simulateRET}
            disabled={busy || stack.length < 2}
            className="flex min-h-11 items-center gap-1 px-2 py-1 rounded text-[12px] font-medium bg-[#89b4fa]/10 hover:bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/20 disabled:opacity-30 transition-colors">
            <ArrowUp className="w-3 h-3" /> RET
          </button>
          <button onClick={() => { if (!stateRef.current.busy) push(EXAMPLE_ACC, 'ACC'); }}
            disabled={busy || stack.length >= STACK_SIZE}
            className="flex min-h-11 items-center gap-1 px-2 py-1 rounded text-[12px] font-medium bg-[#cba6f7]/10 hover:bg-[#cba6f7]/20 text-[#cba6f7] border border-[#cba6f7]/20 disabled:opacity-30 transition-colors">
            <ArrowDown className="w-3 h-3" /> PUSH
          </button>
          <button onClick={() => { if (!stateRef.current.busy) pop(); }}
            disabled={busy || stack.length === 0}
            className="flex min-h-11 items-center gap-1 px-2 py-1 rounded text-[12px] font-medium bg-[#f9e2af]/10 hover:bg-[#f9e2af]/20 text-[#f9e2af] border border-[#f9e2af]/20 disabled:opacity-30 transition-colors">
            <ArrowUp className="w-3 h-3" /> POP
          </button>
          <button onClick={reset}
            className="flex min-h-11 items-center gap-1 px-2 py-1 rounded text-[12px] font-medium bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] transition-colors">
            <RotateCcw className="w-3 h-3" /> 重置
          </button>
        </div>
      </div>

      {/* Operation log */}
      {log.length > 0 && (
        <div role="log" aria-label="堆栈操作记录" aria-live="polite" className="mt-2 max-h-14 overflow-auto bg-[#1e1e2e] rounded border border-[#313244] p-1.5">
          {log.slice(-4).map((l, i) => (
            <div key={i} className="text-[12px] font-mono text-[#a6adc8] break-words">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
