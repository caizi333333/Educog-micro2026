import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { Slider } from '@/components/ui/slider';
import { 
  Cpu, 
  Play, 
  Pause, 
  RotateCcw, 
  Eye, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  Monitor,
  Layers,
  Maximize2,
  Camera,
  Mic,
  Volume2,
  Wifi,
  Battery,
  Target,
  Lightbulb
} from 'lucide-react';

interface SimulationComponent {
  id: string;
  name: string;
  type: 'mcu' | 'led' | 'button' | 'sensor' | 'display' | 'motor';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  state: Record<string, unknown>;
  connections: string[];
  properties: Record<string, unknown>;
}

interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  components: SimulationComponent[];
  objectives: string[];
  hints: string[];
  estimatedTime: number;
  completionRate: number;
}

interface DebugInfo {
  timestamp: number;
  type: 'info' | 'warning' | 'error';
  message: string;
  component?: string;
  value?: unknown;
}

const simulationScenarios: SimulationScenario[] = [
  {
    id: 'led-blink',
    title: 'LED闪烁控制',
    description: '学习基本的GPIO控制，实现LED灯的闪烁效果',
    difficulty: 'beginner',
    components: [
      {
        id: 'mcu-1',
        name: '8051单片机',
        type: 'mcu',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { running: false, registers: {} },
        connections: ['led-1'],
        properties: { model: '8051', frequency: '12MHz' }
      },
      {
        id: 'led-1',
        name: 'LED灯',
        type: 'led',
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { on: false, brightness: 0 },
        connections: ['mcu-1'],
        properties: { color: 'red', voltage: '3.3V' }
      }
    ],
    objectives: [
      '连接LED到单片机P1.0端口',
      '编写LED闪烁程序',
      '调试并运行程序',
      '观察LED闪烁效果'
    ],
    hints: [
      '使用P1寄存器控制LED状态',
      '添加延时函数控制闪烁频率',
      '检查电路连接是否正确'
    ],
    estimatedTime: 30,
    completionRate: 85
  },
  {
    id: 'button-led',
    title: '按键控制LED',
    description: '学习输入检测和输出控制的结合应用',
    difficulty: 'intermediate',
    components: [
      {
        id: 'mcu-1',
        name: '8051单片机',
        type: 'mcu',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { running: false, registers: {} },
        connections: ['led-1', 'button-1'],
        properties: { model: '8051', frequency: '12MHz' }
      },
      {
        id: 'led-1',
        name: 'LED灯',
        type: 'led',
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { on: false, brightness: 0 },
        connections: ['mcu-1'],
        properties: { color: 'green', voltage: '3.3V' }
      },
      {
        id: 'button-1',
        name: '按键',
        type: 'button',
        position: { x: -2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { pressed: false },
        connections: ['mcu-1'],
        properties: { type: 'momentary', voltage: '5V' }
      }
    ],
    objectives: [
      '连接按键到P3.2端口',
      '连接LED到P1.0端口',
      '编写按键检测程序',
      '实现按键控制LED开关'
    ],
    hints: [
      '使用外部中断检测按键',
      '注意按键防抖处理',
      '检查上拉电阻配置'
    ],
    estimatedTime: 45,
    completionRate: 72
  },
  {
    id: 'temperature-display',
    title: '温度监测显示',
    description: '综合应用ADC、传感器和显示器的复杂项目',
    difficulty: 'advanced',
    components: [
      {
        id: 'mcu-1',
        name: '8051单片机',
        type: 'mcu',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { running: false, registers: {} },
        connections: ['sensor-1', 'display-1'],
        properties: { model: '8051', frequency: '12MHz' }
      },
      {
        id: 'sensor-1',
        name: '温度传感器',
        type: 'sensor',
        position: { x: -2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { value: 25.6, unit: '°C' },
        connections: ['mcu-1'],
        properties: { type: 'LM35', range: '-55~150°C' }
      },
      {
        id: 'display-1',
        name: '数码管显示',
        type: 'display',
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        state: { text: '25.6', brightness: 80 },
        connections: ['mcu-1'],
        properties: { type: '4位7段', color: 'red' }
      }
    ],
    objectives: [
      '连接温度传感器到ADC端口',
      '连接数码管显示器',
      '编写ADC采样程序',
      '实现温度值显示',
      '添加温度报警功能'
    ],
    hints: [
      '配置ADC转换参数',
      '实现温度值计算公式',
      '优化显示刷新频率'
    ],
    estimatedTime: 90,
    completionRate: 58
  }
];

const EnhancedSimulation: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>(simulationScenarios[0]?.id || '');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'ar'>('3d');
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [showWiring, setShowWiring] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simulationTime, setSimulationTime] = useState<number>(0);

  const currentScenario = simulationScenarios.find(s => s.id === selectedScenario) ?? simulationScenarios[0];

  // 模拟仿真运行
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSimulationTime(prev => prev + simulationSpeed);
      
      // 模拟调试信息
      if (Math.random() < 0.3) {
        const logTypes: ('info' | 'warning' | 'error')[] = ['info', 'warning', 'error'];
        const messages = [
          'GPIO状态更新',
          '定时器中断触发',
          'ADC转换完成',
          '串口数据接收',
          '内存访问',
          '寄存器写入'
        ];
        
        const component = currentScenario?.components[Math.floor(Math.random() * (currentScenario?.components.length ?? 0))]?.id;
        const newLog: DebugInfo = {
          timestamp: Date.now(),
          type: logTypes[Math.floor(Math.random() * logTypes.length)] || 'info',
          message: messages[Math.floor(Math.random() * messages.length)] || '',
          value: Math.random() * 100,
          ...(component && { component })
        };
        
        setDebugLogs(prev => [...prev.slice(-19), newLog]);
      }
    }, 1000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isRunning, simulationSpeed, currentScenario]);

  // 绘制3D仿真界面
  useEffect(() => {
    if (viewMode !== '3d' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制网格背景
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 绘制组件
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 80;

    currentScenario?.components.forEach(component => {
      const x = centerX + component.position.x * scale;
      const y = centerY + component.position.y * scale;
      const isSelected = selectedComponent === component.id;

      // 绘制组件
      ctx.fillStyle = isSelected ? '#3b82f6' : getComponentColor(component.type);
      ctx.strokeStyle = isSelected ? '#1d4ed8' : '#374151';
      ctx.lineWidth = isSelected ? 3 : 2;

      if (component.type === 'mcu') {
        ctx.fillRect(x - 30, y - 20, 60, 40);
        ctx.strokeRect(x - 30, y - 20, 60, 40);
      } else if (component.type === 'led') {
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // LED发光效果
        if (component.state.on) {
          ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(x, y, 25, 0, 2 * Math.PI);
          ctx.fill();
        }
      } else {
        ctx.fillRect(x - 15, y - 15, 30, 30);
        ctx.strokeRect(x - 15, y - 15, 30, 30);
      }

      // 绘制标签
      if (showLabels) {
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(component.name, x, y + 40);
      }
    });

    // 绘制连接线
    if (showWiring) {
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      currentScenario?.components.forEach(component => {
        const x1 = centerX + component.position.x * scale;
        const y1 = centerY + component.position.y * scale;
        
        component.connections.forEach(connectionId => {
          const connectedComponent = currentScenario?.components.find(c => c.id === connectionId);
          if (connectedComponent) {
            const x2 = centerX + connectedComponent.position.x * scale;
            const y2 = centerY + connectedComponent.position.y * scale;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        });
      });
    }
  }, [currentScenario, selectedComponent, showWiring, showLabels, viewMode]);

  const getComponentColor = (type: string) => {
    switch (type) {
      case 'mcu': return '#1f2937';
      case 'led': return '#ef4444';
      case 'button': return '#6b7280';
      case 'sensor': return '#10b981';
      case 'display': return '#f59e0b';
      case 'motor': return '#8b5cf6';
      default: return '#9ca3af';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <CheckCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 80;

    // 检查点击的组件
    const clickedComponent = currentScenario?.components.find(component => {
      const compX = centerX + component.position.x * scale;
      const compY = centerY + component.position.y * scale;
      const distance = Math.sqrt(Math.pow(x - compX, 2) + Math.pow(y - compY, 2));
      return distance <= 30;
    });

    if (clickedComponent) {
      setSelectedComponent(clickedComponent.id);
    } else {
      setSelectedComponent(null);
    }
  };

  const selectedComponentData = selectedComponent && currentScenario
    ? currentScenario.components.find(c => c.id === selectedComponent) 
    : null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 标题和控制区域 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="w-8 h-8 text-blue-600" />
            增强实验仿真
          </h1>
          <p className="text-gray-600 mt-2">
            3D可视化 + AR调试 + 实时指导的沉浸式仿真体验
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800">
            仿真场景: {simulationScenarios.length}
          </Badge>
          <Badge className="bg-green-100 text-green-800">
            3D渲染引擎
          </Badge>
        </div>
      </div>

      {/* 场景选择 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {simulationScenarios.map((scenario) => (
          <Card 
            key={scenario.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedScenario === scenario.id 
                ? 'ring-2 ring-blue-500 bg-blue-50' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedScenario(scenario.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge className={getDifficultyColor(scenario.difficulty)}>
                  {scenario.difficulty}
                </Badge>
                <div className="text-sm text-gray-500">
                  {scenario.estimatedTime}min
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {scenario.title}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {scenario.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {scenario.components.length} 组件
                </span>
                <div className="flex items-center gap-1">
                  <Progress value={scenario.completionRate} className="w-16 h-2" />
                  <span className="text-xs text-gray-500">{scenario.completionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 主要仿真区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 仿真视图 */}
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  {currentScenario.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* 视图模式切换 */}
                  <div className="flex items-center gap-1 border rounded-md">
                    <Button
                      variant={viewMode === '3d' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('3d')}
                    >
                      <Layers className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === '2d' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('2d')}
                    >
                      <Monitor className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'ar' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('ar')}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* 控制按钮 */}
                  <Button
                    variant={isRunning ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => setIsRunning(!isRunning)}
                  >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSimulationTime(0)}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* 仿真控制面板 */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">速度:</span>
                  <Slider
                    value={[simulationSpeed]}
                    onValueChange={(value) => setSimulationSpeed(value[0] ?? 1)}
                    max={5}
                    min={0.1}
                    step={0.1}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-600">{simulationSpeed}x</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={showWiring}
                      onChange={(e) => setShowWiring(e.target.checked)}
                      className="w-4 h-4"
                    />
                    显示连线
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                      className="w-4 h-4"
                    />
                    显示标签
                  </label>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>仿真时间: {Math.floor(simulationTime / 60)}:{(simulationTime % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 h-[480px]">
              {viewMode === '3d' && (
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-pointer bg-gray-50"
                  onClick={handleCanvasClick}
                />
              )}
              
              {viewMode === '2d' && (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700">2D电路图视图</h3>
                    <p className="text-gray-500">传统的电路图表示方式</p>
                  </div>
                </div>
              )}
              
              {viewMode === 'ar' && (
                <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-purple-700">AR增强现实模式</h3>
                    <p className="text-purple-600 mb-4">使用摄像头进行实时调试</p>
                    <div className="flex items-center justify-center gap-4">
                      <Button variant="outline" size="sm">
                        <Camera className="w-4 h-4 mr-2" />
                        启动摄像头
                      </Button>
                      <Button variant="outline" size="sm">
                        <Mic className="w-4 h-4 mr-2" />
                        语音控制
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 组件详情 */}
          {selectedComponentData && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  组件详情
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedComponentData.name}</h3>
                  <p className="text-sm text-gray-600">{selectedComponentData.type}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">属性</h4>
                  {Object.entries(selectedComponentData.properties).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">状态</h4>
                  {Object.entries(selectedComponentData.state).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">连接</h4>
                  {selectedComponentData.connections.map((conn, index) => (
                    <div key={index} className="text-sm text-blue-600">
                      → {conn}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 学习目标 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5" />
                学习目标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentScenario?.objectives.map((objective, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                      {index + 1}
                    </div>
                    <span className="text-sm">{objective}</span>
                  </div>
                )) ?? []}
              </div>
            </CardContent>
          </Card>
          
          {/* 调试日志 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" />
                实时调试
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {debugLogs.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    启动仿真查看调试信息
                  </div>
                ) : (
                  debugLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      {getLogTypeIcon(log.type)}
                      <div className="flex-1">
                        <div className="font-mono text-gray-600">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                        <div>{log.message}</div>
                        {log.component && (
                          <div className="text-gray-500">@ {log.component}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* 提示信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                学习提示
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentScenario?.hints.map((hint, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                    <span className="text-sm text-gray-600">{hint}</span>
                  </div>
                )) ?? []}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EnhancedSimulation;