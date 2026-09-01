'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Sparkles,
  X,
  Lightbulb,
  Waypoints,
  Timer,
  Monitor,
  Keyboard,
  Volume2,
  Cog,
  Radio,
  Boxes,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  GitCompareArrows,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSimulator } from '@/hooks/useSimulator';
import {
  experiments as staticExperiments,
  hasProj04TelemetryFrame,
  isProj04MilestoneEvidenceComplete,
  PROJ04_MIN_OBSERVATION_STEPS,
  type ExperimentConfig,
} from '@/lib/experiment-config';

import ExperimentSelector from '@/components/simulation/ExperimentSelector';
import CodeEditor from '@/components/simulation/CodeEditor';
import ControlPanel from '@/components/simulation/ControlPanel';
import StatusMonitor from '@/components/simulation/StatusMonitor';
import MemoryViewer from '@/components/simulation/MemoryViewer';
import ExecutionTrace from '@/components/simulation/ExecutionTrace';
import ExperimentGuide from '@/components/simulation/ExperimentGuide';
import AiDiagnostics from '@/components/simulation/AiDiagnostics';
import { HyperExperimentCanvas } from '@/components/hyper/HyperExperimentCanvas';

// 实验分类 → 顶栏徽章小图标（与实验配置的 category 一一对应）
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  '基础入门': Lightbulb,
  '基础指令': Cpu,
  '定时器应用': Timer,
  '显示控制': Monitor,
  '输入处理': Keyboard,
  '音频控制': Volume2,
  '电机控制': Cog,
  '通信接口': Radio,
  '综合项目': Boxes,
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isExperimentConfig(value: unknown): value is ExperimentConfig {
  if (typeof value !== 'object' || value === null) return false;
  const experiment = value as Record<string, unknown>;
  const troubleshooting = experiment.troubleshooting;
  return typeof experiment.id === 'string'
    && typeof experiment.title === 'string'
    && typeof experiment.category === 'string'
    && ['basic', 'intermediate', 'advanced'].includes(String(experiment.difficulty))
    && typeof experiment.duration === 'number'
    && typeof experiment.code === 'string'
    && isStringArray(experiment.objectives)
    && isStringArray(experiment.prerequisites)
    && isStringArray(experiment.knowledgePoints)
    && isStringArray(experiment.hardwareRequirements)
    && isStringArray(experiment.expectedResults)
    && isStringArray(experiment.extensions)
    && Array.isArray(troubleshooting)
    && troubleshooting.every((item) => {
      if (typeof item !== 'object' || item === null) return false;
      const detail = item as Record<string, unknown>;
      return typeof detail.issue === 'string' && typeof detail.solution === 'string';
    })
    && (experiment.peripheral === undefined || (typeof experiment.peripheral === 'object' && experiment.peripheral !== null));
}

function isExperimentsResponse(value: unknown): value is { success: true; data: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  return response.success === true && Array.isArray(response.data);
}

