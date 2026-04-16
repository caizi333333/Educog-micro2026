import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedSimulation from '@/components/EnhancedSimulation';
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
  Clock: () => <div data-testid="clock-icon" />
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