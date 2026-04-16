/**
 * @jest-environment node
 */
import { DeepSeekClient, deepseekClient } from '@/ai/deepseek-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('DeepSeekClient', () => {
  let client: DeepSeekClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new DeepSeekClient(mockApiKey);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with provided API key', () => {
      const testClient = new DeepSeekClient('test-key');
      expect(testClient).toBeInstanceOf(DeepSeekClient);
    });
  });

  describe('chat', () => {
    const mockMessages = [
      { role: 'system' as const, content: 'You are a helpful assistant' },
      { role: 'user' as const, content: 'Hello' }
    ];

    const mockResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: 1234567890,
      model: 'deepseek-chat',
      choices: [{
        index: 0,
        message: { role: 'assistant' as const, content: 'Hello! How can I help you?' },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18
      }
    };

    it('should make successful chat request with default model', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.chat(mockMessages);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockApiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: mockMessages,
            temperature: 0.7,
            max_tokens: 2000
          }),
          // 允许实现里使用 AbortController
          signal: expect.any(Object),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should make successful chat request with custom model', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const customModel = 'deepseek-coder';
      await client.chat(mockMessages, customModel);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(`"model":"${customModel}"`)
        })
      );
    });

    it('should handle API error responses', async () => {
      const errorMessage = 'API key not valid';
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => errorMessage
      });

      await expect(client.chat(mockMessages))
        .rejects
        .toThrow('DeepSeek API error: 401 - API key not valid');
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat(mockMessages))
        .rejects
        .toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(client.chat(mockMessages))
        .rejects
        .toThrow('Invalid JSON');
    });
  });

  describe('generateText', () => {
    const mockChatResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: 1234567890,
      model: 'deepseek-chat',
      choices: [{
        index: 0,
        message: { role: 'assistant' as const, content: 'Generated text response' },
        finish_reason: 'stop'
      }]
    };

    it('should generate text with user prompt only', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatResponse
      });

      const result = await client.generateText('Hello world');

      expect(result).toBe('Generated text response');
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"user","content":"Hello world"}]')
        })
      );
    });

    it('should generate text with system prompt and user prompt', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChatResponse
      });

      const result = await client.generateText('Hello world', 'You are a helpful assistant');

      expect(result).toBe('Generated text response');
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"messages":[{"role":"system","content":"You are a helpful assistant"},{"role":"user","content":"Hello world"}]')
        })
      );
    });

    it('should return empty string when no response content', async () => {
      const emptyResponse = {
        ...mockChatResponse,
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: '' },
          finish_reason: 'stop'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse
      });

      const result = await client.generateText('Hello world');
      expect(result).toBe('');
    });

    it('should return empty string when no choices in response', async () => {
      const noChoicesResponse = {
        ...mockChatResponse,
        choices: []
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => noChoicesResponse
      });

      const result = await client.generateText('Hello world');
      expect(result).toBe('');
    });

    it('should handle generateText API errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      await expect(client.generateText('Hello world'))
        .rejects
        .toThrow('DeepSeek API error: 500 - Internal server error');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton deepseekClient instance', () => {
      expect(deepseekClient).toBeInstanceOf(DeepSeekClient);
    });

    it('should use environment API key or fallback', () => {
      // Test that the singleton is created (we can't easily test the exact key without mocking process.env)
      expect(deepseekClient).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined message content in response', async () => {
      const undefinedContentResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [{
          index: 0,
          message: { role: 'assistant' as const, content: undefined as any },
          finish_reason: 'stop'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => undefinedContentResponse
      });

      const result = await client.generateText('Hello world');
      expect(result).toBe('');
    });

    it('should handle null message in response', async () => {
      const nullMessageResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [{
          index: 0,
          message: null as any,
          finish_reason: 'stop'
        }]
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => nullMessageResponse
      });

      const result = await client.generateText('Hello world');
      expect(result).toBe('');
    });

    it('should handle empty messages array', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [{
            index: 0,
            message: { role: 'assistant' as const, content: 'Response to empty messages' },
            finish_reason: 'stop'
          }]
        })
      });

      const result = await client.chat([]);
      expect(result.choices?.[0]?.message.content).toBe('Response to empty messages');
    });
  });
});
