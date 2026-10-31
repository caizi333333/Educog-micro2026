import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuizClient } from '@/app/quiz/quiz-client';

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn()
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});
jest.mock('@/lib/quiz-data', () => ({
  quizQuestions: [
    {
      id: 1,
      type: 'multiple-choice',
      questionText: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: '4',
      ka: 'Math',
      chapter: 1
    },
    {
      id: 2,
      type: 'code-completion',
      questionText: 'Complete the function',
      code: 'function add(a, b) {\n  return ___;\n}',
      correctAnswer: 'a + b',
      ka: 'Programming',
      chapter: 2
    }
  ]
}));
jest.mock('@/hooks/use-achievement-notifications', () => ({
  processAchievementResponse: jest.fn()
}));

// Mock UI components used by QuizClient
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => <div data-testid="progress" data-value={value} {...props} />,
}));

jest.mock('@/components/ui/radio-group', () => {
  const React = require('react');
  const Ctx = React.createContext({ onValueChange: (_v: string) => {}, value: '', disabled: false });

  const RadioGroup = ({ children, onValueChange, value, disabled = false, ...props }: any) => (
    <Ctx.Provider value={{ onValueChange: onValueChange || (() => {}), value: value || '', disabled }}>
      <div data-testid="radio-group" aria-disabled={disabled} {...props}>{children}</div>
    </Ctx.Provider>
  );

  const RadioGroupItem = ({ value, id, disabled, ...props }: any) => {
    const ctx = React.useContext(Ctx);
    return (
      <input
        id={id}
        type="radio"
        value={value}
        checked={ctx.value === value}
        onChange={() => ctx.onValueChange(value)}
        disabled={disabled ?? ctx.disabled}
        {...props}
      />
    );
  };

  return { RadioGroup, RadioGroupItem };
});

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div role="alert" {...props}>{children}</div>,
  AlertTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('lucide-react', () => {
  const Icon = (props: any) => <span {...props}>icon</span>;
  return {
    Activity: Icon,
    ArrowRight: Icon,
    CheckCircle: Icon,
    ChevronDown: Icon,
    XCircle: Icon,
    BarChart4: Icon,
    Target: Icon,
    BookCopy: Icon,
    ClipboardCheck: Icon,
    FileText: Icon,
    GitBranch: Icon,
    ChevronsRight: Icon,
    ChevronsLeft: Icon,
    RotateCcw: Icon,
    Loader2: Icon,
    Lightbulb: Icon,
    ListChecks: Icon,
    TerminalSquare: Icon,
    Timer: Icon,
  };
});

jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockToast = jest.fn();
const mockPush = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('QuizClient', () => {
  const quizEvidence = {
    dataProvenance: { mode: 'DEMO' as const, label: '演示数据', note: '用于测试的数据身份说明' },
    asOf: '2026-08-26T00:00:00.000Z',
    sampleSize: { questions: 2, answered: 2 },
  };
  const publicQuestions = [
    { id: 1, type: 'multiple-choice', questionText: 'What is 2 + 2?', options: ['3', '4', '5', '6'], ka: 'Math', chapter: 1 },
    { id: 2, type: 'code-completion', questionText: 'Complete the function', code: 'return ___;', ka: 'Programming', chapter: 2 },
  ];
  const serverResult = {
    ...quizEvidence,
    success: true,
    ownerId: 'user123',
    attemptId: 'attempt-1',
    quizId: 'comprehensive-assessment',
    score: 100,
    totalQuestions: 1,
    correctAnswers: 1,
    weakAreas: [],
    scoresByKA: { Math: { correct: 1, total: 1, score: 100 } },
    questionResults: { '1': { correct: true, correctAnswer: '4' } },
  };
  const mockUser = { id: 'user123', username: 'testuser', name: 'Test User', email: 'test@example.com', role: 'STUDENT' as const };
  const authValue = (user: typeof mockUser | null) => ({
    user, loading: false, login: jest.fn(), logout: jest.fn(), refreshUser: jest.fn(), isAuthenticated: Boolean(user),
  });

  const answerAllQuestions = async (): Promise<void> => {
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByText('下一题'));
    await screen.findByText('第 2 / 2 题');
    fireEvent.change(screen.getByPlaceholderText('在此处输入代码...'), { target: { value: 'a + b' } });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockUseToast.mockReturnValue({ toast: mockToast } as any);
    mockUseRouter.mockReturnValue({ push: mockPush } as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);
    mockLocalStorage.getItem.mockImplementation((key: string) => key === 'accessToken' ? 'mock-access-token' : null);
    mockLocalStorage.setItem.mockImplementation(() => undefined);
    mockLocalStorage.removeItem.mockImplementation(() => undefined);
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/questions') ? { ...quizEvidence, success: true, data: publicQuestions } : serverResult,
      } as Response);
    });
  });

  afterEach(() => {
    const restore = (Math.random as any).mockRestore;
    if (typeof restore === 'function') restore.call(Math.random);
  });

  it('loads public questions without exposing an immediate answer check', async () => {
    mockUseAuth.mockReturnValue(authValue(null) as any);
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    expect(screen.getByRole('region', { name: '综合测评' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.queryByText('核对答案')).not.toBeInTheDocument();
    expect(screen.getByText(/正确答案将在交卷成功后/)).toBeInTheDocument();
    const mobileQuestionNavigation = screen.getByText('题目导航 · 第 1/2 题').closest('details');
    expect(mobileQuestionNavigation).not.toHaveAttribute('open');
  });

  it('offers the final objective mock from the comprehensive quiz', async () => {
    mockUseAuth.mockReturnValue(authValue(null) as any);
    render(<QuizClient />);
    const entry = await screen.findByRole('link', { name: /期末客观模拟/ });
    expect(entry).toHaveAttribute('href', '/quiz?topic=final-objective');
    expect(screen.getByRole('region', { name: '综合测评' })).toBeInTheDocument();
  });

  it('loads the final objective paper without treating it as a chapter quiz', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams('topic=final-objective') as any);
    render(<QuizClient />);
    expect(await screen.findByRole('heading', { name: '期末客观模拟' })).toBeInTheDocument();
    expect(screen.getByText(/A 为正确、B 为错误/)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/quiz/questions?topic=final-objective',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('rejects an invalid topic link instead of silently opening the comprehensive quiz', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams('topic=unknown') as any);
    render(<QuizClient />);

    expect(await screen.findByText('测评链接中的主题参数无效，请返回任务页重新进入。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回我的任务' })).toHaveAttribute('href', '/tasks');
    expect(screen.queryByRole('button', { name: '重新加载' })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.some(([input]) => String(input).includes('/api/quiz/questions'))).toBe(false);
  });

  it('supports answering and navigating without revealing correctness', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByText('下一题'));
    expect(await screen.findByText('第 2 / 2 题')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('在此处输入代码...'), { target: { value: 'a + b' } });
    fireEvent.click(screen.getByText('上一题'));
    expect(await screen.findByText('第 1 / 2 题')).toBeInTheDocument();
  });

  it('requires login before creating an official report', async () => {
    mockUseAuth.mockReturnValue(authValue(null) as any);
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/login?from=')));
    expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
  });

  it('shows only the server-confirmed report and clears the draft', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));
    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '测试诊断报告' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('知识原子掌握度分析')).toBeInTheDocument();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-answers-user123-comprehensive-assessment-initial');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('quiz-receipt-user123-comprehensive-assessment-initial', expect.any(String));
    const submitCall = mockFetch.mock.calls.find(([input]) => String(input).includes('/api/quiz/submit'));
    expect(JSON.parse(String(submitCall?.[1]?.body)).expectedUserId).toBe(mockUser.id);
    expect(JSON.parse(String(submitCall?.[1]?.body)).questionOrderIds).toEqual([1, 2]);
  });

  describe('课件题解析', () => {
    const source = {
      title: '第6章 微控制器的串行通信技术（课件第33页）',
      page: 33,
      url: '/resources/course/course-slides.pdf#page=33',
    };
    const explanation = '方式1在停止位开始时将TI置1，因此TI置位不代表停止位已经全部发完。';
    const question = {
      id: 346,
      type: 'multiple-choice',
      questionText: '串口方式1发送时，TI在什么时候置1？',
      options: ['停止位开始时', '停止位完全结束后'],
      ka: '7.3.2',
      chapter: 7,
      source,
    };
    const receipt = {
      ...serverResult,
      sampleSize: { questions: 1, answered: 1 },
      score: 0,
      totalQuestions: 1,
      correctAnswers: 0,
      weakAreas: ['7.3.2'],
      scoresByKA: { '7.3.2': { correct: 0, total: 1, score: 0 } },
      questionResults: {
        '346': { correct: false, correctAnswer: '停止位开始时', explanation, source },
      },
    };
    const questionsResponse = {
      ...quizEvidence,
      sampleSize: { questions: 1 },
      success: true,
      data: [question],
    };

    it('提交前及等待回执时隐藏解析，收到有效回执后显示解析与准确PDF页链接', async () => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      let resolveSubmission!: (response: Response) => void;
      const pendingSubmission = new Promise<Response>((resolve) => { resolveSubmission = resolve; });
      mockFetch.mockImplementation((input: string | Request | URL) => {
        if (String(input).includes('/api/quiz/submit')) return pendingSubmission;
        return Promise.resolve({ ok: true, status: 200, json: async () => questionsResponse } as Response);
      });

      render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      expect(screen.queryByText('解析：')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /PDF第33页/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      await waitFor(() => expect(mockFetch.mock.calls.some(([input]) => String(input).includes('/api/quiz/submit'))).toBe(true));
      expect(screen.queryByText(explanation)).not.toBeInTheDocument();
      expect(screen.queryByText('解析：')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /PDF第33页/ })).not.toBeInTheDocument();
      expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();

      await act(async () => {
        resolveSubmission({ ok: true, status: 200, json: async () => receipt } as Response);
      });
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      expect(screen.getByText(explanation)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: `对照${source.title} · PDF第33页` });
      expect(link).toHaveAttribute('href', '/resources/course/course-slides.pdf#page=33');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });

    it('旧题回执没有解析时仍显示正确答案，不生成空解析或课件链接', async () => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      const { source: _source, ...legacyQuestion } = question;
      const legacyReceipt = {
        ...receipt,
        questionResults: { '346': { correct: false, correctAnswer: '停止位开始时' } },
      };
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
        ok: true,
        status: 200,
        json: async () => String(input).includes('/api/quiz/questions')
          ? { ...questionsResponse, data: [legacyQuestion] }
          : legacyReceipt,
      } as Response));

      render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      expect(screen.getByText('停止位开始时')).toBeInTheDocument();
      expect(screen.queryByText('解析：')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /PDF第/ })).not.toBeInTheDocument();
    });

    it.each([false, true])('提交后显示真实网页章节，拒绝错配实验链接：%s', async (mismatch) => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      const guideSource = { kind: 'guide', title: '实验2网页指导', experimentId: 'exp02', section: '8051 寻址方式', url: `/simulation?experiment=${mismatch ? 'exp03' : 'exp02'}&view=guide` };
      const guideReceipt = { ...receipt, questionResults: {
        '346': { ...receipt.questionResults['346'], source: guideSource },
      } };
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
        ok: true, status: 200,
        json: async () => String(input).includes('/api/quiz/questions')
          ? { ...questionsResponse, data: [{ ...question, source: guideSource }] }
          : guideReceipt,
      } as Response));
      render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      expect(screen.queryByRole('link', { name: /对照实验2网页指导/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      if (mismatch) {
        expect(screen.queryByRole('link', { name: /对照实验2网页指导/ })).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole('link', { name: '对照实验2网页指导 · “8051 寻址方式”' }))
          .toHaveAttribute('href', '/simulation?experiment=exp02&view=guide');
      }
      expect(screen.getByText(explanation)).toBeInTheDocument();
    });

    it('回执的链接页码与声明页码不一致时保留解析，但不生成错误出处链接', async () => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      const mismatchedReceipt = {
        ...receipt,
        questionResults: {
          '346': {
            ...receipt.questionResults['346'],
            source: { ...source, url: '/resources/course/course-slides.pdf#page=34' },
          },
        },
      };
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
        ok: true,
        status: 200,
        json: async () => String(input).includes('/api/quiz/questions') ? questionsResponse : mismatchedReceipt,
      } as Response));

      render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      expect(screen.getByText(explanation)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /PDF第/ })).not.toBeInTheDocument();
    });

    it.each(['换卷', '换账号'])('%s后清除旧回执的正确答案标记、解析和报告', async (change) => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
        ok: true,
        status: 200,
        json: async () => String(input).includes('/api/quiz/questions') ? questionsResponse : receipt,
      } as Response));
      const view = render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      expect(screen.getByText(explanation)).toBeInTheDocument();
      expect(screen.getByText('正确答案：')).toBeInTheDocument();

      if (change === '换卷') {
        mockUseSearchParams.mockReturnValue(new URLSearchParams('chapter=7') as any);
      } else {
        mockUseAuth.mockReturnValue(authValue({ ...mockUser, id: 'user456' }) as any);
      }
      view.rerender(<QuizClient />);

      expect(await screen.findByText('第 1 / 1 题')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '停止位开始时' })).toBeEnabled();
      expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
      expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
      expect(screen.queryByText('正确答案：')).not.toBeInTheDocument();
      expect(screen.queryByText('回答正确！')).not.toBeInTheDocument();
      expect(screen.queryByText('回答错误')).not.toBeInTheDocument();
      expect(screen.queryByText(explanation)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /PDF第33页/ })).not.toBeInTheDocument();
    });

    it('旧提交迟到时不覆盖新卷，也不解除新卷正在提交的锁定状态', async () => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      let resolveOldSubmission!: (response: Response) => void;
      let resolveNewSubmission!: (response: Response) => void;
      const oldSubmission = new Promise<Response>((resolve) => { resolveOldSubmission = resolve; });
      const newSubmission = new Promise<Response>((resolve) => { resolveNewSubmission = resolve; });
      mockFetch.mockImplementation((input: string | Request | URL, init?: RequestInit) => {
        if (String(input).includes('/api/quiz/submit')) {
          const body = JSON.parse(String(init?.body));
          return body.quizId === 'comprehensive-assessment' ? oldSubmission : newSubmission;
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => questionsResponse } as Response);
      });
      const view = render(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      fireEvent.click(screen.getByRole('radio', { name: '停止位完全结束后' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      await waitFor(() => expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(1));

      mockUseSearchParams.mockReturnValue(new URLSearchParams('chapter=7') as any);
      view.rerender(<QuizClient />);
      await screen.findByText('第 1 / 1 题');
      await waitFor(() => expect(screen.getByRole('radio', { name: '停止位开始时' })).toBeEnabled());
      fireEvent.click(screen.getByRole('radio', { name: '停止位开始时' }));
      fireEvent.click(screen.getByText('完成并查看报告'));
      await waitFor(() => expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(2));

      await act(async () => {
        resolveOldSubmission({ ok: true, status: 200, json: async () => receipt } as Response);
      });
      expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
      expect(screen.queryByText(explanation)).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '停止位开始时' })).toBeChecked();
      expect(screen.getByRole('radio', { name: '停止位开始时' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /正在核对原交卷/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /正在核对原交卷/ })).toHaveAttribute('aria-busy', 'true');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
        'quiz-receipt-user123-comprehensive-assessment-initial', expect.any(String),
      );
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('quiz-pending-user123-quiz-ch7-initial');

      await act(async () => {
        resolveNewSubmission({ ok: true, status: 200, json: async () => ({
          ...receipt,
          attemptId: 'chapter7-attempt',
          quizId: 'quiz-ch7',
          score: 100,
          correctAnswers: 1,
          weakAreas: [],
          scoresByKA: { '7.3.2': { correct: 1, total: 1, score: 100 } },
          questionResults: { '346': { correct: true, correctAnswer: '停止位开始时', explanation, source } },
        }) } as Response);
      });
      expect(await screen.findByText('测试完成！')).toBeInTheDocument();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'quiz-receipt-user123-quiz-ch7-initial', expect.stringContaining('chapter7-attempt'),
      );
    });
  });

  it('opens the server-backed learning path without embedding weak areas in the URL', async () => {
    const weakResult = {
      ...serverResult,
      score: 50,
      weakAreas: ['Math'],
      scoresByKA: { Math: { correct: 0, total: 1, score: 0 } },
      questionResults: { '1': { correct: false, correctAnswer: '4' } },
    };
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/questions')
          ? { ...quizEvidence, success: true, data: publicQuestions }
          : weakResult,
      } as Response);
    });

    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));
    expect(await screen.findByText('测试完成！')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /生成补学路径/ })[0]);
    expect(mockPush).toHaveBeenCalledWith('/learning-path?quizId=comprehensive-assessment&mode=initial');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('weakKAs='));
  });

  it('allows a session-only login to submit an official report', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockLocalStorage.getItem.mockReturnValue(null);
    window.sessionStorage.setItem('accessToken', 'session-access-token');
    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));

    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    const submitCall = mockFetch.mock.calls.find(([input]) => String(input).includes('/api/quiz/submit'));
    expect(submitCall?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session-access-token' }),
    }));
  });

  it('keeps the server-confirmed result when local receipt storage is unavailable', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockLocalStorage.setItem.mockImplementation((key: string) => {
      if (key === 'quiz-receipt-user123-comprehensive-assessment-initial') throw new Error('quota exceeded');
    });
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));

    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '测评结果已保存' }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: '交卷未完成' }));
  });

  it('suppresses a rapid duplicate submit before React disables the button', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    await answerAllQuestions();
    const submitButton = screen.getByText('完成并查看报告');
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(1);
  });

  it('keeps the draft, withholds the report, and locks the frozen answers when submission fails', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      if (url.includes('/api/quiz/submit')) return Promise.reject(new Error('Network error'));
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response);
    });
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument());
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '交卷未完成' })));
    expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
    expect(screen.getByText(/原交卷结果尚待确认/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('在此处输入代码...')).toBeDisabled();
    fireEvent.click(screen.getByText('上一题'));
    expect(await screen.findByText('第 1 / 2 题')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新核对原交卷' })).toBeEnabled();
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('quiz-answers-user123-comprehensive-assessment-initial');
    expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'quiz-pending-user123-comprehensive-assessment-initial',
      expect.stringContaining('"attemptId"'),
    );
  });

  it('times out a stalled JSON body after successful headers and preserves answers for retry', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const submittedBodies: string[] = [];
    const submitSignals: AbortSignal[] = [];
    const readStalledJson = jest.fn((signal: AbortSignal) => new Promise<unknown>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Body read aborted', 'AbortError')), { once: true });
    }));
    mockFetch.mockImplementation((input: string | Request | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/quiz/questions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response);
      }
      if (url.includes('/api/quiz/submit') && init?.signal) {
        const signal = init.signal;
        submittedBodies.push(String(init.body));
        submitSignals.push(signal);
        // Headers arrive immediately; only reading the response body stalls.
        return Promise.resolve({ ok: true, status: 200, json: () => readStalledJson(signal) } as Response);
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();

    jest.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('完成并查看报告'));
      await act(async () => { await jest.advanceTimersByTimeAsync(20_000); });
      expect(submittedBodies).toHaveLength(2);
      expect(submitSignals[0].aborted).toBe(true);
      expect(submitSignals[1].aborted).toBe(false);

      await act(async () => { await jest.advanceTimersByTimeAsync(20_000); });
      expect(readStalledJson).toHaveBeenCalledTimes(2);
      expect(submitSignals.every((signal) => signal.aborted)).toBe(true);
      expect(submittedBodies).toHaveLength(2);
      expect(submittedBodies[1]).toBe(submittedBodies[0]);
      expect(JSON.parse(submittedBodies[0]).answers).toEqual({ '1': '4', '2': 'a + b' });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '交卷未完成' }));
      expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重新核对原交卷' })).toBeEnabled();
      expect(screen.getByPlaceholderText('在此处输入代码...')).toHaveValue('a + b');
      fireEvent.click(screen.getByText('上一题'));
      expect(screen.getByRole('radio', { name: '4' })).toBeChecked();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('quiz-answers-user123-comprehensive-assessment-initial');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('quiz-pending-user123-comprehensive-assessment-initial');
    } finally {
      jest.useRealTimers();
    }
  });

  it('replays the exact same submission once after an ambiguous network result', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const submittedBodies: string[] = [];
    mockFetch.mockImplementation((input: string | Request | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/quiz/questions')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response);
      }
      if (url.includes('/api/quiz/submit')) {
        submittedBodies.push(String(init?.body));
        if (submittedBodies.length === 1) return Promise.reject(new TypeError('response lost'));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...serverResult, duplicate: true }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));

    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    expect(submittedBodies).toHaveLength(2);
    expect(submittedBodies[1]).toBe(submittedBodies[0]);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已恢复原提交结果' }));
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-pending-user123-comprehensive-assessment-initial');
  });

  it('does not accept a successful response for a different quiz', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/questions')
          ? { ...quizEvidence, success: true, data: publicQuestions }
          : { ...serverResult, quizId: 'quiz-ch3-addressing' },
      } as Response);
    });
    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '交卷未完成' })));
    expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(2);
  });

  it('rejects another user\'s submission receipt and does not save it under the current account', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => String(input).includes('/api/quiz/questions')
        ? { ...quizEvidence, success: true, data: publicQuestions }
        : { ...serverResult, ownerId: 'another-user' },
    } as Response));

    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    await answerAllQuestions();
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '交卷未完成' })));
    expect(screen.queryByText('测试完成！')).not.toBeInTheDocument();
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(
      'quiz-receipt-user123-comprehensive-assessment-initial', expect.any(String),
    );
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('assessment-results-user123', expect.any(String));
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('quiz-answers-user123-comprehensive-assessment-initial');
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/login?from='));
  });

  it('restores an unconfirmed submission after refresh and retries its stored body unchanged', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const pendingBody = JSON.stringify({
      quizId: 'comprehensive-assessment',
      expectedUserId: mockUser.id,
      assessmentMode: 'initial',
      attemptId: 'attempt_pending_001',
      score: 0,
      totalQuestions: 2,
      correctAnswers: 0,
      timeSpent: 30,
      answers: { '1': '4', '2': 'a + b' },
    });
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === 'quiz-pending-user123-comprehensive-assessment-initial') {
        return JSON.stringify({
          attemptId: 'attempt_pending_001',
          quizId: 'comprehensive-assessment',
          assessmentMode: 'initial',
          pathId: null,
          body: pendingBody,
          createdAt: new Date().toISOString(),
        });
      }
      return null;
    });
    render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    expect(await screen.findByRole('button', { name: '重新核对原交卷' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: '4' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '重新核对原交卷' }));

    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    const submitCall = mockFetch.mock.calls.find(([input]) => String(input).includes('/api/quiz/submit'));
    expect(submitCall?.[1]?.body).toBe(pendingBody);
  });

  it('restores saved answers using the user-specific key', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === 'quiz-answers-user123-comprehensive-assessment-initial') return JSON.stringify({ 1: '4' });
      return null;
    });
    render(<QuizClient />);
    await waitFor(() => expect(screen.getByRole('radio', { name: '4' })).toBeChecked());
  });

  it('persists direct question navigation and restores the current question after remount', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const storage = new Map<string, string>([['accessToken', 'mock-access-token']]);
    mockLocalStorage.getItem.mockImplementation((key: string) => storage.get(key) ?? null);
    mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    mockLocalStorage.removeItem.mockImplementation((key: string) => {
      storage.delete(key);
    });

    const firstRender = render(<QuizClient />);
    await screen.findByText('第 1 / 2 题');
    fireEvent.click(screen.getByRole('button', { name: '第 2 题' }));
    expect(await screen.findByText('第 2 / 2 题')).toBeInTheDocument();
    expect(JSON.parse(storage.get('quiz-progress-user123-comprehensive-assessment-initial') ?? '{}')).toMatchObject({
      currentQuestionIndex: 1,
      questionOrderIds: [1, 2],
    });

    firstRender.unmount();
    render(<QuizClient />);

    expect(await screen.findByText('第 2 / 2 题')).toBeInTheDocument();
  });

  it('migrates an anonymous draft after login instead of losing the saved answers', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === 'quiz-answers-comprehensive-assessment-initial') return JSON.stringify({ 1: '4' });
      if (key === 'quiz-progress-comprehensive-assessment-initial') {
        return JSON.stringify({ currentQuestionIndex: 0, questionOrderIds: [1, 2], timestamp: new Date().toISOString() });
      }
      return null;
    });

    render(<QuizClient />);

    await waitFor(() => expect(screen.getByRole('radio', { name: '4' })).toBeChecked());
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'quiz-answers-user123-comprehensive-assessment-initial',
      JSON.stringify({ 1: '4' }),
    );
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'quiz-progress-user123-comprehensive-assessment-initial',
      expect.stringContaining('questionOrderIds'),
    );
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-answers-comprehensive-assessment-initial');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-progress-comprehensive-assessment-initial');
  });

  it('carries the task path into remediation after an initial addressing submission with no weak nodes', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams(
      'topic=addressing-modes&taskPathId=path-1&taskStepId=addressing-pre-quiz',
    ) as any);
    const addressingQuestion = {
      id: 4,
      type: 'multiple-choice',
      questionText: '直接寻址使用什么？',
      options: ['直接地址', '立即数'],
      ka: '3.1.1',
      chapter: 3,
    };
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/questions')
          ? { ...quizEvidence, sampleSize: { questions: 1 }, success: true, data: [addressingQuestion] }
          : {
            ...serverResult,
            quizId: 'quiz-ch3-addressing',
            weakAreas: [],
            scoresByKA: { '3.1.1': { correct: 1, total: 1, score: 100 } },
            questionResults: { '4': { correct: true, correctAnswer: '直接地址' } },
          },
      } as Response);
    });

    render(<QuizClient />);
    await screen.findByText('第 1 / 1 题');
    fireEvent.click(screen.getByRole('radio', { name: '直接地址' }));
    fireEvent.click(screen.getByText('完成并查看报告'));

    expect(await screen.findByText('测试完成！')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /确认本次诊断并继续/ })).toHaveAttribute(
      'href',
      '/weak-nodes?quizId=quiz-ch3-addressing&mode=initial&pathId=path-1&taskPathId=path-1&taskStepId=addressing-remediation',
    );
  });

  it('restores the same task-scoped remediation entry after refreshing a submitted addressing quiz', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams(
      'topic=addressing-modes&taskPathId=path-1&taskStepId=addressing-pre-quiz',
    ) as any);
    const receiptKey = 'quiz-receipt-user123-quiz-ch3-addressing-initial-task-path-1';
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === receiptKey) {
        return JSON.stringify({
          ...serverResult,
          quizId: 'quiz-ch3-addressing',
          weakAreas: [],
          scoresByKA: { '3.1.1': { correct: 1, total: 1, score: 100 } },
          questionResults: { '4': { correct: true, correctAnswer: '直接地址' } },
        });
      }
      return null;
    });
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/history?attemptId=attempt-1')
          ? {
            ...quizEvidence,
            success: true,
            receipt: {
              ...serverResult,
              quizId: 'quiz-ch3-addressing',
              assessmentMode: 'initial',
              pathId: 'path-1',
              weakAreas: [],
              scoresByKA: { '3.1.1': { correct: 1, total: 1, score: 100 } },
              questionResults: { '4': { correct: true, correctAnswer: '直接地址' } },
            },
          }
          : {
            ...quizEvidence,
            sampleSize: { questions: 1 },
            success: true,
            data: [{
              id: 4,
              type: 'multiple-choice',
              questionText: '直接寻址使用什么？',
              options: ['直接地址', '立即数'],
              ka: '3.1.1',
              chapter: 3,
            }],
          },
      } as Response);
    });

    render(<QuizClient />);

    expect(await screen.findByText('本次测评已经提交')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '确认本次诊断并继续' })).toHaveAttribute(
      'href',
      '/weak-nodes?quizId=quiz-ch3-addressing&mode=initial&pathId=path-1&taskPathId=path-1&taskStepId=addressing-remediation',
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/quiz/history?attemptId=attempt-1&expectedUserId=user123',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('discards a stale local receipt when the server has no matching attempt', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const receiptKey = 'quiz-receipt-user123-comprehensive-assessment-initial';
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === receiptKey) return JSON.stringify(serverResult);
      return null;
    });
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      if (url.includes('/api/quiz/history?attemptId=attempt-1')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: '测评回执不存在' }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response);
    });

    render(<QuizClient />);

    expect(await screen.findByText('第 1 / 2 题')).toBeInTheDocument();
    expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(receiptKey);
  });

  it('discards a server receipt whose task path does not match the current quiz session', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const receiptKey = 'quiz-receipt-user123-comprehensive-assessment-initial';
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === receiptKey) return JSON.stringify(serverResult);
      return null;
    });
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => url.includes('/api/quiz/history?attemptId=attempt-1')
          ? { ...quizEvidence, success: true, receipt: { ...serverResult, assessmentMode: 'initial', pathId: 'another-task' } }
          : { ...quizEvidence, success: true, data: publicQuestions },
      } as Response);
    });

    render(<QuizClient />);

    expect(await screen.findByText('第 1 / 2 题')).toBeInTheDocument();
    expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(receiptKey);
  });

  it('does not restore a history receipt owned by another account after token state changes', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const receiptKey = 'quiz-receipt-user123-comprehensive-assessment-initial';
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'token-from-another-tab';
      if (key === receiptKey) return JSON.stringify(serverResult);
      return null;
    });
    mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => String(input).includes('/api/quiz/history?attemptId=attempt-1')
        ? {
          ...quizEvidence,
          success: true,
          receipt: { ...serverResult, ownerId: 'another-user', assessmentMode: 'initial', pathId: null },
        }
        : { ...quizEvidence, success: true, data: publicQuestions },
    } as Response));

    render(<QuizClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent('登录账号已变更');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/quiz/history?attemptId=attempt-1&expectedUserId=user123',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-from-another-tab' } }),
    );
    expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
    expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith(receiptKey, expect.stringContaining('another-user'));
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith(receiptKey);
  });

  it('withholds the submitted state when receipt verification is temporarily unavailable', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const receiptKey = 'quiz-receipt-user123-comprehensive-assessment-initial';
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'mock-access-token';
      if (key === receiptKey) return JSON.stringify(serverResult);
      return null;
    });
    mockFetch.mockImplementation((input: string | Request | URL) => {
      const url = String(input);
      if (url.includes('/api/quiz/history?attemptId=attempt-1')) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: '服务暂不可用' }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response);
    });

    render(<QuizClient />);

    expect(await screen.findByRole('alert')).toHaveTextContent('服务暂不可用');
    expect(screen.getByRole('button', { name: '重新核对' })).toBeInTheDocument();
    expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith(receiptKey);
  });

  describe('已提交回执只读回看', () => {
    const receiptKey = 'quiz-receipt-user123-comprehensive-assessment-initial';
    const reviewReceipt = {
      ...serverResult,
      attemptId: 'attempt-review-001',
      assessmentMode: 'initial',
      pathId: null,
      score: 50,
      totalQuestions: 2,
      correctAnswers: 1,
      questionResults: {
        '1': { correct: false, correctAnswer: '4', explanation: '原回执解析：两数相加等于四。' },
        '2': { correct: true, correctAnswer: 'a + b' },
      },
      review: {
        order: 'recorded',
        questions: [
          { id: 2, question: publicQuestions[1], questionSource: 'snapshot', selectedAnswer: 'a + b' },
          { id: 1, question: publicQuestions[0], questionSource: 'snapshot', selectedAnswer: '3' },
        ],
      },
    };
    const historyResponse = (receipt: unknown): Response => ({
      ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, receipt }),
    } as Response);
    const installReceipt = (receipt: unknown = reviewReceipt): void => {
      mockUseAuth.mockReturnValue(authValue(mockUser) as any);
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve(
        String(input).includes('/api/quiz/history')
          ? historyResponse(receipt)
          : { ok: true, status: 200, json: async () => ({ ...quizEvidence, success: true, data: publicQuestions }) } as Response,
      ));
    };
    const expectNoSubmission = (): void => {
      expect(mockFetch.mock.calls.filter(([input]) => String(input).includes('/api/quiz/submit'))).toHaveLength(0);
      expect(screen.queryByText('完成并查看报告')).not.toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    };

    it('显式回执入口按已保存题序显示原选择和判分，刷新后重新鉴权回看', async () => {
      installReceipt();
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      const first = render(<QuizClient />);
      await screen.findByRole('heading', { name: '本次作答与错题回看' });
      expect(screen.getByText('原回执共 2 题，答对 1 题。')).toBeInTheDocument();
      const cards = screen.getAllByRole('article');
      expect(within(cards[0]!).getByRole('heading')).toHaveTextContent('原第 1 题（题号 2）');
      expect(within(cards[1]!).getByRole('heading')).toHaveTextContent('原第 2 题（题号 1）');
      expect(within(cards[1]!).getByText('原判分：未答对')).toBeInTheDocument();
      expect(screen.getByText('原回执解析：两数相加等于四。')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '只看错题（1）' }));
      expect(screen.getAllByRole('article')).toHaveLength(1);
      expect(screen.getByRole('heading', { name: '原第 2 题（题号 1）' })).toBeInTheDocument();
      expectNoSubmission();
      expect(mockFetch).toHaveBeenCalledWith('/api/quiz/history?attemptId=attempt-review-001&expectedUserId=user123', expect.objectContaining({ cache: 'no-store' }));
      expect(mockFetch.mock.calls.every(([input]) => String(input).includes('/api/quiz/history'))).toBe(true);
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      first.unmount();
      render(<QuizClient />);
      await screen.findByRole('heading', { name: '本次作答与错题回看' });
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expect(mockFetch.mock.calls).toHaveLength(2);
      expectNoSubmission();
    });

    it('摘要入口只使用重新核对的服务端详情，不信任缓存答案或当前草稿', async () => {
      installReceipt();
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return 'mock-access-token';
        if (key === receiptKey) return JSON.stringify({ ...reviewReceipt, questionResults: { '1': { correct: true, correctAnswer: '伪造正确答案' } } });
        if (key.includes('quiz-answers')) return JSON.stringify({ '1': '缓存草稿答案' });
        return null;
      });
      render(<QuizClient />);
      await screen.findByText('本次测评已经提交');
      expect(screen.queryByText('原回执解析：两数相加等于四。')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '查看本次作答与错题' }));
      expect(screen.getByText('原回执解析：两数相加等于四。')).toBeInTheDocument();
      expect(screen.queryByText('伪造正确答案')).not.toBeInTheDocument();
      expect(screen.queryByText('缓存草稿答案')).not.toBeInTheDocument();
      expectNoSubmission();
    });

    it('旧回执按题号排列并区分原选择未保存、未作答和题干不可用', async () => {
      installReceipt({ ...reviewReceipt, totalQuestions: 3, review: {
        order: 'unavailable', questions: [
          { id: 2, question: publicQuestions[1], questionSource: 'current-bank', selectedAnswer: '' },
          { id: 1, question: publicQuestions[0], questionSource: 'current-bank', selectedAnswer: null },
          { id: 3, question: null, questionSource: 'unavailable', selectedAnswer: '旧题原选择' },
        ],
      }, questionResults: { ...reviewReceipt.questionResults, '3': { correct: false, correctAnswer: '旧题正确答案' } } });
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      render(<QuizClient />);
      await screen.findByText('原作答题序未保存，以下按题号排列。');
      const cards = screen.getAllByRole('article');
      expect(cards).toHaveLength(3);
      expect(within(cards[0]!).getByRole('heading')).toHaveTextContent('题号 1');
      expect(within(cards[0]!).getByText('原选择未保存')).toBeInTheDocument();
      expect(within(cards[1]!).getByText('未作答')).toBeInTheDocument();
      expect(within(cards[2]!).getByText('旧题原选择')).toBeInTheDocument();
      expect(within(cards[2]!).getByText('旧题正确答案')).toBeInTheDocument();
      expect(screen.getByText('原回执共 3 题，答对 1 题。')).toBeInTheDocument();
      expect(screen.getAllByText('题干与选项：按当前题库回看')).toHaveLength(2);
      expect(screen.queryByText(/原第 1 题/)).not.toBeInTheDocument();
      expectNoSubmission();
    });

    it('课程补充说明与原回执解析分开标注，不冒充旧回执内容', async () => {
      installReceipt({ ...reviewReceipt, review: { ...reviewReceipt.review, questions: reviewReceipt.review.questions.map((item) => ({
        ...item, supplement: {
          explanation: item.id === 2 ? '当前课程补充：立即寻址直接给出操作数。' : '不应覆盖原有解析',
          source: { kind: 'guide', title: '实验二 指令系统与寻址方式', experimentId: 'exp02', section: '8051 寻址方式', url: '/simulation?experiment=exp02&view=guide' },
        },
      })) } });
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      render(<QuizClient />);
      await screen.findByRole('heading', { name: '本次作答与错题回看' });
      expect(screen.getAllByRole('heading', { name: '当前课程补充说明（原回执未保存解析）' })).toHaveLength(1);
      expect(screen.getByText('当前课程补充：立即寻址直接给出操作数。')).toBeInTheDocument();
      expect(screen.getByText('原回执解析：两数相加等于四。')).toBeInTheDocument();
      expect(screen.queryByText('不应覆盖原有解析')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /对照实验二 指令系统与寻址方式/ })).toHaveAttribute('href', '/simulation?experiment=exp02&view=guide');
      expectNoSubmission();
    });

    it('没有 review 的旧回执保留原摘要并明确详情不足', async () => {
      const { review: _review, ...legacyReceipt } = reviewReceipt;
      installReceipt(legacyReceipt);
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      render(<QuizClient />);
      await screen.findByText('本次测评已经提交');
      expect(screen.getByText('本次回执的作答详情不足，暂时只能查看原成绩摘要。')).toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expectNoSubmission();
    });

    it.each([
      ['其他回执', { ...reviewReceipt, attemptId: 'different-attempt' }],
      ['其他测评', { ...reviewReceipt, quizId: 'quiz-ch1' }],
      ['其他阶段', { ...reviewReceipt, assessmentMode: 'retest' }],
      ['其他任务', { ...reviewReceipt, pathId: 'different-task' }],
    ])('显式回看拒绝%s且不回退为可交卷页面', async (_label, receipt) => {
      installReceipt(receipt);
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      render(<QuizClient />);
      expect(await screen.findByRole('alert')).toHaveTextContent('本次回执与链接中的测评或任务不一致');
      expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
      expectNoSubmission();
    });

    it('找不到显式回执时保留只读错误状态', async () => {
      installReceipt();
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'not found' }) } as Response);
      render(<QuizClient />);
      expect(await screen.findByRole('alert')).toHaveTextContent('未找到本人账号下的这次测评回执');
      expectNoSubmission();
    });

    it('当前题库暂不可用时仍能独立显示已核对的历史回执', async () => {
      installReceipt();
      mockLocalStorage.getItem.mockImplementation((key: string) => key === 'accessToken' ? 'mock-access-token' : key === receiptKey ? JSON.stringify(reviewReceipt) : null);
      mockFetch.mockImplementation((input: string | Request | URL) => Promise.resolve(
        String(input).includes('/api/quiz/history') ? historyResponse(reviewReceipt) : { ok: false, status: 503, json: async () => ({ error: '题库暂不可用' }) } as Response,
      ));
      render(<QuizClient />);
      await screen.findByText('本次测评已经提交');
      fireEvent.click(screen.getByRole('button', { name: '查看本次作答与错题' }));
      expect(screen.getAllByRole('article')).toHaveLength(2);
      expectNoSubmission();
    });

    it('未登录的显式回看要求本人登录，保留原回看链接且不请求题目或提交', async () => {
      installReceipt();
      mockUseAuth.mockReturnValue(authValue(null) as any);
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      render(<QuizClient />);
      expect(await screen.findByRole('alert')).toHaveTextContent('请先登录本人账号');
      expect(screen.getByRole('link', { name: '登录本人账号' })).toHaveAttribute('href', '/login?from=%2Fquiz%3FattemptId%3Dattempt-review-001');
      expect(mockFetch).not.toHaveBeenCalled();
      expectNoSubmission();
    });

    it('切换账号后忽略旧账号尚未返回的历史详情', async () => {
      installReceipt();
      mockUseSearchParams.mockReturnValue(new URLSearchParams('attemptId=attempt-review-001') as any);
      let resolveOld!: (response: Response) => void;
      mockFetch.mockImplementation((input: string | Request | URL) => {
        if (String(input).includes('expectedUserId=user123')) return new Promise<Response>((resolve) => { resolveOld = resolve; });
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'not found' }) } as Response);
      });
      const view = render(<QuizClient />);
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      mockUseAuth.mockReturnValue(authValue({ ...mockUser, id: 'other-user' }) as any);
      view.rerender(<QuizClient />);
      await screen.findByRole('alert');
      await act(async () => { resolveOld(historyResponse(reviewReceipt)); });
      expect(screen.queryByText('本次测评已经提交')).not.toBeInTheDocument();
      expect(screen.queryByText('原回执解析：两数相加等于四。')).not.toBeInTheDocument();
      expectNoSubmission();
    });
  });

});
