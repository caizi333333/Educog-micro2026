'use client';

import React, { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  Lightbulb, 
  Code, 
  BookOpen, 
  Zap, 
  ThumbsUp, 
  ThumbsDown, 
  Copy, 
  ExternalLink,
  Sparkles,
  Brain,
  HelpCircle,
  Clock,
  Star,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface RelatedNode {
  id: string;
  name: string;
  chapter: number;
  level: number;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  relatedTopics?: string[];
  confidence?: number;
  sources?: string[];
  relatedNodes?: RelatedNode[];
}

interface CodeBlock {
  language: string;
  code: string;
  explanation: string;
}

interface QuickQuestion {
  id: string;
  question: string;
  category: 'basic' | 'programming' | 'hardware' | 'project';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface KnowledgePoint {
  id: string;
  title: string;
  description: string;
  category: string;
  relatedQuestions: string[];
}

const IntelligentQA: React.FC = memo(() => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 缓存快速问题模板
  const quickQuestions: QuickQuestion[] = useMemo(() => [
    {
      id: '1',
      question: '8051微控制器的基本架构是什么？',
      category: 'basic',
      difficulty: 'easy'
    },
    {
      id: '2',
      question: '如何配置8051的定时器？',
      category: 'programming',
      difficulty: 'medium'
    },
    {
      id: '3',
      question: '中断服务程序的编写规则有哪些？',
      category: 'programming',
      difficulty: 'medium'
    },
    {
      id: '4',
      question: '如何实现LED闪烁控制？',
      category: 'project',
      difficulty: 'easy'
    },
    {
      id: '5',
      question: '串口通信的波特率如何计算？',
      category: 'hardware',
      difficulty: 'hard'
    },
    {
      id: '6',
      question: '如何优化8051程序的内存使用？',
      category: 'programming',
      difficulty: 'hard'
    }
  ], []);

  // 缓存知识点库
  const knowledgePoints: KnowledgePoint[] = useMemo(() => [
    {
      id: '1',
      title: '8051架构基础',
      description: 'CPU核心、存储器组织、I/O端口、特殊功能寄存器',
      category: '基础概念',
      relatedQuestions: ['什么是SFR？', '内存映射如何工作？']
    },
    {
      id: '2',
      title: '中断系统',
      description: '中断源、中断优先级、中断服务程序、中断嵌套',
      category: '系统功能',
      relatedQuestions: ['如何设置中断优先级？', '中断嵌套的原理？']
    },
    {
      id: '3',
      title: '定时器/计数器',
      description: 'Timer0/Timer1配置、工作模式、应用实例',
      category: '外设功能',
      relatedQuestions: ['定时器的工作模式有哪些？', '如何实现精确延时？']
    },
    {
      id: '4',
      title: '串口通信',
      description: 'UART配置、波特率设置、数据传输协议',
      category: '通信接口',
      relatedQuestions: ['如何配置串口参数？', '数据帧格式是什么？']
    }
  ], []);

  // 真实 AI 回答：先调 /api/ai/chat（DeepSeek + RAG），失败再回落到下方
  // 关键词模拟，避免页面在网络/key 异常时白屏。
  const generateAIResponse = async (question: string): Promise<Message> => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json?.data;
          if (data?.answer) {
            const relatedTopics = (data.relevantChapters || []).map(
              (c: { chapter: string; title: string }) => c.title,
            );
            const relatedNodes = Array.isArray(data.relatedNodes) ? data.relatedNodes : [];
            return {
              id: Date.now().toString(),
              type: 'assistant',
              content: data.answer,
              timestamp: new Date(),
              confidence: 90,
              relatedTopics,
              relatedNodes,
              sources: relatedNodes.length > 0
                ? [`知识库 RAG · 命中 ${relatedNodes.length} 个节点`]
                : ['DeepSeek + 课程知识库'],
            };
          }
        }
      }
    } catch (err) {
      console.warn('AI chat API failed, falling back to canned response:', err);
    }

    // 模拟API调用延迟（fallback 路径）
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 根据问题类型生成不同的回答
    let response: Message;

    if (question.includes('架构') || question.includes('结构')) {
      response = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `8051微控制器采用哈佛架构，具有以下主要组成部分：

**CPU核心**
- 8位ALU（算术逻辑单元）
- 累加器A和寄存器B
- 程序状态字PSW

**存储器系统**
- 4KB片内ROM（程序存储器）
- 128字节片内RAM（数据存储器）
- 64KB外部程序存储器空间
- 64KB外部数据存储器空间

**I/O系统**
- 4个8位并行I/O端口（P0-P3）
- 每个端口都可以独立配置

**特殊功能**
- 2个16位定时器/计数器
- 全双工串行通信接口
- 5个中断源，2级中断优先级`,
        timestamp: new Date(),
        confidence: 95,
        relatedTopics: ['哈佛架构', 'SFR寄存器', 'I/O端口', '存储器映射'],
        sources: ['8051技术手册', 'Intel官方文档']
      };
    } else if (question.includes('定时器') || question.includes('Timer')) {
      response = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `8051定时器配置需要设置以下寄存器：

**TMOD寄存器配置**
定时器工作模式和功能选择

**初值设置**
根据所需定时时间计算初值

**启动定时器**
设置TCON寄存器的TR位`,
        timestamp: new Date(),
        codeBlocks: [
          {
            language: 'c',
            code: `// 定时器0配置示例
// 工作模式1，16位定时器
TMOD = 0x01;

// 设置初值，定时50ms（12MHz晶振）
TH0 = 0x3C;
TL0 = 0xB0;

// 启动定时器
TR0 = 1;

// 等待定时器溢出
while(!TF0);
TF0 = 0;  // 清除溢出标志`,
            explanation: '这段代码配置定时器0为16位模式，实现50ms定时功能'
          }
        ],
        confidence: 92,
        relatedTopics: ['TMOD寄存器', 'TCON寄存器', '定时计算', '中断处理'],
        sources: ['8051编程指南', '定时器应用手册']
      };
    } else if (question.includes('LED') || question.includes('闪烁')) {
      response = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `LED闪烁控制是8051入门的经典项目，主要涉及GPIO控制和延时实现：

**硬件连接**
- LED正极接VCC，负极通过限流电阻接P1.0
- 低电平点亮，高电平熄灭

**软件实现**
- 配置P1.0为输出模式
- 循环切换P1.0的电平状态
- 在状态切换间加入适当延时`,
        timestamp: new Date(),
        codeBlocks: [
          {
            language: 'c',
            code: `#include <reg51.h>

// 定义LED连接的引脚
sbit LED = P1^0;

// 延时函数
void delay(unsigned int ms) {
    unsigned int i, j;
    for(i = 0; i < ms; i++)
        for(j = 0; j < 123; j++);
}

void main() {
    while(1) {
        LED = 0;        // 点亮LED
        delay(500);     // 延时500ms
        LED = 1;        // 熄灭LED
        delay(500);     // 延时500ms
    }
}`,
            explanation: '使用软件延时实现LED每秒闪烁一次的效果'
          },
          {
            language: 'c',
            code: `// 使用定时器实现更精确的闪烁
void timer0_init() {
    TMOD = 0x01;    // 定时器0，模式1
    TH0 = 0x3C;     // 50ms定时初值
    TL0 = 0xB0;
    ET0 = 1;        // 允许定时器0中断
    EA = 1;         // 开总中断
    TR0 = 1;        // 启动定时器0
}

void timer0_isr() interrupt 1 {
    static unsigned char count = 0;
    TH0 = 0x3C;     // 重新装载初值
    TL0 = 0xB0;
    
    count++;
    if(count >= 20) {  // 1秒到
        LED = ~LED;    // 翻转LED状态
        count = 0;
    }
}`,
            explanation: '使用定时器中断实现精确的1秒间隔LED闪烁'
          }
        ],
        confidence: 98,
        relatedTopics: ['GPIO控制', '延时函数', '定时器中断', 'sbit关键字'],
        sources: ['8051实例教程', 'GPIO编程指南']
      };
    } else {
      // 通用回答
      response = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `感谢您的提问！我是8051微控制器学习助手，专门为您解答相关技术问题。

您的问题："${question}"

我正在分析您的问题，为了给您更准确的回答，建议您可以：

1. **提供更多上下文** - 描述具体的应用场景
2. **明确问题类型** - 是理论概念、编程实现还是硬件连接
3. **说明当前水平** - 初学者、有一定基础还是进阶学习

您也可以尝试以下相关问题：
- 8051的基本架构是什么？
- 如何配置定时器？
- 中断系统如何工作？
- 串口通信怎么实现？`,
        timestamp: new Date(),
        confidence: 85,
        relatedTopics: ['基础概念', '编程实践', '硬件应用', '项目开发'],
        sources: ['8051技术文档']
      };
    }

    return response;
  };

  // 缓存发送消息函数
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponse = await generateAIResponse(inputValue);
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      toast.error('回答生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue]);

  // 缓存快速问题点击处理函数
  const handleQuickQuestion = useCallback((question: string) => {
    setInputValue(question);
    setActiveTab('chat');
    setTimeout(() => {
      sendMessage();
    }, 100);
  }, [sendMessage]);

  // 缓存复制代码函数
  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('代码已复制到剪贴板');
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 缓存回车发送处理函数
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 缓存分类图标获取函数
  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'basic': return <BookOpen className="h-3 w-3" />;
      case 'programming': return <Code className="h-3 w-3" />;
      case 'hardware': return <Zap className="h-3 w-3" />;
      case 'project': return <Lightbulb className="h-3 w-3" />;
      default: return <HelpCircle className="h-3 w-3" />;
    }
  }, []);

  // 缓存难度颜色获取函数
  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">智能问答助手</h1>
        <p className="text-gray-600">24/7在线的8051微控制器学习伙伴，随时为您答疑解惑</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100/80 border border-slate-200/60 p-1">
          <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 text-slate-600 hover:text-slate-800 transition-all duration-200">
            <MessageCircle className="h-4 w-4" />
            智能对话
            {messages.length > 0 && (
              <Badge variant="secondary">{messages.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quick" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 text-slate-600 hover:text-slate-800 transition-all duration-200">
            <Zap className="h-4 w-4" />
            快速问答
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-200 text-slate-600 hover:text-slate-800 transition-all duration-200">
            <Brain className="h-4 w-4" />
            知识库
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4 mt-6">
          <Card className="h-[600px] flex flex-col bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-md">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-b border-slate-200/40">
              <CardTitle className="flex items-center gap-2 text-slate-800 font-semibold">
                <Bot className="h-5 w-5 text-blue-600" />
                AI助手对话
              </CardTitle>
              <CardDescription className="text-slate-600">
                我是您的8051学习助手，可以回答技术问题、提供代码示例、解释概念原理
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col">
              {/* 消息列表 */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">开始您的8051学习之旅吧！</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleQuickQuestion('8051微控制器的基本架构是什么？')}
                        >
                          基础架构
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleQuickQuestion('如何实现LED闪烁控制？')}
                        >
                          LED控制
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleQuickQuestion('定时器如何配置？')}
                        >
                          定时器配置
                        </Button>
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                            message.type === 'user' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-slate-500 to-slate-600'
                          }`}>
                            {message.type === 'user' ? (
                              <User className="h-4 w-4 text-white" />
                            ) : (
                              <Bot className="h-4 w-4 text-white" />
                            )}
                          </div>
                          
                          <div className={`rounded-lg p-4 shadow-sm ${
                            message.type === 'user' 
                              ? 'bg-gradient-to-br from-blue-50 to-blue-100/60 text-slate-800 border border-blue-200/60 font-medium' 
                              : 'bg-gradient-to-br from-slate-50 to-slate-100/60 text-slate-800 border border-slate-200/60'
                          }`}>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            
                            {/* 代码块 */}
                            {message.codeBlocks && message.codeBlocks.map((block, index) => (
                              <div key={index} className="mt-4">
                                <div className="bg-gray-900 rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                                    <Badge variant="outline" className="text-gray-300 border-gray-600">
                                      {block.language}
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => copyCode(block.code)}
                                      className="text-gray-300 hover:text-white"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
                                    <code>{block.code}</code>
                                  </pre>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">{block.explanation}</p>
                              </div>
                            ))}
                            
                            {/* AI回答的额外信息 */}
                            {message.type === 'assistant' && (
                              <div className="mt-4 space-y-3">
                                {/* 置信度 */}
                                {message.confidence && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Star className="h-3 w-3 text-yellow-500" />
                                    <span>置信度: {message.confidence}%</span>
                                  </div>
                                )}
                                
                                {/* 相关主题 */}
                                {message.relatedTopics && message.relatedTopics.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">相关主题：</p>
                                    <div className="flex flex-wrap gap-1">
                                      {message.relatedTopics.map((topic, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {topic}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 参考来源 */}
                                {message.sources && message.sources.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">参考来源：</p>
                                    <div className="space-y-1">
                                      {message.sources.map((source, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                          <ExternalLink className="h-3 w-3" />
                                          {source}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* 知识图谱节点（点击跳转到 /knowledge-graph 对应节点） */}
                                {message.relatedNodes && message.relatedNodes.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">命中的知识图谱节点：</p>
                                    <div className="flex flex-wrap gap-1">
                                      {message.relatedNodes.map((node) => (
                                        <a
                                          key={node.id}
                                          href={`/knowledge-graph?node=${encodeURIComponent(node.id)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/[0.08] px-2 py-1 text-[11px] text-cyan-700 hover:bg-cyan-500/[0.14] dark:text-cyan-200"
                                          title={`CH${node.chapter} · L${node.level}`}
                                        >
                                          <span className="font-mono opacity-70">#{node.id}</span>
                                          <span>{node.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 反馈按钮 */}
                                <div className="flex items-center gap-2 pt-2">
                                  <Button size="sm" variant="ghost" className="h-6 px-2">
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2">
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                              <Clock className="h-3 w-3" />
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* 加载指示器 */}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 animate-pulse text-gray-600" />
                          <span className="text-gray-900">AI正在思考...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* 输入区域 */}
              <div className="flex gap-3 pt-4 border-t border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-blue-50/30 p-4 rounded-b-lg">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您的问题...（支持中文和英文）"
                  disabled={isLoading}
                  className="flex-1 border-slate-200/60 bg-white/80 focus:border-blue-300 focus:ring-blue-200/50 text-slate-800 placeholder:text-slate-500"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={isLoading || !inputValue.trim()}
                  size="icon"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border-blue-600 shadow-md hover:shadow-lg transition-all duration-200 disabled:from-slate-400 disabled:to-slate-500"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick" className="space-y-6 mt-6">
          <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-b border-slate-200/40">
              <CardTitle className="flex items-center gap-2 text-slate-800 font-semibold">
                <Zap className="h-5 w-5 text-amber-600" />
                快速问答
              </CardTitle>
              <CardDescription className="text-slate-600">
                点击下方问题快速获取答案，或者作为提问的参考模板
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {quickQuestions.map((q) => (
                  <Card key={q.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer bg-gradient-to-br from-white to-slate-50/30 border-slate-200/60 hover:border-blue-300/60 hover:bg-gradient-to-br hover:from-blue-50/30 hover:to-slate-50/50" onClick={() => handleQuickQuestion(q.question)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-3 text-slate-800">{q.question}</h3>
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(q.category)}
                            <Badge variant="outline" className="text-xs border-slate-300/60 text-slate-600 bg-slate-50/80">
                              {q.category === 'basic' ? '基础概念' :
                               q.category === 'programming' ? '编程实践' :
                               q.category === 'hardware' ? '硬件应用' : '项目开发'}
                            </Badge>
                            <Badge className={`text-xs ${getDifficultyColor(q.difficulty)}`}>
                              {q.difficulty === 'easy' ? '简单' :
                               q.difficulty === 'medium' ? '中等' : '困难'}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="text-slate-600 hover:text-blue-600 hover:bg-blue-50/60">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6 mt-6">
          <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-b border-slate-200/40">
              <CardTitle className="flex items-center gap-2 text-slate-800 font-semibold">
                <Brain className="h-5 w-5 text-purple-600" />
                知识库导航
              </CardTitle>
              <CardDescription className="text-slate-600">
                浏览8051微控制器的核心知识点，深入了解相关概念
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {knowledgePoints.map((point) => (
                  <Card key={point.id} className="hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-slate-50/30 border-slate-200/60 hover:border-purple-300/60 hover:bg-gradient-to-br hover:from-purple-50/30 hover:to-slate-50/50">
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-slate-800 mb-2">{point.title}</h3>
                            <Badge variant="outline" className="mt-1 border-purple-300/60 text-purple-700 bg-purple-50/80">
                              {point.category}
                            </Badge>
                          </div>
                          <Button size="sm" variant="outline" className="border-purple-300/60 text-purple-700 hover:bg-purple-50/80 hover:border-purple-400">
                            <Search className="h-3 w-3 mr-1" />
                            探索
                          </Button>
                        </div>
                        
                        <p className="text-slate-600 leading-relaxed">{point.description}</p>
                        
                        <div className="bg-gradient-to-r from-slate-50/80 to-purple-50/40 p-3 rounded-lg border border-slate-200/40">
                          <p className="text-sm font-semibold mb-2 text-slate-700">相关问题：</p>
                          <div className="space-y-2">
                            {point.relatedQuestions.map((question, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleQuickQuestion(question)}
                                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors duration-200 font-medium"
                              >
                                • {question}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

IntelligentQA.displayName = 'IntelligentQA';

export default IntelligentQA;