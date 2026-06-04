import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('lucide-react', () => {
  const MockIcon = ({ className, ...props }: any) => <span className={className} {...props}>Icon</span>;
  return new Proxy(
    { __esModule: true },
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return MockIcon;
        return MockIcon;
      },
    },
  );
});

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders the courses page with chapter section by default', () => {
    render(<HomePage />);

    expect(screen.getByText('课程内容')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索章节、知识点、资源...')).toBeInTheDocument();
  });

  it('renders experiment section when toggled', () => {
    render(<HomePage />);

    const experimentBtn = screen.getByRole('button', { name: /实验工作台/ });
    fireEvent.click(experimentBtn);

    expect(screen.getByText('课程实验工作台')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索实验、主题、编号...')).toBeInTheDocument();
  });
});
