import { useState, useRef, useCallback } from 'react';
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
  const [fault, setFault] = useState('');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [experimentStatus, setExperimentStatus] = useState<ExperimentStatusMap>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [previousState, setPreviousState] = useState<SimulatorState | null>(null);
  const [traceLog, setTraceLog] = useState<ExecutionTraceEntry[]>([]);
  const MAX_TRACE_ENTRIES = 200;
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());

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

  // 运行仿真
  const runSimulation = async () => {
    if (!code.trim()) {
      toast({
        title: '代码为空',
        description: '请输入汇编代码后再执行仿真',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setFault('');
    setPreviousState(simulatorState);
    // 完整运行会使单步会话失效
    stepInitializedRef.current = false;
    stepCodeRef.current = '';

    try {
      const simulator = initializeSimulator();
      
      // 运行程序并获取最终状态
      const finalState = await simulator.run(code);
      
      // 获取执行结果（包含LED状态等）
      const executionResult = {
        registers: { ...finalState.registers },
        portValues: {
          P0: '0x' + finalState.portValues.P0.toString(16).toUpperCase().padStart(2, '0'),
          P1: '0x' + finalState.portValues.P1.toString(16).toUpperCase().padStart(2, '0'),
          P2: '0x' + finalState.portValues.P2.toString(16).toUpperCase().padStart(2, '0'),
          P3: '0x' + finalState.portValues.P3.toString(16).toUpperCase().padStart(2, '0'),
        },
        leds: Array.from({ length: 8 }, (_, i) => ((finalState.portValues.P1 >> i) & 1) === 0),
        psw: { ...finalState.psw },
      }
      
      setSimulatorState(finalState);
      setResult({ 
        success: true, 
        output: '仿真执行成功',
        ...executionResult
      });
      
      // 触发状态更新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simulatorRun', { detail: finalState }));
      }
      
      // 记录实验完成状态
      if (selectedExperiment) {
        await recordExperimentCompletion(selectedExperiment);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '仿真执行失败';
      setFault(errorMessage);
      setResult({ success: false, error: errorMessage });
      
      toast({
        title: '仿真执行失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 跟踪是否已为当前代码初始化单步会话
  const stepInitializedRef = useRef(false);
  const stepCodeRef = useRef('');

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

      // 首次单步 或 代码已更改 或 上次完整运行后 → 重新加载代码
      const needsInit = !stepInitializedRef.current
        || stepCodeRef.current !== code
        || simulatorState?.terminated;

      if (needsInit) {
        simulator.reset();
        simulator.updateCode(code);
        stepInitializedRef.current = true;
        stepCodeRef.current = code;
        setFault('');
        setResult(null);

        // 显示初始状态（PC=0, 未执行任何指令）
        const initialState = simulator.getState();
        setSimulatorState(initialState);
      }

      setPreviousState(simulatorState);

      // 执行单步（带追踪）
      const { state: newState, trace } = simulator.stepWithTrace();
      setTraceLog(prev => [...prev.slice(-(MAX_TRACE_ENTRIES - 1)), trace]);

      setSimulatorState(newState);

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
    if (simulatorRef.current) {
      simulatorRef.current.reset();
    }
    stepInitializedRef.current = false;
    stepCodeRef.current = '';
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
      resetSimulation();
      
      toast({
        title: '实验加载成功',
        description: `已加载实验: ${experiment.title}`,
      });
    }
  }, [toast]);

  // 记录实验完成
  const recordExperimentCompletion = useCallback(async (experimentId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

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

      if (response.ok) {
        const data = await response.json();
        
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
      }
    } catch (error) {
      console.error('Failed to record experiment completion:', error);
    }
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
  const run = () => {
    setIsRunning(true);
    return runSimulation();
  };

  // 单步执行（别名，用于兼容测试）
  const step = () => {
    return stepSimulation();
  };

  // 停止执行（用于兼容测试）
  const stop = () => {
    setIsRunning(false);
    // 停止功能通过重置实现
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
    updateCode,
    run,
    step,
    stop,
    reset,
    getBreakpoints,
    isAtBreakpoint
  };
};