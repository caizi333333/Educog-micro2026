import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntelligentQA, {
  classifyAnswerSource,
  isAcceptedFeedbackReceipt,
} from '@/components/ai-assistant/IntelligentQA';
import ErrorDiagnostic from '@/components/ai-assistant/ErrorDiagnostic';
import AiAssistantPageWrapper from '@/app/ai-assistant/page';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import aiBenchmarkReport from '../../../public/ai-benchmark.json';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

jest.mock('@/components/ui/tabs', () => {
  const React = require('react');
  const TabsContext = React.createContext(null);
  const Tabs = ({ value, onValueChange, children, ...props }: any) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
  const TabsList = ({ children, ...props }: any) => <div role="tablist" {...props}>{children}</div>;
  const TabsTrigger = ({ value, children, ...props }: any) => {
    const context = React.useContext(TabsContext);
    return (
      <button
        type="button"
        role="tab"
        aria-selected={context.value === value}
        onClick={() => context.onValueChange(value)}
        {...props}
      >
        {children}
      </button>
    );
  };
  const TabsContent = ({ value, children, ...props }: any) => {
    const context = React.useContext(TabsContext);
    return context.value === value ? <div role="tabpanel" {...props}>{children}</div> : null;
  };
  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

jest.mock('lucide-react', () => {
  const React = require('react');
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', props);
  return new Proxy({ __esModule: true }, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return Icon;
    },
  });
});

const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = jest.fn();
const mockToast = toast as jest.Mocked<typeof toast>;

jest.setTimeout(30_000);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function RouteHarness({ route }: { route: 'course' | 'ai' }): React.JSX.Element {
  return route === 'ai' ? <AiAssistantPageWrapper /> : <div>课程首页占位</div>;
}

const prepSource = {
  refId: 'course-slide-baud-error', pointId: '7.2.3', pointName: '波特率设置与计算',
  title: '授课 PPT 第 6 章：波特率误差分析',
  href: '/resources/course/course-slides.pdf#page=45', pdfPage: 45,
  available: true, textIncluded: false, excerpt: '波特率误差应结合晶振频率及通信要求判断。',
  readingNotes: [{ text: '计算前请确认经典 12T 内核及 SMOD 的取值。', title: '对照课件中的计算条件', url: '/resources/course/course-slides.pdf#page=45' }],
};
const prepCatalog = (generationAvailable = true, drafts: unknown[] = []) => ({
  success: true,
  data: {
    ownerId: 'teacher-1',
    capability: { generationAvailable, provider: 'DeepSeek', model: 'deepseek-chat', message: generationAvailable ? '可按选定课件生成备课草稿。' : '生成服务暂未配置，可阅读课件、手写并保存备课草稿。' },
    sources: [prepSource], drafts,
    limits: { instruction: 2000, submission: 6000, title: 160, content: 12000 },
  },
});
const prepGenerated = {
  ownerId: 'teacher-1',
  generationId: `prep_${'a'.repeat(40)}`, title: '串口通信课堂案例', content: '比较两组晶振频率下的波特率误差，说明适用条件。',
  kind: 'case', pointId: '7.2.3', slideRefId: prepSource.refId, instruction: '设计一个波特率误差讨论案例',
  mode: 'generated', sources: [{ ...prepSource, textIncluded: true }],
};
const prepSnapshot = {
  ...prepGenerated, id: `prep_${'b'.repeat(40)}`, snapshot: 'b123456789ab', savedAt: '2026-09-05T02:00:00.000Z',
};

