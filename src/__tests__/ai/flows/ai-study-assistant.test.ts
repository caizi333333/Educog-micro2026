/**
 * @jest-environment node
 */
import { aiStudyAssistant, AiStudyAssistantInput } from '@/ai/flows/ai-study-assistant';
import { SimpleAiClient } from '@/ai/simple-ai-client';

// Mock dependencies
jest.mock('@/ai/simple-ai-client');
jest.mock('@/lib/video-library', () => ({
  getVideosByChapter: jest.fn(),
  videoLibrary: [
    {
      title: '8051定时器编程实例',
      embedUrl: 'https://example.com/timer-video',
      keywords: ['定时器', 'timer', 'tmod', 'tcon']
    },
    {
      title: '中断系统详解',
      embedUrl: 'https://example.com/interrupt-video',
      keywords: ['中断', 'interrupt', 'ie', 'ip']
    },
    {
      title: 'I/O端口操作',
      embedUrl: 'https://example.com/io-video',
      keywords: ['io', '端口', 'p0', 'p1', 'p2', 'p3']
    }
  ]
}));

describe('AI Study Assistant', () => {
  let mockSimpleAiClient: jest.Mocked<SimpleAiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock SimpleAiClient
    mockSimpleAiClient = {
      chat: jest.fn()
    } as any;
    
    (SimpleAiClient as jest.MockedClass<typeof SimpleAiClient>).mockImplementation(() => mockSimpleAiClient);
  });

  describe('aiStudyAssistant', () => {
    const mockInput: AiStudyAssistantInput = {
      question: '什么是8051定时器？'
    };

    const mockAiResponse = {
      answer: '8051微控制器内置2个16位定时器/计数器（T0和T1）',
      relevantChapters: [],
      relevantVideos: []
    };

    it('should return successful response with AI answer and relevant content', async () => {
      mockSimpleAiClient.chat.mockResolvedValueOnce(mockAiResponse);

      const result = await aiStudyAssistant(mockInput);

      expect(mockSimpleAiClient.chat).toHaveBeenCalledWith('什么是8051定时器？');
      expect(result.answer).toBe('8051微控制器内置2个16位定时器/计数器（T0和T1）');
      // 验证搜索函数能找到相关章节（基于问题中的"定时器"关键词）
      expect(result.relevantChapters).toContainEqual({ chapter: '5', title: '第 5 章：定时器/计数器' });
      // 验证能找到相关视频（如果视频库中有匹配的）
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('should handle input with conversation history', async () => {
      const inputWithHistory: AiStudyAssistantInput = {
        question: '定时器如何配置？',
        history: [
          {
            role: 'user',
            content: [{ text: '什么是8051？' }]
          },
          {
            role: 'model',
            content: [{ text: '8051是一种微控制器' }]
          }
        ]
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce(mockAiResponse);

      const result = await aiStudyAssistant(inputWithHistory);

      expect(mockSimpleAiClient.chat).toHaveBeenCalledWith('定时器如何配置？');
      expect(result.answer).toBe('8051微控制器内置2个16位定时器/计数器（T0和T1）');
    });

    it('should find relevant chapters for interrupt questions', async () => {
      const interruptInput: AiStudyAssistantInput = {
        question: '中断系统如何工作？'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '8051中断系统包含5个中断源',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(interruptInput);

      console.log('Interrupt search result:', result);
      // 验证搜索函数能找到相关章节（基于问题中的"中断"关键词）
      expect(result.relevantChapters).toContainEqual(
        { chapter: '6', title: '第 6 章：中断系统' }
      );
      // 验证返回的视频数组格式正确
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('should find relevant chapters for I/O port questions', async () => {
      const ioInput: AiStudyAssistantInput = {
        question: 'P0端口如何使用？'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: 'P0端口是开漏输出',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(ioInput);

      // 验证搜索函数能找到相关章节（基于问题中的"P0"和"端口"关键词）
      expect(result.relevantChapters).toContainEqual(
        { chapter: '3', title: '第 3 章：I/O 端口编程' }
      );
      // 验证返回的视频数组格式正确
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('should find multiple relevant chapters for complex questions', async () => {
      const complexInput: AiStudyAssistantInput = {
        question: '8051微控制器的存储器结构和汇编语言'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '8051采用哈佛结构',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(complexInput);

      // 验证搜索函数能找到相关章节（基于问题中的关键词）
      expect(result.relevantChapters).toContainEqual(
        { chapter: '1', title: '第 1 章：微控制器概论' }
      );
      expect(result.relevantChapters).toContainEqual(
        { chapter: '2', title: '第 2 章：8051 存储器结构' }
      );
      expect(result.relevantChapters).toContainEqual(
        { chapter: '4', title: '第 4 章：8051 汇编语言基础' }
      );
      // 验证找到了多个相关章节
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.length).toBeGreaterThanOrEqual(3);
      // 验证返回的视频数组格式正确
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('should return empty arrays when no relevant content found', async () => {
      const irrelevantInput: AiStudyAssistantInput = {
        question: '今天天气怎么样？'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '这不是关于8051的问题',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(irrelevantInput);

      expect(result.relevantChapters).toEqual([]);
      expect(result.relevantVideos).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle SimpleAiClient errors and use fallback for timer questions', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiStudyAssistant({ question: '定时器如何配置？' });

      expect(consoleSpy).toHaveBeenCalledWith('AI Study Assistant Error:', expect.any(Error));
      expect(result.answer).toContain('关于8051定时器的问题');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle API key errors and use fallback response', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API key not valid'));

      const result = await aiStudyAssistant({ question: '中断系统原理' });

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：中断系统' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle API_KEY_INVALID errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API_KEY_INVALID'));

      const result = await aiStudyAssistant({ question: 'io端口编程' });

      expect(result.answer).toContain('关于8051 I/O端口');
      expect(result.relevantChapters).toEqual([{ chapter: '3', title: '第 3 章：I/O 端口编程' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle google ai api key placeholder errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('your_actual_google_ai_api_key_here'));

      const result = await aiStudyAssistant({ question: '串口通信' });

      expect(result.answer).toContain('关于8051串行通信');
      expect(result.relevantChapters).toEqual([{ chapter: '9', title: '第 9 章：串行通信 (UART)' }]);
      
      consoleSpy.mockRestore();
    });

    it('should retry once on non-API-key errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // First call fails, second call succeeds
      mockSimpleAiClient.chat
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          answer: '重试成功的回答',
          relevantChapters: [],
          relevantVideos: []
        });

      const result = await aiStudyAssistant({ question: '定时器配置' });

      expect(mockSimpleAiClient.chat).toHaveBeenCalledTimes(2);
      expect(result.answer).toBe('重试成功的回答');
      
      consoleSpy.mockRestore();
    });

    it('should use fallback when retry also fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Both calls fail
      mockSimpleAiClient.chat
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Still failing'));

      const result = await aiStudyAssistant({ question: '定时器配置' });

      expect(mockSimpleAiClient.chat).toHaveBeenCalledTimes(2);
      expect(result.answer).toContain('关于8051定时器的问题');
      
      consoleSpy.mockRestore();
    });

    it('should handle string errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce('String error message');

      const result = await aiStudyAssistant({ question: '随机问题' });

      expect(result.answer).toContain('感谢您的提问');
      
      consoleSpy.mockRestore();
    });
  });

  describe('fallback responses', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API key not valid'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should provide detailed timer fallback response', async () => {
      const result = await aiStudyAssistant({ question: '定时器编程' });

      expect(result.answer).toContain('关于8051定时器的问题');
      expect(result.answer).toContain('工作模式：模式0(13位)、模式1(16位)');
      expect(result.answer).toContain('TMOD(模式控制)、TCON(控制寄存器)');
      expect(result.answer).toContain('MOV TMOD, #20H');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
    });

    it('should provide detailed interrupt fallback response', async () => {
      const result = await aiStudyAssistant({ question: '中断编程' });

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.answer).toContain('8051有5个中断源');
      expect(result.answer).toContain('外部中断0 (INT0)');
      expect(result.answer).toContain('IE：中断允许寄存器');
      expect(result.answer).toContain('SETB EA');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：中断系统' }]);
    });

    it('should provide detailed I/O port fallback response', async () => {
      const result = await aiStudyAssistant({ question: 'p1端口操作' });

      expect(result.answer).toContain('关于8051 I/O端口');
      expect(result.answer).toContain('8051有4个8位I/O端口');
      expect(result.answer).toContain('P0：开漏输出');
      expect(result.answer).toContain('MOV P1, #0FFH');
      expect(result.relevantChapters).toEqual([{ chapter: '3', title: '第 3 章：I/O 端口编程' }]);
    });

    it('should provide detailed UART fallback response', async () => {
      const result = await aiStudyAssistant({ question: 'uart通信' });

      expect(result.answer).toContain('关于8051串行通信');
      expect(result.answer).toContain('8051内置全双工串行口');
      expect(result.answer).toContain('支持4种工作模式');
      expect(result.answer).toContain('SCON：串行控制寄存器');
      expect(result.answer).toContain('MOV SCON, #50H');
      expect(result.relevantChapters).toEqual([{ chapter: '9', title: '第 9 章：串行通信 (UART)' }]);
    });

    it('should provide generic fallback for unknown questions', async () => {
      const result = await aiStudyAssistant({ question: '未知问题' });

      expect(result.answer).toContain('感谢您的提问');
      expect(result.answer).toContain('查阅相关章节的理论知识');
      expect(result.answer).toContain('通过仿真实验加深理解');
      expect(result.answer).toContain('常见主题包括：CPU结构、存储器');
      expect(result.relevantChapters).toEqual([]);
      expect(result.relevantVideos).toEqual([]);
    });
  });

  describe('content search functions', () => {
    // Remove the beforeEach that was causing SimpleAiClient to always fail
    // We want to test the search functions when SimpleAiClient works normally

    it('should search course content with single keyword', async () => {
      // Mock SimpleAiClient to return a basic response
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '定时器相关回答',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: '定时器' });
      
      console.log('Timer search result:', result);
      // Should find timer-related chapter
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '5')).toBe(true);
    });

    it('should search course content with multiple keywords', async () => {
      // Mock SimpleAiClient to return a basic response
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '存储器相关回答',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: '8051 存储器' });
      
      console.log('Memory search result:', result);
      // Should find memory-related chapters
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '2')).toBe(true);
    });

    it('should handle case-insensitive keyword matching', async () => {
      // Mock SimpleAiClient to return a basic response
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: 'IO端口相关回答',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: 'IO端口' });
      
      // Should find I/O port chapter regardless of case
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '3')).toBe(true);
    });
  });
});