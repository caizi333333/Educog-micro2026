'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Square,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  Cpu,
  Activity,
  Terminal,
  MemoryStick,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimulator } from '@/hooks/useSimulator';
import { experiments } from '@/lib/experiment-config';

import ExperimentSelector from '@/components/simulation/ExperimentSelector';
import CodeEditor from '@/components/simulation/CodeEditor';
import ControlPanel from '@/components/simulation/ControlPanel';
import StatusMonitor from '@/components/simulation/StatusMonitor';
import MemoryViewer from '@/components/simulation/MemoryViewer';
import ExecutionTrace from '@/components/simulation/ExecutionTrace';
import ExperimentGuide from '@/components/simulation/ExperimentGuide';

export default function SimulationPage() {
  const {
    code, setCode, simulatorState, previousState, traceLog, isRunning, fault, result,
    selectedExperiment, experimentStatus,
    runSimulation, stepSimulation, resetSimulation,
    loadExperiment, loadExperimentStatus, completeExperiment, stop,
  } = useSimulator();

  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [localSelectedExperiment, setLocalSelectedExperiment] = useState<string | null>(selectedExperiment || null);
  const [activeRightTab, setActiveRightTab] = useState<'registers' | 'memory' | 'console' | 'trace' | 'guide'>('registers');

  // 支持通过 URL 参数直接打开指定实验，例如 /simulation?experiment=exp01
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expId = params.get('experiment') || params.get('experimentId');
    if (expId && typeof expId === 'string') {
      loadExperiment(expId);
      // 默认切到教学指南，让用户先看到课前测试
      setActiveRightTab('guide');
    }
    // 仅在首次加载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute changed memory addresses from last trace entry
  const lastTrace = traceLog.length > 0 ? traceLog[traceLog.length - 1] : null;
  const changedMemoryAddresses = new Set(lastTrace?.memChanges.map(c => c.addr) ?? []);

  const error = fault;
  // simulator.currentLine is 0-indexed source line; convert to 1-indexed for UI
  const currentLine = simulatorState?.currentLine != null && simulatorState.currentLine >= 0
    ? simulatorState.currentLine + 1
    : -1;

  useEffect(() => { loadExperimentStatus(); }, [loadExperimentStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextarea = tag === 'TEXTAREA';

      if (e.key === 'F5') {
        e.preventDefault();
        if (e.shiftKey || isRunning) { stop(); } else { runSimulation(); }
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (!isRunning) stepSimulation();
      } else if (e.key === 'F9' && !isTextarea) {
        e.preventDefault();
        // Toggle breakpoint at current line (handled by CodeEditor)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !isTextarea) {
        e.preventDefault();
        resetSimulation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, runSimulation, stepSimulation, resetSimulation, stop]);

  const handleBreakpointToggle = (line: number) => {
    setBreakpoints(prev => prev.includes(line) ? prev.filter(l => l !== line) : [...prev, line]);
  };

  const currentExp = experiments.find(e => e.id === selectedExperiment);
  const stepCount = simulatorState?.pc || 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6 -mt-4 bg-[#0d0d14]">
        {/* ── Top Toolbar ── */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-[#181825] border-b border-[#313244] flex-shrink-0">
          {/* Left section */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-1.5 rounded-md hover:bg-[#313244] text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
                >
                  {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {sidebarOpen ? '收起实验列表' : '展开实验列表'}
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-[#313244] mx-1" />

            {/* Run controls */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={isRunning ? stop : runSimulation}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                    isRunning
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 ring-1 ring-red-500/20"
                      : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20"
                  )}
                >
                  {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3.5 h-3.5" />}
                  {isRunning ? '停止' : '运行'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isRunning ? '停止执行 (Shift+F5)' : '运行程序 (F5)'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={stepSimulation}
                  disabled={isRunning}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#a6adc8] hover:bg-[#313244] hover:text-[#cdd6f4] disabled:opacity-30 transition-all"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  单步
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">单步执行 (F10)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={resetSimulation}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#a6adc8] hover:bg-[#313244] hover:text-[#cdd6f4] transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重置
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">重置模拟器</TooltipContent>
            </Tooltip>
          </div>

          {/* Center: Status + experiment */}
          <div className="flex-1 flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full transition-all",
                isRunning
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"
                  : error
                    ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]"
                    : "bg-[#45475a]"
              )} />
              <span className="text-[11px] font-medium text-[#a6adc8]">
                {isRunning ? '运行中' : error ? '错误' : simulatorState?.terminated ? '执行完毕' : simulatorState ? '调试中' : '就绪'}
              </span>
            </div>

            {currentExp && (
              <Badge variant="outline" className="text-[10px] font-medium bg-[#313244]/50 border-[#45475a] text-[#a6adc8]">
                <Cpu className="w-3 h-3 mr-1 text-[#89b4fa]" />
                {currentExp.title}
              </Badge>
            )}

            {stepCount > 0 && (
              <span className="text-[10px] text-[#585b70] font-mono">
                PC: 0x{stepCount.toString(16).toUpperCase().padStart(4, '0')}
              </span>
            )}
          </div>

          {/* Right: Complete button */}
          <div className="flex items-center gap-2">
            {selectedExperiment && !isRunning && (result || simulatorState?.terminated) && (
              <button
                onClick={completeExperiment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                完成实验
              </button>
            )}
          </div>
        </div>

        {/* ── Main content: 3-panel layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Experiment selector */}
          <div className={cn(
            "flex-shrink-0 border-r border-[#313244] transition-all duration-300 overflow-hidden bg-[#11111b]",
            sidebarOpen ? "w-[260px]" : "w-0"
          )}>
            <ExperimentSelector
              selectedExperiment={localSelectedExperiment || selectedExperiment}
              onExperimentSelect={(id) => setLocalSelectedExperiment(id)}
              onLoadExperiment={(id) => loadExperiment(id)}
              selectedDifficulty={selectedDifficulty}
              onDifficultyChange={setSelectedDifficulty}
              experimentStatus={experimentStatus}
            />
          </div>

          {/* Center: Code editor */}
          <div className="flex-1 min-w-0 flex flex-col">
            <CodeEditor
              code={code}
              onCodeChange={setCode}
              breakpoints={breakpoints}
              onBreakpointToggle={handleBreakpointToggle}
              currentLine={currentLine}
              isRunning={isRunning}
              onRun={runSimulation}
              onStep={stepSimulation}
              onReset={resetSimulation}
              onStop={stop}
              selectedExperiment={selectedExperiment || null}
            />
          </div>

          {/* Right: Status panel */}
          <div className="w-[300px] flex-shrink-0 border-l border-[#313244] flex flex-col overflow-hidden bg-[#11111b]">
            {/* Tab bar */}
            <div className="flex border-b border-[#313244] bg-[#181825] flex-shrink-0">
              {([
                { key: 'registers' as const, label: '寄存器', icon: Activity },
                { key: 'memory' as const, label: '内存', icon: MemoryStick },
                { key: 'trace' as const, label: '追踪', icon: ScrollText },
                { key: 'guide' as const, label: '教程', icon: Cpu },
                { key: 'console' as const, label: '控制台', icon: Terminal },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveRightTab(tab.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-all border-b-2",
                    activeRightTab === tab.key
                      ? "border-[#89b4fa] text-[#89b4fa] bg-[#89b4fa]/5"
                      : "border-transparent text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#313244]/30"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {activeRightTab === 'registers' ? (
                <StatusMonitor
                  simulatorState={simulatorState}
                  previousState={previousState}
                  result={result}
                  currentLine={currentLine}
                  isRunning={isRunning}
                />
              ) : activeRightTab === 'memory' ? (
                <MemoryViewer simulatorState={simulatorState} changedAddresses={changedMemoryAddresses} />
              ) : activeRightTab === 'trace' ? (
                <ExecutionTrace traceLog={traceLog} />
              ) : activeRightTab === 'guide' ? (
                <ExperimentGuide experiment={currentExp || null} />
              ) : (
                <ControlPanel
                  error={error}
                  result={result}
                  simulatorState={simulatorState}
                  isRunning={isRunning}
                  progress={simulatorState ? (Math.max(0, simulatorState.currentLine) / Math.max(code.split('\n').length, 1)) * 100 : 0}
                  currentInstruction={
                    simulatorState && simulatorState.currentLine >= 0
                      ? code.split('\n')[simulatorState.currentLine]?.trim() || ''
                      : ''
                  }
                  lastTrace={lastTrace}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
