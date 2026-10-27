import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedSimulation from '@/components/EnhancedSimulation';
import { HyperExperimentCanvas } from '@/components/hyper/HyperExperimentCanvas';
import { Simulator } from '@/lib/simulator';
import {
  collectExperimentObservation, createExperimentObservation, getExperimentConfig,
  validateExperimentObservation,
} from '@/lib/experiment-config';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Cpu: () => <div data-testid="cpu-icon" />,
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  RotateCcw: () => <div data-testid="reset-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  AlertTriangle: () => <div data-testid="alert-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  Monitor: () => <div data-testid="monitor-icon" />,
  Layers: () => <div data-testid="layers-icon" />,
  Maximize2: () => <div data-testid="maximize-icon" />,
  Camera: () => <div data-testid="camera-icon" />,
  Mic: () => <div data-testid="mic-icon" />,
  Volume2: () => <div data-testid="volume-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Info: () => <div data-testid="info-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Lightbulb: () => <div data-testid="lightbulb-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Activity: () => <div />,
  ArrowDown: () => <div />,
  ArrowUp: () => <div />,
  Car: () => <div />,
  Keyboard: () => <div />,
  Radio: () => <div />,
  TerminalSquare: () => <div />,
  Thermometer: () => <div />,
  Waypoints: () => <div />,
  ZoomIn: () => <div />,
  ZoomOut: () => <div />
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => 
    <button onClick={onClick} className={className} {...props}>{children}</button>
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => 
    <div className={className} data-testid="progress" data-value={value}>{value}%</div>
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, className }: any) => 
    <input 
      type="range" 
      value={value?.[0] || 0} 
      onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
      className={className}
      role="slider"
    />
}));

// Mock the useSimulator hook
jest.mock('@/hooks/useSimulator', () => ({
  useSimulator: () => ({
    code: '',
    setCode: jest.fn(),
    simulatorState: {
      registers: { A: 0, B: 0, SP: 0x07 },
      ram: new Uint8Array(128),
      pc: 0,
      psw: { CY: false, AC: false, F0: false, RS1: false, RS0: false, OV: false, P: false },
      portValues: { P0: 0xFF, P1: 0xFF, P2: 0xFF, P3: 0xFF },
      timers: { TCON: 0x00, TMOD: 0x00, TH0: 0x00, TL0: 0x00, TH1: 0x00, TL1: 0x00, TR0: false, TR1: false },
      uart: { SCON: 0x00, SBUF: 0x00, TI: false, RI: false, baudRate: 9600 },
      terminated: false,
      memory: new Uint8Array(8192)
    },
    isRunning: false,
    fault: '',
    result: null,
    runSimulation: jest.fn(),
    stepSimulation: jest.fn(),
    stopSimulation: jest.fn(),
    resetSimulation: jest.fn(),
    updateCode: jest.fn(),
    setBreakpoint: jest.fn(),
    removeBreakpoint: jest.fn(),
    breakpoints: new Set<number>()
  })
}));

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

