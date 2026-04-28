/**
 * 简化的AI客户端，避免复杂的依赖问题
 */
import { DeepSeekClient } from './deepseek-client';

export interface SimpleAiResponse {
  answer: string;
  relevantChapters: { chapter: string; title: string }[];
  relevantVideos: any[];
}

export class SimpleAiClient {
  private deepseekClient: DeepSeekClient;
  
  constructor() {
    this.deepseekClient = new DeepSeekClient(
      process.env.DEEPSEEK_API_KEY || 'sk-660f4af29d0049188eae9c8177c90fc2'
    );
  }
  
  async chat(question: string, courseContext?: string): Promise<SimpleAiResponse> {
    try {
      const baseSystem =
        '你是"芯智育才"8051单片机课程的AI助教。学生提问时请优先依据下面提供的"课程知识库检索结果"作答，' +
        '引用时用 [#id] 标注节点编号（如 [#7.2.3]）；若检索结果与问题无关或为空，再结合通用知识回答，' +
        '但务必明确指出依据来源。回答尽量结构化（先结论、再原理、必要时给极简代码示例），不要编造任何数据或实验结果。';
      const systemPrompt = courseContext
        ? `${baseSystem}\n\n${courseContext}`
        : baseSystem;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: question }
      ];

      const response = await this.deepseekClient.chat(messages);
      const answer = response.choices[0]?.message?.content || '抱歉，我无法提供答案。';

      return {
        answer,
        relevantChapters: [],
        relevantVideos: []
      };
    } catch (error) {
      console.error('SimpleAiClient error:', error);
      return this.getFallbackResponse(question);
    }
  }
  
  private getFallbackResponse(question: string): SimpleAiResponse {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('定时器') || lowerQuestion.includes('timer')) {
      return {
        answer: `关于8051定时器：\n\n8051内置2个16位定时器/计数器（T0和T1），支持4种工作模式。\n常用于延时、计数、串口波特率生成等。\n\n建议查看第5章了解详细内容。`,
        relevantChapters: [{ chapter: '5', title: '第 5 章：定时器/计数器' }],
        relevantVideos: []
      };
    }
    
    if (lowerQuestion.includes('中断') || lowerQuestion.includes('interrupt')) {
      return {
        answer: `关于8051中断系统：\n\n8051有5个中断源，通过IE和IP寄存器控制。\n中断向量表位于程序存储器低端。\n\n建议查看第6章了解详细内容。`,
        relevantChapters: [{ chapter: '6', title: '第 6 章：中断系统' }],
        relevantVideos: []
      };
    }
    
    return {
      answer: `感谢您的提问！建议您查阅相关章节内容，或通过仿真实验加深理解。`,
      relevantChapters: [],
      relevantVideos: []
    };
  }
}