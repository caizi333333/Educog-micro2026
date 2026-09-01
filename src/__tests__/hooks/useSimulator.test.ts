import { renderHook, act, waitFor } from '@testing-library/react';
import { useSimulator, type UseSimulatorResult } from '@/hooks/useSimulator';
import { Simulator, type ExecutionTraceEntry, type SimulatorState } from '@/lib/simulator';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';
import { emptyProj04CompletionEvidence } from '@/lib/experiment-config';

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: jest.fn(),
}));

// Mock the Simulator class
jest.mock('@/lib/simulator', () => {
  return {
    Simulator: jest.fn().mockImplementation(() => ({
      state: {
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
          matrix: Array.from({ length: 4 }, () => Array(4).fill(false)),
          rowPins: ['P3.0', 'P3.1', 'P3.2', 'P3.3'], colPins: ['P2.0', 'P2.1', 'P2.2', 'P2.3'],
          lastKeyPressed: '', scanActive: false, debounceTime: 0
        },
        lcd: {
          displayEnabled: false, cursorPosition: { row: 0, col: 0 },
          displayData: Array.from({ length: 2 }, () => Array(16).fill('')),
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
      },
      updateCode: jest.fn(),
      step: jest.fn(),
      run: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
      setBreakpoint: jest.fn(),
      removeBreakpoint: jest.fn(),
      getBreakpoints: jest.fn().mockReturnValue([]),
      isAtBreakpoint: jest.fn().mockReturnValue(false)
    }))
  };
});

