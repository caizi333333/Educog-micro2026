import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SimulationPage from '@/app/simulation/page';
import { createExperimentObservation, emptyProj04CompletionEvidence } from '@/lib/experiment-config';
import StackPushPopAnim from '@/components/simulation/animations/StackPushPopAnim';

const mockLoadExperiment = jest.fn();
const mockLoadExperimentDraft = jest.fn(async () => undefined);
const mockLoadExperimentStatus = jest.fn(async () => undefined);
const mockSaveExperimentDraft = jest.fn(async () => undefined);

let mockHookState: Record<string, unknown>;
let mockRole = 'STUDENT';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: mockRole } }) }));
jest.mock('@/components/site/site-chrome', () => ({
  StudentFeedbackLauncher: ({ variant }: { variant: string }) => <a href="/feedback?from=%2Fsimulation" data-variant={variant}>提交反馈</a>,
}));

jest.mock('@/hooks/useSimulator', () => ({
  useSimulator: () => mockHookState,
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant: _variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/simulation/ExperimentSelector', () => {
  return function MockExperimentSelector(props: {
    selectedExperiment: string | null;
    onExperimentSelect: (id: string) => void;
    onLoadExperiment: (id: string) => void;
  }) {
    return (
      <div data-testid="experiment-selector" data-selected={props.selectedExperiment ?? ''}>
        <button onClick={() => props.onExperimentSelect('exp02')}>选择 exp02</button>
        <button onClick={() => props.onLoadExperiment('exp02')}>加载 exp02</button>
        <button onClick={() => props.onExperimentSelect('exp03')}>选择 exp03</button>
        <button onClick={() => props.onLoadExperiment('exp03')}>加载 exp03</button>
      </div>
    );
  };
});

jest.mock('@/components/simulation/CodeEditor', () => () => <div>code editor</div>);
jest.mock('@/components/simulation/ControlPanel', () => () => <div>control panel</div>);
jest.mock('@/components/simulation/StatusMonitor', () => () => <div>status monitor</div>);
jest.mock('@/components/simulation/MemoryViewer', () => () => <div>memory viewer</div>);
jest.mock('@/components/simulation/ExecutionTrace', () => () => <div>execution trace</div>);
jest.mock('@/components/simulation/ExperimentGuide', () => () => <div>experiment guide</div>);
jest.mock('@/components/simulation/AiDiagnostics', () => () => <div>ai diagnostics</div>);
jest.mock('@/components/hyper/HyperExperimentCanvas', () => ({ HyperExperimentCanvas: () => <div>experiment canvas</div> }));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    PanelLeftClose: Icon, PanelLeftOpen: Icon, PanelRightClose: Icon, PanelRightOpen: Icon, Play: Icon, Square: Icon,
    SkipForward: Icon, RotateCcw: Icon, CheckCircle2: Icon, Cpu: Icon,
    Activity: Icon, Terminal: Icon, MemoryStick: Icon, ScrollText: Icon,
    Sparkles: Icon, X: Icon, Lightbulb: Icon, Waypoints: Icon, Timer: Icon,
    Monitor: Icon, Keyboard: Icon, Volume2: Icon, Cog: Icon, Radio: Icon,
    Boxes: Icon, Loader2: Icon, Cloud: Icon, CloudOff: Icon, RefreshCw: Icon,
    GitCompareArrows: Icon, ArrowDown: Icon, ArrowUp: Icon,
  };
});

