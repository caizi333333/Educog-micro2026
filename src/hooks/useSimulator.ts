import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';
import { Simulator, type SimulatorState, type ExecutionTraceEntry } from '@/lib/simulator';
import {
  experiments,
  emptyProj04CompletionEvidence,
  hasProj04TelemetryFrame,
  isProj04MilestoneEvidenceComplete,
  normalizeProj04CompletionEvidence,
  PROJ04_MIN_OBSERVATION_STEPS,
  type Proj04CompletionEvidence,
  type Proj04MilestoneId,
} from '@/lib/experiment-config';
import { getStoredAccessToken } from '@/lib/auth-storage';

export interface DiagnosticResult {
  success?: boolean;
  output?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ExperimentData {
  id?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ExperimentStatusData {
  id: string;
  name: string;
  status: string;
}

export interface ExperimentStatusMap {
  [experimentId: string]: string;
}

export type ExperimentDraftStatus =
  | 'IDLE'
  | 'LOADING'
  | 'CLEAN'
  | 'DIRTY'
  | 'LOCAL_SAVED'
  | 'SYNCING'
  | 'SAVING'
  | 'SAVED'
  | 'ERROR'
  | 'CONFLICT'
  | 'READ_ONLY';

export interface ExperimentDraftState {
  status: ExperimentDraftStatus;
  savedAt: string | null;
  error: string | null;
  hasUnsavedChanges: boolean;
  serverCode: string | null;
  serverUpdatedAt: string | null;
  localSavedAt?: string | null;
  hasLocalBackup?: boolean;
}

type DiagnosticSummary = {
  level: 'error' | 'info' | 'success';
  title: string;
  message: string;
  suggestions: string[];
};

export interface UseSimulatorResult {
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  state: SimulatorState;
  simulatorState: SimulatorState | null;
  previousState: SimulatorState | null;
  traceLog: ExecutionTraceEntry[];
  executionCount: number;
  isRunning: boolean;
  isCompletingExperiment: boolean;
  fault: string;
  result: DiagnosticResult | null;
  selectedExperiment: string;
  experimentStatus: ExperimentStatusMap;
  isLoadingStatus: boolean;
  experimentStatusError: string | null;
  draftState: ExperimentDraftState;
  projectCompletion: Proj04CompletionEvidence;
  isLoadingProjectCompletion: boolean;
  isSavingProjectCompletion: boolean;
  projectCompletionError: string | null;
  breakpoints: Set<number>;
  paused: boolean;
  speed: number;
  setSpeed: Dispatch<SetStateAction<number>>;
  speedPresets: number[];
  setExperimentStatus: Dispatch<SetStateAction<ExperimentStatusMap>>;
  runSimulation: () => void;
  stepSimulation: () => void;
  resetSimulation: () => void;
  loadExperiment: (experimentId: string) => void;
  loadExperimentStatus: () => Promise<void>;
  loadExperimentDraft: (experimentId: string) => Promise<void>;
  saveExperimentDraft: () => Promise<void>;
  useServerDraft: () => void;
  keepLocalDraft: () => Promise<void>;
  saveProj04Milestone: (milestoneId: Proj04MilestoneId, confirmed: boolean) => Promise<void>;
  startExperiment: (experimentId: string) => Promise<'IN_PROGRESS' | 'COMPLETED'>;
  completeExperiment: () => Promise<void>;
  getDiagnostics: () => DiagnosticSummary;
  setBreakpoint: (line: number) => void;
  removeBreakpoint: (line: number) => void;
  toggleBreakpoint: (line: number) => void;
  setPortBit: (port: 'P0' | 'P1' | 'P2' | 'P3', bit: number, level: boolean) => void;
  pulsePortBit: (port: 'P0' | 'P1' | 'P2' | 'P3', bit: number) => void;
  updateCode: (newCode: string) => void;
  run: () => void;
  step: () => void;
  stop: () => void;
  reset: () => void;
  getBreakpoints: () => number[];
  isAtBreakpoint: (line: number) => boolean;
}

const experimentSaveResponseSchema = z.object({
  success: z.literal(true),
  duplicate: z.boolean().optional(),
  experiment: z.object({
    experimentId: z.string(),
    status: z.literal('COMPLETED'),
  }),
  newAchievements: z.array(z.unknown()).nullable().optional(),
  pointsEarned: z.number().optional(),
});

const experimentStatusResponseSchema = z.object({
  success: z.literal(true),
  experiments: z.array(z.object({
    experimentId: z.string(),
    status: z.string(),
    lastCode: z.string().nullable().optional(),
    updatedAt: z.string().optional(),
    results: z.unknown().optional(),
  })).optional(),
});

const experimentStartResponseSchema = z.object({
  success: z.literal(true),
  duplicate: z.boolean().optional(),
  experiment: z.object({
    experimentId: z.string(),
    status: z.enum(['IN_PROGRESS', 'COMPLETED']),
  }),
  message: z.string().optional(),
});

const experimentDraftResponseSchema = z.object({
  success: z.literal(true),
  readOnly: z.boolean().optional(),
  experiment: z.object({
    experimentId: z.string(),
    status: z.string(),
  }),
  draft: z.object({
    code: z.string(),
    updatedAt: z.string(),
  }),
  message: z.string().optional(),
});

const experimentDraftConflictSchema = z.object({
  error: z.string(),
  code: z.literal('DRAFT_CONFLICT'),
  serverDraft: z.object({
    code: z.string(),
    updatedAt: z.string(),
    status: z.string(),
  }),
});

const projectChecklistSaveResponseSchema = z.object({
  success: z.literal(true),
  experiment: z.object({
    experimentId: z.literal('proj04'),
    status: z.string(),
    updatedAt: z.string().datetime({ offset: true }),
  }),
  projectCompletion: z.unknown(),
});

const EXPERIMENT_SAVE_TIMEOUT_MS = 20_000;
const EXPERIMENT_STATUS_TIMEOUT_MS = 15_000;
const EXPERIMENT_DRAFT_DEBOUNCE_MS = 1_200;
const LOCAL_EXPERIMENT_DRAFT_PREFIX = 'educog:experiment-draft:v1';

type LocalExperimentDraft = {
  version: 1;
  userId: string;
  experimentId: string;
  code: string;
  baseCode: string;
  baseUpdatedAt: string | null;
  savedAt: string;
};

class ExperimentRequestTimeoutError extends Error {
  constructor() {
    super('实验记录请求超时');
    this.name = 'ExperimentRequestTimeoutError';
  }
}

type ExperimentCompletionRequest = {
  scope: string;
  experimentId: string;
  completionKey: string;
  pathId?: string;
  stepId?: string;
  body: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function experimentStatusRank(status: string | undefined): number {
  if (status === 'COMPLETED') return 3;
  if (status === 'IN_PROGRESS') return 2;
  if (status === 'ASSIGNED' || status === 'NOT_STARTED') return 1;
  return 0;
}

function hasCompletionContext(
  results: unknown,
  expected: Pick<ExperimentCompletionRequest, 'completionKey' | 'pathId' | 'stepId'>,
): boolean {
  if (!isRecord(results)) return false;
  const contexts: unknown[] = [];
  if (Array.isArray(results.completionHistory)) contexts.push(...results.completionHistory);
  contexts.push(results.completionContext);
  return contexts.some((context) => isRecord(context)
    && context.completionKey === expected.completionKey
    && (typeof context.pathId === 'string' ? context.pathId : undefined) === expected.pathId
    && (typeof context.stepId === 'string' ? context.stepId : undefined) === expected.stepId);
}

async function fetchExperimentRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ExperimentRequestTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function reconcileExperimentCompletion(
  pendingCompletion: ExperimentCompletionRequest,
  token: string,
): Promise<boolean> {
  try {
    const response = await fetchExperimentRequest(
      `/api/experiments/save?experimentId=${encodeURIComponent(pendingCompletion.experimentId)}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      EXPERIMENT_STATUS_TIMEOUT_MS,
    );
    if (!response.ok) return false;
    const rawData: unknown = await response.json();
    const parsedData = experimentStatusResponseSchema.safeParse(rawData);
    if (!parsedData.success) return false;
    return (parsedData.data.experiments ?? []).some((experiment) =>
      experiment.experimentId === pendingCompletion.experimentId
      && experiment.status === 'COMPLETED'
      && hasCompletionContext(experiment.results, pendingCompletion));
  } catch {
    return false;
  }
}

function errorMessageOf(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

function userIdFromAccessToken(token: string | null): string | null {
  if (!token) return null;
  const payloadPart = token.split('.')[1];
  if (!payloadPart) return null;
  try {
    const parsed: unknown = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const userId = (parsed as Record<string, unknown>).userId;
    return typeof userId === 'string' ? userId : null;
  } catch {
    return null;
  }
}

function localExperimentDraftKey(userId: string, experimentId: string): string {
  return `${LOCAL_EXPERIMENT_DRAFT_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(experimentId)}`;
}

function readLocalExperimentDraft(userId: string | null, experimentId: string): LocalExperimentDraft | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localExperimentDraftKey(userId, experimentId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)
      || value.version !== 1
      || value.userId !== userId
      || value.experimentId !== experimentId
      || typeof value.code !== 'string'
      || typeof value.baseCode !== 'string'
      || (value.baseUpdatedAt !== null && typeof value.baseUpdatedAt !== 'string')
      || typeof value.savedAt !== 'string') return null;
    return value as LocalExperimentDraft;
  } catch {
    return null;
  }
}

function writeLocalExperimentDraft(
  userId: string | null,
  experimentId: string,
  code: string,
  baseCode: string,
  baseUpdatedAt: string | null,
): LocalExperimentDraft | null {
  if (!userId || typeof window === 'undefined') return null;
  const draft: LocalExperimentDraft = {
    version: 1,
    userId,
    experimentId,
    code,
    baseCode,
    baseUpdatedAt,
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(localExperimentDraftKey(userId, experimentId), JSON.stringify(draft));
    return draft;
  } catch {
    return null;
  }
}

function removeLocalExperimentDraft(userId: string | null, experimentId: string): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(localExperimentDraftKey(userId, experimentId));
  } catch {
    // Storage may be unavailable in privacy modes; server persistence remains authoritative.
  }
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

const TRACE_REGISTER_NAMES = ['A', 'B', 'SP', 'DPL', 'DPH', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] as const;
const TRACE_FLAG_NAMES = ['CY', 'AC', 'F0', 'RS1', 'RS0', 'OV', 'P'] as const;

/**
 * 实时运行一次会批量执行数百至数万条指令。这里为每个动画帧生成一条
 * 可复核的批次记录，既保留关键状态变化，又避免逐指令深拷贝拖垮页面。
 */
function buildBatchTrace(
  previous: SimulatorState,
  current: SimulatorState,
  executed: number,
  totalExecuted: number,
): ExecutionTraceEntry {
  const regChanges: ExecutionTraceEntry['regChanges'] = [];
  for (const name of TRACE_REGISTER_NAMES) {
    const from = previous.registers[name] ?? 0;
    const to = current.registers[name] ?? 0;
    if (from !== to) regChanges.push({ name, from, to });
  }
  if (previous.pc !== current.pc) regChanges.push({ name: 'PC', from: previous.pc, to: current.pc });

  const memChanges: ExecutionTraceEntry['memChanges'] = [];
  const memoryLimit = Math.min(previous.ram.length, current.ram.length, 128);
  for (let addr = 0; addr < memoryLimit && memChanges.length < 32; addr++) {
    const from = previous.ram[addr] ?? 0;
    const to = current.ram[addr] ?? 0;
    if (from !== to) memChanges.push({ addr, from, to });
  }

  const portChanges: ExecutionTraceEntry['portChanges'] = [];
  for (const port of ['P0', 'P1', 'P2', 'P3'] as const) {
    const from = previous.portValues[port];
    const to = current.portValues[port];
    if (from !== to) portChanges.push({ port, from, to });
  }

  const flagChanges: ExecutionTraceEntry['flagChanges'] = [];
  for (const flag of TRACE_FLAG_NAMES) {
    const from = previous.psw[flag];
    const to = current.psw[flag];
    if (from !== to) flagChanges.push({ flag, from, to });
  }

  return {
    step: totalExecuted,
    pc: previous.pc,
    instruction: `连续运行 ${executed} 条指令`,
    line: previous.currentLine,
    regChanges,
    memChanges,
    portChanges,
    flagChanges,
  };
}

export const useSimulator = (): UseSimulatorResult => {
  const { toast } = useToast();
  const simulatorRef = useRef<Simulator | null>(null);
  
  const [code, setCode] = useState(`; 8051 LED闪烁示例
ORG 0000H
    LJMP MAIN
ORG 0030H
MAIN:
    MOV P1, #0FFH
    LCALL DELAY
    MOV P1, #00H
    LCALL DELAY
    SJMP MAIN
DELAY:
    MOV R7, #0FFH
D1: MOV R6, #0FFH
D2: DJNZ R6, D2
    DJNZ R7, D1
    RET
    END`);
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompletingExperiment, setIsCompletingExperiment] = useState(false);
  const [paused, setPaused] = useState(false); // 停在断点/单步处（"运行"→"继续"）
  const [fault, setFault] = useState('');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatusMap>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [experimentStatusError, setExperimentStatusError] = useState<string | null>(null);
  const [draftState, setDraftState] = useState<ExperimentDraftState>({
    status: 'IDLE',
    savedAt: null,
    error: null,
    hasUnsavedChanges: false,
    serverCode: null,
    serverUpdatedAt: null,
    localSavedAt: null,
    hasLocalBackup: false,
  });
  const [projectCompletion, setProjectCompletion] = useState<Proj04CompletionEvidence>(
    emptyProj04CompletionEvidence,
  );
  const [isLoadingProjectCompletion, setIsLoadingProjectCompletion] = useState(false);
  const [isSavingProjectCompletion, setIsSavingProjectCompletion] = useState(false);
  const [projectCompletionError, setProjectCompletionError] = useState<string | null>(null);
  const [previousState, setPreviousState] = useState<SimulatorState | null>(null);
  const [traceLog, setTraceLog] = useState<ExecutionTraceEntry[]>([]);
  const [executionCount, setExecutionCount] = useState(0);
  const MAX_TRACE_ENTRIES = 200;
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());

  // ── 实时动画运行 ──
  // 运行速度 = 每一帧连续执行多少条指令。学生写的 DELAY 延时循环因此产生真实的
  // 时间感：LED 会真的以肉眼可见的节奏闪烁，而不是一次性跑到终点只显示定格状态。
  const SPEED_PRESETS = [600, 2000, 6000, 16000]; // 慢 / 中 / 快 / 极速
  const [speed, setSpeed] = useState<number>(SPEED_PRESETS[1]);
  const speedRef = useRef<number>(SPEED_PRESETS[1]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const runningRef = useRef(false); // 动画循环是否在跑（真·停止的开关）
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const executionCountRef = useRef(0);
  const completionKeyRef = useRef<{ scope: string; key: string } | null>(null);
  const completionInFlightRef = useRef(false);
  const projectCompletionSaveInFlightRef = useRef(false);
  const projectCompletionRef = useRef<Proj04CompletionEvidence>(emptyProj04CompletionEvidence());
  const pendingCompletionRef = useRef<ExperimentCompletionRequest | null>(null);
  const statusLoadAbortRef = useRef<AbortController | null>(null);
  const statusLoadIdRef = useRef(0);
  const draftLoadIdRef = useRef(0);
  const draftSaveInFlightRef = useRef(false);
  const draftSaveTimerRef = useRef<number | null>(null);
  const draftReadyExperimentRef = useRef<string | null>(null);
  const draftBaselineCodeRef = useRef('');
  const draftServerUpdatedAtRef = useRef<string | null>(null);
  const draftConflictRef = useRef<{ code: string; updatedAt: string } | null>(null);
  const draftLocalRef = useRef<LocalExperimentDraft | null>(null);
  const draftReadOnlyRef = useRef(false);
  const codeRef = useRef(code);
  const selectedExperimentRef = useRef(selectedExperiment);
  const draftTabIdRef = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  );
  const draftChannelRef = useRef<BroadcastChannel | null>(null);
  const saveDraftRef = useRef<(baseUpdatedAt?: string | null) => Promise<void>>(async () => undefined);

  const applyProjectCompletion = useCallback((value: unknown): Proj04CompletionEvidence => {
    const normalized = normalizeProj04CompletionEvidence(value);
    projectCompletionRef.current = normalized;
    setProjectCompletion(normalized);
    return normalized;
  }, []);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { selectedExperimentRef.current = selectedExperiment; }, [selectedExperiment]);

  // 卸载时确保动画循环停止，避免离开页面后仍在后台步进
  useEffect(() => {
    mountedRef.current = true;
    return (): void => {
      mountedRef.current = false;
      runningRef.current = false;
      if (rafRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current);
      }
      statusLoadAbortRef.current?.abort();
      if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
      draftChannelRef.current?.close();
      rafRef.current = null;
    };
  }, []);

  const cancelLoop = useCallback((): void => {
    runningRef.current = false;
    if (rafRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = null;
  }, []);

  // ── 断点（运行到断点暂停）──
  // 用 ref 镜像断点集合，让动画循环每帧读取到最新断点（运行中增删断点即时生效）
  const breakpointsRef = useRef<Set<number>>(new Set());
  useEffect(() => { breakpointsRef.current = breakpoints; }, [breakpoints]);
  const resumableRef = useRef(false); // 仿真器是否停在可继续的中间态（断点暂停/单步后）→ 决定"运行"是继续还是重开
  const loadedCodeRef = useRef<string>(''); // 当前已编译进仿真器的代码

  const toggleBreakpoint = useCallback((line: number): void => {
    setBreakpoints(prev => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      return next;
    });
  }, []);

  // 在hook初始化时就创建Simulator实例（用于兼容测试）
  simulatorRef.current ??= new Simulator();

  // 初始化仿真器
  const initializeSimulator = (): Simulator => {
    simulatorRef.current ??= new Simulator();
    return simulatorRef.current;
  };

  const portValuesHex = (s: SimulatorState): Record<'P0' | 'P1' | 'P2' | 'P3', string> => ({
    P0: '0x' + s.portValues.P0.toString(16).toUpperCase().padStart(2, '0'),
    P1: '0x' + s.portValues.P1.toString(16).toUpperCase().padStart(2, '0'),
    P2: '0x' + s.portValues.P2.toString(16).toUpperCase().padStart(2, '0'),
    P3: '0x' + s.portValues.P3.toString(16).toUpperCase().padStart(2, '0'),
  });

  // 程序自然终止（遇到 END / PC 越界）时收尾
  const finalizeRun = useCallback((finalState: SimulatorState): void => {
    setPaused(false);
    setResult({
      success: true,
      output: '仿真执行成功',
      registers: { ...finalState.registers },
      portValues: portValuesHex(finalState),
      leds: Array.from({ length: 8 }, (_, i) => ((finalState.portValues.P1 >> i) & 1) === 0),
      psw: { ...finalState.psw },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simulatorRun', { detail: finalState }));
    }
  }, []);

  // 运行仿真 —— 逐帧批量步进的真实动画执行
  // 支持：运行到断点暂停；断点/单步暂停后再点"运行"从当前位置继续
  const runSimulation = (): void => {
    if (runningRef.current) return;
    if (!code.trim()) {
      toast({
        title: '代码为空',
        description: '请输入汇编代码后再执行仿真',
        variant: 'destructive'
      });
      return;
    }

    const simulator = initializeSimulator();

    const isTerminated = typeof simulator.getState === 'function' ? simulator.getState().terminated : false;
    // 停在断点/单步处、代码未变、且未终止 → 从当前位置继续；否则从头干净运行
    const resume = resumableRef.current && loadedCodeRef.current === code && !isTerminated;

    if (!resume) {
      setFault('');
      setResult(null);
      setPreviousState(null);
      setTraceLog([]);
      executionCountRef.current = 0;
      setExecutionCount(0);
      completionKeyRef.current = null;
      try {
        simulator.reset();
        simulator.updateCode(code);
        loadedCodeRef.current = code;
        if (typeof simulator.getState === 'function') {
          setSimulatorState(simulator.getState());
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '代码解析失败';
        setFault(errorMessage);
        setResult({ success: false, error: errorMessage });
        toast({ title: '仿真执行失败', description: errorMessage, variant: 'destructive' });
        return;
      }
    }

    resumableRef.current = false;
    runningRef.current = true;
    setIsRunning(true);
    setPaused(false);

    // 测试环境（无 requestAnimationFrame）下只需保持 isRunning 状态即可
    if (typeof requestAnimationFrame === 'undefined' || typeof simulator.stepBatch !== 'function') {
      return;
    }

    const tick = (): void => {
      if (!runningRef.current || !mountedRef.current) return;
      try {
        const before = simulator.getState();
        const { terminated, hitBreakpoint, executed } = simulator.stepBatch(speedRef.current, breakpointsRef.current);
        const state = simulator.getState();
        if (executed > 0) {
          executionCountRef.current += executed;
          setExecutionCount(executionCountRef.current);
          setPreviousState(before);
          const batchTrace = buildBatchTrace(before, state, executed, executionCountRef.current);
          setTraceLog((previous) => [...previous.slice(-(MAX_TRACE_ENTRIES - 1)), batchTrace]);
        }
        setSimulatorState(state);
        if (hitBreakpoint) {
          cancelLoop();
          resumableRef.current = true;
          setIsRunning(false);
          setPaused(true);
          setResult(prev => prev ?? { success: true, output: '已在断点暂停' });
          toast({ title: '已在断点暂停', description: `第 ${state.currentLine + 1} 行 · 可单步或继续运行` });
          return;
        }
        if (terminated) {
          cancelLoop();
          setIsRunning(false);
          finalizeRun(state);
          return;
        }
      } catch (error) {
        cancelLoop();
        setIsRunning(false);
        const errorMessage = error instanceof Error ? error.message : '仿真执行失败';
        setFault(errorMessage);
        setResult({ success: false, error: errorMessage });
        toast({ title: '仿真执行失败', description: errorMessage, variant: 'destructive' });
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // 单步执行
  const stepSimulation = (): void => {
    if (!code.trim()) {
      toast({
        title: '代码为空',
        description: '请输入汇编代码后再执行单步',
        variant: 'destructive'
      });
      return;
    }

    try {
      const simulator = initializeSimulator();
      cancelLoop(); // 防御：若处于动画运行中先停（正常 UI 下运行时单步已禁用）

      const isTerminated = typeof simulator.getState === 'function' ? simulator.getState().terminated : false;
      // 首次单步 / 代码已改 / 已终止 → 重新加载；停在断点或上次单步处 → 从当前位置继续
      const needsInit = loadedCodeRef.current !== code || isTerminated;

      if (needsInit) {
        simulator.reset();
        simulator.updateCode(code);
        loadedCodeRef.current = code;
        setFault('');
        setResult(null);
        setTraceLog([]);
        executionCountRef.current = 0;
        setExecutionCount(0);
        completionKeyRef.current = null;

        // 显示初始状态（PC=0, 未执行任何指令）
        if (typeof simulator.getState === 'function') {
          setSimulatorState(simulator.getState());
        }
      }

      setPreviousState(simulatorState);

      // 执行单步（带追踪）
      const { state: newState, trace } = simulator.stepWithTrace();
      executionCountRef.current += 1;
      setExecutionCount(executionCountRef.current);
      trace.step = executionCountRef.current;
      setTraceLog(prev => [...prev.slice(-(MAX_TRACE_ENTRIES - 1)), trace]);

      setSimulatorState(newState);
      // 单步后仿真器处于可继续的中间态 → "运行"应从此处继续
      resumableRef.current = !newState.terminated;
      setPaused(!newState.terminated);

      // 如果程序已终止，通知用户
      if (newState.terminated) {
        setResult({
          success: true,
          output: '程序执行完毕',
          portValues: {
            P0: '0x' + newState.portValues.P0.toString(16).toUpperCase().padStart(2, '0'),
            P1: '0x' + newState.portValues.P1.toString(16).toUpperCase().padStart(2, '0'),
            P2: '0x' + newState.portValues.P2.toString(16).toUpperCase().padStart(2, '0'),
            P3: '0x' + newState.portValues.P3.toString(16).toUpperCase().padStart(2, '0'),
          },
        });
      }

      // 触发状态更新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simulatorStep', { detail: newState }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '单步执行失败';
      setFault(errorMessage);
      toast({
        title: '单步执行失败',
        description: errorMessage,
        variant: 'destructive'
      });

      // 尝试恢复当前状态
      if (simulatorRef.current) {
        try {
          const currentState = simulatorRef.current.getState();
          setSimulatorState(currentState);
        } catch (recoveryError) {
          console.error('Failed to recover simulator state:', recoveryError);
        }
      }
    }
  };

  // 重置仿真器
  const resetSimulation = useCallback((): void => {
    cancelLoop();
    if (simulatorRef.current) {
      simulatorRef.current.reset();
    }
    loadedCodeRef.current = '';
    resumableRef.current = false;
    setPaused(false);
    setSimulatorState(null);
    setPreviousState(null);
    setTraceLog([]);
    executionCountRef.current = 0;
    setExecutionCount(0);
    completionKeyRef.current = null;
    setFault('');
    setResult(null);
    setIsRunning(false);
  }, [cancelLoop]);

  // 加载实验
  const loadExperiment = useCallback((experimentId: string): void => {
    const experiment = experiments.find(exp => exp.id === experimentId);
    if (experiment) {
      if (draftReadyExperimentRef.current === selectedExperimentRef.current
        && codeRef.current !== draftBaselineCodeRef.current
        && !draftConflictRef.current
        && !draftReadOnlyRef.current) {
        void saveDraftRef.current();
      }
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      draftReadyExperimentRef.current = null;
      draftConflictRef.current = null;
      draftLocalRef.current = null;
      draftReadOnlyRef.current = false;
      selectedExperimentRef.current = experimentId;
      codeRef.current = experiment.code;
      setCode(experiment.code);
      setSelectedExperiment(experimentId);
      applyProjectCompletion(null);
      setIsLoadingProjectCompletion(experimentId === 'proj04');
      setIsSavingProjectCompletion(false);
      setProjectCompletionError(null);
      setDraftState({
        status: 'IDLE',
        savedAt: null,
        error: null,
        hasUnsavedChanges: false,
        serverCode: null,
        serverUpdatedAt: null,
        localSavedAt: null,
        hasLocalBackup: false,
      });
      // 按实验声明配置蜂鸣器输出引脚（如 exp07 的 P2.0），供仿真器跟踪翻转推算频率
      if (simulatorRef.current?.setBuzzerPin) {
        simulatorRef.current.setBuzzerPin(
          experiment.peripheral?.kind === 'buzzer' ? experiment.peripheral.buzzerPin ?? null : null,
        );
      }
      resetSimulation();

      toast({
        title: '实验加载成功',
        description: `已加载实验: ${experiment.title}`,
        // 1280×720 分辨率下 /simulation 页面右侧紧贴"课前预习检测"面板，
        // 默认 toast 时长会遮挡选项内容较久，此处缩短停留时间以减少遮挡窗口
        duration: 1500,
      });
    }
  }, [applyProjectCompletion, resetSimulation, toast]);

  // 外部输入：改写端口位锁存电平（画布按键按下拉低、松开回高），并立即刷新画面
  const setPortBit = useCallback((port: 'P0' | 'P1' | 'P2' | 'P3', bit: number, level: boolean): void => {
    const simulator = simulatorRef.current;
    if (!simulator?.setPortBit) return;
    simulator.setPortBit(port, bit, level);
    // 未在运行时也让画布立刻反映电平变化（运行中由动画循环每帧刷新）
    if (!runningRef.current && typeof simulator.getState === 'function') {
      setSimulatorState(simulator.getState());
    }
  }, []);

  // 瞬时按键：拉低固定指令数后自动回高（时长短于实验代码的消抖延时，单击只触发一次）
  const pulsePortBit = useCallback((port: 'P0' | 'P1' | 'P2' | 'P3', bit: number): void => {
    const simulator = simulatorRef.current;
    if (!simulator?.pulsePortBit) return;
    simulator.pulsePortBit(port, bit);
    if (!runningRef.current && typeof simulator.getState === 'function') {
      setSimulatorState(simulator.getState());
    }
  }, []);

  // 记录实验完成
  const recordExperimentCompletion = useCallback(async (experimentId: string): Promise<void> => {
    const token = getStoredAccessToken();
    if (!token) throw new Error('未登录');

    const finalSimulatorState = simulatorState;
    const executedSteps = executionCountRef.current;
    const exp02ObservationReady = experimentId === 'exp02' && executedSteps >= 20;
    const uartTail = finalSimulatorState?.uart?.transmitBuffer.slice(-512) ?? '';
    const proj04ObservationReady = experimentId === 'proj04'
      && executedSteps >= PROJ04_MIN_OBSERVATION_STEPS
      && hasProj04TelemetryFrame(uartTail);
    const executionReady = experimentId === 'proj04'
      ? proj04ObservationReady
      : finalSimulatorState?.terminated === true || exp02ObservationReady;
    if (!result?.success || !finalSimulatorState || !executionReady || fault) {
      throw new Error(experimentId === 'proj04'
        ? '请先无故障运行至出现完整 temp/humi 遥测帧，再手动停止观测；持续循环无需执行到 END'
        : '请先无故障运行程序至正常结束，再提交实验结果');
    }
    const verifiedProjectCompletion = projectCompletionRef.current;
    if (experimentId === 'proj04' && !isProj04MilestoneEvidenceComplete(verifiedProjectCompletion)) {
      throw new Error('请先在教程中完成五个项目里程碑的证据自检并确认保存');
    }
    const params = new URLSearchParams(window.location.search);
    const pathId = params.get('taskPathId') ?? undefined;
    const stepId = params.get('taskStepId') ?? undefined;
    const scope = pathId && stepId ? `task:${pathId}:${stepId}` : `standalone:${experimentId}`;
    let completionKey: string;
    if (pathId && stepId) {
      completionKey = `experiment:${pathId}:${stepId}`;
    } else {
      if (!completionKeyRef.current || completionKeyRef.current.scope !== scope) {
        const runId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
        completionKeyRef.current = { scope, key: `experiment:${scope}:${runId}` };
      }
      completionKey = completionKeyRef.current.key;
    }

    const pendingCompletion = pendingCompletionRef.current?.scope === scope
      ? pendingCompletionRef.current
      : {
        scope,
        experimentId,
        completionKey,
        pathId,
        stepId,
        body: JSON.stringify({
          experimentId,
          status: 'COMPLETED',
          code: code,
          pathId,
          stepId,
          completionKey,
          results: {
            ...result,
            execution: {
              terminated: finalSimulatorState.terminated,
              traceSteps: executedSteps,
              faultFree: !fault,
              observationComplete: exp02ObservationReady || proj04ObservationReady,
            },
            ...(experimentId === 'proj04' ? {
              projectObservation: {
                uartTail,
                sensorSnapshot: {
                  temperatureHigh: finalSimulatorState.ram[0x40] ?? null,
                  temperatureLow: finalSimulatorState.ram[0x41] ?? null,
                  humidity: finalSimulatorState.ram[0x42] ?? null,
                  alarm: finalSimulatorState.ram[0x43] ?? null,
                },
              },
              projectCompletion: verifiedProjectCompletion,
            } : {}),
          },
        }),
      };
    pendingCompletionRef.current = pendingCompletion;

    let response: Response;
    try {
      response = await fetchExperimentRequest('/api/experiments/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: pendingCompletion.body,
      }, EXPERIMENT_SAVE_TIMEOUT_MS);
    } catch (error) {
      const completionConfirmed = error instanceof TypeError || error instanceof ExperimentRequestTimeoutError
        ? await reconcileExperimentCompletion(pendingCompletion, token)
        : false;
      if (completionConfirmed) {
        pendingCompletionRef.current = null;
        if (mountedRef.current) setExperimentStatus(prev => ({ ...prev, [experimentId]: 'COMPLETED' }));
        return;
      }
      if (error instanceof TypeError || error instanceof ExperimentRequestTimeoutError) {
        throw new Error('保存结果暂未确认，请保持当前页面后重试；再次提交会沿用同一完成编号。');
      }
      throw error;
    }

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch((): Record<string, never> => ({}));
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (retryable && await reconcileExperimentCompletion(pendingCompletion, token)) {
        pendingCompletionRef.current = null;
        if (mountedRef.current) setExperimentStatus(prev => ({ ...prev, [experimentId]: 'COMPLETED' }));
        return;
      }
      if (!retryable) pendingCompletionRef.current = null;
      throw new Error(errorMessageOf(errorBody, `保存失败: HTTP ${response.status}`));
    }

    const rawData: unknown = await response.json();
    const parsedData = experimentSaveResponseSchema.safeParse(rawData);
    if (!parsedData.success) throw new Error('实验保存结果格式异常');
    const data = parsedData.data;
    if (data.experiment.experimentId !== experimentId) throw new Error('实验保存回执与当前实验不匹配');
    pendingCompletionRef.current = null;

    // Invalidate analytics cache so dashboard refreshes
    try {
      const uid = typeof window !== 'undefined'
        ? userIdFromAccessToken(getStoredAccessToken())
        : null;
      if (uid) {
        localStorage.removeItem(`analytics_${uid}`);
        localStorage.removeItem(`analytics_${uid}_time`);
      }
    } catch { /* non-critical */ }

    // 处理成就通知
    if (mountedRef.current && data.newAchievements && data.newAchievements.length > 0) {
      processAchievementResponse({ newAchievements: data.newAchievements });
    }

    // 显示积分奖励通知
    if (mountedRef.current && (data.pointsEarned ?? 0) > 0) {
      toast({
        title: '实验完成！',
        description: `获得 ${data.pointsEarned ?? 0} 积分`,
      });
    }

    // 更新实验状态
    if (mountedRef.current) {
      setExperimentStatus(prev => ({
        ...prev,
        [experimentId]: 'COMPLETED'
      }));
    }
  }, [code, fault, result, simulatorState, toast]);

  // 获取诊断信息
  const getDiagnostics = (): DiagnosticSummary => {
    if (fault) {
      return {
        level: 'error' as const,
        title: '执行错误',
        message: fault,
        suggestions: [
          '检查指令拼写是否正确',
          '确认寄存器和地址范围',
          '验证程序逻辑和跳转标签'
        ]
      };
    }

    if (!result || !simulatorState) {
      return {
        level: 'info' as const,
        title: '等待执行',
        message: '请点击"仿真执行"按钮开始程序仿真',
        suggestions: ['选择一个实验模板开始', '或编写自定义汇编代码']
      };
    }

    // 分析执行结果
    const pc = simulatorState.pc;
    const totalInstructions = simulatorState.memory.length;
    
    return {
      level: 'success' as const,
      title: '执行正常',
      message: `程序计数器: ${pc.toString(16).toUpperCase().padStart(4, '0')}H`,
      suggestions: [
        `已执行 ${pc} / ${totalInstructions} 条指令`,
        '检查寄存器和端口状态',
        '使用单步调试观察程序执行'
      ]
    };
  };

  // 加载实验状态
  const loadExperimentStatus = useCallback(async (): Promise<void> => {
    statusLoadAbortRef.current?.abort();
    const controller = new AbortController();
    statusLoadAbortRef.current = controller;
    const requestId = ++statusLoadIdRef.current;
    const timeoutId = window.setTimeout(() => controller.abort(), EXPERIMENT_STATUS_TIMEOUT_MS);
    setIsLoadingStatus(true);
    setExperimentStatusError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setExperimentStatus({});
        setExperimentStatusError('登录状态已失效，暂时无法读取实验完成记录。');
        return;
      }

      const response = await fetch('/api/experiments/save', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!mountedRef.current || requestId !== statusLoadIdRef.current) return;

      if (response.ok) {
        const rawData: unknown = await response.json();
        const parsedData = experimentStatusResponseSchema.safeParse(rawData);
        if (parsedData.success && parsedData.data.success && parsedData.data.experiments) {
          setExperimentStatus((current) => {
            const statusMap: ExperimentStatusMap = { ...current };
            parsedData.data.experiments?.forEach((exp) => {
              // “开始实验”与全量状态读取可能并发返回；较旧的 ASSIGNED
              // 响应不得覆盖已经确认的 IN_PROGRESS/COMPLETED。
              if (experimentStatusRank(exp.status) >= experimentStatusRank(statusMap[exp.experimentId])) {
                statusMap[exp.experimentId] = exp.status;
              }
            });
            return statusMap;
          });
        } else {
          setExperimentStatusError('实验完成记录格式异常，请重新加载。');
        }
      } else {
        const errorBody: unknown = await response.json().catch((): Record<string, never> => ({}));
        if (response.status === 401) setExperimentStatus({});
        setExperimentStatusError(response.status === 401
          ? '登录状态已失效，暂时无法读取实验完成记录。'
          : errorMessageOf(errorBody, '实验完成记录加载失败，请重试。'));
      }
    } catch (error) {
      if (!mountedRef.current || requestId !== statusLoadIdRef.current) return;
      console.error('加载实验状态失败:', error);
      setExperimentStatusError(controller.signal.aborted
        ? '实验完成记录加载超时，请重试。'
        : '网络异常，实验完成记录加载失败，请重试。');
    } finally {
      window.clearTimeout(timeoutId);
      if (statusLoadAbortRef.current === controller) statusLoadAbortRef.current = null;
      if (mountedRef.current && requestId === statusLoadIdRef.current) setIsLoadingStatus(false);
    }
  }, []);

  const loadExperimentDraft = useCallback(async (experimentId: string): Promise<void> => {
    const requestId = ++draftLoadIdRef.current;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    draftReadyExperimentRef.current = null;
    draftConflictRef.current = null;
    draftReadOnlyRef.current = false;
    if (experimentId === 'proj04') {
      setIsLoadingProjectCompletion(true);
      setProjectCompletionError(null);
    } else {
      setIsLoadingProjectCompletion(false);
      setProjectCompletionError(null);
    }
    const token = getStoredAccessToken();
    const userId = userIdFromAccessToken(token);
    const localDraft = readLocalExperimentDraft(userId, experimentId);
    draftLocalRef.current = localDraft;
    if (localDraft) {
      codeRef.current = localDraft.code;
      setCode(localDraft.code);
    }
    setDraftState({
      status: 'LOADING',
      savedAt: null,
      error: null,
      hasUnsavedChanges: localDraft !== null,
      serverCode: null,
      serverUpdatedAt: null,
      localSavedAt: localDraft?.savedAt ?? null,
      hasLocalBackup: localDraft !== null,
    });

    const restoreAfterLoadFailure = (message: string, authFailed = false): void => {
      draftReadyExperimentRef.current = experimentId;
      draftBaselineCodeRef.current = localDraft?.baseCode ?? codeRef.current;
      draftServerUpdatedAtRef.current = localDraft?.baseUpdatedAt ?? null;
      if (localDraft) {
        codeRef.current = localDraft.code;
        setCode(localDraft.code);
      }
      setDraftState({
        status: localDraft && !authFailed ? 'LOCAL_SAVED' : 'ERROR',
        savedAt: localDraft?.baseUpdatedAt ?? null,
        error: localDraft
          ? `${message} 本机草稿仍在，恢复后可继续同步。`
          : message,
        hasUnsavedChanges: localDraft !== null,
        serverCode: null,
        serverUpdatedAt: localDraft?.baseUpdatedAt ?? null,
        localSavedAt: localDraft?.savedAt ?? null,
        hasLocalBackup: localDraft !== null,
      });
      if (experimentId === 'proj04') {
        setIsLoadingProjectCompletion(false);
        setProjectCompletionError(`${message} 项目里程碑状态尚未恢复，完成入口保持锁定。`);
      }
    };

    if (!token) {
      restoreAfterLoadFailure('登录已过期，当前代码尚未同步到服务端。', true);
      return;
    }

    try {
      const response = await fetchExperimentRequest(
        `/api/experiments/save?experimentId=${encodeURIComponent(experimentId)}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        },
        EXPERIMENT_STATUS_TIMEOUT_MS,
      );
      if (!mountedRef.current || requestId !== draftLoadIdRef.current
        || selectedExperimentRef.current !== experimentId) return;
      const rawData: unknown = await response.json().catch((): Record<string, never> => ({}));
      if (!response.ok) {
        restoreAfterLoadFailure(
          response.status === 401
            ? '登录已过期，当前代码尚未同步到服务端。'
            : errorMessageOf(rawData, '草稿加载失败，请重试。'),
          response.status === 401,
        );
        return;
      }
      const parsedData = experimentStatusResponseSchema.safeParse(rawData);
      if (!parsedData.success) {
        restoreAfterLoadFailure('草稿数据格式异常，请重新加载。');
        return;
      }
      const record = parsedData.data.experiments?.find((item) => item.experimentId === experimentId);
      if (experimentId === 'proj04') {
        const recordResults = isRecord(record?.results) ? record.results : null;
        applyProjectCompletion(recordResults?.projectCompletion);
        setIsLoadingProjectCompletion(false);
        setProjectCompletionError(null);
      }
      const templateCode = experiments.find((item) => item.id === experimentId)?.code ?? codeRef.current;
      const serverCode = typeof record?.lastCode === 'string' ? record.lastCode : templateCode;
      const updatedAt = record?.updatedAt ?? null;

      if (record?.status === 'COMPLETED') {
        const hasLocalUnsubmittedCode = Boolean(localDraft && localDraft.code !== serverCode);
        if (!hasLocalUnsubmittedCode) {
          removeLocalExperimentDraft(userId, experimentId);
          draftLocalRef.current = null;
        }
        draftBaselineCodeRef.current = serverCode;
        draftServerUpdatedAtRef.current = updatedAt;
        draftReadyExperimentRef.current = experimentId;
        draftReadOnlyRef.current = true;
        const visibleCode = hasLocalUnsubmittedCode && localDraft ? localDraft.code : serverCode;
        codeRef.current = visibleCode;
        setCode(visibleCode);
        setDraftState({
          status: 'READ_ONLY',
          savedAt: updatedAt,
          error: hasLocalUnsubmittedCode
            ? '实验已完成；当前显示的是本机未提交副本，仅供查看和复制。'
            : null,
          hasUnsavedChanges: hasLocalUnsubmittedCode,
          serverCode: null,
          serverUpdatedAt: updatedAt,
          localSavedAt: hasLocalUnsubmittedCode ? localDraft?.savedAt ?? null : null,
          hasLocalBackup: hasLocalUnsubmittedCode,
        });
        return;
      }

      if (localDraft?.code === serverCode) {
        removeLocalExperimentDraft(userId, experimentId);
        draftLocalRef.current = null;
      } else if (localDraft) {
        const isSameBase = localDraft.baseUpdatedAt === updatedAt && localDraft.baseCode === serverCode;
        draftReadyExperimentRef.current = experimentId;
        draftReadOnlyRef.current = false;
        codeRef.current = localDraft.code;
        setCode(localDraft.code);
        if (isSameBase) {
          draftBaselineCodeRef.current = serverCode;
          draftServerUpdatedAtRef.current = updatedAt;
          setDraftState({
            status: 'LOCAL_SAVED',
            savedAt: updatedAt,
            error: null,
            hasUnsavedChanges: true,
            serverCode: null,
            serverUpdatedAt: updatedAt,
            localSavedAt: localDraft.savedAt,
            hasLocalBackup: true,
          });
          if (!isBrowserOffline()) {
            draftSaveTimerRef.current = window.setTimeout(() => {
              void saveDraftRef.current();
            }, EXPERIMENT_DRAFT_DEBOUNCE_MS);
          }
          return;
        }

        draftBaselineCodeRef.current = localDraft.baseCode;
        draftServerUpdatedAtRef.current = localDraft.baseUpdatedAt;
        draftConflictRef.current = { code: serverCode, updatedAt: updatedAt ?? '' };
        setDraftState({
          status: 'CONFLICT',
          savedAt: localDraft.baseUpdatedAt,
          error: '本机草稿基于较早的服务端版本。为避免覆盖，请选择要保留的代码。',
          hasUnsavedChanges: true,
          serverCode,
          serverUpdatedAt: updatedAt,
          localSavedAt: localDraft.savedAt,
          hasLocalBackup: true,
        });
        return;
      }

      draftBaselineCodeRef.current = serverCode;
      draftServerUpdatedAtRef.current = updatedAt;
      draftReadyExperimentRef.current = experimentId;
      draftReadOnlyRef.current = false;
      codeRef.current = serverCode;
      setCode(serverCode);
      setDraftState({
        status: 'CLEAN',
        savedAt: updatedAt,
        error: null,
        hasUnsavedChanges: false,
        serverCode: null,
        serverUpdatedAt: updatedAt,
        localSavedAt: null,
        hasLocalBackup: false,
      });
    } catch (draftLoadError) {
      if (!mountedRef.current || requestId !== draftLoadIdRef.current
        || selectedExperimentRef.current !== experimentId) return;
      restoreAfterLoadFailure(draftLoadError instanceof ExperimentRequestTimeoutError
        ? '草稿加载超时，暂时无法核对服务端版本。'
        : '网络异常，暂时无法核对服务端版本。');
    }
  }, [applyProjectCompletion]);

