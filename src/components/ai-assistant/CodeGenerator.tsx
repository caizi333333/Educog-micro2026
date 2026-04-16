'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Code, Lightbulb, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface CodeSuggestion {
  id: string;
  title: string;
  description: string;
  code: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  explanation: string;
}

interface CodeAnalysis {
  errors: Array<{
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    suggestion: string;
  }>;
  optimizations: Array<{
    description: string;
    before: string;
    after: string;
    benefit: string;
  }>;
  complexity: {
    score: number;
    description: string;
  };
}

const CodeGenerator: React.FC = () => {
  const [requirement, setRequirement] = useState('');
  const [userCode, setUserCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('generate');

  // 模拟AI代码生成
  const generateCode = async () => {
    if (!requirement.trim()) {
      toast.error('请输入功能需求描述');
      return;
    }

    setIsGenerating(true);
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 根据需求生成不同的代码建议
    const mockSuggestions: CodeSuggestion[] = [
      {
        id: '1',
        title: 'LED闪烁控制',
        description: '使用定时器实现LED闪烁，可调节闪烁频率',
        difficulty: 'beginner',
        concepts: ['定时器', 'I/O控制', '循环'],
        code: `#include <reg51.h>

sbit LED = P1^0;

void delay_ms(unsigned int ms) {
    unsigned int i, j;
    for(i = 0; i < ms; i++)
        for(j = 0; j < 123; j++);
}

void main() {
    while(1) {
        LED = 0;        // 点亮LED
        delay_ms(500);  // 延时500ms
        LED = 1;        // 熄灭LED
        delay_ms(500);  // 延时500ms
    }
}`,
        explanation: '这个程序使用简单的延时函数实现LED闪烁。LED连接到P1.0引脚，通过控制引脚的高低电平来控制LED的亮灭。delay_ms函数提供毫秒级延时。'
      },
      {
        id: '2',
        title: '定时器中断LED控制',
        description: '使用定时器中断实现精确的LED闪烁控制',
        difficulty: 'intermediate',
        concepts: ['定时器中断', '中断服务程序', '寄存器配置'],
        code: `#include <reg51.h>

sbit LED = P1^0;
bit flag = 0;

void timer0_init() {
    TMOD = 0x01;    // 定时器0，模式1
    TH0 = 0x3C;     // 装初值，定时50ms
    TL0 = 0xB0;
    EA = 1;         // 开总中断
    ET0 = 1;        // 开定时器0中断
    TR0 = 1;        // 启动定时器0
}

void timer0_isr() interrupt 1 {
    TH0 = 0x3C;     // 重装初值
    TL0 = 0xB0;
    
    static unsigned char count = 0;
    count++;
    if(count >= 10) {   // 500ms到
        count = 0;
        LED = ~LED;     // LED状态翻转
    }
}

void main() {
    timer0_init();
    while(1) {
        // 主程序可以做其他事情
    }
}`,
        explanation: '使用定时器中断实现LED闪烁，主程序不被阻塞。定时器0配置为模式1，每50ms产生一次中断，中断10次后翻转LED状态，实现500ms的闪烁周期。'
      },
      {
        id: '3',
        title: 'PWM调光LED控制',
        description: '使用PWM技术实现LED亮度调节',
        difficulty: 'advanced',
        concepts: ['PWM', '占空比', '模拟输出'],
        code: `#include <reg51.h>

sbit LED = P1^0;
unsigned char pwm_duty = 0;     // PWM占空比
unsigned char pwm_counter = 0;  // PWM计数器

void timer0_init() {
    TMOD = 0x02;    // 定时器0，模式2，自动重装
    TH0 = 0x9C;     // 装初值，定时100us
    TL0 = 0x9C;
    EA = 1;         // 开总中断
    ET0 = 1;        // 开定时器0中断
    TR0 = 1;        // 启动定时器0
}

void timer0_isr() interrupt 1 {
    pwm_counter++;
    if(pwm_counter >= 100) {
        pwm_counter = 0;
    }
    
    if(pwm_counter < pwm_duty) {
        LED = 0;    // 点亮LED
    } else {
        LED = 1;    // 熄灭LED
    }
}

void main() {
    timer0_init();
    
    while(1) {
        // 呼吸灯效果
        for(pwm_duty = 0; pwm_duty < 100; pwm_duty++) {
            delay_ms(20);
        }
        for(pwm_duty = 100; pwm_duty > 0; pwm_duty--) {
            delay_ms(20);
        }
    }
}

void delay_ms(unsigned int ms) {
    unsigned int i, j;
    for(i = 0; i < ms; i++)
        for(j = 0; j < 123; j++);
}`,
        explanation: 'PWM（脉宽调制）技术通过改变占空比来控制LED亮度。定时器每100us中断一次，根据当前占空比决定LED的亮灭状态，实现平滑的亮度调节效果。'
      }
    ];

    setSuggestions(mockSuggestions);
    setIsGenerating(false);
    toast.success('代码生成完成！');
  };

  // 模拟代码分析
  const analyzeCode = async () => {
    if (!userCode.trim()) {
      toast.error('请输入要分析的代码');
      return;
    }

    setIsAnalyzing(true);
    
    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockAnalysis: CodeAnalysis = {
      errors: [
        {
          line: 5,
          message: '延时函数效率较低',
          severity: 'warning',
          suggestion: '建议使用定时器中断替代软件延时，提高程序效率'
        },
        {
          line: 12,
          message: '无限循环可能导致程序无法响应其他事件',
          severity: 'info',
          suggestion: '考虑添加其他功能或使用中断方式实现'
        }
      ],
      optimizations: [
        {
          description: '使用定时器替代延时循环',
          before: 'for(i = 0; i < ms; i++)\n    for(j = 0; j < 123; j++);',
          after: 'TMOD = 0x01;\nTH0 = 0x3C;\nTL0 = 0xB0;\nTR0 = 1;',
          benefit: '释放CPU资源，提高程序响应性能'
        },
        {
          description: '添加变量类型优化',
          before: 'int i, j;',
          after: 'unsigned int i, j;',
          benefit: '明确变量类型，避免潜在的符号问题'
        }
      ],
      complexity: {
        score: 3,
        description: '代码复杂度较低，结构清晰，适合初学者学习'
      }
    };

    setAnalysis(mockAnalysis);
    setIsAnalyzing(false);
    toast.success('代码分析完成！');
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('代码已复制到剪贴板');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">AI智能代码生成器</h1>
        <p className="text-gray-600">基于需求描述自动生成8051微控制器代码，并提供智能优化建议</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            代码生成
          </TabsTrigger>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            代码分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>功能需求描述</CardTitle>
              <CardDescription>
                请详细描述您想要实现的功能，AI将为您生成相应的代码
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="例如：实现LED闪烁控制，要求可以调节闪烁频率..."
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                className="min-h-[100px]"
              />
              <Button 
                onClick={generateCode} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI正在生成代码...
                  </>
                ) : (
                  '生成代码'
                )}
              </Button>
            </CardContent>
          </Card>

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">代码建议</h2>
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                      <Badge className={getDifficultyColor(suggestion.difficulty)}>
                        {suggestion.difficulty === 'beginner' && '初级'}
                        {suggestion.difficulty === 'intermediate' && '中级'}
                        {suggestion.difficulty === 'advanced' && '高级'}
                      </Badge>
                    </div>
                    <CardDescription>{suggestion.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {suggestion.concepts.map((concept, index) => (
                        <Badge key={index} variant="outline">{concept}</Badge>
                      ))}
                    </div>
                    
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{suggestion.code}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(suggestion.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Alert>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>
                        <strong>代码说明：</strong>{suggestion.explanation}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analyze" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>代码分析</CardTitle>
              <CardDescription>
                粘贴您的代码，AI将为您分析潜在问题并提供优化建议
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="请粘贴您的8051代码..."
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="min-h-[200px] font-mono"
              />
              <Button 
                onClick={analyzeCode} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    AI正在分析代码...
                  </>
                ) : (
                  '分析代码'
                )}
              </Button>
            </CardContent>
          </Card>

          {analysis && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">分析结果</h2>
              
              {/* 代码复杂度 */}
              <Card>
                <CardHeader>
                  <CardTitle>代码复杂度评估</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-blue-600">
                      {analysis.complexity.score}/10
                    </div>
                    <div className="text-gray-600">
                      {analysis.complexity.description}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 错误和警告 */}
              {analysis.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>问题检测</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.errors.map((error, index) => (
                      <Alert key={index}>
                        <div className="flex items-start gap-3">
                          {getSeverityIcon(error.severity)}
                          <div className="flex-1">
                            <div className="font-medium">
                              第{error.line}行：{error.message}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              建议：{error.suggestion}
                            </div>
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 优化建议 */}
              {analysis.optimizations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>优化建议</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.optimizations.map((opt, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">{opt.description}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-red-600 mb-1">优化前：</div>
                            <pre className="bg-red-50 p-2 rounded text-sm overflow-x-auto">
                              <code>{opt.before}</code>
                            </pre>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-green-600 mb-1">优化后：</div>
                            <pre className="bg-green-50 p-2 rounded text-sm overflow-x-auto">
                              <code>{opt.after}</code>
                            </pre>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <strong>优化效果：</strong>{opt.benefit}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CodeGenerator;