describe('StackPushPopAnim step consistency', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('pushes low and high return bytes into distinct addresses and pops them in reverse order', () => {
    render(<StackPushPopAnim />);
    fireEvent.click(screen.getByRole('button', { name: 'LCALL' }));
    expect(screen.getByText('SP = 8H')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('PUSH PCL (30H) → [8H]');
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByText('SP = 9H')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('PUSH PCH (00H) → [9H]');
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole('log')).toHaveTextContent('PC = 0100H');

    fireEvent.click(screen.getByRole('button', { name: 'RET' }));
    expect(screen.getByText('SP = 8H')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('POP ← [9H] = 00H (PCH)');
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByText('SP = 7H')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('POP ← [8H] = 30H (PCL)');
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByRole('log')).toHaveTextContent('PC = 0030H');
    expect(screen.getByRole('button', { name: 'POP' })).toBeDisabled();
  });

  it('ignores overlapping actions until both timed steps complete', () => {
    render(<StackPushPopAnim />);
    const call = screen.getByRole('button', { name: 'LCALL' });
    act(() => {
      fireEvent.click(call);
      fireEvent.click(call);
      fireEvent.click(screen.getByRole('button', { name: 'PUSH' }));
      fireEvent.click(screen.getByRole('button', { name: 'POP' }));
    });
    ['LCALL', 'RET', 'PUSH', 'POP'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    });
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getByText('SP = 9H')).toBeInTheDocument();
    expect(screen.getByRole('log').children).toHaveLength(3);
    expect(call).toBeEnabled();
  });

  it('cancels stale steps on reset and does not contaminate a new sequence', () => {
    render(<StackPushPopAnim />);
    fireEvent.click(screen.getByRole('button', { name: 'LCALL' }));
    act(() => jest.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByText('SP = 7H')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'LCALL' }));
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getByText('SP = 9H')).toBeInTheDocument();
    expect(screen.getByRole('log').children).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'RET' }));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    act(() => jest.runAllTimers());
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByText('SP = 7H')).toBeInTheDocument();
  });

  it('reserves two cells for LCALL and restores RET from the actual top two bytes', () => {
    render(<StackPushPopAnim />);
    const push = screen.getByRole('button', { name: 'PUSH' });
    for (let i = 0; i < 7; i += 1) fireEvent.click(push);
    expect(screen.getByText('SP = EH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LCALL' })).toBeDisabled();
    fireEvent.click(push);
    expect(screen.getByText('SP = FH')).toBeInTheDocument();
    expect(push).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'RET' }));
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getByText('SP = DH')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('PC = 5555H');
    expect(screen.getByRole('button', { name: 'LCALL' })).toBeEnabled();
  });

  it('clears scheduled callbacks when the animation is unmounted', () => {
    const view = render(<StackPushPopAnim />);
    fireEvent.click(screen.getByRole('button', { name: 'LCALL' }));
    expect(jest.getTimerCount()).toBe(2);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});

function createHookState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'MOV A, #01H', setCode: jest.fn(), simulatorState: null, previousState: null,
    observation: createExperimentObservation(), executedCode: 'MOV A, #01H', ownerId: 'student-1', identityBlocked: false,
    traceLog: [], executionCount: 0, isRunning: false, isCompletingExperiment: false,
    fault: '', result: null, selectedExperiment: '', experimentStatus: {},
    isLoadingStatus: false, experimentStatusError: null,
    draftState: {
      status: 'IDLE', savedAt: null, error: null, hasUnsavedChanges: false,
      serverCode: null, serverUpdatedAt: null, localSavedAt: null, hasLocalBackup: false,
    },
    projectCompletion: emptyProj04CompletionEvidence(),
    isLoadingProjectCompletion: false,
    isSavingProjectCompletion: false,
    projectCompletionError: null,
    runSimulation: jest.fn(), stepSimulation: jest.fn(), resetSimulation: jest.fn(),
    loadExperiment: mockLoadExperiment, loadExperimentStatus: mockLoadExperimentStatus,
    loadExperimentDraft: mockLoadExperimentDraft, saveExperimentDraft: mockSaveExperimentDraft,
    useServerDraft: jest.fn(), keepLocalDraft: jest.fn(), saveProj04Milestone: jest.fn(), startExperiment: jest.fn(async () => 'IN_PROGRESS'),
    completeExperiment: jest.fn(), stop: jest.fn(), speed: 2000, setSpeed: jest.fn(),
    speedPresets: [600, 2000, 6000, 16000], breakpoints: new Set<number>(),
    toggleBreakpoint: jest.fn(), paused: false, setPortBit: jest.fn(), pulsePortBit: jest.fn(),
    ...overrides,
  };
}

