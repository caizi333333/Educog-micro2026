import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';
import { Simulator, type SimulatorState, type ExecutionTraceEntry } from '@/lib/simulator';
import { experiments } from '@/lib/experiment-config';

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

export const useSimulator = () => {
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
  const [paused, setPaused] = useState(false); // 停在断点/单步处（"运行"→"继续"）
  const [fault, setFault] = useState('');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatusMap>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [previousState, setPreviousState] = useState<SimulatorState | null>(null);
  const [traceLog, setTraceLog] = useState<ExecutionTraceEntry[]>([]);
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

  // 卸载时确保动画循环停止，避免离开页面后仍在后台步进
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      if (rafRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    };
  }, []);

  const cancelLoop = useCallback(() => {
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

  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints(prev => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      return next;
    });
  }, []);

  // 在hook初始化时就创建Simulator实例（用于兼容测试）
  if (!simulatorRef.current) {
    simulatorRef.current = new Simulator();
  }

  // 初始化仿真器
  const initializeSimulator = () => {
    if (!simulatorRef.current) {
      simulatorRef.current = new Simulator();
    }
    return simulatorRef.current;
  };

  const portValuesHex = (s: SimulatorState) => ({
    P0: '0x' + s.portValues.P0.toString(16).toUpperCase().padStart(2, '0'),
    P1: '0x' + s.portValues.P1.toString(16).toUpperCase().padStart(2, '0'),
    P2: '0x' + s.portValues.P2.toString(16).toUpperCase().padStart(2, '0'),
    P3: '0x' + s.portValues.P3.toString(16).toUpperCase().padStart(2, '0'),
  });

  // 程序自然终止（遇到 END / PC 越界）时收尾
  const finalizeRun = useCallback((finalState: SimulatorState) => {
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
    if (selectedExperiment) {
      recordExperimentCompletion(selectedExperiment).catch(() => { /* 已在内部处理 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExperiment]);

  // 运行仿真 —— 逐帧批量步进的真实动画执行
  // 支持：运行到断点暂停；断点/单步暂停后再点"运行"从当前位置继续
  const runSimulation = () => {
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

    const tick = () => {
      if (!runningRef.current || !mountedRef.current) return;
      try {
        const { terminated, hitBreakpoint } = simulator.stepBatch(speedRef.current, breakpointsRef.current);
        const state = simulator.getState();
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
  const stepSimulation = () => {
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

        // 显示初始状态（PC=0, 未执行任何指令）
        if (typeof simulator.getState === 'function') {
          setSimulatorState(simulator.getState());
        }
      }

      setPreviousState(simulatorState);

      // 执行单步（带追踪）
      const { state: newState, trace } = simulator.stepWithTrace();
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
  const resetSimulation = () => {
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
    setFault('');
    setResult(null);
    setIsRunning(false);
  };

  // 加载实验
  const loadExperiment = useCallback((experimentId: string) => {
    const experiment = experiments.find(exp => exp.id === experimentId);
    if (experiment) {
      setCode(experiment.code);
      setSelectedExperiment(experimentId);
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
  }, [toast]);

  // 外部输入：改写端口位锁存电平（画布按键按下拉低、松开回高），并立即刷新画面
  const setPortBit = useCallback((port: 'P0' | 'P1' | 'P2' | 'P3', bit: number, level: boolean) => {
    const simulator = simulatorRef.current;
    if (!simulator?.setPortBit) return;
    simulator.setPortBit(port, bit, level);
    // 未在运行时也让画布立刻反映电平变化（运行中由动画循环每帧刷新）
    if (!runningRef.current && typeof simulator.getState === 'function') {
      setSimulatorState(simulator.getState());
    }
  }, []);

  // 瞬时按键：拉低固定指令数后自动回高（时长短于实验代码的消抖延时，单击只触发一次）
  const pulsePortBit = useCallback((port: 'P0' | 'P1' | 'P2' | 'P3', bit: number) => {
    const simulator = simulatorRef.current;
    if (!simulator?.pulsePortBit) return;
    simulator.pulsePortBit(port, bit);
    if (!runningRef.current && typeof simulator.getState === 'function') {
      setSimulatorState(simulator.getState());
    }
  }, []);

  // 记录实验完成
  const recordExperimentCompletion = useCallback(async (experimentId: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('未登录');

    const response = await fetch('/api/experiments/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        experimentId,
        status: 'COMPLETED',
        code: code,
        results: result
      })
    });

    if (!response.ok) {
      throw new Error(`保存失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    // Invalidate analytics cache so dashboard refreshes
    try {
      const uid = typeof window !== 'undefined' ? JSON.parse(atob((localStorage.getItem('accessToken') || '').split('.')[1] || '')).userId : null;
      if (uid) {
        localStorage.removeItem(`analytics_${uid}`);
        localStorage.removeItem(`analytics_${uid}_time`);
      }
    } catch { /* non-critical */ }

    // 处理成就通知
    if (data.newAchievements && data.newAchievements.length > 0) {
      processAchievementResponse({ newAchievements: data.newAchievements });
    }

    // 显示积分奖励通知
    if (data.pointsEarned > 0) {
      toast({
        title: '实验完成！',
        description: `获得 ${data.pointsEarned} 积分`,
      });
    }

    // 更新实验状态
    setExperimentStatus(prev => ({
      ...prev,
      [experimentId]: 'COMPLETED'
    }));
  }, [code, result, toast]);

  // 获取诊断信息
  const getDiagnostics = () => {
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
  const loadExperimentStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoadingStatus(false);
        return;
      }

      const response = await fetch('/api/experiments/save', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.experiments) {
          const statusMap: ExperimentStatusMap = {};
          data.experiments.forEach((exp: any) => {
            statusMap[exp.experimentId] = exp.status;
          });
          setExperimentStatus(statusMap);
        }
      } else {
        console.error('加载实验状态失败: HTTP', response.status, response.statusText);
      }
    } catch (error) {
      console.error('加载实验状态失败:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // 完成实验
  const completeExperiment = useCallback(async () => {
    if (!selectedExperiment) {
      toast({
        title: '未选择实验',
        description: '请先选择一个实验',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    try {
      await recordExperimentCompletion(selectedExperiment);
      toast({
        title: '实验已完成',
        description: '实验进度已保存',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '实验完成状态保存失败',
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  }, [selectedExperiment, recordExperimentCompletion, toast]);

  // 设置断点
  const setBreakpoint = (line: number) => {
    setBreakpoints(prev => new Set([...prev, line]));
    // 断点功能暂时在前端管理
  };

  // 移除断点
  const removeBreakpoint = (line: number) => {
    setBreakpoints(prev => {
      const newBreakpoints = new Set(prev);
      newBreakpoints.delete(line);
      return newBreakpoints;
    });
    // 断点功能暂时在前端管理
  };

  // 更新代码（用于兼容测试）
  const updateCode = (newCode: string) => {
    setCode(newCode);
    if (simulatorRef.current) {
      simulatorRef.current.updateCode(newCode);
    }
  };

  // 运行程序（别名，用于兼容测试）
  const run = () => runSimulation();

  // 单步执行（别名，用于兼容测试）
  const step = () => {
    return stepSimulation();
  };

  // 停止执行 —— 真正终止动画循环，画面停在当前帧便于观察
  // 停止=结束本次会话（下次点"运行"从头开始，而非继续）
  const stop = () => {
    cancelLoop();
    resumableRef.current = false;
    setPaused(false);
    setIsRunning(false);
    // 补一个结果，让"完成实验"按钮在停止后可用（闪烁类程序不会自然终止）
    setResult(prev => prev ?? { success: true, output: '已停止' });
  };

  // 重置（别名，用于兼容测试）
  const reset = () => {
    if (simulatorRef.current) {
      simulatorRef.current.reset();
    }
    return resetSimulation();
  };

  // 获取断点列表（用于兼容测试）
  const getBreakpoints = () => {
    return Array.from(breakpoints);
  };

  // 检查是否在断点处（用于兼容测试）
  const isAtBreakpoint = (line: number) => {
    return breakpoints.has(line);
  };

  // 确保初始状态存在（用于兼容测试）
  const getInitialState = () => {
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
      };
    }
    return simulatorState;
  };

  return {
    code,
    setCode,
    state: simulatorState || getInitialState(), // 为了兼容测试，同时提供state和simulatorState
    simulatorState,
    previousState,
    traceLog,
    isRunning,
    fault,
    result,
    selectedExperiment,
    experimentStatus,
    isLoadingStatus,
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