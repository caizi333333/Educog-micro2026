import { NextRequest } from 'next/server';
import { POST } from '@/app/api/test-deepseek/route';
import { DeepSeekClient } from '@/ai/deepseek-client';
import { createMockNextRequest } from '../../utils/test-mocks';

// Mock DeepSeekClient
jest.mock('@/ai/deepseek-client');
const MockedDeepSeekClient = DeepSeekClient as jest.MockedClass<typeof DeepSeekClient>;

// Mock AI flows
jest.mock('@/ai/flows/ai-study-assistant', () => ({
  aiStudyAssistant: jest.fn(),
}));

describe('/api/test-deepseek', () => {
  let mockClient: jest.Mocked<DeepSeekClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      chat: jest.fn(),
    } as any;
    MockedDeepSeekClient.mockImplementation(() => mockClient);
  });

  describe('POST', () => {
    it('should handle single test request successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '你好！我是DeepSeek AI助手。'
          }
        }]
      };
      mockClient.chat.mockResolvedValue(mockResponse as any);

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '你好，请介绍一下自己',
          runFullTest: false
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBe('你好！我是DeepSeek AI助手。');
      expect(data.testResults.directClient).toBe(true);
      expect(data.testResults.genkitIntegration).toBe(null);
      expect(data.testResults.codeGeneration).toBe(null);
      expect(mockClient.chat).toHaveBeenCalledWith([
        { role: 'user', content: '你好，请介绍一下自己' }
      ]);
    });

    it('should handle single test request with no response content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }]
      };
      mockClient.chat.mockResolvedValue(mockResponse as any);

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '测试提示',
          runFullTest: false
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBe('无响应');
      expect(data.testResults.directClient).toBe(true);
    });

    it('should run full test suite successfully', async () => {
      // Mock successful responses for all tests
      const mockChatResponse = {
        choices: [{
          message: {
            content: '测试响应内容'
          }
        }]
      };
      mockClient.chat.mockResolvedValue(mockChatResponse as any);

      // Mock AI study assistant
      const { aiStudyAssistant } = await import('@/ai/flows/ai-study-assistant');
      (aiStudyAssistant as jest.Mock).mockResolvedValue({
        answer: '8051单片机的定时器有4种工作模式...'
      });

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          runFullTest: true
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.testResults.directClient).toBe(true);
      expect(data.testResults.genkitIntegration).toBe(true);
      expect(data.testResults.codeGeneration).toBe(true);
      expect(data.summary).toContain('✅ 直接客户端测试通过');
      expect(data.summary).toContain('✅ AI 学习助手集成测试通过');
      expect(data.summary).toContain('✅ 代码生成测试通过');
    });

    it('should handle full test suite with partial failures', async () => {
      // Mock direct client success
      const mockChatResponse = {
        choices: [{
          message: {
            content: '测试响应内容'
          }
        }]
      };
      mockClient.chat.mockResolvedValueOnce(mockChatResponse as any);

      // Mock AI study assistant failure
      const { aiStudyAssistant } = await import('@/ai/flows/ai-study-assistant');
      (aiStudyAssistant as jest.Mock).mockRejectedValue(new Error('AI助手连接失败'));

      // Mock code generation success
      mockClient.chat.mockResolvedValueOnce(mockChatResponse as any);

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          runFullTest: true
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.testResults.directClient).toBe(true);
      expect(data.testResults.genkitIntegration).toBe(false);
      expect(data.testResults.codeGeneration).toBe(true);
      expect(data.summary).toContain('✅ 直接客户端测试通过');
      expect(data.summary).toContain('❌ AI 学习助手集成测试失败');
      expect(data.summary).toContain('✅ 代码生成测试通过');
    });

    it('should handle full test suite with all failures', async () => {
      // Mock all tests to fail
      mockClient.chat.mockRejectedValue(new Error('API连接失败'));

      const { aiStudyAssistant } = await import('@/ai/flows/ai-study-assistant');
      (aiStudyAssistant as jest.Mock).mockRejectedValue(new Error('AI助手连接失败'));

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          runFullTest: true
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.testResults.directClient).toBe(false);
      expect(data.testResults.genkitIntegration).toBe(false);
      expect(data.testResults.codeGeneration).toBe(false);
      expect(data.summary).toContain('❌ 直接客户端测试失败');
      expect(data.summary).toContain('❌ AI 学习助手集成测试失败');
      expect(data.summary).toContain('❌ 代码生成测试失败');
    });

    it('should handle invalid JSON request', async () => {
      const request = new NextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle client initialization error', async () => {
      MockedDeepSeekClient.mockImplementation(() => {
        throw new Error('Client initialization failed');
      });

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '测试提示',
          runFullTest: false
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Client initialization failed');
    });

    it('should handle chat API error in single test', async () => {
      mockClient.chat.mockRejectedValue(new Error('API rate limit exceeded'));

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '测试提示',
          runFullTest: false
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('API rate limit exceeded');
    });

    it('should use correct model for code generation test', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'ORG 0000H\nMOV P1, #0FFH\nLOOP: CPL P1.0\nCALL DELAY\nSJMP LOOP'
          }
        }]
      };
      mockClient.chat.mockResolvedValue(mockResponse as any);

      const { aiStudyAssistant } = await import('@/ai/flows/ai-study-assistant');
      (aiStudyAssistant as jest.Mock).mockResolvedValue({
        answer: '测试答案'
      });

      const request = createMockNextRequest('http://localhost:3000/api/test-deepseek', {
        method: 'POST',
        body: JSON.stringify({
          runFullTest: true
        }) as any,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request as unknown as NextRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.testResults.codeGeneration).toBe(true);

      // Verify that chat was called for code generation with correct model
      expect(mockClient.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: '请写一个8051单片机LED闪烁的汇编代码' }],
        'deepseek-coder'
      );
    });
  });
});
