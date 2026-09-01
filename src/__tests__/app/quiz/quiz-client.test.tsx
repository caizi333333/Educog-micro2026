import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(mockPush).toHaveBeenCalledWith('/learning-path');
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

  it('restores an unconfirmed submission after refresh and retries its stored body unchanged', async () => {
    mockUseAuth.mockReturnValue(authValue(mockUser) as any);
    const pendingBody = JSON.stringify({
      quizId: 'comprehensive-assessment',
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
      '/api/quiz/history?attemptId=attempt-1',
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
});
