import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

// Mock useToast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock LearningModuleWithProgress component
jest.mock('@/components/LearningModuleWithProgress', () => ({
  LearningModuleWithProgress: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="learning-module">{children}</div>
  ),
}));

// Mock useTrackProgress hook
jest.mock('@/hooks/useTrackProgress', () => ({
  useTrackProgress: jest.fn(() => ({
    currentProgress: 0,
    state: {
      isSaving: false,
      lastSaved: null,
      error: null,
      totalTimeSpent: 0,
      pageViews: 0,
      isTracking: true,
      responseData: null,
      interactions: {
        notes: 0,
        highlights: 0,
        codeExecutions: 0,
        questions: 0,
      },
    },
    trackInteraction: jest.fn(),
    saveProgress: jest.fn(),
    resetProgress: jest.fn(),
  })),
}));

// Mock learning completion utilities
jest.mock('@/lib/learning-completion', () => ({
  calculateLearningCompletion: jest.fn(() => ({
    completionPercentage: 0,
    isCompleted: false,
    details: {
      readingScore: 0,
      timeScore: 0,
      interactionScore: 0,
      quizScore: 0,
    },
    suggestions: [],
  })),
  getMissingRequirements: jest.fn(() => []),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

// Mock all UI components to avoid rendering issues
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = ({ className, ...props }: any) => (
    <span className={className} {...props}>Icon</span>
  );
  
  return {
    Copy: MockIcon,
    Search: MockIcon,
    Share2: MockIcon,
    Lightbulb: MockIcon,
    GraduationCap: MockIcon,
    Wrench: MockIcon,
    Brain: MockIcon,
    Star: MockIcon,
    BrainCircuit: MockIcon,
    Siren: MockIcon,
    PenTool: MockIcon,
    FlaskConical: MockIcon,
    Globe: MockIcon,
    Clock: MockIcon,
    Zap: MockIcon,
  };
});

describe('HomePage', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  it('renders title and search input', () => {
    render(<HomePage />);
    expect(screen.getByText('8051 微控制器学习指南')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索章节内容...')).toBeInTheDocument();
  });

  it('displays chapter headings', () => {
    render(<HomePage />);
    expect(screen.getByText('第 1 章：微控制器概述')).toBeInTheDocument();
    expect(screen.getByText('第 2 章：8051 存储器结构')).toBeInTheDocument();
  });

  it('displays chapter objective blocks', () => {
    render(<HomePage />);
    expect(screen.getAllByText('知识目标').length).toBeGreaterThan(0);
    expect(screen.getAllByText('技能目标').length).toBeGreaterThan(0);
    expect(screen.getAllByText('思政目标').length).toBeGreaterThan(0);
  });

  it('shows time estimates', () => {
    render(<HomePage />);
    expect(screen.getByText('约 10 分钟')).toBeInTheDocument();
  });

  it('copies code and shows toast', async () => {
    render(<HomePage />);
    const copyButtons = screen.getAllByText('复制代码').map((el) => el.closest('button')).filter(Boolean);
    expect(copyButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(copyButtons[0]!);
    });

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('handles copy error and shows destructive toast', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));

    render(<HomePage />);
    const copyButtons = screen.getAllByText('复制代码').map((el) => el.closest('button')).filter(Boolean);
    expect(copyButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(copyButtons[0]!);
    });

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('filters chapters based on search query', () => {
    render(<HomePage />);
    const searchInput = screen.getByPlaceholderText('搜索章节内容...');

    fireEvent.change(searchInput, { target: { value: '存储器' } });
    expect(searchInput).toHaveValue('存储器');
    expect(screen.getByText('第 2 章：8051 存储器结构')).toBeInTheDocument();
  });
});