const MockedSimulator = Simulator as jest.MockedClass<typeof Simulator>;
const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const originalFetch = global.fetch;
let localStorageData = new Map<string, string>();

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function accessTokenFor(userId: string): string {
  const payload = window.btoa(JSON.stringify({ userId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

function prepareCompletedExperiment(
  hookResult: { current: UseSimulatorResult },
  experimentId = 'exp02',
): void {
  const simulator = MockedSimulator.mock.results[0]?.value;
  if (!simulator) throw new Error('Simulator mock was not created');
  const finalState: SimulatorState = {
    ...simulator.state,
    currentLine: 0,
    terminated: true,
  };
  const trace: ExecutionTraceEntry = {
    step: 1,
    pc: 0,
    instruction: 'END',
    line: 0,
    regChanges: [],
    memChanges: [],
    portChanges: [],
    flagChanges: [],
  };
  simulator.getState = jest.fn().mockReturnValue(finalState);
  simulator.stepWithTrace = jest.fn().mockReturnValue({ state: finalState, trace });

  act(() => hookResult.current.loadExperiment(experimentId));
  act(() => hookResult.current.stepSimulation());
}

describe('useSimulator Hook', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
    mockGetStoredAccessToken.mockReturnValue(null);
    window.history.replaceState({}, '', '/simulation');
    localStorageData = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string): string | null => localStorageData.get(key) ?? null,
        setItem: (key: string, value: string): void => { localStorageData.set(key, value); },
        removeItem: (key: string): void => { localStorageData.delete(key); },
        clear: (): void => { localStorageData.clear(); },
        key: (index: number): string | null => Array.from(localStorageData.keys())[index] ?? null,
        get length(): number { return localStorageData.size; },
      },
    });
    window.localStorage.clear();
    setOnline(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setOnline(true);
  });

  describe('初始化', () => {
    it('应该正确初始化模拟器状态', () => {
      const { result } = renderHook(() => useSimulator());
      
      expect(result.current.state).toBeDefined();
      expect(result.current.state.registers.A).toBe(0);
      expect(result.current.state.pc).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isCompletingExperiment).toBe(false);
      expect(result.current.executionCount).toBe(0);
      expect(result.current.breakpoints.size).toBe(0);
    });

    it('应该创建Simulator实例', () => {
      renderHook(() => useSimulator());
      
      expect(MockedSimulator).toHaveBeenCalledTimes(1);
    });
  });

  describe('代码管理', () => {
    it('应该正确更新代码', () => {
      const { result } = renderHook(() => useSimulator());
      const testCode = 'MOV A, #55H\nMOV P1, A';
      
      act(() => {
        result.current.updateCode(testCode);
      });
      
      expect(result.current.code).toBe(testCode);
    });

    it('应该处理空代码', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.updateCode('');
      });
      
      expect(result.current.code).toBe('');
    });
  });

  describe('实验草稿同步', () => {
    it('刷新 proj04 时应从现有实验 results 恢复五项证据自检', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      const evidence = emptyProj04CompletionEvidence();
      evidence.milestones[0] = {
        ...evidence.milestones[0],
        confirmed: true,
        confirmedAt: '2026-08-16T08:00:00.000Z',
      };
      evidence.updatedAt = '2026-08-16T08:00:00.000Z';
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{
          experimentId: 'proj04', status: 'IN_PROGRESS', lastCode: 'MOV A, #22H',
          updatedAt: '2026-08-16T08:00:00.000Z', results: { projectCompletion: evidence },
        }],
      }));
      const { result } = renderHook(() => useSimulator());

      act(() => result.current.loadExperiment('proj04'));
      await act(async () => result.current.loadExperimentDraft('proj04'));

      expect(result.current.projectCompletion).toEqual(evidence);
      expect(result.current.isLoadingProjectCompletion).toBe(false);
      expect(result.current.projectCompletionError).toBeNull();
    });

    it('保存 proj04 里程碑时应采用服务端确认时间并更新可恢复状态', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      const saved = emptyProj04CompletionEvidence();
      saved.milestones[0] = {
        ...saved.milestones[0],
        confirmed: true,
        confirmedAt: '2026-08-16T08:01:00.000Z',
      };
      saved.updatedAt = '2026-08-16T08:01:00.000Z';
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'proj04', status: 'IN_PROGRESS', lastCode: 'MOV A, #22H',
              updatedAt: '2026-08-16T08:00:00.000Z', results: null,
            }],
          });
        }
        return response({
          success: true,
          experiment: {
            experimentId: 'proj04', status: 'IN_PROGRESS', updatedAt: '2026-08-16T08:01:00.000Z',
          },
          projectCompletion: saved,
        });
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('proj04'));
      await act(async () => result.current.loadExperimentDraft('proj04'));

      await act(async () => result.current.saveProj04Milestone('requirements', true));

      expect(result.current.projectCompletion).toEqual(saved);
      expect(result.current.projectCompletionError).toBeNull();
      const postCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
        experimentId: 'proj04', intent: 'PROJECT_CHECKLIST',
        results: { projectCompletion: { version: 1 } },
      });
    });

    it('进入实验时应以服务端草稿恢复代码和版本', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{
          experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'MOV A, #22H',
          updatedAt: '2026-07-19T08:00:00.000Z',
        }],
      }));
      const { result } = renderHook(() => useSimulator());

      act(() => result.current.loadExperiment('exp02'));
      await act(async () => {
        await result.current.loadExperimentDraft('exp02');
      });

      expect(result.current.code).toBe('MOV A, #22H');
      expect(result.current.draftState).toMatchObject({
        status: 'SAVED',
        savedAt: '2026-07-19T08:00:00.000Z',
        hasUnsavedChanges: false,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/experiments/save?experimentId=exp02',
        expect.objectContaining({ method: 'GET', cache: 'no-store' }),
      );
    });

    it('服务端版本变化时应保留本地代码并进入显式冲突状态', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
              updatedAt: '2026-07-19T08:00:00.000Z',
            }],
          });
        }
        return response({
          error: '另一个页面已保存更新，请选择要保留的草稿',
          code: 'DRAFT_CONFLICT',
          serverDraft: {
            code: 'SERVER', updatedAt: '2026-07-19T08:02:00.000Z', status: 'IN_PROGRESS',
          },
        }, 409);
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));
      await act(async () => result.current.loadExperimentDraft('exp02'));
      act(() => result.current.setCode('LOCAL'));

      await act(async () => result.current.saveExperimentDraft());

      expect(result.current.code).toBe('LOCAL');
      expect(result.current.draftState).toMatchObject({
        status: 'CONFLICT',
        hasUnsavedChanges: true,
        serverCode: 'SERVER',
        serverUpdatedAt: '2026-07-19T08:02:00.000Z',
      });

      act(() => result.current.useServerDraft());
      expect(result.current.code).toBe('SERVER');
      expect(result.current.draftState).toMatchObject({ status: 'SAVED', hasUnsavedChanges: false });
    });

    it('确认保留当前代码后应基于最新服务端版本再次保存', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      let postCount = 0;
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
              updatedAt: '2026-07-19T08:00:00.000Z',
            }],
          });
        }
        postCount++;
        if (postCount === 1) {
          return response({
            error: '另一个页面已保存更新，请选择要保留的草稿',
            code: 'DRAFT_CONFLICT',
            serverDraft: {
              code: 'SERVER', updatedAt: '2026-07-19T08:02:00.000Z', status: 'IN_PROGRESS',
            },
          }, 409);
        }
        const body = JSON.parse(String(init?.body)) as { code: string; baseUpdatedAt: string };
        expect(body).toMatchObject({ code: 'LOCAL', baseUpdatedAt: '2026-07-19T08:02:00.000Z' });
        return response({
          success: true,
          experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' },
          draft: { code: 'LOCAL', updatedAt: '2026-07-19T08:03:00.000Z' },
        });
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));
      await act(async () => result.current.loadExperimentDraft('exp02'));
      act(() => result.current.setCode('LOCAL'));
      await act(async () => result.current.saveExperimentDraft());

      await act(async () => result.current.keepLocalDraft());

      expect(postCount).toBe(2);
      expect(result.current.code).toBe('LOCAL');
      expect(result.current.draftState).toMatchObject({
        status: 'SAVED',
        savedAt: '2026-07-19T08:03:00.000Z',
        hasUnsavedChanges: false,
      });
    });

    it('响应丢失后若服务端代码相同应恢复已保存而不是制造伪冲突', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      let postCount = 0;
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
              updatedAt: '2026-07-19T08:00:00.000Z',
            }],
          });
        }
        postCount++;
        if (postCount === 1) throw new TypeError('response lost');
        return response({
          error: '另一个页面已保存更新，请选择要保留的草稿',
          code: 'DRAFT_CONFLICT',
          serverDraft: {
            code: 'LOCAL', updatedAt: '2026-07-19T08:01:00.000Z', status: 'IN_PROGRESS',
          },
        }, 409);
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));
      await act(async () => result.current.loadExperimentDraft('exp02'));
      act(() => result.current.setCode('LOCAL'));

      await act(async () => result.current.saveExperimentDraft());
      expect(result.current.draftState.status).toBe('ERROR');
      await act(async () => result.current.saveExperimentDraft());

      expect(postCount).toBe(2);
      expect(result.current.draftState).toMatchObject({
        status: 'SAVED',
        savedAt: '2026-07-19T08:01:00.000Z',
        hasUnsavedChanges: false,
      });
    });

    it('断网编辑时应立即保存用户隔离的本机草稿且不发送无效请求', async () => {
      mockGetStoredAccessToken.mockReturnValue(accessTokenFor('student-1'));
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{
          experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
          updatedAt: '2026-07-19T08:00:00.000Z',
        }],
      }));
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));
      await act(async () => result.current.loadExperimentDraft('exp02'));
      setOnline(false);

      act(() => result.current.setCode('LOCAL OFFLINE'));

      await waitFor(() => expect(result.current.draftState.status).toBe('LOCAL_SAVED'));
      expect(result.current.draftState).toMatchObject({
        hasUnsavedChanges: true,
        hasLocalBackup: true,
      });
      const stored = JSON.parse(String(window.localStorage.getItem(
        'educog:experiment-draft:v1:student-1:exp02',
      ))) as Record<string, unknown>;
      expect(stored).toMatchObject({
        version: 1,
        userId: 'student-1',
        experimentId: 'exp02',
        code: 'LOCAL OFFLINE',
        baseCode: 'BASE',
        baseUpdatedAt: '2026-07-19T08:00:00.000Z',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('恢复联网后应自动同步本机草稿并在成功后清除本地副本', async () => {
      mockGetStoredAccessToken.mockReturnValue(accessTokenFor('student-1'));
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
              updatedAt: '2026-07-19T08:00:00.000Z',
            }],
          });
        }
        const body = JSON.parse(String(init?.body)) as { code: string; baseUpdatedAt: string };
        expect(body).toMatchObject({
          code: 'LOCAL OFFLINE',
          baseUpdatedAt: '2026-07-19T08:00:00.000Z',
        });
        return response({
          success: true,
          experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' },
          draft: { code: 'LOCAL OFFLINE', updatedAt: '2026-07-19T08:03:00.000Z' },
        });
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));
      await act(async () => result.current.loadExperimentDraft('exp02'));
      setOnline(false);
      act(() => result.current.setCode('LOCAL OFFLINE'));
      await waitFor(() => expect(result.current.draftState.status).toBe('LOCAL_SAVED'));

      await act(async () => {
        setOnline(true);
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => expect(result.current.draftState.status).toBe('SAVED'));
      expect(result.current.draftState).toMatchObject({
        savedAt: '2026-07-19T08:03:00.000Z',
        hasUnsavedChanges: false,
        hasLocalBackup: false,
      });
      expect(window.localStorage.getItem('educog:experiment-draft:v1:student-1:exp02')).toBeNull();
    });

    it('刷新时应先恢复同一服务端基线上的本机草稿并继续同步', async () => {
      mockGetStoredAccessToken.mockReturnValue(accessTokenFor('student-1'));
      window.localStorage.setItem('educog:experiment-draft:v1:student-1:exp02', JSON.stringify({
        version: 1,
        userId: 'student-1',
        experimentId: 'exp02',
        code: 'LOCAL RECOVERED',
        baseCode: 'BASE',
        baseUpdatedAt: '2026-07-19T08:00:00.000Z',
        savedAt: '2026-07-19T08:01:00.000Z',
      }));
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return response({
            success: true,
            experiments: [{
              experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'BASE',
              updatedAt: '2026-07-19T08:00:00.000Z',
            }],
          });
        }
        return response({
          success: true,
          experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' },
          draft: { code: 'LOCAL RECOVERED', updatedAt: '2026-07-19T08:02:00.000Z' },
        });
      });
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));

      await act(async () => result.current.loadExperimentDraft('exp02'));

      expect(result.current.code).toBe('LOCAL RECOVERED');
      expect(result.current.draftState).toMatchObject({
        status: 'DIRTY',
        hasUnsavedChanges: true,
        hasLocalBackup: true,
      });
      await act(async () => result.current.saveExperimentDraft());
      expect(result.current.draftState).toMatchObject({
        status: 'SAVED',
        hasUnsavedChanges: false,
        hasLocalBackup: false,
      });
    });

    it('刷新时本机草稿基线过旧应保留本机代码并要求显式选择', async () => {
      mockGetStoredAccessToken.mockReturnValue(accessTokenFor('student-1'));
      window.localStorage.setItem('educog:experiment-draft:v1:student-1:exp02', JSON.stringify({
        version: 1,
        userId: 'student-1',
        experimentId: 'exp02',
        code: 'LOCAL OLDER',
        baseCode: 'BASE',
        baseUpdatedAt: '2026-07-19T08:00:00.000Z',
        savedAt: '2026-07-19T08:01:00.000Z',
      }));
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{
          experimentId: 'exp02', status: 'IN_PROGRESS', lastCode: 'SERVER NEWER',
          updatedAt: '2026-07-19T08:02:00.000Z',
        }],
      }));
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));

      await act(async () => result.current.loadExperimentDraft('exp02'));

      expect(result.current.code).toBe('LOCAL OLDER');
      expect(result.current.draftState).toMatchObject({
        status: 'CONFLICT',
        hasUnsavedChanges: true,
        hasLocalBackup: true,
        serverCode: 'SERVER NEWER',
        serverUpdatedAt: '2026-07-19T08:02:00.000Z',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('实验已完成时不得静默删除尚未同步的本机副本', async () => {
      mockGetStoredAccessToken.mockReturnValue(accessTokenFor('student-1'));
      const storageKey = 'educog:experiment-draft:v1:student-1:exp02';
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 1,
        userId: 'student-1',
        experimentId: 'exp02',
        code: 'LOCAL UNSUBMITTED',
        baseCode: 'BASE',
        baseUpdatedAt: '2026-07-19T08:00:00.000Z',
        savedAt: '2026-07-19T08:01:00.000Z',
      }));
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{
          experimentId: 'exp02', status: 'COMPLETED', lastCode: 'SERVER SUBMITTED',
          updatedAt: '2026-07-19T08:02:00.000Z',
        }],
      }));
      const { result } = renderHook(() => useSimulator());
      act(() => result.current.loadExperiment('exp02'));

      await act(async () => result.current.loadExperimentDraft('exp02'));

      expect(result.current.code).toBe('LOCAL UNSUBMITTED');
      expect(result.current.draftState).toMatchObject({
        status: 'READ_ONLY',
        hasUnsavedChanges: true,
        hasLocalBackup: true,
      });
      expect(window.localStorage.getItem(storageKey)).not.toBeNull();
    });
  });

  describe('执行控制', () => {
    it('应该正确执行单步操作', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.step();
      });
      
      // 单步执行不会改变isRunning状态
      expect(result.current.isRunning).toBe(false);
    });

    it('应该正确启动运行', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.run();
      });
      
      expect(result.current.isRunning).toBe(true);
    });

    it('exp02 快速重复运行只启动一次，并在停止和重置后清理运行状态', () => {
      const { result } = renderHook(() => useSimulator());
      const simulator = MockedSimulator.mock.results[0]?.value;
      if (!simulator) throw new Error('Simulator mock was not created');

      act(() => {
        result.current.loadExperiment('exp02');
        result.current.runSimulation();
        result.current.runSimulation();
      });

      expect(simulator.updateCode).toHaveBeenCalledTimes(1);
      expect(result.current.selectedExperiment).toBe('exp02');
      expect(result.current.isRunning).toBe(true);

      act(() => result.current.stop());
      expect(result.current.isRunning).toBe(false);

      act(() => result.current.resetSimulation());
      expect(result.current.executionCount).toBe(0);
      expect(result.current.result).toBeNull();
      expect(result.current.isRunning).toBe(false);
    });

    it('应该正确停止运行', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.run();
      });
      
      expect(result.current.isRunning).toBe(true);
      
      act(() => {
        result.current.stop();
      });
      
      expect(result.current.isRunning).toBe(false);
    });

    it('应该正确重置模拟器', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('断点管理', () => {
    it('应该正确设置断点', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        result.current.setBreakpoint(5);
      });
      
      expect(result.current.breakpoints.has(5)).toBe(true);
    });

    it('应该正确移除断点', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 先设置断点
      act(() => {
        result.current.setBreakpoint(5);
      });
      
      expect(result.current.breakpoints.has(5)).toBe(true);
      
      // 然后移除断点
      act(() => {
        result.current.removeBreakpoint(5);
      });
      
      expect(result.current.breakpoints.has(5)).toBe(false);
    });

    it('应该正确获取断点列表', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置一些断点
      act(() => {
        result.current.setBreakpoint(1);
        result.current.setBreakpoint(3);
        result.current.setBreakpoint(5);
      });
      
      expect(result.current.breakpoints.has(1)).toBe(true);
      expect(result.current.breakpoints.has(3)).toBe(true);
      expect(result.current.breakpoints.has(5)).toBe(true);
      expect(result.current.breakpoints.size).toBe(3);
    });

    it('应该正确移除断点', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置断点
      act(() => {
        result.current.setBreakpoint(1);
        result.current.setBreakpoint(3);
      });
      
      expect(result.current.breakpoints.size).toBe(2);
      
      // 移除断点
      act(() => {
        result.current.removeBreakpoint(1);
      });
      
      expect(result.current.breakpoints.has(1)).toBe(false);
      expect(result.current.breakpoints.has(3)).toBe(true);
      expect(result.current.breakpoints.size).toBe(1);
    });
  });

  describe('状态更新', () => {
    it('应该在步进执行后更新状态', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置代码
      act(() => {
        result.current.setCode('MOV A, #55H\nNOP');
      });
      
      // 执行步进
      act(() => {
        result.current.step();
      });
      
      // 验证状态更新
      expect(result.current.simulatorState).toBeDefined();
      if (result.current.simulatorState) {
        expect(result.current.simulatorState.registers.A).toBe(0x55);
      }
    });

    it('应该在重置后恢复初始状态', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置代码并执行步进
      act(() => {
        result.current.setCode('MOV A, #55H');
        result.current.step();
      });
      
      // 验证状态已改变
      expect(result.current.simulatorState).toBeDefined();
      
      // 重置
      act(() => {
        result.current.resetSimulation();
      });
      
      // 验证状态已重置
      expect(result.current.simulatorState).toBeNull();
      expect(result.current.fault).toBe('');
      expect(result.current.result).toBeNull();
      expect(result.current.isRunning).toBe(false);
      expect(result.current.executionCount).toBe(0);
    });
  });

  describe('实验完成记录', () => {
    it('从课前任务进入时应先确认进行中状态并保存到本地状态映射', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        duplicate: false,
        experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' },
        message: '实验已开始，刷新后可继续',
      }));
      const { result } = renderHook(() => useSimulator());

      await act(async () => {
        await expect(result.current.startExperiment('exp02')).resolves.toBe('IN_PROGRESS');
      });

      expect(result.current.experimentStatus.exp02).toBe('IN_PROGRESS');
      expect(global.fetch).toHaveBeenCalledWith('/api/experiments/save', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ experimentId: 'exp02', status: 'IN_PROGRESS', intent: 'START' }),
      }));
    });

    it('加载失败时应该保留明确错误并允许再次调用', async () => {
      const originalFetch = global.fetch;
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: '实验记录服务暂不可用' }),
      } as Response);
      try {
        const { result } = renderHook(() => useSimulator());

        await act(async () => {
          await result.current.loadExperimentStatus();
        });

        await waitFor(() => expect(result.current.isLoadingStatus).toBe(false));
        expect(result.current.experimentStatusError).toBe('实验记录服务暂不可用');
        expect(result.current.experimentStatus).toEqual({});
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('登录失效时应该清除旧的实验完成标记', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({ error: '无效的令牌' }, 401));
      const { result } = renderHook(() => useSimulator());

      act(() => result.current.setExperimentStatus({ exp02: 'COMPLETED' }));
      await act(async () => {
        await result.current.loadExperimentStatus();
      });

      expect(result.current.experimentStatus).toEqual({});
      expect(result.current.experimentStatusError).toBe('登录状态已失效，暂时无法读取实验完成记录。');
    });

    it('并发返回的旧待开始状态不得覆盖已确认的进行中状态', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiments: [{ experimentId: 'exp02', status: 'ASSIGNED' }],
      }));
      const { result } = renderHook(() => useSimulator());

      act(() => result.current.setExperimentStatus({ exp02: 'IN_PROGRESS' }));
      await act(async () => {
        await result.current.loadExperimentStatus();
      });

      expect(result.current.experimentStatus.exp02).toBe('IN_PROGRESS');
    });

    it('保存响应字段不完整时不能把实验标记为已完成', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({ success: true }));
      const { result } = renderHook(() => useSimulator());
      prepareCompletedExperiment(result);

      await act(async () => {
        await result.current.completeExperiment();
      });

      expect(result.current.experimentStatus.exp02).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('网络结果不明时应该按完成编号向服务端核对并恢复状态', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      window.history.replaceState({}, '', '/simulation?taskPathId=path_1&taskStepId=addressing-exp02');
      let completionKey = '';
      global.fetch = jest.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'POST') {
          const requestBody = JSON.parse(String(init?.body)) as { completionKey: string };
          completionKey = requestBody.completionKey;
          throw new TypeError('network response lost');
        }
        expect(String(input)).toBe('/api/experiments/save?experimentId=exp02');
        return response({
          success: true,
          experiments: [{
            experimentId: 'exp02',
            status: 'COMPLETED',
            results: {
              completionContext: {
                completionKey,
                pathId: 'path_1',
                stepId: 'addressing-exp02',
              },
            },
          }],
        });
      });
      const { result } = renderHook(() => useSimulator());
      prepareCompletedExperiment(result);

      await act(async () => {
        await result.current.completeExperiment();
      });

      expect(result.current.experimentStatus.exp02).toBe('COMPLETED');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect((global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    });

    it('核对不到本次完成编号时不应误判，并应原样重试同一请求', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      window.history.replaceState({}, '', '/simulation?taskPathId=path_1&taskStepId=addressing-exp02');
      const postBodies: string[] = [];
      global.fetch = jest.fn().mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'POST') {
          postBodies.push(String(init?.body));
          if (postBodies.length === 1) throw new TypeError('network response lost');
          return response({
            success: true,
            duplicate: true,
            experiment: { experimentId: 'exp02', status: 'COMPLETED' },
            pointsEarned: 0,
            newAchievements: null,
          });
        }
        return response({
          success: true,
          experiments: [{
            experimentId: 'exp02',
            status: 'COMPLETED',
            results: {
              completionContext: {
                completionKey: 'experiment:another_path:another_step',
                pathId: 'another_path',
                stepId: 'another_step',
              },
            },
          }],
        });
      });
      const { result } = renderHook(() => useSimulator());
      prepareCompletedExperiment(result);

      await act(async () => {
        await result.current.completeExperiment();
      });
      expect(result.current.experimentStatus.exp02).toBeUndefined();

      await act(async () => {
        await result.current.completeExperiment();
      });
      expect(result.current.experimentStatus.exp02).toBe('COMPLETED');
      expect(postBodies).toHaveLength(2);
      expect(postBodies[1]).toBe(postBodies[0]);
    });

    it('快速重复点击完成实验时只发送一次保存请求', async () => {
      mockGetStoredAccessToken.mockReturnValue('test-token');
      global.fetch = jest.fn().mockResolvedValue(response({
        success: true,
        experiment: { experimentId: 'exp02', status: 'COMPLETED' },
        pointsEarned: 0,
        newAchievements: null,
      }));
      const { result } = renderHook(() => useSimulator());
      prepareCompletedExperiment(result);

      await act(async () => {
        await Promise.all([
          result.current.completeExperiment(),
          result.current.completeExperiment(),
        ]);
      });

      expect(result.current.experimentStatus.exp02).toBe('COMPLETED');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误处理', () => {
    it('应该处理模拟器执行错误', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置无效代码
      act(() => {
        result.current.setCode('INVALID_INSTRUCTION');
      });
      
      expect(() => {
        act(() => {
          result.current.step();
        });
      }).not.toThrow();
      
      // 验证错误被正确处理
      expect(result.current.fault).toBeTruthy();
      expect(result.current.isRunning).toBe(false);
    });

    it('应该处理无效代码', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置无效代码并尝试执行
      act(() => {
        result.current.setCode('INVALID_INSTRUCTION');
      });
      
      expect(() => {
        act(() => {
          result.current.step();
        });
      }).not.toThrow();
      
      // 验证错误状态
      expect(result.current.fault).toBeTruthy();
    });
  });

  describe('性能测试', () => {
    it('应该能够处理频繁的状态更新', () => {
      const { result } = renderHook(() => useSimulator());
      
      // 设置代码以便能够执行步进
      act(() => {
        result.current.setCode('MOV A, #55H\nNOP');
      });
      
      // 模拟频繁的步进操作
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.step();
        }
      });
      
      // 验证hook状态正确更新
      expect(result.current.simulatorState).toBeDefined();
    });

    it('应该能够处理大量断点', () => {
      const { result } = renderHook(() => useSimulator());
      
      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.setBreakpoint(i);
        }
      });
      
      // 验证断点数量
      expect(result.current.breakpoints.size).toBe(50);
    });
  });

  describe('内存清理', () => {
    it('应该在组件卸载时清理资源', () => {
      const { result, unmount } = renderHook(() => useSimulator());
      
      // 设置代码
      act(() => {
        result.current.setCode('MOV A, #55H');
      });
      
      // 验证组件卸载不会抛出错误
      expect(() => unmount()).not.toThrow();
    });
  });
});
