/**
 * @jest-environment node
 */
import { SimpleAiClient } from '@/ai/simple-ai-client';
import { DeepSeekClient } from '@/ai/deepseek-client';

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
      expect(DeepSeekClient).toHaveBeenCalledWith(
        expect.stringMatching(/sk-|your_actual_google_ai_api_key_here/)
      );
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
    });

    it('should handle missing choices in response', async () => {
      const noChoicesResponse = {
        ...mockDeepSeekResponse,
        choices: []
      };
      
      mockDeepSeekClient.chat.mockResolvedValueOnce(noChoicesResponse);

      const result = await client.chat('测试问题');

      expect(result.answer).toBe('抱歉，我无法提供答案。');
    });

    it('should handle API errors and return fallback response', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('什么是定时器？');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
    });

    it('should handle network errors and return fallback response', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await client.chat('中断系统如何工作？');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：中断系统' }]);
    });
  });

  describe('getFallbackResponse', () => {
    it('should return timer-related fallback for timer questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('定时器如何配置？');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.answer).toContain('8051内置2个16位定时器/计数器');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should return timer fallback for English timer questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('How does timer work?');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
    });

    it('should return interrupt-related fallback for interrupt questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('中断系统原理');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.answer).toContain('8051有5个中断源');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：中断系统' }]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should return interrupt fallback for English interrupt questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('What is interrupt system?');

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '第 6 章：中断系统' }]);
    });

    it('should return generic fallback for unknown questions', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('随机问题');

      expect(result.answer).toContain('感谢您的提问');
      expect(result.answer).toContain('建议您查阅相关章节内容');
      expect(result.relevantChapters).toEqual([]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should handle mixed case keywords', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('TIMER配置问题');

      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
    });

    it('should handle questions with multiple keywords', async () => {
      mockDeepSeekClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await client.chat('定时器中断如何处理？');

      // Should match the first keyword found (定时器)
      expect(result.answer).toContain('关于8051定时器');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '第 5 章：定时器/计数器' }]);
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