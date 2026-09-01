/**
 * @jest-environment node
 */
import { SimpleAiClient } from '@/ai/simple-ai-client';
import { DeepSeekClient } from '@/ai/deepseek-client';
import { retrieveContext } from '@/ai/knowledge-context';

// Mock the DeepSeekClient
jest.mock('@/ai/deepseek-client');

describe('SimpleAiClient', () => {
  let client: SimpleAiClient;
  let mockDeepSeekClient: jest.Mocked<DeepSeekClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock DeepSeekClient instance
    mockDeepSeekClient = {
      chat: jest.fn(),
      generateText: jest.fn()
    } as any;
    
    // Mock the DeepSeekClient constructor
    (DeepSeekClient as jest.MockedClass<typeof DeepSeekClient>).mockImplementation(() => mockDeepSeekClient);
    
    client = new SimpleAiClient();
  });

  describe('constructor', () => {
    it('should create instance with DeepSeekClient', () => {
      expect(client).toBeInstanceOf(SimpleAiClient);
      expect(DeepSeekClient).toHaveBeenCalledWith(process.env.DEEPSEEK_API_KEY || '');
    });

    it('should use environment API key or fallback', () => {
      const originalEnv = process.env.DEEPSEEK_API_KEY;
      process.env.DEEPSEEK_API_KEY = 'test-env-key';
      
      new SimpleAiClient();
      
      expect(DeepSeekClient).toHaveBeenCalledWith('test-env-key');
      
      process.env.DEEPSEEK_API_KEY = originalEnv;
    });
  });

  describe('chat', () => {
    const mockDeepSeekResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: 1234567890,
      model: 'deepseek-chat',
      choices: [{
        index: 0,
        message: { role: 'assistant' as const, content: '这是一个关于8051微控制器的回答' },
        finish_reason: 'stop'
      }]
    };

    it('should make successful chat request', async () => {
      mockDeepSeekClient.chat.mockResolvedValueOnce(mockDeepSeekResponse);

      const result = await client.chat('什么是8051微控制器？');

      expect(mockDeepSeekClient.chat).toHaveBeenCalledWith([
        { role: 'system', content: expect.stringContaining('AI助教') },
        { role: 'user', content: '什么是8051微控制器？' }
      ]);

      expect(result).toEqual({
        answer: '这是一个关于8051微控制器的回答',
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });
    });

    it('should handle empty response content', async () => {
      const emptyResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: '' },
          finish_reason: 'stop'
        }]
      };
      
      mockDeepSeekClient.chat.mockResolvedValueOnce(emptyResponse);

      const result = await client.chat('测试问题');

      expect(result.answer).toBe('抱歉，我无法提供答案。');
      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
    });

    it('should handle undefined response content', async () => {
      const undefinedResponse = {
        ...mockDeepSeekResponse,
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: undefined as any },
          finish_reason: 'stop'
        }]
      };
      
      mockDeepSeekClient.chat.mockResolvedValueOnce(undefinedResponse);

      const result = await client.chat('测试问题');

      expect(result.answer).toBe('抱歉，我无法提供答案。');
      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
    });

    it('should handle missing choices in response', async () => {
      const noChoicesResponse = {
        ...mockDeepSeekResponse,
        choices: []
      };
      
      mockDeepSeekClient.chat.mockResolvedValueOnce(noChoicesResponse);

      const result = await client.chat('测试问题');

      expect(result.answer).toBe('抱歉，我无法提供答案。');
      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
    });

    it('should handle API errors and return fallback response', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('什么是定时器？');

      expect(result.answer).toContain('关于8051定时器');
      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：定时器/计数器' }]);
    });

    it('should handle network errors and return fallback response', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await client.chat('中断系统如何工作？');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：中断系统' }]);
    });
  });

  describe('getFallbackResponse', () => {
    it('should expose the deterministic production fallback for benchmark runs without a network request', () => {
      const result = client.getLocalFallbackResponse('寻址方式有什么区别？', '## 课程知识库检索结果');

      expect(result.answer).toContain('7 种寻址方式');
      expect(result.relevantChapters).toEqual([{ chapter: '3', title: '第 3 章：指令系统' }]);
      expect(mockDeepSeekClient.chat).not.toHaveBeenCalled();
    });

    it('should return timer-related fallback for timer questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('定时器如何配置？');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.answer).toContain('8051内置2个16位定时器/计数器');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：定时器/计数器' }]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should return timer fallback for English timer questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('How does timer work?');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：定时器/计数器' }]);
    });

    it('should return interrupt-related fallback for interrupt questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('中断系统原理');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.answer).toContain('8051有5个中断源');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：中断系统' }]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should return interrupt fallback for English interrupt questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('What is interrupt system?');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：中断系统' }]);
    });

    it('should return generic fallback for unknown questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('随机问题');

      expect(result.answer).toContain('感谢您的提问');
      expect(result.answer).toContain('建议您查阅相关章节内容');
      expect(result.relevantChapters).toEqual([]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should return grounded course nodes when generation fails after retrieval', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat(
        '8051微控制器的基本架构是什么？',
        '## 课程知识库检索结果',
      );

      expect(result.answer).toContain('课程检索直接返回');
      expect(result.answer).toContain('[#2.1]');
      expect(result).toMatchObject({ source: 'retrieved', mode: 'retrieved' });
      expect(result.answer).not.toContain('可结合实验');
      expect(result.answer).not.toContain('exp03');
      expect(result.answer).not.toContain('感谢您的提问');
      expect(result.relevantChapters).toEqual(expect.arrayContaining([
        expect.objectContaining({ chapter: '2' }),
      ]));
    });

    it('should handle mixed case keywords', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('TIMER配置问题');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：定时器/计数器' }]);
    });

    it('should handle questions with multiple keywords', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('定时器中断如何处理？');

      // Should match the first keyword found (定时器)
      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：定时器/计数器' }]);
    });
  });

  describe('error handling', () => {
    it('should log errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Test error');
      
      mockDeepSeekClient.chat.mockRejectedValueOnce(testError);

      await client.chat('测试问题');

      expect(consoleSpy).toHaveBeenCalledWith('SimpleAiClient error:', testError);
      
      consoleSpy.mockRestore();
    });

    it('should handle string errors', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce('String error');

      const result = await client.chat('测试问题');

      expect(result.answer).toContain('感谢您的提问');
    });

    it('should handle null/undefined errors', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(null);

      const result = await client.chat('测试问题');

      expect(result.answer).toContain('感谢您的提问');
    });
  });

  describe('system prompt', () => {
    it('should use correct system prompt for AI assistant', async () => {
      mockDeepSeekClient.chat.mockResolvedValueOnce({
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: '测试回答' },
          finish_reason: 'stop'
        }]
      });

      await client.chat('测试问题');

      expect(mockDeepSeekClient.chat).toHaveBeenCalledWith([
        {
          role: 'system',
          content: expect.stringContaining('AI助教')
        },
        { role: 'user', content: '测试问题' }
      ]);
    });
  });
});

