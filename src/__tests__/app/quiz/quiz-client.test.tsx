import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { QuizClient } from '@/app/quiz/quiz-client';
import { quizQuestions } from '@/lib/quiz-data';

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn()
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
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
  const Ctx = React.createContext({ onValueChange: (_v: string) => {}, value: '' });

  const RadioGroup = ({ children, onValueChange, value, ...props }: any) => (
    <Ctx.Provider value={{ onValueChange: onValueChange || (() => {}), value: value || '' }}>
      <div data-testid="radio-group" {...props}>{children}</div>
    </Ctx.Provider>
  );

  const RadioGroupItem = ({ value, id, ...props }: any) => {
    const ctx = React.useContext(Ctx);
    return (
      <input
        id={id}
        type="radio"
        value={value}
        checked={ctx.value === value}
        onChange={() => ctx.onValueChange(value)}
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
    CheckCircle: Icon,
    XCircle: Icon,
    BarChart4: Icon,
    Target: Icon,
    BookCopy: Icon,
    GitBranch: Icon,
    ChevronsRight: Icon,
    ChevronsLeft: Icon,
    RotateCcw: Icon,
    Loader2: Icon,
    Lightbulb: Icon,
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast } as any);
    mockUseRouter.mockReturnValue({ push: mockPush } as any);
    mockLocalStorage.getItem.mockReturnValue(null);
    jest.spyOn(Math, 'random').mockReturnValue(0.9); // 保证 shuffle 后题目顺序稳定
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    } as Response);
  });

  afterEach(() => {
    const restore = (Math.random as any).mockRestore;
    if (typeof restore === 'function') restore.call(Math.random);
  });

  const mockUser = {
    id: 'user123',
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    role: 'STUDENT' as const
  };

  it.skip('should render loading state initially', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    expect(screen.getByText('正在准备题目...')).toBeInTheDocument();
  });

  it('should render first question after loading', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Should show one of the questions (order is shuffled)
    expect(
      screen.getByText('What is 2 + 2?') || screen.getByText('Complete the function')
    ).toBeInTheDocument();
  });

  it('should handle multiple choice question selection', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Find and click on an option (assuming first question is multiple choice)
    const option = screen.getByText('4');
    if (option) {
      fireEvent.click(option);
      
      // Check answer button should be enabled
      const checkButton = screen.getByText('核对答案');
      expect(checkButton).not.toBeDisabled();
      
      // Click check answer
      fireEvent.click(checkButton);
      
      // Should show result
      await waitFor(() => {
        expect(screen.getByText('回答正确！') || screen.getByText('回答错误')).toBeInTheDocument();
      });
    }
  });

  it('should handle code completion question', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // 进入第 2 题（代码补全题）
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByText('核对答案'));
    await waitFor(() => expect(screen.getByText('下一题')).toBeInTheDocument());
    fireEvent.click(screen.getByText('下一题'));
    await waitFor(() => expect(screen.getByText('第 2 / 2 题')).toBeInTheDocument());

    // Look for code input field
    const codeInput = screen.getByPlaceholderText('在此处输入代码...');
    if (codeInput) {
      fireEvent.change(codeInput, { target: { value: 'a + b' } });
      
      // Check answer
      const checkButton = screen.getByText('核对答案');
      fireEvent.click(checkButton);
      
      await waitFor(() => {
        expect(screen.getByText('回答正确！') || screen.getByText('回答错误')).toBeInTheDocument();
      });
    }
  });

  it('should navigate between questions', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Answer first question
    const option = screen.getByText('4');
    if (option) {
      fireEvent.click(option);
      fireEvent.click(screen.getByText('核对答案'));
      
      await waitFor(() => {
        expect(screen.getByText('下一题')).toBeInTheDocument();
      });
      
      // Go to next question
      fireEvent.click(screen.getByText('下一题'));
      
      await waitFor(() => {
        expect(screen.getByText('第 2 / 2 题')).toBeInTheDocument();
      });
      
      // Previous button should work
      fireEvent.click(screen.getByText('上一题'));
      
      await waitFor(() => {
        expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
      });
    }
  });

  it('should submit quiz and show results', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    mockLocalStorage.getItem.mockReturnValue('mock-access-token');

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Answer a question
    fireEvent.click(screen.getByRole('radio', { name: '4' }));

    // Submit quiz
    fireEvent.click(screen.getByText('完成并查看报告'));
    
    await waitFor(() => {
      expect(screen.getByText('测试完成！')).toBeInTheDocument();
      expect(screen.getByText('这是您的诊断报告。')).toBeInTheDocument();
    });

    // Should show score
    expect(screen.getByText(/您回答了/)).toBeInTheDocument();
    
    // Should show knowledge analysis
    expect(screen.getByText('知识原子掌握度分析')).toBeInTheDocument();
  });

  it('should save quiz results for authenticated user', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    mockLocalStorage.getItem.mockReturnValue('mock-access-token');

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: '4' }));

    // Submit quiz
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/quiz/submit', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-access-token'
        }
      }));
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '测评结果已保存',
        description: '您的测评结果已成功保存到系统中。'
      });
    });
  });

  it('should handle quiz submission error', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    mockLocalStorage.getItem.mockReturnValue('mock-access-token');
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: '4' }));

    // Submit quiz
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '保存失败',
        description: '测评结果保存失败，但您可以继续查看结果。',
        variant: 'destructive'
      });
    });
  });

  it('should restart quiz', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: '4' }));

    // Submit to get to results
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => {
      expect(screen.getByText('测试完成！')).toBeInTheDocument();
    });

    // Restart quiz
    fireEvent.click(screen.getByText('再试一次'));

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Should clear localStorage
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-answers');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz-progress');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('assessment-results');
  });

  it('should generate learning plan', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: '4' }));

    // Submit to get to results
    fireEvent.click(screen.getByText('完成并查看报告'));

    await waitFor(() => {
      expect(screen.getByText('测试完成！')).toBeInTheDocument();
    });

    // Generate learning plan (if weak areas exist)
    const generateButton = screen.queryByText('获取个性化学习计划');
    if (generateButton) {
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/learning-path?weakKAs='));
      });
    }
  });

  it('should load saved answers from localStorage', () => {
    const savedAnswers = JSON.stringify({ 1: '4', 2: 'a + b' });
    mockLocalStorage.getItem.mockReturnValue(savedAnswers);
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    // Should use user-specific storage key
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(`quiz-answers-${mockUser.id}`);
  });

  it('should save answers to localStorage', async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Answer a question
    const option = screen.getByText('4');
    if (option) {
      fireEvent.click(option);
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          `quiz-answers-${mockUser.id}`,
          expect.stringContaining('"1":"4"')
        );
      });
    }
  });

  it('should show review links for wrong answers', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false
    });

    render(<QuizClient />);

    await waitFor(() => {
      expect(screen.getByText('第 1 / 2 题')).toBeInTheDocument();
    });

    // Answer incorrectly
    const wrongOption = screen.getByText('3');
    if (wrongOption) {
      fireEvent.click(wrongOption);
      fireEvent.click(screen.getByText('核对答案'));
      
      await waitFor(() => {
        expect(screen.getByText('回答错误')).toBeInTheDocument();
      });
      
      // Should show review link
      expect(screen.getByText(/复习第.*章的相关知识点/)).toBeInTheDocument();
    }
  });
});
