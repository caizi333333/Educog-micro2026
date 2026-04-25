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

  it('renders the new experiment workbench header and search', () => {
    render(<HomePage />);

    expect(screen.getByText('课程实验工作台')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索实验、主题、编号...')).toBeInTheDocument();
  });

  it('renders experiment cards from the existing experiment catalog', () => {
    render(<HomePage />);

    expect(screen.getByText('实验一：基础LED控制实验')).toBeInTheDocument();
    expect(screen.getByText('实验二：指令系统实验')).toBeInTheDocument();
  });

  it('filters experiments by search query', () => {
    render(<HomePage />);

    const searchInput = screen.getByPlaceholderText('搜索实验、主题、编号...');
    fireEvent.change(searchInput, { target: { value: '定时' } });

    expect(searchInput).toHaveValue('定时');
    expect(screen.getByText('实验三：定时/计数器实验')).toBeInTheDocument();
  });
});