describe('course knowledge retrieval', () => {
  it('maps a natural-language architecture question to the CPU structure branch', () => {
    const result = retrieveContext('8051微控制器的基本架构是什么？', { maxKnowledge: 3 });
    const returnedIds = result.knowledgePoints.map((point) => point.id);

    expect(returnedIds).toContain('2.1');
    expect(returnedIds.every((id) => id === '2.1' || id.startsWith('2.1.'))).toBe(true);
    expect(result.experiments).toEqual([]);
  });

  it('keeps experiment recommendations for explicit practice topics', () => {
    const result = retrieveContext(
      '寻址方式应当如何在实验中验证？',
      { maxKnowledge: 3, maxExperiments: 1 },
    );

    expect(result.experiments[0]?.id).toBe('exp02');
  });

  it('keeps the immediate teaching parent when a detailed child ranks first', () => {
    const result = retrieveContext(
      '下列哪个不是 8051 最小系统的必备组成？候选答案：晶振电路；电源去耦；复位电路；以太网控制器',
      { maxKnowledge: 6 },
    );
    const returnedIds = result.knowledgePoints.map((point) => point.id);

    expect(returnedIds).toContain('1.4');
    expect(returnedIds.indexOf('1.4')).toBeLessThan(3);
  });

  it('preserves 8051 operand notation when ranking instruction context', () => {
    const result = retrieveContext(
      'MOVC A, @A+DPTR 采用什么寻址方式，并访问哪类存储器？',
      { maxKnowledge: 3, maxExperiments: 0 },
    );
    const returnedIds = result.knowledgePoints.map((point) => point.id);

    expect(returnedIds).toContain('3.1.5');
    expect(returnedIds).toContain('3.2.3');
  });

  it('treats unlabelled multiple-choice alternatives as weaker than the stem', () => {
    const result = retrieveContext(
      'C51中使用 _crol_ 循环移位函数时应查阅哪个头文件？候选答案：<intrins.h>；<stdio.h>；<math.h>；<string.h>',
      { maxKnowledge: 3, maxExperiments: 0 },
    );

    expect(result.knowledgePoints[0]?.id).toBe('4.5');
  });

  it('expands register aliases without requiring the formal node title', () => {
    const result = retrieveContext(
      'SCON 中的 TI 置位后 UART 程序应如何处理？',
      { maxKnowledge: 6, maxExperiments: 0 },
    );
    const returnedIds = result.knowledgePoints.map((point) => point.id);

    expect(returnedIds).toContain('7.2.1');
    expect(returnedIds).toContain('7.3.2');
  });

  it('maps AI verification language to the responsible-use branch', () => {
    const result = retrieveContext(
      'AI助教给出寄存器结论后应如何核对和引用？',
      { maxKnowledge: 3, maxExperiments: 0 },
    );

    expect(result.knowledgePoints[0]?.id).toBe('10.5.1');
  });
});