export default function SimulationPage(): React.JSX.Element {
  const {
    code, setCode, simulatorState, previousState, traceLog, executionCount, isRunning, isCompletingExperiment, fault, result,
    selectedExperiment, experimentStatus, isLoadingStatus, experimentStatusError,
    draftState,
    projectCompletion, isLoadingProjectCompletion, isSavingProjectCompletion, projectCompletionError,
    runSimulation, stepSimulation, resetSimulation,
    loadExperiment, loadExperimentStatus, loadExperimentDraft, saveExperimentDraft,
    useServerDraft, keepLocalDraft, saveProj04Milestone, startExperiment, completeExperiment, stop,
    speed, setSpeed, speedPresets,
    breakpoints, toggleBreakpoint, paused, setPortBit, pulsePortBit,
  } = useSimulator();

  const breakpointLines = React.useMemo(() => Array.from(breakpoints), [breakpoints]);
  // 窄视口默认收起实验列表侧栏，腾出空间给编辑器/右侧面板（含全局左侧导航约256px在内，
  // 1440px以下窗口/投影演示时展开三栏很容易挤压溢出）；用户仍可随时手动展开
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1440,
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [localSelectedExperiment, setLocalSelectedExperiment] = useState<string | null>(selectedExperiment ?? null);
  const [activeRightTab, setActiveRightTab] = useState<'registers' | 'memory' | 'console' | 'trace' | 'guide' | 'ai'>('registers');
  const [experiments, setExperiments] = useState<ExperimentConfig[]>(staticExperiments);
  const [guideDismissed, setGuideDismissed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('sim_guide_dismissed') === '1',
  );
  const [preclassExperimentId, setPreclassExperimentId] = useState<string | null>(null);
  const [taskExperimentContext, setTaskExperimentContext] = useState(false);
  const [isConfirmingPreclassStart, setIsConfirmingPreclassStart] = useState(false);
  const [preclassStartError, setPreclassStartError] = useState<string | null>(null);
  const [experimentLoadError, setExperimentLoadError] = useState<string | null>(null);
  const dismissGuide = (): void => {
    setGuideDismissed(true);
    try { localStorage.setItem('sim_guide_dismissed', '1'); } catch { /* ignore */ }
  };

  // Fetch experiments from API on mount
  useEffect(() => {
    let active = true;
    async function fetchExperiments(): Promise<void> {
      try {
        const res = await fetch('/api/experiments');
        if (!res.ok) return;
        const json: unknown = await res.json();
        if (active && isExperimentsResponse(json)) {
          const validatedExperiments = json.data.filter(isExperimentConfig);
          if (validatedExperiments.length > 0) setExperiments(validatedExperiments);
        }
      } catch {
        // Keep static fallback on error
      }
    }
    void fetchExperiments();
    return (): void => { active = false; };
  }, []);

  const confirmPreclassStart = React.useCallback(async (experimentId: string): Promise<void> => {
    setIsConfirmingPreclassStart(true);
    setPreclassStartError(null);
    try {
      await startExperiment(experimentId);
    } catch (startError) {
      setPreclassStartError(startError instanceof Error ? startError.message : '实验开始状态暂未确认，请重试');
    } finally {
      setIsConfirmingPreclassStart(false);
    }
  }, [startExperiment]);

  useEffect(() => {
    setLocalSelectedExperiment(selectedExperiment || null);
  }, [selectedExperiment]);

  const persistExperimentInUrl = React.useCallback((experimentId: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.set('experiment', experimentId);
    url.searchParams.delete('experimentId');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const openExperiment = React.useCallback((experimentId: string): void => {
    const params = new URLSearchParams(window.location.search);
    const assignedExperimentId = params.get('experiment') ?? params.get('experimentId');
    const hasTaskContext = Boolean(params.get('taskPathId') && params.get('taskStepId'));
    if (hasTaskContext && assignedExperimentId && experimentId !== assignedExperimentId) {
      setLocalSelectedExperiment(selectedExperiment || null);
      setExperimentLoadError(`当前任务指定实验为 ${assignedExperimentId}，不能切换为 ${experimentId}。请先完成当前任务步骤。`);
      return;
    }
    if (!staticExperiments.some((experiment) => experiment.id === experimentId)) {
      setLocalSelectedExperiment(selectedExperiment || null);
      setExperimentLoadError(`未找到课程实验 ${experimentId}，请从实验列表重新选择。`);
      return;
    }
    if (draftState.hasUnsavedChanges && (draftState.status === 'ERROR' || draftState.status === 'CONFLICT')) {
      const confirmed = window.confirm(
        draftState.status === 'CONFLICT'
          ? '当前代码与另一页面的服务端草稿存在冲突。切换实验会放弃当前页面尚未处理的版本，是否继续？'
          : draftState.hasLocalBackup
            ? '当前代码已保存在本机，但尚未同步到服务端。切换后仍可返回恢复，是否继续？'
            : '当前代码尚未保存。切换实验可能丢失本页修改，是否继续？',
      );
      if (!confirmed) {
        setLocalSelectedExperiment(selectedExperiment || null);
        return;
      }
    }
    setExperimentLoadError(null);
    if (experimentId === selectedExperiment
      && draftState.hasUnsavedChanges
      && draftState.status !== 'ERROR'
      && draftState.status !== 'CONFLICT') {
      setLocalSelectedExperiment(experimentId);
      persistExperimentInUrl(experimentId);
      void saveExperimentDraft();
      return;
    }
    loadExperiment(experimentId);
    setLocalSelectedExperiment(experimentId);
    persistExperimentInUrl(experimentId);
    if (preclassExperimentId && preclassExperimentId !== experimentId) {
      setPreclassExperimentId(null);
      setPreclassStartError(null);
      if (!hasTaskContext && params.get('from') === 'preclass') {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('from');
        window.history.replaceState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      }
    }
    void loadExperimentDraft(experimentId);
  }, [draftState.hasLocalBackup, draftState.hasUnsavedChanges, draftState.status, loadExperiment, loadExperimentDraft, persistExperimentInUrl, preclassExperimentId, saveExperimentDraft, selectedExperiment]);

  // 支持通过 URL 参数直接打开指定实验，例如 /simulation?experiment=exp01。
  // 从“我的任务”进入时，先把教师布置状态迁移为进行中，再开放执行动作。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expId = params.get('experiment') ?? params.get('experimentId');
    setTaskExperimentContext(Boolean(params.get('taskPathId') && params.get('taskStepId')));
    if (expId && typeof expId === 'string') {
      if (!staticExperiments.some((experiment) => experiment.id === expId)) {
        setExperimentLoadError(`链接中的实验 ${expId} 不存在，请从实验列表重新选择。`);
        setLocalSelectedExperiment(null);
        return;
      }
      setExperimentLoadError(null);
      loadExperiment(expId);
      // 默认切到教学指南，让用户先看到课前测试
      setActiveRightTab('guide');
      if (params.get('from') === 'preclass') {
        setPreclassExperimentId(expId);
        // 开始状态会更新同一实验记录的 updatedAt；先确认开始、再读取草稿，
        // 避免把本页面自己的状态迁移误判成多标签页编辑冲突。
        void (async (): Promise<void> => {
          await confirmPreclassStart(expId);
          await loadExperimentDraft(expId);
        })();
      } else {
        void loadExperimentDraft(expId);
      }
    }
  }, [confirmPreclassStart, loadExperiment, loadExperimentDraft]);

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
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isCompletingExperiment) return;
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
        // 焦点不在编辑器时，F9 在当前执行行切换断点（编辑器内 F9 作用于光标行）
        if (currentLine > 0) toggleBreakpoint(currentLine);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !isTextarea) {
        e.preventDefault();
        resetSimulation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompletingExperiment, isRunning, runSimulation, stepSimulation, resetSimulation, stop, toggleBreakpoint, currentLine]);

  const currentExp = experiments.find(e => e.id === selectedExperiment);
  const stepCount = simulatorState?.pc ?? 0;
  const preclassStatus = preclassExperimentId ? experimentStatus[preclassExperimentId] : null;
  const preclassStartBlocked = Boolean(preclassExperimentId && (isConfirmingPreclassStart || preclassStartError));
  const proj04MilestoneCount = projectCompletion.milestones.filter((item) => item.confirmed && item.confirmedAt).length;
  const proj04ChecklistReady = isProj04MilestoneEvidenceComplete(projectCompletion);
  const proj04TelemetryObserved = hasProj04TelemetryFrame(simulatorState?.uart?.transmitBuffer);
  const proj04ObservationReady = executionCount >= PROJ04_MIN_OBSERVATION_STEPS && proj04TelemetryObserved;
  const proj04DraftReady = !draftState.hasUnsavedChanges
    && !['SAVING', 'SYNCING', 'CONFLICT', 'ERROR', 'LOADING'].includes(draftState.status);
  const projectCompletionBlockedReason = selectedExperiment === 'proj04' && !proj04DraftReady
    ? '代码草稿正在同步或需要处理，请先完成代码保存，再确认项目证据。'
    : null;
  const canCompleteExperiment = Boolean(
    selectedExperiment
      && !preclassStartBlocked
      && !isRunning
      && simulatorState
      && result?.success
      && !fault
      && (selectedExperiment === 'proj04'
        ? (proj04ObservationReady
          && proj04ChecklistReady
          && !isLoadingProjectCompletion
          && !isSavingProjectCompletion
          && !projectCompletionError
          && proj04DraftReady)
        : (simulatorState?.terminated === true
          || (selectedExperiment === 'exp02' && executionCount >= 20))),
  );
  const completionGuidance = (() => {
    if (!selectedExperiment) return '请先选择实验';
    if (preclassStartBlocked) return '等待服务端确认实验开始状态';
    if (isRunning) return '先停止运行，再核对并提交本次结果';
    if (fault) return '先修复执行错误并重新运行';
    if (!result?.success) {
      if (selectedExperiment === 'exp02') return '先成功运行，并累计执行至少 20 条指令';
      if (selectedExperiment === 'proj04') {
        return `先运行至少 ${PROJ04_MIN_OBSERVATION_STEPS} 步并观察完整 temp/humi 遥测帧`;
      }
      return '先无故障运行到程序正常结束';
    }
    if (selectedExperiment === 'proj04') {
      if (isLoadingProjectCompletion) return '正在读取项目里程碑证据';
      if (projectCompletionError) return '先在教程中处理项目证据读取或保存错误';
      if (isSavingProjectCompletion) return '正在保存项目里程碑证据';
      if (!proj04DraftReady) return '先处理代码草稿保存或版本冲突';
      if (!proj04ObservationReady) {
        return `继续运行至至少 ${PROJ04_MIN_OBSERVATION_STEPS} 步，并观察完整 temp/humi 遥测帧`;
      }
      if (!proj04ChecklistReady) return '打开教程，完成并保存五项里程碑证据自检';
    }
    if (selectedExperiment === 'exp02' && executionCount < 20) {
      return `还需执行 ${20 - executionCount} 条指令`;
    }
    if (selectedExperiment !== 'proj04' && simulatorState?.terminated !== true) {
      return '继续运行到程序正常结束';
    }
    return '完成条件已满足，可以提交';
  })();
  const showCompleteExperiment = Boolean(selectedExperiment);
  const selectedExperimentCompleted = Boolean(
    selectedExperiment && experimentStatus[selectedExperiment] === 'COMPLETED',
  );

  return (
    <TooltipProvider delayDuration={300}>
      <section aria-labelledby="simulation-page-title" className="circuit-grid animate-fade-in -m-4 flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-x-hidden bg-[#080a0d] text-[#d8f3f2] sm:-m-6 sm:-mt-4">
        <h1 id="simulation-page-title" className="sr-only">实验仿真工作台</h1>
        {/* ── Top Toolbar ── */}
        <div className="flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-1 overflow-hidden border-b border-white/[0.08] bg-[#0e1317]/95 px-2 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:flex-nowrap sm:overflow-x-auto">
          {/* Left section */}
          <div className="flex w-full flex-none flex-wrap items-center gap-1 overflow-visible sm:w-auto sm:flex-nowrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label={sidebarOpen ? '收起实验列表' : '展开实验列表'}
                  aria-expanded={sidebarOpen}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-[#7f9698] transition-colors hover:bg-white/[0.07] hover:text-[#d8f3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {sidebarOpen ? '收起实验列表' : '展开实验列表'}
              </TooltipContent>
            </Tooltip>

            <a
              href="#experiment-live-canvas"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 lg:hidden"
            >
              <Waypoints className="h-3.5 w-3.5" aria-hidden="true" />
              查看动态画布
            </a>

            <div className="mx-1 h-5 w-px bg-white/[0.09]" />

            {/* Run controls */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={isRunning ? stop : runSimulation}
                  disabled={isCompletingExperiment || preclassStartBlocked}
                  aria-label={isRunning ? '停止执行' : paused ? '从断点继续运行' : '运行程序'}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40",
                    isRunning
                      ? "bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25 ring-1 ring-cyan-300/20 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                      : "bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25 ring-1 ring-cyan-300/20"
                  )}
                >
                  {isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3.5 h-3.5" />}
                  {isRunning ? '停止' : paused ? '继续' : '运行'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isRunning ? '停止执行 (Shift+F5)' : paused ? '从断点继续 (F5)' : '运行程序 (F5)'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                onClick={stepSimulation}
                disabled={isRunning || isCompletingExperiment || preclassStartBlocked}
                  className="flex min-h-11 items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-[#9db3b5] transition-all hover:bg-white/[0.07] hover:text-[#d8f3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-30"
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
                  disabled={isCompletingExperiment}
                  className="flex min-h-11 items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-[#9db3b5] transition-all hover:bg-white/[0.07] hover:text-[#d8f3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重置
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">重置模拟器</TooltipContent>
            </Tooltip>

            <div className="mx-1 h-5 w-px bg-white/[0.09]" />

            {/* Speed control */}
            <div className="ml-auto flex basis-full items-center justify-end gap-1 pt-1 sm:ml-0 sm:basis-auto sm:justify-start sm:pt-0">
              <span className="hidden text-[10px] font-medium text-[#65777a] sm:inline">速度</span>
              <div className="flex rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5">
                {([['慢', 0], ['中', 1], ['快', 2], ['极速', 3]] as const).map(([label, idx]) => (
                  <button
                    key={label}
                    onClick={() => setSpeed(speedPresets[idx])}
                    disabled={isCompletingExperiment}
                    aria-label={`仿真速度：${label}`}
                    aria-pressed={speed === speedPresets[idx]}
                    className={cn(
                      "min-h-11 min-w-11 rounded px-2 py-1 text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40",
                      speed === speedPresets[idx]
                        ? "bg-cyan-300/90 text-[#001014]"
                        : "text-[#7f9698] hover:bg-white/[0.06] hover:text-[#c0dcde]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Status + experiment */}
          <div className="flex w-full min-w-0 flex-none items-center justify-start gap-3 border-t border-white/[0.06] px-1 pt-1 sm:w-auto sm:min-w-max sm:justify-center sm:border-0 sm:p-0">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full transition-all",
                isRunning || isCompletingExperiment
                  ? "bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.55)] pulse-dot"
                  : error
                    ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]"
                    : "bg-[#3b4a4d]"
              )} />
              <span className="text-[11px] font-medium text-[#9db3b5]">
                {isCompletingExperiment
                  ? '保存中'
                  : isRunning
                    ? selectedExperiment === 'proj04' ? '监测运行中' : '运行中'
                    : error
                      ? '错误'
                      : simulatorState?.terminated
                        ? '执行完毕'
                        : selectedExperiment === 'proj04' && proj04ObservationReady
                          ? '观测已记录'
                          : simulatorState ? '调试中' : '就绪'}
              </span>
            </div>

            {currentExp && ((): React.JSX.Element => {
              // 按实验分类显示对应小图标，找不到分类时回落 Cpu
              const CategoryIcon = CATEGORY_ICONS[currentExp.category] ?? Cpu;
              return (
                <Badge variant="outline" className="max-w-[15rem] truncate border-white/[0.10] bg-white/[0.04] text-[10px] font-medium text-[#9db3b5]">
                  <CategoryIcon className="mr-1 h-3 w-3 text-cyan-300" />
                  {currentExp.title}
                </Badge>
              );
            })()}

            {stepCount > 0 && (
              <span className="font-mono text-[10px] text-[#65777a]">
                PC: 0x{stepCount.toString(16).toUpperCase().padStart(4, '0')}
              </span>
            )}
          </div>

          {/* Right: Complete button */}
          {showCompleteExperiment && (
            <div className="flex w-full flex-none flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              {selectedExperiment === 'proj04' && (
                <button
                  type="button"
                  onClick={() => setActiveRightTab('guide')}
                  className="min-h-11 rounded-md px-2 py-1 text-left text-[10px] leading-4 text-[#9db3b5] transition-colors hover:bg-white/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  aria-label="打开教程核对项目完成条件"
                >
                  <span className={proj04TelemetryObserved ? 'text-emerald-300' : 'text-amber-200'}>
                    遥测 {proj04TelemetryObserved ? '已观察' : '待观察'}
                  </span>
                  <span className="mx-1 text-[#52666a]">·</span>
                  <span className={proj04ChecklistReady ? 'text-emerald-300' : 'text-amber-200'}>
                    里程碑 {proj04MilestoneCount}/5
                  </span>
                </button>
              )}
              <span id="experiment-completion-guidance" className="min-w-0 flex-1 text-right text-[10px] leading-4 text-[#7f9698] sm:max-w-[16rem]">
                {completionGuidance}
              </span>
              <button
                onClick={completeExperiment}
                disabled={isCompletingExperiment || !canCompleteExperiment}
                aria-busy={isCompletingExperiment}
                aria-describedby="experiment-completion-guidance"
                title={completionGuidance}
                className="flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-300/20 transition-all hover:bg-emerald-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCompletingExperiment ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isCompletingExperiment ? '正在保存…' : selectedExperiment === 'proj04' ? '完成项目' : '完成实验'}
              </button>
            </div>
          )}
        </div>

        {experimentLoadError && (
          <div className="flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-3 border-b border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100" role="alert" aria-live="polite">
            <span className="min-w-0 flex-1">{experimentLoadError}</span>
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setExperimentLoadError(null);
              }}
              className="inline-flex min-h-11 items-center rounded-md border border-amber-100/25 px-3 py-2 font-medium hover:bg-amber-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
            >
              查看可用实验
            </button>
          </div>
        )}

        {preclassExperimentId && (
          <div
            className={cn(
              'flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2 text-xs',
              preclassStartError
                ? 'border-red-300/20 bg-red-300/[0.07] text-red-100'
                : preclassStatus === 'COMPLETED'
                  ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
                  : 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100',
            )}
            role={preclassStartError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="min-w-0 flex-1">
              <span className="font-semibold">课前实验任务 · {preclassExperimentId}</span>
              <span className="ml-2 text-[11px] opacity-80">
                {isConfirmingPreclassStart
                  ? '正在向服务端确认开始状态，确认前暂不执行程序…'
                  : preclassStartError
                    ? preclassStartError
                    : preclassStatus === 'COMPLETED'
                      ? '服务端已确认完成；本次为回看或自主巩固，不会清除完成记录。'
                      : '进行中状态已保存；刷新、返回或重新登录后可继续。'}
              </span>
            </div>
            {preclassStartError && (
              <button
                type="button"
                onClick={() => { void confirmPreclassStart(preclassExperimentId); }}
                disabled={isConfirmingPreclassStart}
                className="inline-flex min-h-11 items-center rounded-md border border-red-200/25 px-3 py-2 font-medium hover:bg-red-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 disabled:opacity-50"
              >
                重新确认
              </button>
            )}
            <Link
              href="/tasks"
              className="inline-flex min-h-11 items-center rounded-md border border-white/[0.10] px-3 py-2 font-medium hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              返回我的任务
            </Link>
          </div>
        )}

        {selectedExperimentCompleted && !preclassExperimentId && (
          <div className="flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-3 border-b border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2 text-xs text-emerald-100" role="status" aria-live="polite">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {taskExperimentContext
                ? '服务端已有该实验的历史完成回执；当前任务是否完成仍以本次任务步骤回执为准，请按上方条件重新运行并提交。'
                : '服务端已有该实验的完成回执；当前回看或再次练习不会清除既有记录。'}
            </span>
            <Link
              href="/tasks"
              className="inline-flex min-h-11 items-center rounded-md border border-emerald-100/25 px-3 py-2 font-medium hover:bg-emerald-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
            >
              {taskExperimentContext ? '返回任务核对步骤状态' : '返回我的任务查看下一步'}
            </Link>
          </div>
        )}

        {/* ── 评委速览（首次显示·可关闭） ── */}
        {!guideDismissed && (
          <div className="flex w-full min-w-0 flex-shrink-0 items-center gap-2 border-b border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] text-[#a6c8ca]">
            <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-cyan-300" />
            <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
              <span className="font-medium text-cyan-200">评委速览：</span>
              点 <b className="text-[#d8f3f2]">运行</b> 看实时动画（速度可调）· 点代码行号或 <b className="text-[#d8f3f2]">F9</b> 设断点、支持运行到断点 · <b className="text-[#d8f3f2]">教程</b> 页含完整教学设计（三维目标·重难点·课程思政）· <b className="text-[#d8f3f2]">AI助教</b> 诊断代码
            </div>
            <button
              onClick={dismissGuide}
              title="不再显示"
              aria-label="关闭评委速览并不再显示"
              className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded p-1 text-[#7f9698] transition-colors hover:bg-white/[0.07] hover:text-[#d8f3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Main content: 3-panel layout ── */}
        {/* overflow-x-auto（而非 hidden）：窄视口/投影分辨率不足时右侧面板改为横向滚动可达，
            而不是被静默裁切到评委完全看不见、够不到 */}
        <div
          className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-x-auto lg:overflow-y-hidden"
          onScroll={(event) => {
            // 桌面三栏只允许横向滚动。浏览器聚焦代码编辑器时可能仍会偷偷改写
            // overflow-hidden 容器的 scrollTop，进而把草稿状态栏推到教学提示下方。
            if (window.innerWidth >= 1024 && event.currentTarget.scrollTop !== 0) {
              event.currentTarget.scrollTop = 0;
            }
          }}
        >
          {/* Left: Experiment selector */}
          <div className={cn(
            "min-w-0 max-w-full flex-shrink-0 overflow-hidden border-r border-white/[0.08] bg-[#0c1014]/96 shadow-[inset_-1px_0_0_rgba(255,255,255,0.025)] transition-all duration-300",
            sidebarOpen ? "h-64 w-full lg:h-auto lg:w-[260px]" : "h-0 w-full lg:h-auto lg:w-0"
          )}>
            <ExperimentSelector
              experiments={experiments}
              selectedExperiment={localSelectedExperiment ?? selectedExperiment}
              onExperimentSelect={(id) => setLocalSelectedExperiment(id)}
              onLoadExperiment={openExperiment}
              selectedDifficulty={selectedDifficulty}
              onDifficultyChange={setSelectedDifficulty}
              experimentStatus={experimentStatus}
              isLoadingStatus={isLoadingStatus}
              statusError={experimentStatusError}
              onRetryStatus={() => { void loadExperimentStatus(); }}
            />
          </div>

          {/* Center: Code editor */}
          {/* min-w-[320px]（而非0）：容器可横向滚动后，编辑器压到此宽度即停止收缩、改为触发滚动，
              保证代码始终可读，不会被压成一条缝 */}
          <div className="flex min-h-[420px] w-full min-w-0 max-w-full flex-col lg:min-w-[320px] lg:flex-1">
            {selectedExperiment && draftState.status !== 'IDLE' && (
              <div
                className={cn(
                  'flex min-h-9 flex-shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-[11px]',
                  draftState.status === 'ERROR'
                    ? 'border-red-300/20 bg-red-300/[0.07] text-red-100'
                    : draftState.status === 'CONFLICT' || draftState.status === 'LOCAL_SAVED'
                      ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100'
                      : draftState.status === 'READ_ONLY'
                        ? 'border-slate-300/15 bg-slate-300/[0.05] text-slate-200'
                        : 'border-cyan-300/15 bg-cyan-300/[0.045] text-cyan-100',
                )}
                role={draftState.status === 'ERROR' || draftState.status === 'CONFLICT' ? 'alert' : 'status'}
                aria-live="polite"
              >
                {draftState.status === 'LOADING' || draftState.status === 'SAVING' || draftState.status === 'SYNCING' ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : draftState.status === 'ERROR' || draftState.status === 'LOCAL_SAVED' ? (
                  <CloudOff className="h-3.5 w-3.5 shrink-0" />
                ) : draftState.status === 'CONFLICT' ? (
                  <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Cloud className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  {draftState.status === 'LOADING'
                    ? '正在读取服务端草稿，完成前不会自动覆盖。'
                    : draftState.status === 'DIRTY'
                      ? draftState.hasLocalBackup
                        ? '代码已保存在本机，将在片刻后同步到服务端。'
                        : '检测到代码修改，将在片刻后自动保存。'
                      : draftState.status === 'LOCAL_SAVED'
                        ? `网络不可用，代码已保存在本机；恢复联网后将自动同步${draftState.localSavedAt ? ` · ${new Date(draftState.localSavedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : ''}`
                        : draftState.status === 'SYNCING'
                          ? '网络已恢复，正在把本机草稿同步到服务端。'
                      : draftState.status === 'SAVING'
                        ? '正在保存草稿，请勿关闭页面。'
                        : draftState.status === 'SAVED'
                          ? `草稿已保存到服务端${draftState.savedAt ? ` · ${new Date(draftState.savedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : ''}`
                          : draftState.status === 'ERROR'
                            ? draftState.error ?? '当前更改尚未保存。'
                            : draftState.status === 'CONFLICT'
                              ? draftState.error ?? '另一个页面已更新此实验，请选择要保留的版本。'
                              : draftState.status === 'READ_ONLY'
                                ? draftState.hasLocalBackup
                                  ? draftState.error ?? '该实验已完成；当前显示的是本机未提交副本，仅供查看和复制。'
                                  : taskExperimentContext
                                    ? '你曾完成过该实验，已提交代码保持只读；本次任务仍需点击运行，exp02 执行至少 20 条指令后再点“完成实验”，平台会生成本任务的新回执。'
                                    : '该实验已有完成回执；当前编辑不会改写已提交代码。'
                                : '已核对当前版本；修改后将自动保存。'}
                </span>
                {draftState.status === 'ERROR' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (draftState.hasUnsavedChanges) void saveExperimentDraft();
                      else void loadExperimentDraft(selectedExperiment);
                    }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-red-200/25 px-3 py-2 font-medium hover:bg-red-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重试同步
                  </button>
                )}
                {draftState.status === 'CONFLICT' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('确认使用服务端版本吗？当前页面的本机草稿将被替换，此操作无法撤销。')) {
                          useServerDraft();
                        }
                      }}
                      className="inline-flex min-h-11 items-center rounded-md border border-amber-100/25 px-3 py-2 font-medium hover:bg-amber-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
                    >
                      使用服务端版本
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('确认把当前页面的本机代码同步为新的服务端草稿吗？此操作不会改写已完成实验的提交记录。')) {
                          void keepLocalDraft();
                        }
                      }}
                      className="inline-flex min-h-11 items-center rounded-md border border-amber-100/25 bg-amber-100/10 px-3 py-2 font-medium hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
                    >
                      保留当前代码
                    </button>
                  </div>
                )}
              </div>
            )}
            <CodeEditor
              code={code}
              onCodeChange={setCode}
              breakpoints={breakpointLines}
              onBreakpointToggle={toggleBreakpoint}
              currentLine={currentLine}
              isRunning={isRunning}
              onRun={runSimulation}
              onStep={stepSimulation}
              onReset={resetSimulation}
              onStop={stop}
              selectedExperiment={selectedExperiment || null}
              readOnly={draftState.status === 'READ_ONLY'}
            />
          </div>

          <HyperExperimentCanvas
            simulatorState={simulatorState}
            isRunning={isRunning}
            experimentId={selectedExperiment || null}
            onSetPortBit={setPortBit}
            onPulsePortBit={pulsePortBit}
          />

          {/* Right: Status panel */}
          <div className="flex min-h-[420px] w-full min-w-0 max-w-full flex-shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#0c1014]/96 shadow-[inset_1px_0_0_rgba(255,255,255,0.025)] lg:w-[260px] xl:w-[300px]">
            {/* Tab bar */}
            <div className="flex flex-shrink-0 border-b border-white/[0.08] bg-[#0e1317]">
              {([
                { key: 'registers' as const, label: '寄存器', icon: Activity },
                { key: 'memory' as const, label: '内存', icon: MemoryStick },
                { key: 'trace' as const, label: '追踪', icon: ScrollText },
                { key: 'guide' as const, label: '教程', icon: Cpu },
                { key: 'ai' as const, label: 'AI助教', icon: Sparkles },
                { key: 'console' as const, label: '控制台', icon: Terminal },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveRightTab(tab.key)}
                  aria-label={`切换到${tab.label}面板`}
                  aria-pressed={activeRightTab === tab.key}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200",
                    activeRightTab === tab.key
                      ? "border-cyan-300 bg-cyan-300/[0.07] text-cyan-200"
                      : "border-transparent text-[#7f9698] hover:bg-white/[0.05] hover:text-[#c0dcde]"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-auto transition-all duration-200">
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
                <ExecutionTrace traceLog={traceLog} totalExecuted={executionCount} />
              ) : activeRightTab === 'guide' ? (
                <ExperimentGuide
                  experiment={currentExp ?? null}
                  projectCompletion={projectCompletion}
                  isLoadingProjectCompletion={isLoadingProjectCompletion}
                  isSavingProjectCompletion={isSavingProjectCompletion}
                  projectCompletionError={projectCompletionError}
                  projectCompletionBlockedReason={projectCompletionBlockedReason}
                  onProjectMilestoneChange={saveProj04Milestone}
                />
              ) : activeRightTab === 'ai' ? (
                <AiDiagnostics code={code} fault={fault} experimentTitle={currentExp?.title} />
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
      </section>
    </TooltipProvider>
  );
}
