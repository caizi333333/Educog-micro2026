/**
 * @jest-environment node
 */
import { aiStudyAssistant, AiStudyAssistantInput } from '@/ai/flows/ai-study-assistant';
import { SimpleAiClient } from '@/ai/simple-ai-client';
import { formatContextForPrompt, getCourseSlidePage, retrieveCourseSlides } from '@/ai/knowledge-context';

describe('latest course slide references', () => {
  it('preserves formula exponents and separates corrections from original slide text', () => {
    expect(getCourseSlidePage(43)?.text).toContain('2^(SMOD)');
    expect(getCourseSlidePage(43)?.text).toContain('2^(16)');
    expect(getCourseSlidePage(43)?.text).toContain('2^(8)');
    expect(getCourseSlidePage(46)?.text).toContain('10^(6)');
    const page = getCourseSlidePage(64)!;
    expect(page.text).toContain('DJNZ R7,END_RETI');
    const context = formatContextForPrompt({ knowledgePoints: [], experiments: [], slides: [page] });
    expect(context).toContain('实际访问40H—60H并发送33字节');
    expect(context).toContain('回答必须遵循这些修正及适用条件');
    expect(getCourseSlidePage(11)?.readingNotes[0]?.text).toContain('每个符号承载1 bit');
    expect(retrieveCourseSlides('请解释PDF第64页')[0]?.page).toBe(64);
  });
  it('retrieves numeric operating conditions and the matching original PDF page', () => {
    const pages = retrieveCourseSlides('12MHz为什么不能精确产生9600波特率');
    expect(pages.map((page) => page.page)).toContain(45);
    expect(getCourseSlidePage(45)?.text).toContain('10417');
    expect(getCourseSlidePage(45)?.href).toBe('/resources/course/course-slides.pdf#page=45');
  });

  it('keeps bipolar motor and serial register retrieval tied to their actual course pages', () => {
    expect(retrieveCourseSlides('四线双极型步进电机需要什么驱动', { pointId: '8.5.2' }).map((page) => page.page)).toContain(145);
    expect(retrieveCourseSlides('SCON寄存器中TI和RI的作用', { pointId: '7.2.1' }).map((page) => page.page)).toContain(25);
    expect(retrieveCourseSlides('明天海南天气')).toEqual([]);
  });

  it('validates page and result limits without claiming unseen graphics were extracted', () => {
    expect(getCourseSlidePage(0)).toBeUndefined();
    expect(getCourseSlidePage(168)).toBeUndefined();
    expect(getCourseSlidePage(1.5)).toBeUndefined();
    expect(retrieveCourseSlides('串口', { limit: 0 })).toEqual([]);
    const page = getCourseSlidePage(145)!;
    const context = formatContextForPrompt({ knowledgePoints: [], experiments: [], slides: [page] });
    expect(context).toContain(page.text);
    expect(context).toContain('[课件P145]');
    expect(context).toContain('电路连线、图像和动画必须打开原页核对');
  });
});

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
      source: 'generated' as const,
      mode: 'generated' as const,
      relevantChapters: [],
      relevantVideos: []
    };

    it('should return successful response with AI answer and relevant content', async () => {
      mockSimpleAiClient.chat.mockResolvedValueOnce(mockAiResponse);

      const result = await aiStudyAssistant(mockInput);

      expect(mockSimpleAiClient.chat).toHaveBeenCalledWith('什么是8051定时器？', expect.any(String), []);
      expect(result.answer).toBe('8051微控制器内置2个16位定时器/计数器（T0和T1）');
      expect(result).toMatchObject({ source: 'generated', mode: 'generated' });
      // 平台单元6是定时器/计数器，大纲相应内容在第5章。
      expect(result.relevantChapters).toContainEqual({ chapter: '6', title: '平台单元 6：定时器/计数器' });
      // 验证能找到相关视频（如果视频库中有匹配的）
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('returns the requested slide correction when the external model falls back', async () => {
      mockSimpleAiClient.chat.mockResolvedValueOnce({ answer: '关于8051中断系统', source: 'fallback', mode: 'fallback', relevantChapters: [], relevantVideos: [] });
      const result = await aiStudyAssistant({ question: '请解释PDF第64页的32字节串口中断发送程序' });
      expect(result).toMatchObject({ source: 'retrieved', mode: 'retrieved', relatedNodes: [], relevantChapters: [] });
      expect(result.answer).toContain('40H—60H并发送33字节');
      expect(result.answer).toContain('未取得生成式解释');
      expect(result.answer).not.toContain('关于8051中断系统');
      expect(result.courseSources?.[0]?.page).toBe(64);
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

      expect(mockSimpleAiClient.chat).toHaveBeenCalledWith(
        '定时器如何配置？',
        expect.any(String),
        [
          { role: 'user', content: '什么是8051？' },
          { role: 'assistant', content: '8051是一种微控制器' },
        ],
      );
      expect(result.answer).toBe('8051微控制器内置2个16位定时器/计数器（T0和T1）');
    });

    it('should find relevant chapters for interrupt questions', async () => {
      const interruptInput: AiStudyAssistantInput = {
        question: '中断系统如何工作？'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '8051中断系统包含5个中断源',
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(interruptInput);

      // 真实 syllabus：CH5 是 中断系统
      expect(result.relevantChapters).toContainEqual(
        { chapter: '5', title: '平台单元 5：中断系统' }
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
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(ioInput);

      // 真实 syllabus：CH2 硬件结构 包含 2.3 I/O接口（P0~P3）
      expect(result.relevantChapters).toContainEqual(
        { chapter: '2', title: '平台单元 2：硬件结构' }
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
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(complexInput);

      // 真实 syllabus：CH1 单片机概述 / CH2 硬件结构（含存储器组织）/ CH3 指令系统
      expect(result.relevantChapters).toBeDefined();
      // 至少命中其中之一
      const hits = result.relevantChapters!.map((c) => c.chapter);
      expect(hits.some((c) => ['1', '2', '3'].includes(c))).toBe(true);
      // 验证返回的视频数组格式正确
      expect(Array.isArray(result.relevantVideos)).toBe(true);
    });

    it('should return empty arrays when no relevant content found', async () => {
      const irrelevantInput: AiStudyAssistantInput = {
        question: '今天天气怎么样？'
      };

      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '这不是关于8051的问题',
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });

      const result = await aiStudyAssistant(irrelevantInput);

      expect(result.relevantChapters).toEqual([]);
      expect(result.relevantVideos).toEqual([]);
    });

    it('should preserve a direct course-retrieval response as retrieved', async () => {
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '当前外部生成服务不可用，以下内容由平台课程检索直接返回：\n\n- [#2.1] CPU结构',
        source: 'retrieved',
        mode: 'retrieved',
        relevantChapters: [],
        relevantVideos: [],
      });

      const result = await aiStudyAssistant({ question: '8051微控制器的基本架构是什么？' });

      expect(result).toMatchObject({ source: 'retrieved', mode: 'retrieved' });
      expect(result.relatedNodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: '2.1' }),
      ]));
    });

    it('should preserve a fixed client fallback and withhold unrelated retrieval nodes', async () => {
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '关于8051定时器：\n\n当前为固定回退说明。',
        source: 'fallback',
        mode: 'fallback',
        relevantChapters: [{ chapter: '6', title: '平台单元 6：定时器/计数器' }],
        relevantVideos: [],
      });

      const result = await aiStudyAssistant({ question: '定时器怎么设置' });

      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
      expect(result.relatedNodes).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle SimpleAiClient errors and use fallback for timer questions', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API Error'));

      const result = await aiStudyAssistant({ question: '定时器如何配置？' });

      expect(consoleSpy).toHaveBeenCalledWith('AI Study Assistant Error:', expect.any(Error));
      expect(result.answer).toContain('关于8051定时器的问题');
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '平台单元 6：定时器/计数器' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle API key errors and use fallback response', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API key not valid'));

      const result = await aiStudyAssistant({ question: '中断系统原理' });

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '平台单元 5：中断系统' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle API_KEY_INVALID errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('API_KEY_INVALID'));

      const result = await aiStudyAssistant({ question: 'io端口编程' });

      expect(result.answer).toContain('关于8051 I/O端口');
      expect(result.relevantChapters).toEqual([{ chapter: '2', title: '平台单元 2：硬件结构' }]);
      
      consoleSpy.mockRestore();
    });

    it('should handle google ai api key placeholder errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSimpleAiClient.chat.mockRejectedValueOnce(new Error('your_actual_google_ai_api_key_here'));

      const result = await aiStudyAssistant({ question: '串口通信' });

      expect(result.answer).toContain('关于8051串行通信');
      expect(result.relevantChapters).toEqual([{ chapter: '7', title: '平台单元 7：串行通信' }]);
      
      consoleSpy.mockRestore();
    });

    it('should retry once on non-API-key errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // First call fails, second call succeeds
      mockSimpleAiClient.chat
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          answer: '重试成功的回答',
          source: 'generated',
          mode: 'generated',
          relevantChapters: [],
          relevantVideos: []
        });

      const result = await aiStudyAssistant({ question: '定时器配置' });

      expect(mockSimpleAiClient.chat).toHaveBeenCalledTimes(2);
      expect(result.answer).toBe('重试成功的回答');
      expect(result).toMatchObject({ source: 'generated', mode: 'generated' });
      
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
      expect(result).toMatchObject({ source: 'fallback', mode: 'fallback' });
      
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
      expect(result.relevantChapters).toEqual([{ chapter: '6', title: '平台单元 6：定时器/计数器' }]);
    });

    it('should provide detailed interrupt fallback response', async () => {
      const result = await aiStudyAssistant({ question: '中断编程' });

      expect(result.answer).toContain('关于8051中断系统');
      expect(result.answer).toContain('8051有5个中断源');
      expect(result.answer).toContain('外部中断0 (INT0)');
      expect(result.answer).toContain('IE：中断允许寄存器');
      expect(result.answer).toContain('SETB EA');
      expect(result.relevantChapters).toEqual([{ chapter: '5', title: '平台单元 5：中断系统' }]);
    });

    it('should provide detailed I/O port fallback response', async () => {
      const result = await aiStudyAssistant({ question: 'p1端口操作' });

      expect(result.answer).toContain('关于8051 I/O端口');
      expect(result.answer).toContain('8051有4个8位I/O端口');
      expect(result.answer).toContain('P0：用作通用输出时为开漏输出');
      expect(result.answer).toContain('MOV P1, #0FFH');
      expect(result.relevantChapters).toEqual([{ chapter: '2', title: '平台单元 2：硬件结构' }]);
    });

    it('should provide detailed UART fallback response', async () => {
      const result = await aiStudyAssistant({ question: 'uart通信' });

      expect(result.answer).toContain('关于8051串行通信');
      expect(result.answer).toContain('8051内置全双工串行口');
      expect(result.answer).toContain('支持4种工作模式');
      expect(result.answer).toContain('SCON：串行控制寄存器');
      expect(result.answer).toContain('MOV SCON, #50H');
      expect(result.answer).toContain('经典12T内核、11.0592MHz');
      expect(result.answer).toContain('ANL PCON, #7FH');
      expect(result.answer).toContain('MOV TL1, #0FDH');
      expect(result.relevantChapters).toEqual([{ chapter: '7', title: '平台单元 7：串行通信' }]);
    });

    it('does not mistake the io substring in communication for an I/O question', async () => {
      const result = await aiStudyAssistant({ question: 'UART communication' });

      expect(result.answer).toContain('关于8051串行通信');
      expect(result.answer).toContain('对应大纲及授课课件第6章');
      expect(result.relevantChapters).toEqual([{ chapter: '7', title: '平台单元 7：串行通信' }]);
    });

    it('should provide generic fallback for unknown questions', async () => {
      const result = await aiStudyAssistant({ question: '未知问题' });

      expect(result.answer).toContain('感谢您的提问');
      expect(result.answer).toContain('查阅相关平台单元的理论知识');
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
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: '定时器' });
      
      // 真实 syllabus：CH6 定时器/计数器
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '6')).toBe(true);
    });

    it('should search course content with multiple keywords', async () => {
      // Mock SimpleAiClient to return a basic response
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: '存储器相关回答',
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: '8051 存储器' });
      
      // Should find memory-related chapters
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '2')).toBe(true);
    });

    it('should handle case-insensitive keyword matching', async () => {
      // Mock SimpleAiClient to return a basic response
      mockSimpleAiClient.chat.mockResolvedValueOnce({
        answer: 'IO端口相关回答',
        source: 'generated',
        mode: 'generated',
        relevantChapters: [],
        relevantVideos: []
      });
      
      const result = await aiStudyAssistant({ question: 'IO端口' });
      
      // 真实 syllabus：CH2 硬件结构 含 2.3 I/O 接口
      expect(result.relevantChapters).toBeDefined();
      expect(result.relevantChapters!.some(ch => ch.chapter === '2')).toBe(true);
    });
  });
});
