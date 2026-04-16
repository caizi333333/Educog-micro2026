'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Zap, 
  Bug, 
  Wrench, 
  Lightbulb, 
  Play, 
  RotateCcw, 
  Download,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiCall, errorHandlerPresets } from '@/lib/api-error-handler';

interface DiagnosticResult {
  id: string;
  type: 'syntax' | 'logic' | 'runtime' | 'performance';
  severity: 'error' | 'warning' | 'info';
  line: number;
  column?: number;
  message: string;
  description: string;
  solution: string;
  codeExample?: string;
  relatedConcepts: string[];
}

interface SimulationStep {
  step: number;
  description: string;
  registers: Record<string, string>;
  memory: Record<string, string>;
  pins: Record<string, boolean>;
  explanation: string;
}

const ErrorDiagnostic: React.FC = () => {
  const [code, setCode] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState('diagnostic');
  
  // API调用状态管理
  const diagnosticApi = useApiCall<DiagnosticResult[]>({
    ...errorHandlerPresets.userAction,
    onError: (error) => {
      toast.error(`诊断失败: ${error.message}`);
    },
  });
  
  const simulationApi = useApiCall<SimulationStep[]>({
    ...errorHandlerPresets.userAction,
    onError: (error) => {
      toast.error(`模拟失败: ${error.message}`);
    },
  });

  // 模拟代码诊断
  const runDiagnostic = async () => {
    if (!code.trim()) {
      toast.error('请输入要诊断的代码');
      return;
    }

    try {
      const results = await diagnosticApi.execute(async () => {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 模拟诊断结果
        const mockDiagnostics: DiagnosticResult[] = [
          {
            id: '1',
            type: 'syntax',
            severity: 'error',
            line: 5,
            column: 12,
            message: '缺少分号',
            description: '在C语言中，每个语句都必须以分号结尾',
            solution: '在语句末尾添加分号 ";"',
            codeExample: 'LED = 0;  // 正确\nLED = 0   // 错误：缺少分号',
            relatedConcepts: ['C语法', '语句终止符']
          },
          {
            id: '2',
            type: 'logic',
            severity: 'warning',
            line: 8,
            message: '无限循环可能导致程序无响应',
            description: 'while(1)循环没有退出条件，可能导致程序无法响应其他事件',
            solution: '添加适当的退出条件或使用中断处理其他任务',
            codeExample: 'while(1) {\n    // 添加其他逻辑\n    if(exit_condition) break;\n}',
            relatedConcepts: ['循环控制', '程序流程']
          },
          {
            id: '3',
            type: 'performance',
            severity: 'warning',
            line: 12,
            message: '延时函数效率低下',
            description: '使用空循环进行延时会占用CPU资源，影响系统性能',
            solution: '使用定时器中断替代软件延时',
            codeExample: '// 推荐使用定时器\nTMOD = 0x01;\nTH0 = 0x3C;\nTL0 = 0xB0;\nTR0 = 1;',
            relatedConcepts: ['定时器', '中断', '性能优化']
          },
          {
            id: '4',
            type: 'runtime',
            severity: 'info',
            line: 15,
            message: '建议添加变量初始化',
            description: '未初始化的变量可能包含随机值，导致程序行为不可预测',
            solution: '在声明变量时进行初始化',
            codeExample: 'unsigned char count = 0;  // 推荐\nunsigned char count;      // 不推荐',
            relatedConcepts: ['变量初始化', '程序可靠性']
          }
        ];
        
        return mockDiagnostics;
      });
      
      setDiagnostics(results);
      toast.success('代码诊断完成！');
    } catch (error) {
      // Error is already handled by useApiCall
      console.error('Diagnostic failed:', error);
    }
  };

  // 模拟代码执行
  const runSimulation = async () => {
    if (!code.trim()) {
      toast.error('请输入要模拟的代码');
      return;
    }

    try {
      const steps = await simulationApi.execute(async () => {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 模拟执行步骤
        const mockSteps: SimulationStep[] = [
          {
            step: 1,
            description: '程序初始化',
            registers: { 'PC': '0x0000', 'SP': '0x07', 'A': '0x00' },
            memory: { '0x20': '0x00', '0x21': '0x00' },
            pins: { 'P1.0': false, 'P1.1': false },
            explanation: '程序计数器指向起始地址，堆栈指针初始化，累加器清零'
          },
          {
            step: 2,
            description: '执行 LED = 0',
            registers: { 'PC': '0x0003', 'SP': '0x07', 'A': '0x00' },
            memory: { '0x20': '0x00', '0x21': '0x00' },
            pins: { 'P1.0': true, 'P1.1': false },
            explanation: 'P1.0引脚输出低电平，LED点亮（假设低电平有效）'
          },
          {
            step: 3,
            description: '进入延时函数',
            registers: { 'PC': '0x0010', 'SP': '0x05', 'A': '0x00' },
            memory: { '0x20': '0x01', '0x21': '0xF4' },
            pins: { 'P1.0': true, 'P1.1': false },
            explanation: '调用延时函数，参数500存储在内存中，堆栈保存返回地址'
          },
          {
            step: 4,
            description: '延时循环执行',
            registers: { 'PC': '0x0015', 'SP': '0x05', 'A': '0x7B' },
            memory: { '0x20': '0x01', '0x21': '0xF4' },
            pins: { 'P1.0': true, 'P1.1': false },
            explanation: '执行嵌套循环，累加器用作循环计数器'
          },
          {
            step: 5,
            description: '执行 LED = 1',
            registers: { 'PC': '0x0006', 'SP': '0x07', 'A': '0x01' },
            memory: { '0x20': '0x00', '0x21': '0x00' },
            pins: { 'P1.0': false, 'P1.1': false },
            explanation: 'P1.0引脚输出高电平，LED熄灭'
          }
        ];
        
        return mockSteps;
      });
      
      setSimulationSteps(steps);
      setCurrentStep(0);
      setActiveTab('simulation');
      toast.success('代码模拟完成！');
    } catch (error) {
      // Error is already handled by useApiCall
      console.error('Simulation failed:', error);
    }
  };

  // 自动播放模拟步骤
  useEffect(() => {
    if (simulationSteps.length > 0 && currentStep < simulationSteps.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentStep, simulationSteps.length]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'syntax': return <Bug className="h-4 w-4" />;
      case 'logic': return <Lightbulb className="h-4 w-4" />;
      case 'runtime': return <Play className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'syntax': return '语法错误';
      case 'logic': return '逻辑问题';
      case 'runtime': return '运行时问题';
      case 'performance': return '性能问题';
      default: return '其他问题';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">智能错误诊断系统</h1>
        <p className="text-gray-600">AI驱动的代码错误检测、分析和修复建议系统</p>
      </div>

      {/* 代码输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle>代码输入</CardTitle>
          <CardDescription>
            请输入您的8051微控制器代码，系统将自动进行错误诊断和执行模拟
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`请输入您的代码，例如：

#include <reg51.h>
sbit LED = P1^0;

void delay(unsigned int ms) {
    unsigned int i, j;
    for(i = 0; i < ms; i++)
        for(j = 0; j < 123; j++);
}

void main() {
    while(1) {
        LED = 0;
        delay(500);
        LED = 1;
        delay(500);
    }
}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
          <div className="flex gap-4">
            <Button 
              onClick={runDiagnostic} 
              disabled={diagnosticApi.loading}
              className="flex-1"
            >
              {diagnosticApi.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在诊断...
                </>
              ) : (
                <>
                  <Bug className="mr-2 h-4 w-4" />
                  错误诊断
                </>
              )}
            </Button>
            <Button 
              onClick={runSimulation} 
              disabled={simulationApi.loading}
              variant="outline"
              className="flex-1"
            >
              {simulationApi.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在模拟...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  执行模拟
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果展示 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="diagnostic" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            诊断结果
            {diagnostics.length > 0 && (
              <Badge variant="secondary">{diagnostics.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="simulation" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            执行模拟
            {simulationSteps.length > 0 && (
              <Badge variant="secondary">{simulationSteps.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostic" className="space-y-4">
          {diagnostics.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">诊断结果</h2>
                <div className="flex gap-2">
                  <Badge variant="destructive">
                    {diagnostics.filter(d => d.severity === 'error').length} 错误
                  </Badge>
                  <Badge variant="secondary">
                    {diagnostics.filter(d => d.severity === 'warning').length} 警告
                  </Badge>
                  <Badge variant="outline">
                    {diagnostics.filter(d => d.severity === 'info').length} 信息
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-4">
                {diagnostics.map((diagnostic) => (
                  <Card key={diagnostic.id} className={`border-l-4 ${getSeverityColor(diagnostic.severity)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(diagnostic.severity)}
                          <CardTitle className="text-lg">
                            第{diagnostic.line}行：{diagnostic.message}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(diagnostic.type)}
                          <Badge variant="outline">
                            {getTypeLabel(diagnostic.type)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-gray-700">{diagnostic.description}</p>
                      
                      <Alert>
                        <Wrench className="h-4 w-4" />
                        <AlertDescription>
                          <strong>解决方案：</strong>{diagnostic.solution}
                        </AlertDescription>
                      </Alert>
                      
                      {diagnostic.codeExample && (
                        <div>
                          <h4 className="font-medium mb-2">代码示例：</h4>
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                            <code>{diagnostic.codeExample}</code>
                          </pre>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-medium">相关概念：</span>
                        {diagnostic.relatedConcepts.map((concept, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Bug className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无诊断结果，请先运行错误诊断</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="simulation" className="space-y-4">
          {simulationSteps.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">执行模拟</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    步骤 {currentStep + 1} / {simulationSteps.length}
                  </span>
                  <Progress 
                    value={(currentStep + 1) / simulationSteps.length * 100} 
                    className="w-32"
                  />
                </div>
              </div>
              
              {simulationSteps[currentStep] && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 当前步骤信息 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        步骤 {simulationSteps[currentStep].step}
                      </CardTitle>
                      <CardDescription>
                        {simulationSteps[currentStep].description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {simulationSteps[currentStep].explanation}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                  
                  {/* 系统状态 */}
                  <Card>
                    <CardHeader>
                      <CardTitle>系统状态</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 寄存器状态 */}
                      <div>
                        <h4 className="font-medium mb-2">寄存器</h4>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          {Object.entries(simulationSteps[currentStep].registers).map(([reg, value]) => (
                            <div key={reg} className="flex justify-between bg-gray-50 p-2 rounded">
                              <span className="font-mono">{reg}:</span>
                              <span className="font-mono text-blue-600">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 内存状态 */}
                      <div>
                        <h4 className="font-medium mb-2">内存</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(simulationSteps[currentStep].memory).map(([addr, value]) => (
                            <div key={addr} className="flex justify-between bg-gray-50 p-2 rounded">
                              <span className="font-mono">{addr}:</span>
                              <span className="font-mono text-green-600">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 引脚状态 */}
                      <div>
                        <h4 className="font-medium mb-2">引脚状态</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(simulationSteps[currentStep].pins).map(([pin, state]) => (
                            <div key={pin} className="flex justify-between bg-gray-50 p-2 rounded">
                              <span className="font-mono">{pin}:</span>
                              <span className={`font-mono ${state ? 'text-red-600' : 'text-gray-600'}`}>
                                {state ? 'HIGH' : 'LOW'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* 步骤控制 */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                    >
                      上一步
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(Math.min(simulationSteps.length - 1, currentStep + 1))}
                      disabled={currentStep === simulationSteps.length - 1}
                    >
                      下一步
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep(0)}
                    >
                      重新开始
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Play className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无模拟结果，请先运行执行模拟</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorDiagnostic;