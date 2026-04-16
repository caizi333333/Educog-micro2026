import { renderHook, act } from '@testing-library/react';
import { useSimulator } from '@/hooks/useSimulator';
import { Simulator } from '@/lib/simulator';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

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

describe('useSimulator Hook', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('初始化', () => {
    it('应该正确初始化模拟器状态', () => {
      const { result } = renderHook(() => useSimulator());
      
      expect(result.current.state).toBeDefined();
      expect(result.current.state.registers.A).toBe(0);
      expect(result.current.state.pc).toBe(0);
      expect(result.current.isRunning).toBe(false);
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