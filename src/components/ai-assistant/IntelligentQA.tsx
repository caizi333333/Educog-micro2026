'use client';

import React, { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStoredAccessToken } from '@/lib/auth-storage';
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
  Sparkles,
  Brain,
  HelpCircle,
  Clock,
  Search,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const AI_REQUEST_TIMEOUT_MS = 20_000;
const FEEDBACK_REQUEST_TIMEOUT_MS = 10_000;

type FeedbackVote = 'up' | 'down';
type ActiveAIRequest = {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
  version: number;
};

function throwIfRequestAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('请求已取消', 'AbortError');
}

function waitForAbortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      try {
        throwIfRequestAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAcceptedFeedbackReceipt(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const receipt = value;
  const accepted = typeof receipt.accepted === 'number' ? receipt.accepted : -1;
  const duplicates = typeof receipt.duplicates === 'number' ? receipt.duplicates : -1;
  return receipt.success === true && accepted >= 0 && duplicates >= 0 && accepted + duplicates >= 1;
}

interface RelatedNode {
  id: string;
  name: string;
  chapter: number;
  level: number;
}

function isRelatedNode(value: unknown): value is RelatedNode {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.chapter === 'number'
    && typeof value.level === 'number';
}

export type AnswerSourceType =
  | '课程检索'
  | '生成解释'
  | '生成解释（引用课程节点）'
  | '本地回退'
  | '来源未确认';

type ServerAnswerMode = 'generated' | 'retrieved' | 'fallback';

function parseServerAnswerMode(payload: Record<string, unknown> | null): ServerAnswerMode | null {
  const source = payload?.source;
  const mode = payload?.mode;
  if (source !== mode) return null;
  if (mode === 'generated' || mode === 'retrieved' || mode === 'fallback') return mode;
  return null;
}

function citedRelatedNodeIds(answer: string, relatedNodes: RelatedNode[]): string[] {
  const relatedNodeIds = new Set(relatedNodes.map((node) => node.id));
  return Array.from(answer.matchAll(/\[#([0-9]+(?:\.[0-9]+)*)\]/g), (match) => match[1])
    .filter((id, index, ids) => relatedNodeIds.has(id) && ids.indexOf(id) === index);
}

// 只接受服务端 source/mode 两个受控字段一致的响应。旧响应、缺失字段或
// 字段冲突一律显示保守标签，不再根据回答文案或“附带了节点”反推来源。
export function classifyAnswerSource(data: unknown, answer: string): AnswerSourceType {
  const payload = isRecord(data) ? data : null;
  const mode = parseServerAnswerMode(payload);
  if (mode === 'retrieved') return '课程检索';
  if (mode === 'fallback') return '本地回退';
  if (mode !== 'generated') return '来源未确认';

  const relatedNodes = Array.isArray(payload?.relatedNodes)
    ? payload.relatedNodes.filter(isRelatedNode)
    : [];
  return citedRelatedNodeIds(answer, relatedNodes).length > 0
    ? '生成解释（引用课程节点）'
    : '生成解释';
}

function describeAnswerSource(
  sourceType: AnswerSourceType,
  answer: string,
  relatedNodes: RelatedNode[],
): string {
  if (sourceType === '课程检索') {
    return `当前回答由服务端课程检索直接组织；返回 ${relatedNodes.length} 个可核对节点，未调用外部生成服务。`;
  }
  if (sourceType === '生成解释（引用课程节点）') {
    const citationCount = citedRelatedNodeIds(answer, relatedNodes).length;
    return `服务端生成了解释，并显式引用 ${citationCount} 个本次检索命中的课程节点。`;
  }
  if (sourceType === '生成解释') {
    return relatedNodes.length > 0
      ? `服务端生成了解释，并附 ${relatedNodes.length} 个相关课程节点；回答未显式引用这些节点。`
      : '服务端生成了解释，但未返回可核验的课程节点；请结合教材与实验结果复核。';
  }
  if (sourceType === '本地回退') {
    return '服务端外部生成不可用，当前为固定回退内容；未形成生成式回答，请结合教材与实验条件复核。';
  }
  return '服务端未返回一致、可核验的来源字段；不将本回答标作生成内容、课程检索或本地回退。';
}

// 只解析受控的粗体和知识点引用；其余内容始终作为 React 文本节点输出，
// 不使用 dangerouslySetInnerHTML，避免把回答中的 HTML 当成页面结构执行。
function renderInlineAnswer(content: string, relatedNodes?: RelatedNode[], keyPrefix = 'inline'): React.ReactNode[] {
  if (!content) return [];
  const byId = new Map<string, RelatedNode>();
  for (const n of relatedNodes ?? []) byId.set(n.id, n);
  const re = /\[#([0-9]+(?:\.[0-9]+)*)\]|\*\*([^*\n]+)\*\*/g;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      out.push(<React.Fragment key={`${keyPrefix}-text-${key++}`}>{content.slice(lastIndex, match.index)}</React.Fragment>);
    }
    if (match[2] !== undefined) {
      out.push(<strong key={`${keyPrefix}-strong-${key++}`} className="font-semibold text-slate-100">{match[2]}</strong>);
      lastIndex = match.index + match[0].length;
      continue;
    }
    const id = match[1] as string;
    const node = byId.get(id);
    out.push(
      <a
        key={`${keyPrefix}-citation-${key++}`}
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
    out.push(<React.Fragment key={`${keyPrefix}-text-${key++}`}>{content.slice(lastIndex)}</React.Fragment>);
  }
  return out;
}

function renderTextBlocks(content: string, relatedNodes?: RelatedNode[], keyPrefix = 'block'): React.ReactNode[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const unorderedMatch = lines[index].match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      out.push(
        <ul key={`${keyPrefix}-ul-${key++}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${key}-item-${itemIndex}`}>
              {renderInlineAnswer(item, relatedNodes, `${keyPrefix}-ul-${key}-item-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const orderedMatch = lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      out.push(
        <ol key={`${keyPrefix}-ol-${key++}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${key}-item-${itemIndex}`}>
              {renderInlineAnswer(item, relatedNodes, `${keyPrefix}-ol-${key}-item-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !/^\s*[-*]\s+/.test(lines[index])
      && !/^\s*\d+[.)]\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    out.push(
      <p key={`${keyPrefix}-p-${key++}`}>
        {paragraphLines.map((line, lineIndex) => (
          <React.Fragment key={`${keyPrefix}-p-${key}-line-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {renderInlineAnswer(line, relatedNodes, `${keyPrefix}-p-${key}-line-${lineIndex}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return out;
}

// 把回答按 ```代码块``` 切分；文本只解析粗体、列表、分段和课程节点引用。
export function renderSafeAnswerContent(content: string, relatedNodes?: RelatedNode[]): React.ReactNode[] {
  if (!content) return [];
  const out: React.ReactNode[] = [];
  const re = /```([a-zA-Z0-9+-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      out.push(...renderTextBlocks(content.slice(lastIndex, match.index), relatedNodes, `text-${key++}`));
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
    out.push(...renderTextBlocks(content.slice(lastIndex), relatedNodes, `text-${key++}`));
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
  sourceType?: AnswerSourceType;
  sourceDetail?: string;
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
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, FeedbackVote>>({});
  const [pendingFeedbackByMessage, setPendingFeedbackByMessage] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequestRef = useRef<ActiveAIRequest | null>(null);
  const requestVersionRef = useRef(0);
  const pendingFeedbackRef = useRef(new Set<string>());

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
  const generateAIResponse = useCallback(async (
    question: string,
    history: Message[],
    signal: AbortSignal,
  ): Promise<Message> => {
    try {
      throwIfRequestAborted(signal);
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
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
          signal,
        });
        throwIfRequestAborted(signal);
        if (res.ok) {
          const json: unknown = await res.json();
          throwIfRequestAborted(signal);
          const data = isRecord(json) && isRecord(json.data) ? json.data : null;
          const answer = data && typeof data.answer === 'string' ? data.answer.trim() : '';
          if (answer) {
            const relatedTopics = Array.isArray(data?.relevantChapters)
              ? data.relevantChapters.flatMap((chapter) => (
                isRecord(chapter) && typeof chapter.title === 'string' ? [chapter.title] : []
              ))
              : [];
            const relatedNodes = Array.isArray(data?.relatedNodes)
              ? data.relatedNodes.filter(isRelatedNode)
              : [];
            const sourceType = classifyAnswerSource(data, answer);
            const visibleRelatedNodes = sourceType === '本地回退' || sourceType === '来源未确认'
              ? []
              : relatedNodes;
            return {
              id: Date.now().toString(),
              type: 'assistant',
              content: answer,
              timestamp: new Date(),
              relatedTopics,
              relatedNodes: visibleRelatedNodes,
              sourceType,
              sourceDetail: describeAnswerSource(sourceType, answer, relatedNodes),
            };
          }
        }
      }
    } catch (err) {
      if (signal.aborted) throw err;
      console.warn('AI chat API failed, falling back to canned response:', err);
    }

    // 模拟API调用延迟（fallback 路径）
    await waitForAbortableDelay(1500, signal);
    throwIfRequestAborted(signal);

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
        sourceType: '本地回退',
        sourceDetail: '页面内固定课程提示模板；未调用生成服务，具体参数仍需结合教材版本和实验条件复核。'
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
        sourceType: '本地回退',
        sourceDetail: '页面内固定课程提示模板；未调用生成服务，定时初值需按实际晶振和机器周期复核。'
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
        sourceType: '本地回退',
        sourceDetail: '页面内固定课程提示模板；未调用生成服务，引脚电平与接线方式需在实际电路或仿真中核对。'
      };
    } else {
      // 通用回答
      response = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `当前问题信息不足，本地回退未形成可核验的技术结论。

您的问题："${question}"

请补充以下信息后重新提问：

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
        sourceType: '本地回退',
        sourceDetail: '页面内固定占位提示；未进行课程检索，也未生成技术回答。'
      };
    }

    return response;
  }, []);

  // 发送消息：支持直接传入问题文本（快速问题入口），避免依赖尚未更新的输入框状态
  const sendMessage = useCallback(async (text?: string) => {
    const question = (text ?? inputValue).trim();
    if (!question || isLoading || activeRequestRef.current) return;

    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (activeRequestRef.current?.version === requestVersion) {
        controller.abort('timeout');
      }
    }, AI_REQUEST_TIMEOUT_MS);
    activeRequestRef.current = { controller, timeoutId, version: requestVersion };

    const userMessage: Message = {
      id: `user-${Date.now()}-${requestVersion}`,
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
      const aiResponse = await generateAIResponse(question, history, controller.signal);
      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) return;
      setMessages(prev => [...prev, aiResponse]);
    } catch {
      if (requestVersion !== requestVersionRef.current) return;
      if (controller.signal.aborted && controller.signal.reason === 'timeout') {
        toast.error('回答请求超时，请重试');
        setMessages(prev => [...prev, {
          id: `assistant-timeout-${Date.now()}-${requestVersion}`,
          type: 'assistant',
          content: '本次回答等待超时，未生成有效结果。请检查网络后重试。',
          timestamp: new Date(),
          sourceType: '本地回退',
          sourceDetail: '页面内超时状态提示；本次未形成技术回答。',
        }]);
        return;
      }
      if (controller.signal.aborted) return;
      // 保留用户消息，追加错误提示，不让提问凭空消失
      toast.error('回答生成失败，请重试');
      setMessages(prev => [...prev, {
        id: `assistant-error-${Date.now()}-${requestVersion}`,
        type: 'assistant',
        content: '抱歉，本次回答生成失败，请稍后重试或换个问法。',
        timestamp: new Date(),
        sourceType: '本地回退',
        sourceDetail: '页面内失败状态提示；本次未形成技术回答。',
      }]);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        clearTimeout(timeoutId);
        if (activeRequestRef.current?.version === requestVersion) activeRequestRef.current = null;
        setIsLoading(false);
        queueMicrotask(() => inputRef.current?.focus());
      }
    }
  }, [generateAIResponse, inputValue, isLoading, messages]);

  const cancelResponse = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest) return;
    clearTimeout(activeRequest.timeoutId);
    requestVersionRef.current += 1;
    activeRequestRef.current = null;
    activeRequest.controller.abort('cancelled');
    setIsLoading(false);
    toast.info('已取消本次回答');
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  // 快速问题：切到对话页并直接发送
  const handleQuickQuestion = useCallback((question: string) => {
    setActiveTab('chat');
    sendMessage(question);
  }, [sendMessage]);

  // 缓存复制代码函数
  const copyCode = useCallback(async (code: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code);
      toast.success('代码已复制到剪贴板');
    } catch {
      toast.error('复制失败，请手动选择代码');
    }
  }, []);

  // 点赞/点踩反馈：写入既有学习事件接口
  const sendFeedback = useCallback(async (messageId: string, vote: FeedbackVote) => {
    if (pendingFeedbackRef.current.has(messageId)) return;
    const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
    if (!token) {
      toast.error('请先登录后再提交反馈');
      return;
    }

    pendingFeedbackRef.current.add(messageId);
    setPendingFeedbackByMessage(prev => ({ ...prev, [messageId]: true }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), FEEDBACK_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('/api/learning-events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          events: [{
            clientEventId: `ai-feedback:${messageId}:${vote}`,
            eventType: 'AI_FEEDBACK',
            targetType: 'AI_ASSISTANT',
            targetId: messageId,
            metadata: { vote },
          }],
        }),
        signal: controller.signal,
      });
      const receipt: unknown = await response.json().catch(() => null);
      if (!response.ok || !isAcceptedFeedbackReceipt(receipt)) {
        throw new Error(`Feedback receipt rejected (${response.status})`);
      }
      setFeedbackByMessage(prev => ({ ...prev, [messageId]: vote }));
      toast.success(vote === 'up' ? '已记录“有帮助”反馈' : '已记录“需改进”反馈');
    } catch {
      toast.error(controller.signal.reason === 'timeout' ? '反馈保存超时，请重试' : '反馈未保存，请重试');
    } finally {
      clearTimeout(timeoutId);
      pendingFeedbackRef.current.delete(messageId);
      setPendingFeedbackByMessage(prev => ({ ...prev, [messageId]: false }));
    }
  }, []);

  useEffect(() => () => {
    requestVersionRef.current += 1;
    const activeRequest = activeRequestRef.current;
    if (activeRequest) {
      clearTimeout(activeRequest.timeoutId);
      activeRequest.controller.abort('unmounted');
      activeRequestRef.current = null;
    }
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
        <h2 className="text-3xl font-bold text-slate-50">智能问答助手</h2>
        <p className="text-slate-400">基于课程内容检索的8051学习助手；回答需结合教材与实验结果复核</p>
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
                            <div className="space-y-2 leading-relaxed">
                              {message.type === 'assistant'
                                ? renderSafeAnswerContent(message.content, message.relatedNodes)
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
                                      aria-label="复制代码"
                                      title="复制代码"
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
                                
                                <div
                                  aria-label={`回答来源：${message.sourceType ?? '本地回退'}`}
                                  className="rounded-md border border-white/[0.08] bg-black/15 px-3 py-2 text-xs leading-5 text-slate-400"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-slate-300">回答来源</span>
                                    <Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100">
                                      {message.sourceType ?? '本地回退'}
                                    </Badge>
                                  </div>
                                  {message.sourceDetail && <p className="mt-1">{message.sourceDetail}</p>}
                                  <p className="mt-1 text-slate-500">仅作学习解释，不改变测验得分、实验完成状态或教师评价。</p>
                                </div>

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
                                <div className="flex items-center gap-2 pt-2" aria-label="评价本条回答">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    aria-label="这条回答有帮助"
                                    aria-pressed={feedbackByMessage[message.id] === 'up'}
                                    disabled={pendingFeedbackByMessage[message.id]}
                                    className={`h-8 min-w-8 px-2 hover:bg-white/[0.08] ${
                                      feedbackByMessage[message.id] === 'up'
                                        ? 'bg-emerald-300/[0.14] text-emerald-200'
                                        : 'text-slate-400 hover:text-slate-100'
                                    }`}
                                    onClick={() => sendFeedback(message.id, 'up')}
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    aria-label="这条回答需要改进"
                                    aria-pressed={feedbackByMessage[message.id] === 'down'}
                                    disabled={pendingFeedbackByMessage[message.id]}
                                    className={`h-8 min-w-8 px-2 hover:bg-white/[0.08] ${
                                      feedbackByMessage[message.id] === 'down'
                                        ? 'bg-amber-300/[0.14] text-amber-200'
                                        : 'text-slate-400 hover:text-slate-100'
                                    }`}
                                    onClick={() => sendFeedback(message.id, 'down')}
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                  {pendingFeedbackByMessage[message.id] && (
                                    <span className="text-[11px] text-slate-500" role="status">正在保存反馈…</span>
                                  )}
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
                    <div className="flex gap-3" role="status" aria-live="polite">
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
                  onKeyDown={handleKeyPress}
                  aria-label="向 AI 助手提问"
                  placeholder="请输入您的问题...（支持中文和英文）"
                  disabled={isLoading}
                  className="flex-1 bg-black/30 border-white/[0.10] focus:border-cyan-300/40 focus:ring-cyan-300/20 text-slate-100 placeholder:text-slate-500"
                />
                {isLoading ? (
                  <Button
                    type="button"
                    onClick={cancelResponse}
                    size="icon"
                    variant="outline"
                    aria-label="取消本次回答"
                    title="取消本次回答"
                    className="border-amber-300/30 bg-amber-300/[0.08] text-amber-100 hover:bg-amber-300/[0.16]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!inputValue.trim()}
                    size="icon"
                    aria-label="发送问题"
                    title="发送问题"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md hover:shadow-lg transition-all duration-200 disabled:bg-slate-600 disabled:text-slate-400"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
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
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`提问：${q.question}`}
                    className="group w-full rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-all duration-200 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1117]"
                    onClick={() => handleQuickQuestion(q.question)}
                  >
                      <span className="flex items-start justify-between">
                        <span className="flex-1">
                          <span className="mb-3 block font-semibold text-slate-100">{q.question}</span>
                          <span className="flex items-center gap-2 text-slate-400">
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
                          </span>
                        </span>
                        <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition group-hover:bg-cyan-300/[0.10] group-hover:text-cyan-200">
                          <MessageCircle className="h-4 w-4" />
                        </span>
                      </span>
                  </button>
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
