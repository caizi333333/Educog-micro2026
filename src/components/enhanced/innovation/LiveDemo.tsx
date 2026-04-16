import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Unused
import { 
  PlayCircle, 
  StopCircle, 
  Mic, 
  MicOff, 
  Code, 
  Zap,
  CheckCircle,
  AlertCircle,
  Brain,
  Image,
  Upload,
  Sparkles,
  Cpu,
  Network
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DemoType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'code-generation' | 'error-analysis' | 'voice-interaction' | 'image-recognition';
}

const demoTypes: DemoType[] = [
  {
    id: 'code-generation',
    title: 'AI代码生成',
    description: '输入需求，AI实时生成单片机代码',
    icon: <Code className="w-5 h-5" />,
    category: 'code-generation'
  },
  {
    id: 'error-analysis',
    title: '智能错误诊断',
    description: '上传代码，AI分析错误并提供修复建议',
    icon: <AlertCircle className="w-5 h-5" />,
    category: 'error-analysis'
  },
  {
    id: 'voice-interaction',
    title: '语音交互助手',
    description: '语音问答，AI智能回复技术问题',
    icon: <Mic className="w-5 h-5" />,
    category: 'voice-interaction'
  },
  {
    id: 'image-recognition',
    title: '电路图识别',
    description: '上传电路图，AI识别并生成对应代码',
    icon: <Image className="w-5 h-5" />,
    category: 'image-recognition'
  }
];