  const saveExperimentDraft = useCallback(async (baseUpdatedAtOverride?: string | null): Promise<void> => {
    const experimentId = selectedExperimentRef.current;
    if (!experimentId || draftReadyExperimentRef.current !== experimentId || draftReadOnlyRef.current) return;
    if (draftSaveInFlightRef.current || (draftConflictRef.current && baseUpdatedAtOverride === undefined)) return;
    const token = getStoredAccessToken();
    const userId = userIdFromAccessToken(token);
    const draftCode = codeRef.current;
    const baseUpdatedAt = baseUpdatedAtOverride === undefined
      ? draftServerUpdatedAtRef.current
      : baseUpdatedAtOverride;
    const localDraft = writeLocalExperimentDraft(
      userId,
      experimentId,
      draftCode,
      draftBaselineCodeRef.current,
      baseUpdatedAt,
    );
    if (localDraft) draftLocalRef.current = localDraft;

    if (!token) {
      setDraftState((current) => ({
        ...current,
        status: 'ERROR',
        error: localDraft || draftLocalRef.current
          ? '登录已过期，代码已保存在本机；重新登录后可继续同步。'
          : '登录已过期，当前更改尚未保存。',
        hasUnsavedChanges: codeRef.current !== draftBaselineCodeRef.current,
        localSavedAt: localDraft?.savedAt ?? draftLocalRef.current?.savedAt ?? null,
        hasLocalBackup: Boolean(localDraft || draftLocalRef.current),
      }));
      return;
    }
    if (draftCode === draftBaselineCodeRef.current) {
      removeLocalExperimentDraft(userId, experimentId);
      draftLocalRef.current = null;
      setDraftState((current) => ({
        ...current,
        status: current.savedAt ? 'SAVED' : 'CLEAN',
        error: null,
        hasUnsavedChanges: false,
        localSavedAt: null,
        hasLocalBackup: false,
      }));
      return;
    }

    if (isBrowserOffline()) {
      setDraftState((current) => ({
        ...current,
        status: localDraft ? 'LOCAL_SAVED' : 'ERROR',
        error: localDraft ? null : '当前网络不可用，且浏览器未能保存本机草稿。请复制代码后再离开。',
        hasUnsavedChanges: true,
        localSavedAt: localDraft?.savedAt ?? null,
        hasLocalBackup: localDraft !== null,
      }));
      return;
    }

    draftSaveInFlightRef.current = true;
    setDraftState((current) => ({
      ...current,
      status: draftLocalRef.current ? 'SYNCING' : 'SAVING',
      error: null,
      hasUnsavedChanges: true,
      localSavedAt: draftLocalRef.current?.savedAt ?? current.localSavedAt ?? null,
      hasLocalBackup: draftLocalRef.current !== null || current.hasLocalBackup === true,
    }));
    try {
      const response = await fetchExperimentRequest('/api/experiments/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          experimentId,
          intent: 'DRAFT',
          status: 'IN_PROGRESS',
          code: draftCode,
          ...(baseUpdatedAt ? { baseUpdatedAt } : {}),
        }),
      }, EXPERIMENT_SAVE_TIMEOUT_MS);
      const rawData: unknown = await response.json().catch((): Record<string, never> => ({}));
      if (!mountedRef.current || selectedExperimentRef.current !== experimentId) return;
      if (response.status === 409) {
        const conflict = experimentDraftConflictSchema.safeParse(rawData);
        if (conflict.success) {
          // 上一次请求可能已经写入、但响应在网络中丢失。若服务端代码与本次
          // 待保存内容完全一致，直接恢复为已保存，不要求学生处理伪冲突。
          if (conflict.data.serverDraft.code === draftCode) {
            draftBaselineCodeRef.current = draftCode;
            draftServerUpdatedAtRef.current = conflict.data.serverDraft.updatedAt;
            draftConflictRef.current = null;
            const changedAgain = codeRef.current !== draftCode;
            const newerLocalDraft = changedAgain
              ? writeLocalExperimentDraft(
                userId,
                experimentId,
                codeRef.current,
                draftCode,
                conflict.data.serverDraft.updatedAt,
              )
              : null;
            if (changedAgain) {
              draftLocalRef.current = newerLocalDraft;
            } else {
              removeLocalExperimentDraft(userId, experimentId);
              draftLocalRef.current = null;
            }
            setDraftState({
              status: changedAgain ? 'DIRTY' : 'SAVED',
              savedAt: conflict.data.serverDraft.updatedAt,
              error: null,
              hasUnsavedChanges: changedAgain,
              serverCode: null,
              serverUpdatedAt: conflict.data.serverDraft.updatedAt,
              localSavedAt: newerLocalDraft?.savedAt ?? null,
              hasLocalBackup: newerLocalDraft !== null,
            });
            if (changedAgain) {
              draftSaveTimerRef.current = window.setTimeout(() => {
                void saveDraftRef.current();
              }, EXPERIMENT_DRAFT_DEBOUNCE_MS);
            }
            return;
          }
          draftConflictRef.current = {
            code: conflict.data.serverDraft.code,
            updatedAt: conflict.data.serverDraft.updatedAt,
          };
          setDraftState({
            status: 'CONFLICT',
            savedAt: draftServerUpdatedAtRef.current,
            error: conflict.data.error,
            hasUnsavedChanges: true,
            serverCode: conflict.data.serverDraft.code,
            serverUpdatedAt: conflict.data.serverDraft.updatedAt,
            localSavedAt: localDraft?.savedAt ?? draftLocalRef.current?.savedAt ?? null,
            hasLocalBackup: Boolean(localDraft || draftLocalRef.current),
          });
          return;
        }
      }
      if (!response.ok) {
        setDraftState((current) => ({
          ...current,
          status: 'ERROR',
          error: response.status === 401
            ? '登录已过期，代码已保存在本机；重新登录后可继续同步。'
            : `${errorMessageOf(rawData, '草稿保存失败，请重试。')} 本机草稿仍在。`,
          hasUnsavedChanges: true,
          localSavedAt: localDraft?.savedAt ?? current.localSavedAt ?? null,
          hasLocalBackup: Boolean(localDraft || current.hasLocalBackup),
        }));
        return;
      }
      const parsedData = experimentDraftResponseSchema.safeParse(rawData);
      if (!parsedData.success || parsedData.data.experiment.experimentId !== experimentId) {
        setDraftState((current) => ({
          ...current,
          status: 'ERROR',
          error: '草稿保存回执与当前实验不匹配，请重试。',
          hasUnsavedChanges: true,
          localSavedAt: localDraft?.savedAt ?? current.localSavedAt ?? null,
          hasLocalBackup: Boolean(localDraft || current.hasLocalBackup),
        }));
        return;
      }
      const savedDraft = parsedData.data.draft;
      if (parsedData.data.readOnly) {
        draftBaselineCodeRef.current = savedDraft.code;
        draftServerUpdatedAtRef.current = savedDraft.updatedAt;
        draftConflictRef.current = null;
        draftReadOnlyRef.current = true;
        const hasLocalUnsubmittedCode = codeRef.current !== savedDraft.code;
        const preservedLocalDraft = hasLocalUnsubmittedCode
          ? writeLocalExperimentDraft(
            userId,
            experimentId,
            codeRef.current,
            savedDraft.code,
            savedDraft.updatedAt,
          )
          : null;
        if (preservedLocalDraft) {
          draftLocalRef.current = preservedLocalDraft;
        } else {
          removeLocalExperimentDraft(userId, experimentId);
          draftLocalRef.current = null;
          codeRef.current = savedDraft.code;
          setCode(savedDraft.code);
        }
        setDraftState({
          status: 'READ_ONLY',
          savedAt: savedDraft.updatedAt,
          error: hasLocalUnsubmittedCode
            ? '实验已完成；当前显示的是本机未提交副本，仅供查看和复制。'
            : null,
          hasUnsavedChanges: hasLocalUnsubmittedCode,
          serverCode: null,
          serverUpdatedAt: savedDraft.updatedAt,
          localSavedAt: preservedLocalDraft?.savedAt ?? null,
          hasLocalBackup: preservedLocalDraft !== null,
        });
        return;
      }

      draftBaselineCodeRef.current = draftCode;
      draftServerUpdatedAtRef.current = savedDraft.updatedAt;
      draftConflictRef.current = null;
      draftReadOnlyRef.current = false;
      const changedAgain = codeRef.current !== draftCode;
      const newerLocalDraft = changedAgain
        ? writeLocalExperimentDraft(
          userId,
          experimentId,
          codeRef.current,
          draftCode,
          savedDraft.updatedAt,
        )
        : null;
      if (changedAgain) {
        draftLocalRef.current = newerLocalDraft;
      } else {
        removeLocalExperimentDraft(userId, experimentId);
        draftLocalRef.current = null;
      }
      setDraftState({
        status: changedAgain ? 'DIRTY' : 'SAVED',
        savedAt: savedDraft.updatedAt,
        error: null,
        hasUnsavedChanges: changedAgain,
        serverCode: null,
        serverUpdatedAt: savedDraft.updatedAt,
        localSavedAt: newerLocalDraft?.savedAt ?? null,
        hasLocalBackup: newerLocalDraft !== null,
      });
      draftChannelRef.current?.postMessage({
        type: 'DRAFT_SAVED',
        senderId: draftTabIdRef.current,
        userId: userIdFromAccessToken(token),
        experimentId,
        code: draftCode,
        updatedAt: savedDraft.updatedAt,
      });
      if (changedAgain) {
        if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = window.setTimeout(() => {
          void saveDraftRef.current();
        }, EXPERIMENT_DRAFT_DEBOUNCE_MS);
      }
    } catch (draftSaveError) {
      if (!mountedRef.current || selectedExperimentRef.current !== experimentId) return;
      setDraftState((current) => ({
        ...current,
        status: draftSaveError instanceof TypeError && Boolean(localDraft) ? 'LOCAL_SAVED' : 'ERROR',
        error: draftSaveError instanceof ExperimentRequestTimeoutError
          ? '草稿保存超时，结果尚未确认；本机草稿仍在，重试时会先核对版本。'
          : localDraft
            ? null
            : '网络异常，当前更改尚未保存，请复制代码后重试。',
        hasUnsavedChanges: true,
        localSavedAt: localDraft?.savedAt ?? current.localSavedAt ?? null,
        hasLocalBackup: Boolean(localDraft || current.hasLocalBackup),
      }));
    } finally {
      draftSaveInFlightRef.current = false;
    }
  }, []);
  saveDraftRef.current = saveExperimentDraft;

  const saveProj04Milestone = useCallback(async (
    milestoneId: Proj04MilestoneId,
    confirmed: boolean,
  ): Promise<void> => {
    if (selectedExperimentRef.current !== 'proj04' || projectCompletionSaveInFlightRef.current) return;
    if (draftSaveInFlightRef.current || codeRef.current !== draftBaselineCodeRef.current) {
      setProjectCompletionError('代码仍在保存，请等待草稿同步完成后再确认里程碑。');
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setProjectCompletionError('登录已过期，里程碑自检状态尚未保存。');
      return;
    }

    const previous = projectCompletionRef.current;
    const nextMilestones = previous.milestones.map((item) =>
      item.id === milestoneId ? { ...item, confirmed } : item);
    projectCompletionSaveInFlightRef.current = true;
    setIsSavingProjectCompletion(true);
    setProjectCompletionError(null);
    try {
      const response = await fetchExperimentRequest('/api/experiments/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          experimentId: 'proj04',
          intent: 'PROJECT_CHECKLIST',
          status: 'IN_PROGRESS',
          results: {
            projectCompletion: {
              version: 1,
              milestones: nextMilestones.map(({ id, confirmed: itemConfirmed }) => ({
                id,
                confirmed: itemConfirmed,
              })),
            },
          },
        }),
      }, EXPERIMENT_SAVE_TIMEOUT_MS);
      const rawData: unknown = await response.json().catch((): Record<string, never> => ({}));
      if (!response.ok) {
        throw new Error(errorMessageOf(rawData, '项目里程碑自检保存失败，请重试。'));
      }
      const parsedData = projectChecklistSaveResponseSchema.safeParse(rawData);
      if (!parsedData.success) throw new Error('项目里程碑保存回执格式异常，请重试。');
      const updatedAt = parsedData.data.experiment.updatedAt;
      draftServerUpdatedAtRef.current = updatedAt;
      setDraftState((current) => ({
        ...current,
        savedAt: updatedAt,
        serverUpdatedAt: updatedAt,
      }));
      const saved = applyProjectCompletion(parsedData.data.projectCompletion);
      const savedMilestone = saved.milestones.find((item) => item.id === milestoneId);
      if (savedMilestone?.confirmed !== confirmed || (confirmed && !savedMilestone.confirmedAt)) {
        throw new Error('服务端未确认本次里程碑状态，请重试。');
      }
    } catch (error) {
      applyProjectCompletion(previous);
      setProjectCompletionError(error instanceof ExperimentRequestTimeoutError
        ? '项目里程碑保存超时，状态尚未确认，请重试。'
        : error instanceof TypeError
          ? '网络异常，项目里程碑状态尚未保存，请重试。'
          : error instanceof Error ? error.message : '项目里程碑自检保存失败，请重试。');
    } finally {
      projectCompletionSaveInFlightRef.current = false;
      if (mountedRef.current) setIsSavingProjectCompletion(false);
    }
  }, [applyProjectCompletion]);

  const useServerDraft = useCallback((): void => {
    const conflict = draftConflictRef.current;
    if (!conflict) return;
    const experimentId = selectedExperimentRef.current;
    removeLocalExperimentDraft(userIdFromAccessToken(getStoredAccessToken()), experimentId);
    draftLocalRef.current = null;
    draftBaselineCodeRef.current = conflict.code;
    draftServerUpdatedAtRef.current = conflict.updatedAt;
    draftConflictRef.current = null;
    codeRef.current = conflict.code;
    setCode(conflict.code);
    setDraftState({
      status: 'SAVED',
      savedAt: conflict.updatedAt,
      error: null,
      hasUnsavedChanges: false,
      serverCode: null,
      serverUpdatedAt: conflict.updatedAt,
      localSavedAt: null,
      hasLocalBackup: false,
    });
  }, []);

  const keepLocalDraft = useCallback(async (): Promise<void> => {
    const conflict = draftConflictRef.current;
    if (!conflict) return;
    draftServerUpdatedAtRef.current = conflict.updatedAt;
    draftConflictRef.current = null;
    setDraftState((current) => ({
      ...current,
      status: 'DIRTY',
      error: null,
      serverCode: null,
      serverUpdatedAt: conflict.updatedAt,
      hasUnsavedChanges: true,
    }));
    await saveDraftRef.current(conflict.updatedAt);
  }, []);

  useEffect(() => {
    if (!selectedExperiment || draftReadyExperimentRef.current !== selectedExperiment || draftReadOnlyRef.current) return;
    const hasUnsavedChanges = code !== draftBaselineCodeRef.current;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    if (!hasUnsavedChanges) {
      removeLocalExperimentDraft(userIdFromAccessToken(getStoredAccessToken()), selectedExperiment);
      draftLocalRef.current = null;
      setDraftState((current) => {
        if (current.status === 'LOADING' || current.status === 'ERROR' || current.status === 'CONFLICT') return current;
        return {
          ...current,
          status: current.savedAt ? 'SAVED' : 'CLEAN',
          error: null,
          hasUnsavedChanges: false,
          localSavedAt: null,
          hasLocalBackup: false,
        };
      });
      return;
    }
    const localDraft = writeLocalExperimentDraft(
      userIdFromAccessToken(getStoredAccessToken()),
      selectedExperiment,
      code,
      draftBaselineCodeRef.current,
      draftServerUpdatedAtRef.current,
    );
    if (localDraft) draftLocalRef.current = localDraft;
    const offline = isBrowserOffline();
    setDraftState((current) => {
      if (current.status === 'LOADING' || current.status === 'ERROR' || current.status === 'CONFLICT') {
        return {
          ...current,
          hasUnsavedChanges: true,
          localSavedAt: localDraft?.savedAt ?? current.localSavedAt ?? null,
          hasLocalBackup: Boolean(localDraft || current.hasLocalBackup),
        };
      }
      return {
        ...current,
        status: offline
          ? localDraft ? 'LOCAL_SAVED' : 'ERROR'
          : current.status === 'SAVING' || current.status === 'SYNCING'
            ? current.status
            : 'DIRTY',
        error: offline && !localDraft
          ? '当前网络不可用，且浏览器未能保存本机草稿。请复制代码后再离开。'
          : null,
        hasUnsavedChanges: true,
        localSavedAt: localDraft?.savedAt ?? current.localSavedAt ?? null,
        hasLocalBackup: Boolean(localDraft || current.hasLocalBackup),
      };
    });
    if (!offline && !draftConflictRef.current) {
      draftSaveTimerRef.current = window.setTimeout(() => {
        void saveDraftRef.current();
      }, EXPERIMENT_DRAFT_DEBOUNCE_MS);
    }
    return (): void => {
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [code, selectedExperiment]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('educog-experiment-drafts');
    draftChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>): void => {
      if (!isRecord(event.data)) return;
      const message = event.data;
      if (message.type !== 'DRAFT_SAVED'
        || message.senderId === draftTabIdRef.current
        || message.userId !== userIdFromAccessToken(getStoredAccessToken())
        || message.experimentId !== selectedExperimentRef.current
        || typeof message.code !== 'string'
        || typeof message.updatedAt !== 'string'
        || message.updatedAt === draftServerUpdatedAtRef.current) return;
      if (codeRef.current === draftBaselineCodeRef.current) {
        removeLocalExperimentDraft(userIdFromAccessToken(getStoredAccessToken()), String(message.experimentId));
        draftLocalRef.current = null;
        draftBaselineCodeRef.current = message.code;
        draftServerUpdatedAtRef.current = message.updatedAt;
        codeRef.current = message.code;
        setCode(message.code);
        setDraftState({
          status: 'SAVED',
          savedAt: message.updatedAt,
          error: null,
          hasUnsavedChanges: false,
          serverCode: null,
          serverUpdatedAt: message.updatedAt,
          localSavedAt: null,
          hasLocalBackup: false,
        });
        return;
      }
      const localDraft = writeLocalExperimentDraft(
        userIdFromAccessToken(getStoredAccessToken()),
        String(message.experimentId),
        codeRef.current,
        draftBaselineCodeRef.current,
        draftServerUpdatedAtRef.current,
      );
      if (localDraft) draftLocalRef.current = localDraft;
      draftConflictRef.current = { code: message.code, updatedAt: message.updatedAt };
      setDraftState({
        status: 'CONFLICT',
        savedAt: draftServerUpdatedAtRef.current,
        error: '另一个页面刚刚保存了此实验，请选择要保留的草稿。',
        hasUnsavedChanges: true,
        serverCode: message.code,
        serverUpdatedAt: message.updatedAt,
        localSavedAt: localDraft?.savedAt ?? null,
        hasLocalBackup: localDraft !== null,
      });
    };
    return (): void => {
      channel.close();
      if (draftChannelRef.current === channel) draftChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const flushDraft = (): void => {
      if (draftReadyExperimentRef.current === selectedExperimentRef.current
        && codeRef.current !== draftBaselineCodeRef.current
        && !draftConflictRef.current
        && !draftReadOnlyRef.current) {
        void saveDraftRef.current();
      }
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') flushDraft();
    };
    const handleOnline = (): void => {
      if (draftReadyExperimentRef.current === selectedExperimentRef.current
        && codeRef.current !== draftBaselineCodeRef.current
        && !draftConflictRef.current
        && !draftReadOnlyRef.current) {
        setDraftState((current) => ({
          ...current,
          status: 'SYNCING',
          error: null,
          hasUnsavedChanges: true,
        }));
        void saveDraftRef.current();
      }
    };
    const handleOffline = (): void => flushDraft();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', flushDraft);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const startExperiment = useCallback(async (experimentId: string): Promise<'IN_PROGRESS' | 'COMPLETED'> => {
    const token = getStoredAccessToken();
    if (!token) throw new Error('登录已过期，请重新登录');

    const recoverServerStatus = async (): Promise<'IN_PROGRESS' | 'COMPLETED' | null> => {
      try {
        const response = await fetchExperimentRequest(
          `/api/experiments/save?experimentId=${encodeURIComponent(experimentId)}`,
          {
            method: 'GET',
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` },
          },
          EXPERIMENT_STATUS_TIMEOUT_MS,
        );
        if (!response.ok) return null;
        const rawData: unknown = await response.json();
        const parsedData = experimentStatusResponseSchema.safeParse(rawData);
        const record = parsedData.success
          ? parsedData.data.experiments?.find((item) => item.experimentId === experimentId)
          : undefined;
        return record?.status === 'COMPLETED'
          ? 'COMPLETED'
          : record?.status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : null;
      } catch {
        return null;
      }
    };

    let response: Response;
    try {
      response = await fetchExperimentRequest('/api/experiments/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ experimentId, status: 'IN_PROGRESS', intent: 'START' }),
      }, EXPERIMENT_SAVE_TIMEOUT_MS);
    } catch (requestError) {
      const recovered = requestError instanceof TypeError || requestError instanceof ExperimentRequestTimeoutError
        ? await recoverServerStatus()
        : null;
      if (recovered) {
        if (mountedRef.current) setExperimentStatus((current) => ({ ...current, [experimentId]: recovered }));
        return recovered;
      }
      if (requestError instanceof TypeError || requestError instanceof ExperimentRequestTimeoutError) {
        throw new Error('实验开始状态暂未确认，请重试；重复操作不会生成多条开始记录。');
      }
      throw requestError;
    }

    const rawData: unknown = await response.json().catch((): Record<string, never> => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error('登录已过期，请重新登录');
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      const recovered = retryable ? await recoverServerStatus() : null;
      if (recovered) {
        if (mountedRef.current) setExperimentStatus((current) => ({ ...current, [experimentId]: recovered }));
        return recovered;
      }
      throw new Error(errorMessageOf(rawData, retryable
        ? '实验开始状态暂未确认，请重试'
        : '无法开始实验'));
    }
    const parsedData = experimentStartResponseSchema.safeParse(rawData);
    if (!parsedData.success || parsedData.data.experiment.experimentId !== experimentId) {
      throw new Error('实验开始回执与当前任务不匹配，请返回任务页重试');
    }
    const serverStatus = parsedData.data.experiment.status;
    if (mountedRef.current) {
      setExperimentStatus((current) => ({ ...current, [experimentId]: serverStatus }));
    }
    return serverStatus;
  }, []);

  // 完成实验
  const completeExperiment = useCallback(async (): Promise<void> => {
    if (completionInFlightRef.current) return;
    if (!selectedExperiment) {
      toast({
        title: '未选择实验',
        description: '请先选择一个实验',
        variant: 'destructive'
      });
      return;
    }

    completionInFlightRef.current = true;
    setIsCompletingExperiment(true);
    try {
      await recordExperimentCompletion(selectedExperiment);
      if (mountedRef.current) {
        toast({
          title: '实验已完成',
          description: '实验进度已保存',
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        toast({
          title: '保存失败',
          description: error instanceof Error ? error.message : '实验完成状态保存失败',
          variant: 'destructive'
        });
      }
    } finally {
      completionInFlightRef.current = false;
      if (mountedRef.current) setIsCompletingExperiment(false);
    }
  }, [selectedExperiment, recordExperimentCompletion, toast]);

  // 设置断点
  const setBreakpoint = (line: number): void => {
    setBreakpoints(prev => new Set([...prev, line]));
    // 断点功能暂时在前端管理
  };

  // 移除断点
  const removeBreakpoint = (line: number): void => {
    setBreakpoints(prev => {
      const newBreakpoints = new Set(prev);
      newBreakpoints.delete(line);
      return newBreakpoints;
    });
    // 断点功能暂时在前端管理
  };

  // 更新代码（用于兼容测试）
  const updateCode = (newCode: string): void => {
    setCode(newCode);
    if (simulatorRef.current) {
      simulatorRef.current.updateCode(newCode);
    }
  };

  // 运行程序（别名，用于兼容测试）
  const run = (): void => runSimulation();

  // 单步执行（别名，用于兼容测试）
  const step = (): void => stepSimulation();

  // 停止执行 —— 真正终止动画循环，画面停在当前帧便于观察
  // 停止=结束本次会话（下次点"运行"从头开始，而非继续）
  const stop = (): void => {
    cancelLoop();
    resumableRef.current = false;
    setPaused(false);
    setIsRunning(false);
    // 补一个结果，让"完成实验"按钮在停止后可用（闪烁类程序不会自然终止）
    setResult(prev => prev ?? {
      success: executionCountRef.current > 0 && !fault,
      output: executionCountRef.current > 0 && !fault ? '已停止，可复核本次执行记录' : '已停止，尚未达到实验完成条件',
    });
  };

  // 重置（别名，用于兼容测试）
  const reset = (): void => {
    if (simulatorRef.current) {
      simulatorRef.current.reset();
    }
    return resetSimulation();
  };

  // 获取断点列表（用于兼容测试）
  const getBreakpoints = (): number[] => {
    return Array.from(breakpoints);
  };

  // 检查是否在断点处（用于兼容测试）
  const isAtBreakpoint = (line: number): boolean => {
    return breakpoints.has(line);
  };

  // 确保初始状态存在（用于兼容测试）
  const getInitialState = (): SimulatorState => {
    if (!simulatorState) {
      // 返回默认的初始状态
      return {
        registers: { A: 0, B: 0, SP: 0x07, DPL: 0, DPH: 0, R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0, R7: 0 },
        ram: new Uint8Array(128),
        pc: 0,
        psw: { CY: false, AC: false, F0: false, RS1: false, RS0: false, OV: false, P: false },
        portValues: { P0: 0xFF, P1: 0xFF, P2: 0xFF, P3: 0xFF },
        currentLine: -1,
        memory: [],
        uart: {
          SCON: 0x00, SBUF: 0x00, TI: false, RI: false,
          transmitBuffer: '', receiveBuffer: '', baudRate: 9600, dataTransmitting: false
        },
        timers: {
          TCON: 0x00, TMOD: 0x00, TH0: 0x00, TL0: 0x00, TH1: 0x00, TL1: 0x00,
          TR0: false, TR1: false, TF0: false, TF1: false, overflowCount0: 0, overflowCount1: 0
        },
        interrupts: {
          IE: 0x00, IP: 0x00, EA: false, ET0: false, ET1: false, EX0: false, EX1: false, ES: false,
          pendingInterrupts: []
        },
        adc: {
          channelSelect: 0, conversionActive: false, conversionComplete: true, lastResult: 0,
          inputVoltages: [0, 0, 0, 0, 0, 0, 0, 0], referenceVoltage: 5, conversionTime: 0
        },
        buzzer: { active: false, frequency: 0, dutyCycle: 50, outputPin: 'P2.1', soundPattern: 'continuous' },
        keypad: {
          matrix: Array.from({ length: 4 }, (): boolean[] => Array<boolean>(4).fill(false)),
          rowPins: ['P3.0', 'P3.1', 'P3.2', 'P3.3'], colPins: ['P2.0', 'P2.1', 'P2.2', 'P2.3'],
          lastKeyPressed: '', scanActive: false, debounceTime: 0
        },
        lcd: {
          displayEnabled: false, cursorPosition: { row: 0, col: 0 },
          displayData: Array.from({ length: 2 }, (): string[] => Array<string>(16).fill('')),
          backlight: true, controlPins: { RS: 'P0.0', EN: 'P0.1', RW: 'P0.2' },
          dataPins: ['P1.0', 'P1.1', 'P1.2', 'P1.3'], mode: '4bit', initialized: false
        },
        stepperMotor: {
          currentStep: 0, direction: 'clockwise', speed: 0, controlPins: ['P2.0', 'P2.1', 'P2.2', 'P2.3'],
          stepPattern: [0b1000, 0b1100, 0b0100, 0b0110, 0b0010, 0b0011, 0b0001, 0b1001],
          totalSteps: 0, isRunning: false
        },
        pwm: {
          channels: [
            { pin: 'P1.4', frequency: 0, dutyCycle: 0, enabled: false, currentLevel: false },
            { pin: 'P1.5', frequency: 0, dutyCycle: 0, enabled: false, currentLevel: false },
            { pin: 'P1.6', frequency: 0, dutyCycle: 0, enabled: false, currentLevel: false },
            { pin: 'P1.7', frequency: 0, dutyCycle: 0, enabled: false, currentLevel: false }
          ]
        },
        terminated: false
      };
    }
    return simulatorState;
  };

  return {
    code,
    setCode,
    state: simulatorState ?? getInitialState(), // 为了兼容测试，同时提供state和simulatorState
    simulatorState,
    previousState,
    traceLog,
    executionCount,
    isRunning,
    isCompletingExperiment,
    fault,
    result,
    selectedExperiment,
    experimentStatus,
    isLoadingStatus,
    experimentStatusError,
    draftState,
    projectCompletion,
    isLoadingProjectCompletion,
    isSavingProjectCompletion,
    projectCompletionError,
    breakpoints,
    paused,
    speed,
    setSpeed,
    speedPresets: SPEED_PRESETS,
    setExperimentStatus,
    runSimulation,
    stepSimulation,
    resetSimulation,
    loadExperiment,
    loadExperimentStatus,
    loadExperimentDraft,
    saveExperimentDraft,
    useServerDraft,
    keepLocalDraft,
    saveProj04Milestone,
    startExperiment,
    completeExperiment,
    getDiagnostics,
    setBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    setPortBit,
    pulsePortBit,
    updateCode,
    run,
    step,
    stop,
    reset,
    getBreakpoints,
    isAtBreakpoint
  };
};
