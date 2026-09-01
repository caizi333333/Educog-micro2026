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

describe('AI assistant atomic actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      jest.advanceTimersByTime(20_000);
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
    expect(screen.getByLabelText('回答来源：本地回退')).toHaveTextContent('未形成生成式回答');
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
});
