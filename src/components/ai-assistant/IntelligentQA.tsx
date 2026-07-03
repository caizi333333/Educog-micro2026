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
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface RelatedNode {
  id: string;
  name: string;
  chapter: number;
  level: number;
}

// Parse '[#7.4.3]' style inline citations in AI answer text. Each match
// becomes a clickable chip linking to /knowledge-graph?node=ID. The chip
// label uses the node's name from relatedNodes when available, falling
// back to '#id'. Surrounding text keeps its newlines via React fragments.
function renderWithCitations(content: string, relatedNodes?: RelatedNode[]): React.ReactNode[] {
  if (!content) return [];
  const byId = new Map<string, RelatedNode>();
  for (const n of relatedNodes ?? []) byId.set(n.id, n);
  const re = /\[#([0-9]+(?:\.[0-9]+)*)\]/g;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      out.push(<span key={`t${key++}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    const id = match[1] as string;
    const node = byId.get(id);
    out.push(
      <a
        key={`c${key++}`}
        href={`/knowledge-graph?node=${encodeURIComponent(id)}`}
        target="_blank"
        rel="noreferrer"
        className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/[0.10] px-1.5 py-0.5 align-baseline text-[11px] text-cyan-200 hover:bg-cyan-300/[0.16]"
        title={node ? `CH${node.chapter} · L${node.level} · ${node.name}` : `节点 ${id}（未在检索结果中）`}
      >
        <span className="font-mono">#{id}</span>
        {node && <span>{node.name}</span>}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    out.push(<span key={`t${key++}`}>{content.slice(lastIndex)}</span>);
  }
  return out;
}

// 把回答按 ```代码块``` 切分：文本段走引用渲染，代码段渲染为深色代码样式
function renderAnswerContent(content: string, relatedNodes?: RelatedNode[]): React.ReactNode[] {
  if (!content) return [];
  const out: React.ReactNode[] = [];
  const re = /```([a-zA-Z0-9+-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      out.push(
        <React.Fragment key={`txt${key++}`}>
          {renderWithCitations(content.slice(lastIndex, match.index), relatedNodes)}
        </React.Fragment>,
      );
    }
    const lang = match[1] || 'code';
    out.push(
      <div key={`code${key++}`} className="my-2 rounded-lg overflow-hidden bg-gray-900">
        <div className="px-3 py-1 bg-gray-800 text-xs text-gray-300 font-mono">{lang}</div>
        <pre className="p-3 text-sm text-gray-100 overflow-x-auto">
          <code>{match[2].replace(/\n$/, '')}</code>
        </pre>
      </div>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    out.push(
      <React.Fragment key={`txt${key++}`}>
        {renderWithCitations(content.slice(lastIndex), relatedNodes)}
      </React.Fragment>,
    );
  }
  return out;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeBlocks?: CodeBlock[];
  relatedTopics?: string[];
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
  // 本地课程知识库模板，避免页面在网络/key 异常时白屏。
  const generateAIResponse = async (question: string, history: Message[]): Promise<Message> => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (token) {
        // 携带最近6条对话作为上下文，支持多轮追问
        const historyPayload = history.slice(-6).map((m) => ({
          role: m.type === 'user' ? 'user' : 'model',
          content: [{ text: m.content }],
        }));
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question, history: historyPayload }),
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
              relatedTopics,
              relatedNodes,
              // 只标注真实的知识库检索命中，不编造来源
              sources: relatedNodes.length > 0
                ? [`课程知识库检索命中 ${relatedNodes.length} 个知识点`]
                : undefined,
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
        relatedTopics: ['哈佛架构', 'SFR寄存器', 'I/O端口', '存储器映射'],
        sources: ['来自本地课程知识库']
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
        relatedTopics: ['TMOD寄存器', 'TCON寄存器', '定时计算', '中断处理'],
        sources: ['来自本地课程知识库']
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
        relatedTopics: ['GPIO控制', '延时函数', '定时器中断', 'sbit关键字'],
        sources: ['来自本地课程知识库']
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
        relatedTopics: ['基础概念', '编程实践', '硬件应用', '项目开发'],
        sources: ['来自本地课程知识库']
      };
    }

    return response;
  };

  // 发送消息：支持直接传入问题文本（快速问题入口），避免依赖尚未更新的输入框状态
  const sendMessage = useCallback(async (text?: string) => {
    const question = (text ?? inputValue).trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: question,
      timestamp: new Date()
    };

    // 当前对话作为上下文（不含本条新提问）
    const history = messages;

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponse = await generateAIResponse(question, history);
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      // 保留用户消息，追加错误提示，不让提问凭空消失
      toast.error('回答生成失败，请重试');
      setMessages(prev => [...prev, {
        id: `${Date.now()}-err`,
        type: 'assistant',
        content: '抱歉，本次回答生成失败，请稍后重试或换个问法。',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages]);

  // 快速问题：切到对话页并直接发送
  const handleQuickQuestion = useCallback((question: string) => {
    setActiveTab('chat');
    sendMessage(question);
  }, [sendMessage]);

  // 缓存复制代码函数
  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('代码已复制到剪贴板');
  }, []);

  // 点赞/点踩反馈：写入既有学习事件接口
  const sendFeedback = useCallback((messageId: string, vote: 'up' | 'down') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      fetch('/api/learning-events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          events: [{
            eventType: 'AI_FEEDBACK',
            targetType: 'AI_ASSISTANT',
            targetId: messageId,
            metadata: { vote },
          }],
        }),
      }).catch(() => {});
    }
    toast.success('感谢您的反馈');
  }, []);

  // 自动滚动到底部（block: 'nearest' 避免牵连页面级滚动；空列表时跳过，避免挂载即滚动）
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
      case 'easy': return 'bg-emerald-300/[0.12] text-emerald-200 border-emerald-300/25';
      case 'medium': return 'bg-amber-300/[0.12] text-amber-200 border-amber-300/25';
      case 'hard': return 'bg-red-400/[0.12] text-red-300 border-red-400/25';
      default: return 'bg-white/[0.08] text-slate-300 border-white/[0.10]';
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-50">智能问答助手</h1>
        <p className="text-slate-400">24/7在线的8051微控制器学习伙伴，随时为您答疑解惑</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/[0.05] border border-white/[0.08] p-1">
          <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-cyan-300/[0.14] data-[state=active]:text-cyan-100 text-slate-400 hover:text-slate-200 transition-all duration-200">
            <MessageCircle className="h-4 w-4" />
            智能对话
            {messages.length > 0 && (
              <Badge variant="secondary">{messages.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quick" className="flex items-center gap-2 data-[state=active]:bg-cyan-300/[0.14] data-[state=active]:text-cyan-100 text-slate-400 hover:text-slate-200 transition-all duration-200">
            <Zap className="h-4 w-4" />
            快速问答
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2 data-[state=active]:bg-cyan-300/[0.14] data-[state=active]:text-cyan-100 text-slate-400 hover:text-slate-200 transition-all duration-200">
            <Brain className="h-4 w-4" />
            知识库
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4 mt-6">
          <Card className="h-[600px] flex flex-col border border-white/[0.08] bg-white/[0.035]">
            <CardHeader className="pb-3 bg-black/20 border-b border-white/[0.08]">
              <CardTitle className="flex items-center gap-2 text-slate-50 font-semibold">
                <Bot className="h-5 w-5 text-cyan-300" />
                AI助手对话
              </CardTitle>
              <CardDescription className="text-slate-400">
                我是您的8051学习助手，可以回答技术问题、提供代码示例、解释概念原理
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* 消息列表 */}
              <ScrollArea className="flex-1 pr-4 min-h-0">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <Bot className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400 mb-4">开始您的8051学习之旅吧！</p>
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
                            message.type === 'user' ? 'bg-cyan-500/90' : 'bg-white/[0.10] border border-white/[0.08]'
                          }`}>
                            {message.type === 'user' ? (
                              <User className="h-4 w-4 text-white" />
                            ) : (
                              <Bot className="h-4 w-4 text-white" />
                            )}
                          </div>
                          
                          <div className={`rounded-lg p-4 shadow-sm ${
                            message.type === 'user'
                              ? 'bg-cyan-300/[0.12] text-slate-100 border border-cyan-300/25 font-medium'
                              : 'bg-white/[0.05] text-slate-200 border border-white/[0.08]'
                          }`}>
                            <div className="whitespace-pre-wrap">
                              {message.type === 'assistant'
                                ? renderAnswerContent(message.content, message.relatedNodes)
                                : message.content}
                            </div>
                            
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
                                <p className="text-sm text-slate-400 mt-2">{block.explanation}</p>
                              </div>
                            ))}
                            
                            {/* AI回答的额外信息 */}
                            {message.type === 'assistant' && (
                              <div className="mt-4 space-y-3">
                                {/* 相关主题 */}
                                {message.relatedTopics && message.relatedTopics.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">相关主题：</p>
                                    <div className="flex flex-wrap gap-1">
                                      {message.relatedTopics.map((topic, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs bg-white/[0.08] text-slate-300">
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
                                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
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
                                          className="inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/[0.10] px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-300/[0.16]"
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
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]" onClick={() => sendFeedback(message.id, 'up')}>
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08]" onClick={() => sendFeedback(message.id, 'down')}>
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
                      <div className="w-8 h-8 rounded-full bg-white/[0.10] border border-white/[0.08] flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-white/[0.05] border border-white/[0.08] rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 animate-pulse text-cyan-300" />
                          <span className="text-slate-300">AI正在思考...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* 输入区域 */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.08] bg-black/20 p-4 rounded-b-lg">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入您的问题...（支持中文和英文）"
                  disabled={isLoading}
                  className="flex-1 bg-black/30 border-white/[0.10] focus:border-cyan-300/40 focus:ring-cyan-300/20 text-slate-100 placeholder:text-slate-500"
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !inputValue.trim()}
                  size="icon"
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md hover:shadow-lg transition-all duration-200 disabled:bg-slate-600 disabled:text-slate-400"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick" className="space-y-6 mt-6">
          <Card className="border border-white/[0.08] bg-white/[0.035]">
            <CardHeader className="bg-black/20 border-b border-white/[0.08]">
              <CardTitle className="flex items-center gap-2 text-slate-50 font-semibold">
                <Zap className="h-5 w-5 text-amber-300" />
                快速问答
              </CardTitle>
              <CardDescription className="text-slate-400">
                点击下方问题快速获取答案，或者作为提问的参考模板
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {quickQuestions.map((q) => (
                  <Card key={q.id} className="transition-all duration-200 cursor-pointer border border-white/[0.08] bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]" onClick={() => handleQuickQuestion(q.question)}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold mb-3 text-slate-100">{q.question}</h3>
                          <div className="flex items-center gap-2 text-slate-400">
                            {getCategoryIcon(q.category)}
                            <Badge variant="outline" className="text-xs border-white/[0.12] text-slate-300 bg-white/[0.04]">
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
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-cyan-200 hover:bg-cyan-300/[0.10]">
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
          <Card className="border border-white/[0.08] bg-white/[0.035]">
            <CardHeader className="bg-black/20 border-b border-white/[0.08]">
              <CardTitle className="flex items-center gap-2 text-slate-50 font-semibold">
                <Brain className="h-5 w-5 text-cyan-300" />
                知识库导航
              </CardTitle>
              <CardDescription className="text-slate-400">
                浏览8051微控制器的核心知识点，深入了解相关概念
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {knowledgePoints.map((point) => (
                  <Card key={point.id} className="transition-all duration-200 border border-white/[0.08] bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]">
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-slate-100 mb-2">{point.title}</h3>
                            <Badge variant="outline" className="mt-1 border-cyan-300/30 text-cyan-200 bg-cyan-300/[0.08]">
                              {point.category}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent border-cyan-300/30 text-cyan-200 hover:bg-cyan-300/[0.10] hover:border-cyan-300/50 hover:text-cyan-100"
                            onClick={() => handleQuickQuestion(`请介绍一下${point.title}：${point.description}`)}
                          >
                            <Search className="h-3 w-3 mr-1" />
                            探索
                          </Button>
                        </div>
                        
                        <p className="text-slate-400 leading-relaxed">{point.description}</p>

                        <div className="bg-black/20 p-3 rounded-lg border border-white/[0.08]">
                          <p className="text-sm font-semibold mb-2 text-slate-300">相关问题：</p>
                          <div className="space-y-2">
                            {point.relatedQuestions.map((question, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleQuickQuestion(question)}
                                className="block text-sm text-cyan-300 hover:text-cyan-100 hover:underline text-left transition-colors duration-200 font-medium"
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