function useTeacher(role: 'TEACHER' | 'ADMIN' = 'TEACHER') {
  mockGetStoredAccessToken.mockReturnValue('teacher-token');
  mockUseAuth.mockReturnValue({ user: { id: 'teacher-1', username: 'teacher', name: '教师甲', email: 'teacher@example.com', role }, loading: false, refreshUser: jest.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof useAuth>);
}

async function openTeacherPrep() {
  fireEvent.click(screen.getByRole('tab', { name: '教师备课' }));
  await waitFor(() => expect(screen.queryByText('正在读取备课资料与本人草稿…')).not.toBeInTheDocument());
}

describe('AI assistant atomic actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    jest.useRealTimers();
    mockGetStoredAccessToken.mockReturnValue('student-token');
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'student', email: 'student@example.com', name: '学生甲', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    global.fetch = mockFetch as typeof fetch;
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    let uuidSequence = 0;
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}`),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts only a concrete feedback receipt', () => {
    expect(isAcceptedFeedbackReceipt({ success: true, accepted: 1, duplicates: 0 })).toBe(true);
    expect(isAcceptedFeedbackReceipt({ success: true, accepted: 0, duplicates: 1 })).toBe(true);
    expect(isAcceptedFeedbackReceipt({ success: true, accepted: 0, duplicates: 0 })).toBe(false);
    expect(isAcceptedFeedbackReceipt({ success: false, accepted: 1, duplicates: 0 })).toBe(false);
  });

  it('uses a conservative label for missing or conflicting server provenance', () => {
    const answer = '回答引用了课程节点 [#3.1]';
    const relatedNodes = [{ id: '3.1', name: '寻址方式', chapter: 3, level: 2 }];

    expect(classifyAnswerSource({ relatedNodes }, answer)).toBe('来源未确认');
    expect(classifyAnswerSource({ source: 'generated', mode: 'retrieved', relatedNodes }, answer))
      .toBe('来源未确认');
    expect(classifyAnswerSource({ source: 'GENERATED', mode: 'GENERATED', relatedNodes }, answer))
      .toBe('来源未确认');
  });

  it('keeps the offline LED prompt explicit about loop counts and the complete blink period after an API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    render(<AiAssistantPageWrapper />);
    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), { target: { value: '如何让LED闪烁？' } });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    expect(await screen.findByText(/循环次数不能直接换算为毫秒/)).toBeInTheDocument();
    expect(screen.getByText(/完整亮灭周期约2s/)).toBeInTheDocument();
    expect(screen.getByLabelText('回答来源：本地回退')).toBeInTheDocument();
    expect(screen.queryByText(/延时500ms|精确的1秒/)).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('mounts from another route, switches modes, leaves and re-enters with a stable hook order', () => {
    const view = render(<RouteHarness route="course" />);
    expect(screen.getByText('课程首页占位')).toBeInTheDocument();

    expect(() => view.rerender(<RouteHarness route="ai" />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'AI智能助手' })).toBeInTheDocument();
    expect(screen.getByText(/SCHEMA v5 · SOURCE [0-9a-f]{12}/)).toBeInTheDocument();
    expect(screen.getByText('本地固定基准运行记录 · 非线上当前版本')).toBeInTheDocument();
    expect(screen.getByText('生成式质量：未运行（NOT_RUN）')).toBeInTheDocument();
    const expectedMrr = aiBenchmarkReport.retrieval.meanReciprocalRank.toFixed(4).replace('.', '\\.');
    expect(screen.getByText(new RegExp(`MRR ${expectedMrr}`))).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'AI智能助手' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '智能问答助手' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('能力边界与固定基准').closest('details')).not.toHaveAttribute('open');

    fireEvent.click(screen.getByRole('tab', { name: '错误诊断' }));
    expect(screen.getByRole('heading', { level: 2, name: '汇编错误诊断' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    fireEvent.click(screen.getByRole('tab', { name: '智能问答' }));
    expect(screen.getByRole('heading', { name: '智能问答助手' })).toBeInTheDocument();

    expect(() => view.rerender(<RouteHarness route="course" />)).not.toThrow();
    expect(() => view.rerender(<RouteHarness route="ai" />)).not.toThrow();
    expect(screen.getByRole('heading', { name: '智能问答助手' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '汇编错误诊断' })).not.toBeInTheDocument();
  });

  it('waits for auth hydration before mounting hook-bearing assistant children', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'student', email: 'student@example.com', name: '学生甲', role: 'STUDENT' },
      loading: true,
    } as ReturnType<typeof useAuth>);
    const view = render(<AiAssistantPageWrapper />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认 AI 助教访问权限');
    expect(screen.queryByRole('heading', { name: 'AI智能助手' })).not.toBeInTheDocument();

    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'student', email: 'student@example.com', name: '学生甲', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    expect(() => view.rerender(<AiAssistantPageWrapper />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'AI智能助手' })).toBeInTheDocument();
  });

  it('aborts an unfinished answer when switching to diagnostics and does not replay it after returning', async () => {
    const pending = deferredResponse();
    let requestSignal: AbortSignal | null = null;
    mockFetch.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? null;
      return pending.promise;
    });
    render(<AiAssistantPageWrapper />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '解释定时器模式' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    await waitFor(() => expect(requestSignal).not.toBeNull());

    fireEvent.click(screen.getByRole('tab', { name: '错误诊断' }));
    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect(screen.getByRole('heading', { name: '汇编错误诊断' })).toBeInTheDocument();

    await act(async () => {
      pending.resolve(jsonResponse({ data: { answer: '已离开问答页后的迟到回答' } }));
      await pending.promise;
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('tab', { name: '智能问答' }));
    expect(screen.queryByText('已离开问答页后的迟到回答')).not.toBeInTheDocument();
    expect(screen.getByText('开始您的8051学习之旅吧！')).toBeInTheDocument();
  });

  it('aborts the previous account request and resets local mode when the authenticated identity changes', async () => {
    const pending = deferredResponse();
    let requestSignal: AbortSignal | null = null;
    mockFetch.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? null;
      return pending.promise;
    });
    const view = render(<AiAssistantPageWrapper />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '请解释中断优先级' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    await waitFor(() => expect(requestSignal).not.toBeNull());

    mockUseAuth.mockReturnValue({
      user: { id: 'student-2', username: 'student2', email: 'student2@example.com', name: '学生乙', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    view.rerender(<AiAssistantPageWrapper />);

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect(screen.getByText('开始您的8051学习之旅吧！')).toBeInTheDocument();
    await act(async () => {
      pending.resolve(jsonResponse({ data: { answer: '上一账号的迟到回答' } }));
      await pending.promise;
      await Promise.resolve();
    });
    expect(screen.queryByText('上一账号的迟到回答')).not.toBeInTheDocument();
  });

  it('renders each quick question as a keyboard-activatable button', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      data: {
        answer: '**检索结论**\n\n键盘提问已收到 [#3.1]',
        source: 'retrieved',
        mode: 'retrieved',
        relatedNodes: [{ id: '3.1', name: '寻址方式', chapter: 3, level: 2 }],
      },
    }));
    render(<IntelligentQA />);

    fireEvent.click(screen.getByRole('tab', { name: /快速问答/ }));
    const quickQuestion = screen.getByRole('button', { name: '提问：8051微控制器的基本架构是什么？' });
    expect(quickQuestion.tagName).toBe('BUTTON');
    expect(quickQuestion).toHaveAttribute('type', 'button');

    quickQuestion.focus();
    expect(quickQuestion).toHaveFocus();
    fireEvent.click(quickQuestion);

    expect(await screen.findByText('键盘提问已收到')).toBeInTheDocument();
    expect(screen.getByText('检索结论').tagName).toBe('STRONG');
    expect(screen.getByLabelText('回答来源：课程检索')).toBeInTheDocument();
    expect(screen.queryByText(/\*\*检索结论\*\*/)).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({
      method: 'POST',
      signal: expect.any(AbortSignal),
    }));
  });

  it('labels generated explanations that explicitly cite retrieved course nodes without calling them retrieval', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      data: {
        answer: '这是生成解释，并引用课程节点 [#3.1]。',
        source: 'generated',
        mode: 'generated',
        relatedNodes: [{ id: '3.1', name: '寻址方式', chapter: 3, level: 2 }],
      },
    }));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '解释寻址方式' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    expect(await screen.findByLabelText('回答来源：生成解释（引用课程节点）'))
      .toHaveTextContent('显式引用 1 个');
    expect(screen.queryByLabelText('回答来源：课程检索')).not.toBeInTheDocument();
  });

  it('renders a safe label for a legacy response even when it contains a valid-looking node citation', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      data: {
        answer: '旧接口回答引用了 [#3.1]。',
        relatedNodes: [{ id: '3.1', name: '寻址方式', chapter: 3, level: 2 }],
      },
    }));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '旧接口问题' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    expect(await screen.findByLabelText('回答来源：来源未确认'))
      .toHaveTextContent('不将本回答标作生成内容、课程检索或本地回退');
    expect(screen.queryByText('知识图谱关联')).not.toBeInTheDocument();
  });

  it('times out a stalled answer and exposes an explicit cancellation action', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '解释一下定时器' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    expect(screen.getByRole('button', { name: '取消本次回答' })).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(35_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockToast.error).toHaveBeenCalledWith('回答请求超时，请重试');
    expect(screen.getByText('本次回答等待超时，未生成有效结果。请检查网络后重试。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送问题' })).toBeInTheDocument();
  });

  it('does not claim copy success until the clipboard write resolves', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'offline' }, 503));
    const writeText = navigator.clipboard.writeText as jest.Mock;
    writeText.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
    const view = render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '如何实现LED闪烁控制？' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    const copyButtons = await screen.findAllByRole('button', { name: '复制代码' }, { timeout: 3_000 });
    expect(screen.getByLabelText('回答来源：本地回退')).toBeInTheDocument();
    expect(screen.getByText('硬件连接').tagName).toBe('STRONG');
    expect(view.container).not.toHaveTextContent('**');
    expect(screen.queryByText('参考来源：')).not.toBeInTheDocument();

    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('复制失败，请手动选择代码'));
    expect(mockToast.success).not.toHaveBeenCalledWith('代码已复制到剪贴板');

    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('代码已复制到剪贴板'));
  });

  it('keeps votes mutually exclusive and changes state only after a retryable server receipt', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({
        data: { answer: '服务端回答', source: 'generated', mode: 'generated' },
      }))
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary' }, 503))
      .mockResolvedValueOnce(jsonResponse({ success: true, accepted: 1, duplicates: 0, ignored: 0 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, accepted: 1, duplicates: 0, ignored: 0 }));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '什么是SFR？' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    expect(await screen.findByText('服务端回答')).toBeInTheDocument();
    expect(screen.getByLabelText('回答来源：生成解释')).toBeInTheDocument();
    const up = screen.getByRole('button', { name: '这条回答有帮助' });
    const down = screen.getByRole('button', { name: '这条回答需要改进' });

    fireEvent.click(up);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('反馈未保存，请重试'));
    expect(up).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(up);
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'));
    expect(down).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(down);
    await waitFor(() => expect(down).toHaveAttribute('aria-pressed', 'true'));
    expect(up).toHaveAttribute('aria-pressed', 'false');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('does not mislabel a deterministic server fallback as generated or retrieved content', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      data: {
        answer: '关于8051定时器：\n\n当前为固定回退说明。',
        source: 'fallback',
        mode: 'fallback',
        relatedNodes: [{ id: '6.1', name: '定时器基础', chapter: 6, level: 2 }],
      },
    }));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '定时器怎么设置' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    expect(await screen.findByText('当前为固定回退说明。')).toBeInTheDocument();
    expect(screen.getByLabelText('回答来源：本地回退')).toHaveTextContent('未调用外部生成模型');
    expect(screen.queryByLabelText('回答来源：课程检索')).not.toBeInTheDocument();
  });

  it('labels a generic local placeholder without claiming a verifiable technical conclusion', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'offline' }, 503));
    render(<IntelligentQA />);

    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), {
      target: { value: '帮我看看这个' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    expect(await screen.findByText('当前问题信息不足，本地回退未形成可核验的技术结论。', {}, { timeout: 3_000 })).toBeInTheDocument();
    expect(screen.getByLabelText('回答来源：本地回退')).toHaveTextContent('未进行课程检索，也未生成技术回答');
    expect(screen.queryByText('参考来源：')).not.toBeInTheDocument();
  });

  it('labels and safely formats the optional generated diagnostic explanation', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      data: {
        answer: '**原因判断**\n\n先核对寄存器初值。',
        source: 'generated',
        mode: 'generated',
      },
    }));
    const view = render(<ErrorDiagnostic />);

    const codeInput = screen.getByRole('textbox', { name: '8051 汇编代码' });
    fireEvent.change(codeInput, { target: { value: 'MOV A,#01H\nEND' } });
    fireEvent.click(screen.getByRole('button', { name: '静态诊断' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 解释诊断结果' }));

    expect(await screen.findByText('原因判断')).toBeInTheDocument();
    expect(screen.getByText('原因判断').tagName).toBe('STRONG');
    expect(screen.getByText('生成解释')).toBeInTheDocument();
    expect(screen.getByText(/不改变静态诊断结果、测验得分、实验完成状态或教师评价/)).toBeInTheDocument();
    expect(view.container).not.toHaveTextContent('**');
  });

  it('clears diagnostics on code edits and ignores an older AI explanation', async () => {
    const pending = deferredResponse();
    mockFetch.mockReturnValue(pending.promise);
    render(<ErrorDiagnostic />);

    const codeInput = screen.getByRole('textbox', { name: '8051 汇编代码' });
    fireEvent.change(codeInput, { target: { value: 'MOV A,#01H\nEND' } });
    fireEvent.click(screen.getByRole('button', { name: '静态诊断' }));
    expect(screen.getByText('静态检查未发现语法问题')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AI 解释诊断结果' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '取消 AI 分析' })).toBeInTheDocument());
    fireEvent.change(codeInput, { target: { value: 'MOV A,#02H\nEND' } });

    expect(screen.queryByText('静态检查未发现语法问题')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消 AI 分析' })).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve(jsonResponse({ data: { answer: '这是旧代码的解释' } }));
      await pending.promise;
      await Promise.resolve();
    });
    expect(screen.queryByText('这是旧代码的解释')).not.toBeInTheDocument();
  });

  it('shows course page text and excludes a purported external course source', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: {
      answer: '请对照课件中的波特率条件。', source: 'generated', mode: 'generated',
      courseSources: [
        { id: 'course-slide-45', title: '串行通信技术', page: 45, sourcePage: 45, href: '/resources/course/course-slides.pdf#page=45', excerpt: '课件给出的波特率计算条件。' },
        { id: 'external', title: '不可信外站资料', page: 45, sourcePage: 45, href: 'https://untrusted.example/course.pdf', excerpt: '不得显示的外站资料。' },
      ],
    } }));
    render(<IntelligentQA />);
    fireEvent.change(screen.getByRole('textbox', { name: '向 AI 助手提问' }), { target: { value: '解释波特率计算条件' } });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));
    const summary = await screen.findByText('对照授课课件（1页）');
    fireEvent.click(summary);
    const link = screen.getByRole('link', { name: '串行通信技术 · 原课件第45页（PDF第45页）' });
    expect(link).toHaveAttribute('href', '/resources/course/course-slides.pdf#page=45');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('课件给出的波特率计算条件。')).toBeInTheDocument();
    expect(screen.queryByText('不可信外站资料')).not.toBeInTheDocument();
  });

  it('keeps teacher preparation hidden for students without fetching teacher data', () => {
    render(<AiAssistantPageWrapper />);
    expect(screen.queryByRole('tab', { name: '教师备课' })).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('releases the preparation loading state when the response body ignores cancellation', async () => {
    useTeacher();
    const body = new Promise(() => {});
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => body });
    jest.useFakeTimers();
    render(<AiAssistantPageWrapper />);
    fireEvent.click(screen.getByRole('tab', { name: '教师备课' }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await jest.advanceTimersByTimeAsync(35_000); });
    expect(screen.getByRole('alert')).toHaveTextContent('备课资料读取超时');
    expect(screen.getByRole('button', { name: '重新读取备课资料' })).toBeEnabled();
    expect(screen.queryByText('正在读取备课资料与本人草稿…')).not.toBeInTheDocument();
  });

  it.each(['TEACHER', 'ADMIN'] as const)('offers preparation to %s and requests private sources only on opening it', async (role) => {
    useTeacher(role);
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)));
    render(<AiAssistantPageWrapper />);
    expect(mockFetch).not.toHaveBeenCalled();
    await openTeacherPrep();
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/chat?mode=teacher-prep', expect.objectContaining({ headers: { Authorization: 'Bearer teacher-token' }, signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: '生成备课草稿' })).toBeDisabled();
    expect(screen.getByText(/生成服务暂未配置/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /授课 PPT 第 6 章/ })).toHaveAttribute('href', prepSource.href);
    expect(screen.getByText('计算前请确认经典 12T 内核及 SMOD 的取值。')).toBeInTheDocument();
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
  });

  it('allows manual writing without a model and confirms saving only from a concrete idempotent receipt', async () => {
    useTeacher();
    const manual = { ...prepSnapshot, mode: 'manual', generationId: null, title: '教师自编案例', content: '先讨论误差条件，再核对计算。', sources: [prepSource] };
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: {} }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: manual, duplicate: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...manual, id: `prep_${'c'.repeat(40)}`, snapshot: 'c123456789ab', content: '修改后的课堂讨论方案。' }, duplicate: false }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('草稿标题'), { target: { value: manual.title } });
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: manual.content } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('未收到明确的保存回执');
    expect(screen.queryByText(/已保存草稿 ·/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('草稿正文')).toHaveValue(manual.content);
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByText(/已保存草稿 · b123456789ab/)).toBeInTheDocument();
    const first = JSON.parse(mockFetch.mock.calls[1][1].body);
    const retry = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(first).toEqual(retry);
    expect(first).toMatchObject({ mode: 'teacher-prep', expectedUserId: 'teacher-1', action: 'save', title: manual.title, content: manual.content });
    expect(first).not.toHaveProperty('generationId');
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '修改后的课堂讨论方案。' } });
    expect(screen.queryByText(/已保存草稿 ·/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByText(/已保存草稿 · c123456789ab/)).toBeInTheDocument();
    expect(JSON.parse(mockFetch.mock.calls[3][1].body).requestId).not.toBe(first.requestId);
    expect(screen.getAllByRole('button', { name: /教师自编案例/ })).toHaveLength(2);
  });

  it('previews and adopts a grounded course template without generation, then saves the teacher edit as manual', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...prepSnapshot, mode: 'manual', generationId: null, sources: [prepSource] } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    const templateButton = screen.getByRole('button', { name: '预览课程模板（不调用生成）' });
    expect(templateButton).toBeEnabled();
    expect(screen.getByRole('button', { name: '生成备课草稿' })).toBeDisabled();
    fireEvent.click(templateButton);
    expect(screen.getByRole('heading', { name: '课程模板预览 · 非生成内容' })).toBeVisible();
    expect(screen.getByLabelText('草稿正文')).toHaveValue('');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '采用此模板' }));
    const content = (screen.getByLabelText('草稿正文') as HTMLTextAreaElement).value;
    expect(content).toContain('课程备课模板（非生成内容）');
    expect(content).toContain('合并 PDF 第 45 页');
    expect(content).toContain(prepSource.href);
    expect(content).toContain(prepSource.excerpt);
    expect(content).toContain(prepSource.readingNotes[0].text);
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: `${content}\n教师补充：核对晶振和SMOD。` } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText(/已保存草稿 · b123456789ab/);
    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body).toMatchObject({ action: 'save', pointId: prepSource.pointId, slideRefId: prepSource.refId });
    expect(body.content).toContain('教师补充：核对晶振和SMOD。');
    expect(body).not.toHaveProperty('generationId');
    expect(mockFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('leaves an unsaved draft untouched during preview and appends only after the teacher applies it', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('草稿标题'), { target: { value: '教师原来的标题' } });
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '教师未保存的课堂设计。' } });
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭预览' }));
    expect(screen.getByLabelText('草稿正文')).toHaveValue('教师未保存的课堂设计。');
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    fireEvent.click(screen.getByRole('button', { name: '追加到当前草稿' }));
    expect(screen.getByLabelText('草稿标题')).toHaveValue('教师原来的标题');
    expect((screen.getByLabelText('草稿正文') as HTMLTextAreaElement).value).toMatch(/^教师未保存的课堂设计。\n\n课程备课模板/);
    expect(screen.getByText(/已追加课程模板，原草稿内容保留/)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('offers the same local template after the server reports generation unavailable', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog()))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ownerId: 'teacher-1', mode: 'unavailable', message: '生成服务暂不可用。' } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('教学要求'), { target: { value: '核对晶振条件' } });
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    await screen.findByText('生成服务暂不可用。');
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    fireEvent.click(screen.getByRole('button', { name: '采用此模板' }));
    expect((screen.getByLabelText('草稿正文') as HTMLTextAreaElement).value).toContain('教学要求：核对晶振条件');
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { available: false, excerpt: prepSource.excerpt },
    { available: true, excerpt: '' },
  ])('does not manufacture a template when the selected page lacks readable source: %j', async (missing) => {
    useTeacher();
    const catalog = prepCatalog(false);
    mockFetch.mockResolvedValueOnce(jsonResponse({ ...catalog, data: { ...catalog.data, sources: [{ ...prepSource, ...missing }] } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    expect(screen.getByRole('button', { name: '预览课程模板（不调用生成）' })).toBeDisabled();
    expect(screen.getByLabelText('草稿正文')).toBeEnabled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('closes a stale preview on a task or source change and distinguishes exercise and review frameworks', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    fireEvent.change(screen.getByLabelText('备课任务'), { target: { value: 'exercise' } });
    expect(screen.queryByRole('heading', { name: '课程模板预览 · 非生成内容' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    expect(document.querySelector('#course-prep-template')).toHaveTextContent('本模板未自动生成标准答案或判分规则');
    fireEvent.change(screen.getByLabelText('备课任务'), { target: { value: 'review' } });
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    expect(document.querySelector('#course-prep-template')).toHaveTextContent('本模板未评价该作业');
    fireEvent.change(screen.getByLabelText('选择依据'), { target: { value: 'knowledge' } });
    fireEvent.change(screen.getByLabelText('平台单元'), { target: { value: '1' } });
    expect(screen.queryByRole('heading', { name: '课程模板预览 · 非生成内容' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '预览课程模板（不调用生成）' })).toBeDisabled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('preserves an existing draft instead of truncating it when a template would exceed the content limit', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false)));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    const original = '教师原文'.repeat(3000);
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: original } });
    fireEvent.click(screen.getByRole('button', { name: '预览课程模板（不调用生成）' }));
    fireEvent.click(screen.getByRole('button', { name: '追加到当前草稿' }));
    expect(screen.getByRole('alert')).toHaveTextContent('将超过 12000 字');
    expect(screen.getByLabelText('草稿正文')).toHaveValue(original);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps generated content editable and sends generation provenance only while its task inputs match', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog()))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: prepGenerated }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...prepSnapshot, content: '教师已核对后的案例。' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...prepSnapshot, id: `prep_${'c'.repeat(40)}`, snapshot: 'c123456789ab', mode: 'manual', generationId: null } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('教学要求'), { target: { value: prepGenerated.instruction } });
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    expect(await screen.findByText('已生成可编辑草稿，请核对内容后保存。')).toBeInTheDocument();
    expect(screen.getByLabelText('草稿正文')).toHaveValue(prepGenerated.content);
    expect(screen.getByText('生成时已提供该来源的文字内容。')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ mode: 'teacher-prep', expectedUserId: 'teacher-1', action: 'generate', kind: 'case', pointId: '7.2.3', slideRefId: prepSource.refId, instruction: prepGenerated.instruction });
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '教师已核对后的案例。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText(/已保存草稿 · b123456789ab/);
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toMatchObject({ generationId: prepGenerated.generationId, content: '教师已核对后的案例。' });
    fireEvent.change(screen.getByLabelText('备课任务'), { target: { value: 'exercise' } });
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await screen.findByText(/已保存草稿 · c123456789ab/);
    expect(JSON.parse(mockFetch.mock.calls[3][1].body)).not.toHaveProperty('generationId');
  });

  it('preserves a manual draft when generation is unavailable and when switching tabs', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog()))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...prepGenerated, generationId: null, mode: 'unavailable', content: '', message: '生成服务暂不可用；可以阅读课件并手写保存草稿。' } }))
      .mockResolvedValueOnce(jsonResponse(prepCatalog()));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('教学要求'), { target: { value: prepGenerated.instruction } });
    fireEvent.change(screen.getByLabelText('草稿标题'), { target: { value: '尚未保存的思路' } });
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '保留教师当前编写内容。' } });
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    expect(await screen.findByText(/生成服务暂不可用；/)).toBeInTheDocument();
    expect(screen.getByLabelText('草稿正文')).toHaveValue('保留教师当前编写内容。');
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '智能问答' }));
    await openTeacherPrep();
    expect(screen.getByLabelText('草稿正文')).toHaveValue('保留教师当前编写内容。');
    expect(screen.getByLabelText('草稿标题')).toHaveValue('尚未保存的思路');
  });

  it('requires anonymized assignment confirmation and sends review input without assigning a grade', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog()))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...prepGenerated, kind: 'review', content: '建议学生补充晶振频率与误差计算过程。' } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('备课任务'), { target: { value: 'review' } });
    fireEvent.change(screen.getByLabelText('教学要求'), { target: { value: '检查计算假设' } });
    fireEvent.change(screen.getByLabelText('作业内容（请先删除姓名、学号等个人信息）'), { target: { value: 'TH1=FDH，未说明晶振。' } });
    expect(screen.getByRole('button', { name: '生成备课草稿' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: '已移除姓名、学号等个人信息' }));
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    await screen.findByText('已生成可编辑草稿，请核对内容后保存。');
    const request = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(request).toMatchObject({ kind: 'review', submission: 'TH1=FDH，未说明晶振。', instruction: '检查计算假设' });
    expect(request).not.toHaveProperty('grade');
    fireEvent.change(screen.getByLabelText('作业内容（请先删除姓名、学号等个人信息）'), { target: { value: '补充了晶振频率。' } });
    expect(screen.getByRole('checkbox', { name: '已移除姓名、学号等个人信息' })).not.toBeChecked();
    expect(screen.getByText('手动编写草稿')).toBeInTheDocument();
  });

  it('reopens a saved snapshot and keeps an unmapped knowledge point available for manual work', async () => {
    useTeacher();
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(true, [prepSnapshot])));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.click(screen.getByRole('button', { name: /串口通信课堂案例 ·?案例设计|串口通信课堂案例案例设计/ }));
    expect(screen.getByLabelText('草稿正文')).toHaveValue(prepSnapshot.content);
    expect(screen.getByText(/已保存草稿 · b123456789ab/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('选择依据'), { target: { value: 'knowledge' } });
    fireEvent.change(screen.getByLabelText('平台单元'), { target: { value: '1' } });
    expect(screen.getByLabelText('课程知识点')).toHaveValue('1');
    expect(screen.getByRole('button', { name: '生成备课草稿' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeEnabled();
    expect(screen.getByText(/此知识点暂无可用于生成的课件正文/)).toBeInTheDocument();
  });

  it('ignores a cancelled generation, permits retry immediately and resets drafts after account changes', async () => {
    useTeacher();
    const pending = deferredResponse();
    let signal: AbortSignal | undefined;
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog()))
      .mockImplementationOnce((_url: RequestInfo | URL, init: RequestInit) => { signal = init.signal as AbortSignal; return pending.promise; })
      .mockResolvedValueOnce(jsonResponse({ success: true, data: prepGenerated }));
    const view = render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('教学要求'), { target: { value: prepGenerated.instruction } });
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    fireEvent.click(screen.getByRole('button', { name: '取消生成' }));
    expect(signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '生成备课草稿' }));
    await screen.findByText('已生成可编辑草稿，请核对内容后保存。');
    await act(async () => { pending.resolve(jsonResponse({ success: true, data: { ...prepGenerated, content: '已经取消的迟到草稿' } })); await pending.promise; });
    expect(screen.getByLabelText('草稿正文')).toHaveValue(prepGenerated.content);
    mockUseAuth.mockReturnValue({ user: { id: 'student-2', username: 'student2', name: '学生乙', email: 'student2@example.com', role: 'STUDENT' }, loading: false } as ReturnType<typeof useAuth>);
    view.rerender(<AiAssistantPageWrapper />);
    expect(screen.queryByRole('tab', { name: '教师备课' })).not.toBeInTheDocument();
    expect(screen.queryByText(prepGenerated.content)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '智能问答助手' })).toBeInTheDocument();
  });

  it('rejects a catalog belonging to a different cookie account and revalidates identity before showing drafts', async () => {
    useTeacher();
    const refreshUser = mockUseAuth.getMockImplementation()!().refreshUser as jest.Mock;
    const catalog = prepCatalog(true, [{ ...prepSnapshot, ownerId: 'teacher-2', title: '另一个账号的备课' }]);
    mockFetch.mockResolvedValueOnce(jsonResponse({ ...catalog, data: { ...catalog.data, ownerId: 'teacher-2' } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    expect(screen.getByRole('alert')).toHaveTextContent('登录账号已变化');
    expect(screen.queryByRole('button', { name: /另一个账号的备课/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('草稿正文')).toHaveValue('');
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeDisabled();
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it.each(['conflict', 'mismatched-receipt'])('clears a stale account editor after a %s and never confirms its save', async (failure) => {
    useTeacher();
    const refreshUser = mockUseAuth.getMockImplementation()!().refreshUser as jest.Mock;
    mockFetch.mockResolvedValueOnce(jsonResponse(prepCatalog(false))).mockResolvedValueOnce(failure === 'conflict'
      ? jsonResponse({ error: '登录账号已变化', code: 'ACCOUNT_CHANGED' }, 409)
      : jsonResponse({ success: true, data: { ...prepSnapshot, ownerId: 'teacher-2', title: '另一账号的草稿' } }));
    render(<AiAssistantPageWrapper />);
    await openTeacherPrep();
    fireEvent.change(screen.getByLabelText('草稿标题'), { target: { value: '旧账号的私有草稿' } });
    fireEvent.change(screen.getByLabelText('草稿正文'), { target: { value: '旧账号的私有正文。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('登录账号已变化');
    expect(screen.getByLabelText('草稿正文')).toHaveValue('');
    expect(screen.getByLabelText('草稿标题')).toHaveValue('');
    expect(screen.queryByText(/已保存草稿 ·/)).not.toBeInTheDocument();
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ expectedUserId: 'teacher-1' });
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });
});