describe('EnhancedSimulation Component', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  it('应该正确渲染组件', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('增强实验仿真')).toBeInTheDocument();
    expect(screen.getByText('3D可视化 + AR调试 + 实时指导的沉浸式仿真体验')).toBeInTheDocument();
  });

  it('应该显示仿真场景选择器', () => {
    render(<EnhancedSimulation />);
    
    // 检查场景标题和描述
    const ledTitles = screen.getAllByText('LED闪烁控制');
    expect(ledTitles.length).toBeGreaterThan(0);
    expect(screen.getByText('学习基本的GPIO控制，实现LED灯的闪烁效果')).toBeInTheDocument();
  });

  it('应该能够切换仿真场景', async () => {
    render(<EnhancedSimulation />);
    
    // 查找并点击不同的场景
    const buttonScenario = screen.getByText('按键控制LED');
    fireEvent.click(buttonScenario);
    
    await waitFor(() => {
      expect(screen.getByText('学习输入检测和输出控制的结合应用')).toBeInTheDocument();
    });
  });

  it('应该显示仿真控制按钮', () => {
    render(<EnhancedSimulation />);
    
    // 检查控制按钮的存在（通过按钮数量和功能）
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(3); // 至少有播放、重置等按钮
    
    // 检查速度控制滑块
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('应该显示视图模式切换按钮', () => {
    render(<EnhancedSimulation />);
    
    // 检查视图模式切换按钮（通过图标识别）
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // 检查速度控制
    expect(screen.getByText('速度:')).toBeInTheDocument();
  });

  it('应该显示学习目标面板', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('学习目标')).toBeInTheDocument();
    expect(screen.getByText('连接LED到单片机P1.0端口')).toBeInTheDocument();
  });

  it('应该显示学习目标内容', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('学习目标')).toBeInTheDocument();
    expect(screen.getByText('连接LED到单片机P1.0端口')).toBeInTheDocument();
  });

  it('应该显示学习提示', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('学习提示')).toBeInTheDocument();
    expect(screen.getByText('使用P1寄存器控制LED状态')).toBeInTheDocument();
  });

  it('应该显示场景完成率', () => {
    render(<EnhancedSimulation />);
    
    // 检查进度条和百分比显示
    const percentageTexts = screen.getAllByText('85%');
    expect(percentageTexts.length).toBeGreaterThan(0);
    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars.length).toBeGreaterThan(0);
    expect(progressBars[0]).toHaveAttribute('data-value', '85');
  });

  it('应该能够选择组件', async () => {
    render(<EnhancedSimulation />);
    
    // 检查canvas是否存在
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    
    // 模拟点击canvas
    if (canvas) {
      fireEvent.click(canvas, { clientX: 400, clientY: 300 });
    }
    
    // 检查基本功能是否正常
    expect(screen.getByText('学习目标')).toBeInTheDocument();
  });

  it('应该显示难度标识', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('beginner')).toBeInTheDocument();
  });

  it('应该显示预计时间', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('30min')).toBeInTheDocument();
  });

  it('应该处理视角控制', () => {
    render(<EnhancedSimulation />);
    
    const viewControls = screen.getAllByRole('slider');
    expect(viewControls.length).toBeGreaterThan(0);
  });

  it('应该显示AR增强现实模式', async () => {
    render(<EnhancedSimulation />);
    
    // 切换到AR模式 - 通过Camera图标按钮
    const cameraButtons = screen.getAllByTestId('camera-icon');
    const arButton = cameraButtons[0].closest('button');
    if (arButton) {
      fireEvent.click(arButton);
    }
    
    await waitFor(() => {
      expect(screen.getByText('AR增强现实模式')).toBeInTheDocument();
    });
  });

  it('应该显示实时调试', () => {
    render(<EnhancedSimulation />);
    
    expect(screen.getByText('实时调试')).toBeInTheDocument();
  });
});

describe('HyperExperimentCanvas simulated ADC input', () => {
  const inputName = 'P0 模拟 ADC 输入（0–255）';

  function ConnectedCanvas({ simulator }: { simulator: Simulator }) {
    const [state, setState] = React.useState(() => simulator.getState());
    return (
      <HyperExperimentCanvas
        experimentId="proj02"
        simulatorState={state}
        onSetPortBit={(port, bit, level) => {
          simulator.setPortBit(port, bit, level);
          setState(simulator.getState());
        }}
      />
    );
  }

  it.each([0, 127, 255])('writes input %i to actual P0 and the original program reads its complement', value => {
    const simulator = new Simulator(getExperimentConfig('proj02')!.code);
    render(<ConnectedCanvas simulator={simulator} />);
    const input = screen.getByRole('slider', { name: inputName });

    // Move away from the reset value first so the 255 case also exercises a change.
    fireEvent.change(input, { target: { value: '64' } });
    fireEvent.change(input, { target: { value: String(value) } });
    expect(input).toHaveValue(String(value));
    expect(simulator.getState().portValues.P0).toBe(value);
    expect(simulator.getState().portValues.P1).toBe(255);

    expect(() => simulator.stepBatch(30_000)).not.toThrow();
    const state = simulator.getState();
    expect(state.terminated).toBe(false);
    expect(state.ram[0x32]).toBe(value);
    expect(state.ram[0x30]).toBe(255 - value);
  });

  it('allows the original project to satisfy output observations after an intermediate input', () => {
    const simulator = new Simulator(getExperimentConfig('proj02')!.code);
    simulator.stepBatch(1_024);
    render(<ConnectedCanvas simulator={simulator} />);
    fireEvent.change(screen.getByRole('slider', { name: inputName }), { target: { value: '127' } });

    let observation = createExperimentObservation();
    expect(() => {
      for (let batch = 0; batch < 2_000; batch++) {
        const result = simulator.stepBatch(257);
        observation = collectExperimentObservation(observation, simulator.getState(), result.executed);
        if (validateExperimentObservation('proj02', observation).ok) break;
      }
    }).not.toThrow();
    expect(simulator.getState().terminated).toBe(false);
    expect(observation.adcPwmPairs).toContainEqual({ adc: 127, duty: 128 });
    expect(new Set(observation.portValues.P2.map(value => value & 1))).toEqual(new Set([0, 1]));
    expect(validateExperimentObservation('proj02', observation).ok).toBe(true);
    expect(screen.getByText(/非真实 ADC 或光照测量/)).toBeInTheDocument();
  });

  it('disables input before initialization and when no actual setter is supplied', () => {
    const setter = jest.fn();
    const { rerender } = render(
      <HyperExperimentCanvas experimentId="proj02" simulatorState={null} onSetPortBit={setter} />,
    );
    expect(screen.getByRole('slider', { name: inputName })).toBeDisabled();
    expect(screen.getByText(/先运行或单步初始化/)).toBeInTheDocument();
    expect(setter).not.toHaveBeenCalled();

    rerender(<HyperExperimentCanvas experimentId="proj02" simulatorState={new Simulator().getState()} />);
    expect(screen.getByRole('slider', { name: inputName })).toBeDisabled();
    expect(screen.getByText(/当前视图仅显示端口值/)).toBeInTheDocument();
  });

  it('does not expose an ADC input for another project', () => {
    render(<HyperExperimentCanvas experimentId="proj03" simulatorState={new Simulator().getState()} onSetPortBit={jest.fn()} />);
    expect(screen.queryByRole('slider', { name: inputName })).not.toBeInTheDocument();
  });
});

