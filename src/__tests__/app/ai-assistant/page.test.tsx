import React from 'react';
import { render, screen } from '@testing-library/react';
import AiAssistantPage from '@/app/ai-assistant/page';

const mockUseAuth = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/components/AIAssistant', () => function MockAiAssistant() {
  return <div>AI assistant workspace</div>;
});

jest.mock('next/link', () => function MockLink({
  children,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { BrainCircuit: Icon, Loader2: Icon, LogIn: Icon };
});

describe('AI assistant page access states', () => {
  it('waits for authentication before mounting the assistant', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(<AiAssistantPage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认 AI 助教访问权限');
    expect(screen.queryByText('AI assistant workspace')).not.toBeInTheDocument();
  });

  it('preserves the return page and states the AI teaching boundary when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<AiAssistantPage />);

    expect(screen.getByRole('heading', { name: '登录后使用 AI 助教' })).toBeInTheDocument();
    expect(screen.getByText(/不直接修改测验得分、实验完成状态或教师评价/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登录并返回' })).toHaveAttribute('href', '/login?from=%2Fai-assistant');
    expect(screen.queryByText('AI assistant workspace')).not.toBeInTheDocument();
  });

  it('mounts the assistant only for an authenticated account', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'student-1',
        username: 'student',
        email: 'student@example.com',
        name: '学生',
        role: 'STUDENT',
      },
      loading: false,
    });

    render(<AiAssistantPage />);

    expect(screen.getByText('AI assistant workspace')).toBeInTheDocument();
  });
});
