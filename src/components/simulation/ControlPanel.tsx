import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Cpu, Zap, Terminal, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SimulatorState, type ExecutionTraceEntry } from '@/lib/simulator';

interface ControlPanelProps {
  error: string | null;
  result: any;
  simulatorState: SimulatorState | null;
  isRunning: boolean;
  progress: number;
  currentInstruction: string;
  lastTrace?: ExecutionTraceEntry | null;
  className?: string;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  error,
  result,
  simulatorState,
  isRunning,
  progress,
  currentInstruction,
  lastTrace,
}) => {
  const getDiag = () => {
    if (!error && result) {
      return { type: 'success' as const, title: '执行成功', desc: '程序已正常执行完成。' };
    }
    if (error) {
      return { type: 'error' as const, title: '执行错误', desc: error };
    }
    if (isRunning) {
      return { type: 'running' as const, title: '运行中...', desc: '程序正在执行。' };
    }
    if (simulatorState && !simulatorState.terminated) {
      return { type: 'debug' as const, title: '调试中', desc: '使用单步按钮逐行执行。' };
    }
    return { type: 'info' as const, title: '等待执行', desc: '编写代码并点击运行开始仿真。' };
  };

  const diag = getDiag();

  // Build console output lines
  const consoleLines: { text: string; type: 'info' | 'success' | 'error' | 'dim' }[] = [];

  if (simulatorState) {
    const pc = simulatorState.pc;
    const line = simulatorState.currentLine >= 0 ? simulatorState.currentLine + 1 : '-';
    consoleLines.push({ text: `[PC] 0x${pc.toString(16).toUpperCase().padStart(4, '0')}  Line ${line}`, type: 'info' });
  }

  if (currentInstruction) {
    consoleLines.push({ text: `> ${currentInstruction}`, type: 'success' });
  }

  if (error) {
    consoleLines.push({ text: `[ERR] ${error}`, type: 'error' });
  }

  if (result?.output) {
    consoleLines.push({ text: `[OUT] ${result.output}`, type: 'success' });
  }

  if (lastTrace) {
    const fmt = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
    consoleLines.push({ text: `[STEP] #${lastTrace.step} ${lastTrace.instruction}`, type: 'info' });
    for (const c of lastTrace.regChanges.filter(c => c.name !== 'PC')) {
      consoleLines.push({ text: `  ${c.name}: 0x${fmt(c.from)} → 0x${fmt(c.to)}`, type: 'success' });
    }
    for (const c of lastTrace.portChanges) {
      consoleLines.push({ text: `  ${c.port}: 0x${fmt(c.from)} → 0x${fmt(c.to)}`, type: 'success' });
    }
    for (const c of lastTrace.memChanges) {
      consoleLines.push({ text: `  [${fmt(c.addr)}H]: 0x${fmt(c.from)} → 0x${fmt(c.to)}`, type: 'success' });
    }
  }

  if (simulatorState?.terminated) {
    consoleLines.push({ text: '--- 程序终止 ---', type: 'dim' });
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Diagnostic badge */}
        <div className={cn(
          "flex items-start gap-2.5 p-2.5 rounded-lg border text-xs",
          diag.type === 'success' && "bg-emerald-500/5 border-emerald-500/20",
          diag.type === 'error'   && "bg-red-500/5 border-red-500/20",
          diag.type === 'running' && "bg-[#89b4fa]/5 border-[#89b4fa]/20",
          diag.type === 'debug'   && "bg-amber-500/5 border-amber-500/20",
          diag.type === 'info'    && "bg-[#313244]/30 border-[#313244]",
        )}>
          {diag.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />}
          {diag.type === 'error'   && <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
          {diag.type === 'running' && <Cpu className="w-4 h-4 text-[#89b4fa] mt-0.5 flex-shrink-0 animate-spin" />}
          {diag.type === 'debug'   && <Zap className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />}
          {diag.type === 'info'    && <Cpu className="w-4 h-4 text-[#585b70] mt-0.5 flex-shrink-0" />}
          <div>
            <p className="font-semibold text-[#cdd6f4]">{diag.title}</p>
            <p className="text-[#6c7086] mt-0.5 leading-relaxed">{diag.desc}</p>
          </div>
        </div>

        {/* Progress bar */}
        {simulatorState && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] px-0.5">
              <span className="text-[#6c7086] uppercase tracking-wider font-bold">执行进度</span>
              <span className="font-mono text-[#a6adc8]">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-[#313244] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progress >= 100 ? "bg-emerald-400" : "bg-[#89b4fa]"
                )}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Terminal console */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
            <Terminal className="w-3 h-3 text-[#6c7086]" />
            <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-wider">输出</span>
          </div>
          <div className="bg-[#11111b] rounded-lg border border-[#313244]/50 overflow-hidden">
            {/* Terminal title bar */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-[#313244]/50">
              <div className="w-2 h-2 rounded-full bg-[#f38ba8]/60" />
              <div className="w-2 h-2 rounded-full bg-[#f9e2af]/60" />
              <div className="w-2 h-2 rounded-full bg-[#a6e3a1]/60" />
              <span className="text-[9px] text-[#45475a] ml-1 font-mono">console</span>
            </div>
            <div className="p-2 font-mono text-[11px] min-h-[80px] max-h-[200px] overflow-auto space-y-0.5">
              {consoleLines.length === 0 ? (
                <div className="text-[#45475a] flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  <span>等待输出...</span>
                </div>
              ) : (
                consoleLines.map((line, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-1",
                    line.type === 'info'    && "text-[#89b4fa]",
                    line.type === 'success' && "text-[#a6e3a1]",
                    line.type === 'error'   && "text-[#f38ba8]",
                    line.type === 'dim'     && "text-[#585b70]",
                  )}>
                    <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#45475a]" />
                    <span className="break-all">{line.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div>
          <span className="text-[10px] font-bold text-[#6c7086] uppercase tracking-wider px-0.5">快捷键</span>
          <div className="mt-1.5 space-y-1 text-[11px]">
            {[
              { keys: 'F5', desc: '运行 / 停止' },
              { keys: 'F10', desc: '单步执行' },
              { keys: 'F9', desc: '切换断点' },
              { keys: 'Ctrl+R', desc: '重置仿真器' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-1">
                <span className="text-[#6c7086]">{item.desc}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#313244] text-[#a6adc8] text-[10px] font-mono border border-[#45475a]/50">
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ControlPanel;
