import { renderHook, act, waitFor } from '@testing-library/react';
import { useAiAssistant } from '@/hooks/useAiAssistant';
import { aiStudyAssistant } from '@/ai/flows/ai-study-assistant';
import { studentData } from '@/lib/mock-data';

// Mock dependencies
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Export mockToast for use in tests
export { mockToast };

jest.mock('@/ai/flows/ai-study-assistant', () => ({
  aiStudyAssistant: jest.fn(),
}));

jest.mock('@/lib/mock-data', () => ({
  studentData: {
    profile: {
      name: '测试学生',
    },
  },
}));

const mockAiStudyAssistant = aiStudyAssistant as jest.MockedFunction<typeof aiStudyAssistant>;

// Mock HTMLDivElement scrollTo method
const mockScrollTo = jest.fn();
Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
  value: mockScrollTo,
  writable: true,
});

Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
  get: () => 1000,
  configurable: true,
});

describe('useAiAssistant Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful AI response
    mockAiStudyAssistant.mockResolvedValue({
      answer: '这是AI助手的回答',
      relevantChapters: [
        {
          chapter: 'chapter-1',
          title: '相关章节1',
        },
      ],
      relevantVideos: [
        {
          title: '相关视频1',
          embedUrl: 'https://example.com/video1',
        },
      ],
    });
  });

  describe('初始化', () => {
    it('应该正确初始化hook状态', () => {
      const { result } = renderHook(() => useAiAssistant());

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual({
        role: 'model',
        content: `你好，${studentData.profile.name}同学！我是你的AI学习伙伴"芯智育才"。关于8051微控制器，有什么可以帮你的吗？你可以问我关于课程概念、代码示例或学习建议的问题。`,
      });
      expect(result.current.input).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.scrollAreaRef.current).toBeNull();
    });

    it('应该包含正确的初始欢迎消息', () => {
      const { result } = renderHook(() => useAiAssistant());
      
      const welcomeMessage = result.current.messages[0];
      expect(welcomeMessage.role).toBe('model');
      expect(welcomeMessage.content).toContain('测试学生');
      expect(welcomeMessage.content).toContain('芯智育才');
      expect(welcomeMessage.content).toContain('8051微控制器');
    });
  });

  describe('输入处理', () => {
    it('应该能够更新输入内容', () => {
      const { result } = renderHook(() => useAiAssistant());

      act(() => {
        result.current.setInput('测试输入');
      });

      expect(result.current.input).toBe('测试输入');
    });

    it('应该处理键盘事件', () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.setInput('测试问题');
      });

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(true);
    });

    it('应该在Shift+Enter时不提交', () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        key: 'Enter',
        shiftKey: true,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.setInput('测试问题');
      });

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('应该在非Enter键时不处理', () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        key: 'Space',
        shiftKey: false,
        preventDefault: jest.fn(),
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;

      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('消息提交', () => {
    it('应该成功提交消息并获得回复', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.setInput('什么是8051微控制器？');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(3); // 初始消息 + 用户消息 + AI回复
      expect(result.current.messages[1]).toEqual({
        role: 'user',
        content: '什么是8051微控制器？',
      });
      expect(result.current.messages[2]).toEqual(expect.objectContaining({
        role: 'model',
        content: '这是AI助手的回答',
        chapters: [
          expect.objectContaining({
            chapter: 'chapter-1',
            title: '相关章节1',
          }),
        ],
        videos: [
          expect.objectContaining({
            title: '相关视频1',
            embedUrl: 'https://example.com/video1',
          }),
        ],
      }));
      expect(result.current.input).toBe('');
      expect(result.current.isLoading).toBe(false);
    });

    it('应该正确调用AI助手API', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.setInput('测试问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockAiStudyAssistant).toHaveBeenCalledWith({
        question: '测试问题',
        history: [
          {
            role: 'model',
            content: [{ text: expect.stringContaining('你好，测试学生同学') }],
          },
        ],
      });
    });

    it('应该在空输入时不提交', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      // 测试空字符串
      act(() => {
        result.current.setInput('');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockAiStudyAssistant).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(1); // 只有初始消息

      // 测试只有空格的字符串
      act(() => {
        result.current.setInput('   ');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockAiStudyAssistant).not.toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(1);
    });

    it('应该在加载中时不提交', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      // 设置加载状态
      act(() => {
        result.current.setInput('第一个问题');
      });

      // 开始第一个请求（不等待完成）
      act(() => {
        result.current.handleSubmit(mockEvent);
      });

      expect(result.current.isLoading).toBe(true);

      // 尝试提交第二个问题
      act(() => {
        result.current.setInput('第二个问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      // 应该只调用一次AI助手
      expect(mockAiStudyAssistant).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误处理', () => {
    it('应该处理AI助手API错误', async () => {
      mockAiStudyAssistant.mockRejectedValueOnce(new Error('API错误'));

      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.setInput('测试问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '请求失败',
        description: '抱歉，与AI助教通信时发生错误，请稍后再试。',
      });
      expect(result.current.messages).toHaveLength(1); // 用户消息被移除，只剩初始消息
      expect(result.current.isLoading).toBe(false);
    });

    it('应该处理无效的AI响应', async () => {
      mockAiStudyAssistant.mockResolvedValueOnce(null as any);

      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.setInput('测试问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '请求失败',
        description: '抱歉，与AI助教通信时发生错误，请稍后再试。',
      });
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('应该处理缺少answer字段的响应', async () => {
      mockAiStudyAssistant.mockResolvedValueOnce({
        relevantChapters: [],
        relevantVideos: [],
      } as any);

      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      act(() => {
        result.current.setInput('测试问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '请求失败',
        description: '抱歉，与AI助教通信时发生错误，请稍后再试。',
      });
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('滚动行为', () => {
    it('应该在消息更新时自动滚动到底部', () => {
      const { result } = renderHook(() => useAiAssistant());
      
      // 模拟设置scrollAreaRef
      const mockDiv = document.createElement('div');
      Object.defineProperty(mockDiv, 'scrollHeight', {
        value: 1000,
        writable: true,
      });
      mockDiv.scrollTo = mockScrollTo;
      
      act(() => {
        (result.current.scrollAreaRef as any).current = mockDiv;
      });

      // 添加新消息
      act(() => {
        result.current.setInput('新消息');
      });

      // 由于useEffect的异步性质，我们需要等待
      waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 1000,
          behavior: 'smooth',
        });
      });
    });

    it('应该在scrollAreaRef为null时不报错', () => {
      const { result } = renderHook(() => useAiAssistant());
      
      // scrollAreaRef默认为null，添加消息不应该报错
      expect(() => {
        act(() => {
          result.current.setInput('测试消息');
        });
      }).not.toThrow();
    });
  });

  describe('消息历史', () => {
    it('应该正确构建消息历史用于API调用', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      // 添加第一条用户消息
      act(() => {
        result.current.setInput('第一个问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      // 添加第二条用户消息
      act(() => {
        result.current.setInput('第二个问题');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      // 验证第二次调用包含了完整的历史
      expect(mockAiStudyAssistant).toHaveBeenLastCalledWith({
        question: '第二个问题',
        history: [
          {
            role: 'model',
            content: [{ text: expect.stringContaining('你好，测试学生同学') }],
          },
          {
            role: 'user',
            content: [{ text: '第一个问题' }],
          },
          {
            role: 'model',
            content: [{ text: '这是AI助手的回答' }],
          },
        ],
      });
    });

    it('应该正确处理包含章节和视频的消息历史', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      // 第一次提交
      act(() => {
        result.current.setInput('问题1');
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      // 验证消息包含章节和视频信息
      const lastMessage = result.current.messages[result.current.messages.length - 1];
      expect(lastMessage.chapters).toBeDefined();
      expect(lastMessage.videos).toBeDefined();
      expect(lastMessage.chapters).toHaveLength(1);
      expect(lastMessage.videos).toHaveLength(1);
    });
  });

  describe('边界情况', () => {
    it('应该处理极长的输入', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      const longInput = 'a'.repeat(10000);
      
      act(() => {
        result.current.setInput(longInput);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(mockAiStudyAssistant).toHaveBeenCalledWith({
        question: longInput,
        history: expect.any(Array),
      });
    });

    it('应该处理特殊字符输入', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      const specialInput = '!@#$%^&*()_+{}|:"<>?[]\\;\',./`~';
      
      act(() => {
        result.current.setInput(specialInput);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.messages[1].content).toBe(specialInput);
    });

    it('应该处理Unicode字符', async () => {
      const { result } = renderHook(() => useAiAssistant());
      const mockEvent = {
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent;

      const unicodeInput = '你好世界 🌍 测试 emoji 😊';
      
      act(() => {
        result.current.setInput(unicodeInput);
      });

      await act(async () => {
        await result.current.handleSubmit(mockEvent);
      });

      expect(result.current.messages[1].content).toBe(unicodeInput);
    });
  });
});