describe('SimulationPage experiment loading context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'STUDENT';
    mockHookState = createHookState();
    window.history.replaceState({}, '', '/simulation');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as typeof fetch;
  });

  it('exposes one labelled experiment workspace without adding another main landmark', () => {
    render(<SimulationPage />);

    expect(screen.getByRole('heading', { level: 1, name: '实验仿真工作台' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '实验仿真工作台' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看动态画布' })).toHaveAttribute('href', '#experiment-live-canvas');
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('offers in-flow feedback only to students and lets the status panel reopen', () => {
    const { rerender } = render(<SimulationPage />);
    expect(screen.getByRole('link', { name: '提交反馈' })).toHaveAttribute('data-variant', 'inline');
    const open = screen.getByRole('button', { name: '展开状态面板' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(open);
    expect(screen.getByRole('button', { name: '收起状态面板' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: '收起状态面板' }));
    expect(screen.getByRole('button', { name: '展开状态面板' })).toHaveAttribute('aria-expanded', 'false');
    mockRole = 'TEACHER';
    rerender(<SimulationPage />);
    expect(screen.queryByRole('link', { name: '提交反馈' })).not.toBeInTheDocument();
  });

  it('writes a loaded experiment into the URL and restores it after remount', async () => {
    window.history.replaceState({}, '', '/simulation?source=course');
    const first = render(<SimulationPage />);

    fireEvent.click(screen.getByRole('button', { name: '选择 exp02' }));
    fireEvent.click(screen.getByRole('button', { name: '加载 exp02' }));

    expect(window.location.search).toContain('source=course');
    expect(window.location.search).toContain('experiment=exp02');
    expect(mockLoadExperiment).toHaveBeenCalledWith('exp02');
    expect(mockLoadExperimentDraft).toHaveBeenCalledWith('exp02');

    first.unmount();
    jest.clearAllMocks();
    render(<SimulationPage />);

    await waitFor(() => expect(mockLoadExperiment).toHaveBeenCalledWith('exp02'));
    expect(mockLoadExperimentDraft).toHaveBeenCalledWith('exp02');
  });

  it('restores the actual experiment highlight when a risky switch is cancelled', async () => {
    mockHookState = createHookState({
      selectedExperiment: 'exp01',
      draftState: {
        status: 'ERROR', savedAt: null, error: 'save failed', hasUnsavedChanges: true,
        serverCode: null, serverUpdatedAt: null, localSavedAt: null, hasLocalBackup: false,
      },
    });
    window.history.replaceState({}, '', '/simulation?experiment=exp01');
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SimulationPage />);

    fireEvent.click(screen.getByRole('button', { name: '选择 exp02' }));
    expect(screen.getByTestId('experiment-selector')).toHaveAttribute('data-selected', 'exp02');
    fireEvent.click(screen.getByRole('button', { name: '加载 exp02' }));

    await waitFor(() => expect(screen.getByTestId('experiment-selector')).toHaveAttribute('data-selected', 'exp01'));
    expect(mockLoadExperiment).not.toHaveBeenCalledWith('exp02');
    expect(window.location.search).toContain('experiment=exp01');
  });

  it('does not allow a task-scoped experiment to be replaced by another experiment', async () => {
    window.history.replaceState({}, '', '/simulation?experiment=exp02&taskPathId=path-1&taskStepId=addressing-exp02');
    render(<SimulationPage />);

    fireEvent.click(screen.getByRole('button', { name: '选择 exp03' }));
    fireEvent.click(screen.getByRole('button', { name: '加载 exp03' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('当前任务指定实验为 exp02');
    expect(mockLoadExperiment).not.toHaveBeenCalledWith('exp03');
    expect(window.location.search).toContain('experiment=exp02');
  });

  it('shows an explicit error instead of loading an unknown experiment from the URL', async () => {
    window.history.replaceState({}, '', '/simulation?experiment=exp99&source=task');
    render(<SimulationPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('链接中的实验 exp99 不存在');
    expect(mockLoadExperiment).not.toHaveBeenCalled();
    expect(mockLoadExperimentDraft).not.toHaveBeenCalled();
    expect(within(alert).getByRole('button', { name: '查看可用实验' })).toBeInTheDocument();
  });

  it('keeps proj04 completion locked until all five server-confirmed milestones are present', () => {
    mockHookState = createHookState({
      selectedExperiment: 'proj04',
      executionCount: 200,
      result: { success: true },
      simulatorState: {
        terminated: false,
        pc: 12,
        currentLine: 3,
        uart: { transmitBuffer: '{"temp":25,"humi":65}\r\n' },
      },
    });
    render(<SimulationPage />);

    expect(screen.getByText('里程碑 0/5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存运行记录' })).toBeDisabled();
  });

  it('enables proj04 completion for a stopped continuous run with telemetry and five saved milestones', () => {
    const completeExperiment = jest.fn();
    const projectCompletion = emptyProj04CompletionEvidence();
    projectCompletion.milestones = projectCompletion.milestones.map((item) => ({
      ...item,
      confirmed: true,
      confirmedAt: '2026-08-16T08:00:00.000Z',
    }));
    projectCompletion.updatedAt = '2026-08-16T08:00:00.000Z';
    mockHookState = createHookState({
      selectedExperiment: 'proj04',
      executionCount: 200,
      result: { success: true },
      simulatorState: {
        terminated: false,
        pc: 12,
        currentLine: 3,
        uart: { transmitBuffer: '{"temp":25,"humi":65}\r\n' },
      },
      projectCompletion,
      completeExperiment,
    });
    render(<SimulationPage />);

    expect(screen.getByText('遥测 已观察')).toBeInTheDocument();
    expect(screen.getByText('里程碑 5/5')).toBeInTheDocument();
    const completeButton = screen.getByRole('button', { name: '保存运行记录' });
    expect(completeButton).toBeEnabled();
    fireEvent.click(completeButton);
    expect(completeExperiment).toHaveBeenCalledTimes(1);
  });

  it('does not let a terminated proj04 bypass its telemetry observation gate', () => {
    const projectCompletion = emptyProj04CompletionEvidence();
    projectCompletion.milestones = projectCompletion.milestones.map((item) => ({
      ...item,
      confirmed: true,
      confirmedAt: '2026-08-16T08:00:00.000Z',
    }));
    mockHookState = createHookState({
      selectedExperiment: 'proj04',
      executionCount: 200,
      result: { success: true },
      simulatorState: {
        terminated: true,
        pc: 12,
        currentLine: 3,
        uart: { transmitBuffer: '' },
      },
      projectCompletion,
    });
    render(<SimulationPage />);

    expect(screen.getByText('遥测 待观察')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存运行记录' })).toBeDisabled();
  });

  it('keeps the completion action visible and explains what exp02 still requires', () => {
    mockHookState = createHookState({
      selectedExperiment: 'exp02',
      executionCount: 0,
      result: null,
      simulatorState: null,
    });

    render(<SimulationPage />);

    expect(screen.getByText('先成功运行，并累计执行至少 20 条指令')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /已加载：/ })).toHaveTextContent('已加载：');
    expect(screen.getByRole('button', { name: '保存运行记录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存运行记录' })).toHaveAttribute('aria-describedby', 'experiment-completion-guidance');
    expect(screen.getByRole('link', { name: '提交反馈' })).toHaveAttribute('href', '/feedback?from=%2Fsimulation');
  });

  it('allows a stopped LED loop with the required output observations to save a run record', () => {
    const observation = createExperimentObservation();
    observation.steps = 80000;
    observation.portValues.P1 = [0xfe, 0xfd, 0xfb, 0xf7, 0xef, 0xdf, 0xbf, 0x7f];
    mockHookState = createHookState({ selectedExperiment: 'exp01', result: { success: true }, executionCount: 80000, observation, simulatorState: { terminated: false } });
    render(<SimulationPage />);
    expect(screen.getByRole('button', { name: '保存运行记录' })).toBeEnabled();
    expect(screen.getByText(/本轮仿真输出观测已满足/)).toHaveTextContent('学习目标与实物性能仍需另行评价');
  });

  it.each([
    { name: 'an END-only run', executedCode: 'MOV A, #01H', identityBlocked: false, ownerId: 'student-1' },
    { name: 'edited code', executedCode: 'OLD CODE', identityBlocked: false, ownerId: 'student-1' },
    { name: 'a changed account', executedCode: 'MOV A, #01H', identityBlocked: true, ownerId: 'student-1' },
    { name: 'an anonymous session', executedCode: 'MOV A, #01H', identityBlocked: false, ownerId: null },
  ])('keeps $name from saving an experiment run', (state) => {
    mockHookState = createHookState({ ...state, selectedExperiment: 'exp01', result: { success: true }, executionCount: 1, simulatorState: { terminated: true } });
    render(<SimulationPage />);
    expect(screen.getByRole('button', { name: '保存运行记录' })).toBeDisabled();
    if (state.identityBlocked) expect(screen.getByRole('button', { name: '运行程序' })).toBeDisabled();
  });

  it('shows the next-step entry when the server already confirms completion', () => {
    mockHookState = createHookState({
      selectedExperiment: 'exp02',
      experimentStatus: { exp02: 'COMPLETED' },
    });

    render(<SimulationPage />);

    expect(screen.getByText(/服务端已有该实验的完成回执/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回我的任务查看下一步' })).toHaveAttribute('href', '/tasks');
  });
});

describe('ExperimentSelector completion summary', () => {
  const { calculateExperimentProgress } = jest.requireActual(
    '@/components/simulation/ExperimentSelector',
  ) as typeof import('@/components/simulation/ExperimentSelector');

  it('ignores completed status keys that are outside the current experiment list', () => {
    expect(calculateExperimentProgress(
      [{ id: 'exp01' }],
      { exp01: 'COMPLETED', retiredExperiment: 'COMPLETED', staleDraft: { completed: true } },
    )).toEqual({ completedCount: 1, totalCount: 1, progressPct: 100 });
  });

  it('uses unique experiment IDs for both the completed and total counts', () => {
    expect(calculateExperimentProgress(
      [{ id: 'exp01' }, { id: 'exp01' }, { id: 'exp02' }],
      { exp01: 'COMPLETED', exp02: 'IN_PROGRESS' },
    )).toEqual({ completedCount: 1, totalCount: 2, progressPct: 50 });
  });

  it('returns a stable zero summary for an empty experiment list', () => {
    expect(calculateExperimentProgress(
      [],
      { retiredExperiment: 'COMPLETED' },
    )).toEqual({ completedCount: 0, totalCount: 0, progressPct: 0 });
  });

  it('reports normal completion across supported persisted status shapes', () => {
    const result = calculateExperimentProgress(
      [{ id: 'exp01' }, { id: 'exp02' }, { id: 'exp03' }],
      { exp01: 'COMPLETED', exp02: { completed: true }, exp03: 'ASSIGNED' },
    );

    expect(result).toEqual({ completedCount: 2, totalCount: 3, progressPct: 67 });
    expect(result.progressPct).toBeGreaterThanOrEqual(0);
    expect(result.progressPct).toBeLessThanOrEqual(100);
  });
});