describe('HyperExperimentCanvas serial and car controls', () => {
  function ConnectedCanvas({ simulator, experimentId, enabled = true }: {
    simulator: Simulator; experimentId: string; enabled?: boolean;
  }) {
    const [state, setState] = React.useState(() => simulator.getState());
    return <>
      <button onClick={() => { simulator.stepBatch(1000); setState(simulator.getState()); }}>执行观测批次</button>
      <HyperExperimentCanvas experimentId={experimentId} simulatorState={state} inputEnabled={enabled}
        onReceiveUartByte={value => { const accepted = simulator.receiveUartByte(value); setState(simulator.getState()); return accepted; }}
        onSetPortBit={(port, bit, level) => { simulator.setPortBit(port, bit, level); setState(simulator.getState()); }}
        onPulsePortBit={(port, bit) => { simulator.pulsePortBit(port, bit); setState(simulator.getState()); }} />
    </>;
  }

  it('sends car commands through the program, observes motor output, and switches sensor controls by mode', () => {
    const simulator = new Simulator(getExperimentConfig('proj03')!.code);
    simulator.stepBatch(1000);
    render(<ConnectedCanvas simulator={simulator} experimentId="proj03" />);
    expect(screen.getByRole('button', { name: '左侧障碍 · P3.2' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'F 前进' }));
    expect(simulator.getState().ram[0x31]).toBe('S'.charCodeAt(0));
    expect(screen.getByRole('button', { name: 'B 后退' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '执行观测批次' }));
    expect(simulator.getState().portValues.P2 & 15).toBe(5);
    expect(screen.getByText('前进')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2 · 循迹模式' }));
    fireEvent.click(screen.getByRole('button', { name: '执行观测批次' }));
    expect(screen.getByRole('button', { name: 'F 前进' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '左黑线' }));
    fireEvent.click(screen.getByRole('button', { name: '执行观测批次' }));
    expect(simulator.getState().portValues.P1 & 7).toBe(6);
    expect(simulator.getState().portValues.P2 & 15).toBe(4);
  });

  it('accepts one printable ASCII character and displays the actual echo after execution', () => {
    // 9600bit/s（12MHz 下约 10417bit/s）真实发送：欢迎帧 14 字符约需 1.3 万机器周期
    const simulator = new Simulator(getExperimentConfig('exp09')!.code);
    simulator.stepBatch(20000);
    render(<ConnectedCanvas simulator={simulator} experimentId="exp09" />);
    const input = screen.getByRole('textbox', { name: '串口接收字符（一个可打印 ASCII 字符）' });
    fireEvent.change(input, { target: { value: '中' } });
    expect(screen.getByRole('button', { name: '输入并回显' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '~' } });
    fireEvent.click(screen.getByRole('button', { name: '输入并回显' }));
    expect(simulator.getState().uart.transmitBuffer).toBe('HELLO WORLD!\r\n');
    expect(input).toBeDisabled();
    for (let batch = 0; batch < 3; batch++) fireEvent.click(screen.getByRole('button', { name: '执行观测批次' }));
    expect(simulator.getState().uart.transmitBuffer).toBe('HELLO WORLD!\r\n~');
    expect(input).toBeEnabled();
  });

  it('disables all external controls after stopping or reset and removes previous car controls when switching experiments', () => {
    const simulator = new Simulator(getExperimentConfig('proj03')!.code);
    simulator.stepBatch(1000);
    const receive = jest.fn();
    const { rerender } = render(<HyperExperimentCanvas experimentId="proj03" simulatorState={simulator.getState()}
      inputEnabled={false} onReceiveUartByte={receive} onSetPortBit={jest.fn()} onPulsePortBit={jest.fn()} />);
    for (const name of ['F 前进', '1 · 避障模式', '左黑线', '左侧障碍 · P3.2']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    rerender(<HyperExperimentCanvas experimentId="proj03" simulatorState={null} onReceiveUartByte={receive} />);
    expect(screen.getByRole('button', { name: '0 · 遥控模式' })).toBeDisabled();
    rerender(<HyperExperimentCanvas experimentId="exp09" simulatorState={null} onReceiveUartByte={receive} />);
    expect(screen.queryByRole('button', { name: 'F 前进' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '输入并回显' })).toBeDisabled();
    expect(receive).not.toHaveBeenCalled();
  });

  it('shows the real P0 numeric segment output for proj01', () => {
    const state = new Simulator().getState();
    state.portValues.P0 = 0x5b;
    render(<HyperExperimentCanvas experimentId="proj01" simulatorState={state} />);
    expect(screen.getByLabelText('项目一数码管显示')).toHaveTextContent('2');
    expect(screen.getByText('P0 = 0x5B')).toBeInTheDocument();
  });
});

describe('HyperExperimentCanvas LED hardware diagram', () => {
  it('draws an 80C51 sink-current schematic at a readable size and lights the low pin', () => {
    const state = new Simulator().getState();
    state.portValues.P1 = 0xfe;
    render(<HyperExperimentCanvas experimentId="exp01" simulatorState={state} />);

    const diagram = screen.getByTestId('led-hardware-diagram');
    expect(diagram).toHaveAttribute('data-variant', 'schematic');
    expect(diagram).toHaveAttribute('width', '320');
    expect(diagram).toHaveTextContent('80C51');
    expect(diagram).not.toHaveTextContent('AT89C52');
    expect(screen.getAllByText('2kΩ')).toHaveLength(8);
    for (let pin = 0; pin < 8; pin += 1) {
      expect(screen.getByText(`P1.${pin}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('led-lamp-P1.0')).toHaveAttribute('data-on', 'true');
    expect(screen.getByTestId('led-lamp-P1.7')).toHaveAttribute('data-on', 'false');
    expect(screen.getByRole('button', { name: '缩小接线画布' })).toBeDisabled();
  });

  it('enlarges the vector diagram without shrinking it below the readable size', () => {
    render(<HyperExperimentCanvas experimentId="exp01" simulatorState={new Simulator().getState()} />);
    fireEvent.click(screen.getByRole('button', { name: '放大接线画布' }));
    expect(screen.getByTestId('led-hardware-diagram')).toHaveAttribute('width', '384');
    fireEvent.click(screen.getByRole('button', { name: '重置接线画布视图' }));
    expect(screen.getByTestId('led-hardware-diagram')).toHaveAttribute('width', '320');
  });

  it('keeps the same pin names on the board view and follows the declared LED port', () => {
    const state = new Simulator().getState();
    state.portValues.P0 = 0xfe;
    const { rerender } = render(<HyperExperimentCanvas experimentId="exp01" simulatorState={new Simulator().getState()} />);
    fireEvent.click(screen.getByRole('button', { name: '板级仿真' }));
    expect(screen.getByTestId('led-hardware-diagram')).toHaveAttribute('data-variant', 'board');
    expect(screen.getByText('板级连线')).toBeInTheDocument();
    expect(screen.getByText('P1.0')).toBeInTheDocument();

    rerender(<HyperExperimentCanvas experimentId="exp03" simulatorState={state} />);
    expect(screen.getByTestId('led-lamp-P0.0')).toHaveAttribute('data-on', 'true');
    expect(screen.getByTestId('led-lamp-P0.1')).toHaveAttribute('data-on', 'false');
  });
});