const LiveDemo: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<string>('code-generation');
  const [isRunning, setIsRunning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [progress, setProgress] = useState(0);
  const [demoResults, setDemoResults] = useState<any>(null);

  // 模拟AI处理过程
  const runDemo = async () => {
    setIsRunning(true);
    setProgress(0);
    setOutput('');
    
    // 模拟处理进度
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 根据演示类型生成不同的结果
    const results = generateDemoResults(activeDemo, input);
    setDemoResults(results);
    setOutput(results.output);
    
    setIsRunning(false);
  };

  const generateDemoResults = (demoType: string, userInput: string) => {
    switch (demoType) {
      case 'code-generation':
        return {
          output: `// AI生成的单片机代码 - 基于输入: "${userInput}"
#include <reg52.h>

// LED控制函数
void LED_Control() {
    sbit LED = P1^0;  // 定义LED连接到P1.0
    
    while(1) {
        LED = 0;      // 点亮LED
        delay(500);   // 延时500ms
        LED = 1;      // 熄灭LED  
        delay(500);   // 延时500ms
    }
}

// 延时函数
void delay(unsigned int ms) {
    unsigned int i, j;
    for(i = 0; i < ms; i++)
        for(j = 0; j < 123; j++);
}

void main() {
    LED_Control();  // 调用LED控制函数
}`,
          analysis: {
            codeQuality: 92,
            efficiency: 88,
            readability: 95,
            suggestions: [
              '代码结构清晰，注释完整',
              '建议添加错误处理机制',
              '可考虑使用定时器实现更精确的延时'
            ]
          },
          executionTime: '0.3秒',
          linesOfCode: 23
        };
        
      case 'error-analysis':
        return {
          output: `🔍 AI错误诊断报告

发现 3 个问题:

❌ 第8行: 语法错误
   问题: 缺少分号
   修复: 在语句末尾添加分号 ";"
   
⚠️  第15行: 逻辑警告  
   问题: 无限循环可能导致程序卡死
   建议: 添加退出条件或使用中断
   
💡 第22行: 优化建议
   问题: 延时函数效率较低
   建议: 使用硬件定时器替代软件延时

✅ 修复后代码质量评分: 85 → 96`,
          analysis: {
            errorCount: 3,
            warningCount: 1,
            fixSuccess: 100,
            codeImprovement: 13
          },
          executionTime: '0.5秒',
          fixedLines: 3
        };
        
      case 'voice-interaction':
        return {
          output: `🎤 语音识别结果: "${userInput}"

🤖 AI回复:

根据您的问题，关于单片机中断的工作原理，我来为您详细解释：

中断是指CPU在执行程序时，遇到紧急事件需要处理，暂停当前程序转而处理该事件的机制。

主要特点：
• 异步性：中断可在任意时刻发生
• 优先级：不同中断有不同优先级
• 现场保护：自动保存CPU状态

实现步骤：
1. 中断请求 → 2. 中断响应 → 3. 中断处理 → 4. 中断返回

需要更多详细信息吗？我可以提供代码示例。`,
          analysis: {
            recognitionAccuracy: 96,
            responseRelevance: 94,
            technicalAccuracy: 98,
            userSatisfaction: 4.8
          },
          executionTime: '1.2秒',
          confidence: 96
        };
        
      case 'image-recognition':
        return {
          output: `📸 电路图识别结果

识别到的元件:
• LED × 2 (连接到P1.0, P1.1)
• 电阻 × 2 (限流电阻, 470Ω)  
• 按键 × 1 (连接到P3.2)
• 单片机: STC89C52

🔄 自动生成代码:

#include <reg52.h>

sbit LED1 = P1^0;
sbit LED2 = P1^1; 
sbit KEY = P3^2;

void main() {
    while(1) {
        if(KEY == 0) {  // 按键按下
            LED1 = 0;   // 点亮LED1
            LED2 = 1;   // 熄灭LED2
        } else {
            LED1 = 1;   // 熄灭LED1
            LED2 = 0;   // 点亮LED2
        }
    }
}`,
          analysis: {
            recognitionAccuracy: 94,
            componentCount: 6,
            codeGeneration: 98,
            circuitComplexity: '简单'
          },
          executionTime: '0.8秒',
          confidence: 94
        };
        
      default:
        return { output: '演示结果', analysis: {}, executionTime: '0.1秒' };
    }
  };

  const resetDemo = () => {
    setInput('');
    setOutput('');
    setProgress(0);
    setDemoResults(null);
    setIsRunning(false);
  };

  const currentDemo = demoTypes.find(demo => demo.id === activeDemo);

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-500" />
          AI能力现场演示
        </h2>
        <p className="text-gray-600">
          体验AI在微控制器教学中的强大能力，支持实时交互和即时反馈
        </p>
      </div>

      {/* 演示类型选择 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {demoTypes.map((demo) => (
          <Card 
            key={demo.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              activeDemo === demo.id 
                ? 'ring-2 ring-blue-500 bg-blue-50' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => {
              setActiveDemo(demo.id);
              resetDemo();
            }}
          >
            <CardContent className="p-4 text-center">
              <div className={`mx-auto mb-3 p-3 rounded-full ${
                activeDemo === demo.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {demo.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {demo.title}
              </h3>
              <p className="text-xs text-gray-600">
                {demo.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 演示界面 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentDemo?.icon}
            {currentDemo?.title} 实时演示
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 输入区域 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">输入区域</h4>
              <div className="flex gap-2">
                {activeDemo === 'voice-interaction' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsListening(!isListening)}
                    className={`flex items-center gap-1 ${isListening ? 'bg-red-50 text-red-600' : ''}`}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isListening ? '停止录音' : '开始录音'}
                  </Button>
                )}
                {activeDemo === 'image-recognition' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    上传图片
                  </Button>
                )}
              </div>
            </div>
            
            {activeDemo === 'code-generation' && (
              <Textarea
                placeholder="请描述您想要实现的功能，例如：控制LED灯闪烁"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-24"
              />
            )}
            
            {activeDemo === 'error-analysis' && (
              <Textarea
                placeholder="请粘贴您的单片机代码"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-32 font-mono text-sm"
              />
            )}
            
            {activeDemo === 'voice-interaction' && (
              <div className="space-y-2">
                <Input
                  placeholder={isListening ? "正在录音中..." : "或者直接输入您的问题"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isListening}
                />
                {isListening && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    正在录音中，请说话...
                  </div>
                )}
              </div>
            )}
            
            {activeDemo === 'image-recognition' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">拖拽电路图片到此处，或点击上传</p>
                <p className="text-sm text-gray-500">支持 JPG, PNG, GIF 格式</p>
              </div>
            )}
          </div>

          {/* 控制按钮 */}
          <div className="flex justify-center gap-4">
            <Button 
              onClick={runDemo}
              disabled={isRunning || (!input && activeDemo !== 'image-recognition')}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI处理中...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  开始演示
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={resetDemo}
              className="flex items-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              重置
            </Button>
          </div>

          {/* 处理进度 */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI处理进度</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div 
                  className="bg-blue-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>
          )}

          {/* 输出区域 */}
          <AnimatePresence>
            {output && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    AI处理结果
                  </h4>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      ✨ 处理完成
                    </Badge>
                    {demoResults?.executionTime && (
                      <Badge variant="outline">
                        ⚡ {demoResults.executionTime}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                    {output}
                  </pre>
                </div>

                {/* 分析结果 */}
                {demoResults?.analysis && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        AI分析报告
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(demoResults.analysis).map(([key, value]) => (
                          <div key={key} className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              {typeof value === 'number' ?
                                (key.includes('Rate') || key.includes('Accuracy') || key.includes('Quality') ? `${value}%` : String(value))
                                : String(value)}
                            </div>
                            <div className="text-xs text-blue-700 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* 技术特性展示 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Cpu className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">高性能处理</h4>
            <p className="text-sm text-gray-600">基于Transformer架构，毫秒级响应</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Network className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">多模态融合</h4>
            <p className="text-sm text-gray-600">支持文本、语音、图像多种输入</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">实时学习</h4>
            <p className="text-sm text-gray-600">持续学习用户偏好，个性化服务</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveDemo;