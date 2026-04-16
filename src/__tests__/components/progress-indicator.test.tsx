import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProgressIndicator } from '@/components/ui/progress-indicator';

describe('ProgressIndicator 组件', () => {
  const defaultProps = {
    current: 3,
    total: 10,
    label: '学习进度'
  };

  describe('基本渲染', () => {
    it('应该正确渲染进度指示器', () => {
      render(<ProgressIndicator {...defaultProps} />);
      
      expect(screen.getByText('学习进度')).toBeInTheDocument();
      expect(screen.getByText('3 / 10')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('应该正确计算进度百分比', () => {
      render(<ProgressIndicator current={7} total={20} label="测试" />);
      
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('7 / 20')).toBeInTheDocument();
    });

    it('应该处理100%进度', () => {
      render(<ProgressIndicator current={10} total={10} label="完成" />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('10 / 10')).toBeInTheDocument();
    });

    it('应该处理0%进度', () => {
      render(<ProgressIndicator current={0} total={10} label="开始" />);
      
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('0 / 10')).toBeInTheDocument();
    });
  });

  describe('进度条样式', () => {
    it('应该根据进度应用正确的颜色', () => {
      const { rerender } = render(
        <ProgressIndicator current={2} total={10} label="低进度" />
      );
      
      // 低进度应该是红色
      let progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-red-500');

      // 中等进度应该是黄色
      rerender(<ProgressIndicator current={5} total={10} label="中等进度" />);
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-yellow-500');

      // 高进度应该是绿色
      rerender(<ProgressIndicator current={8} total={10} label="高进度" />);
      progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-green-500');
    });

    it('应该正确设置进度条宽度', () => {
      render(<ProgressIndicator current={3} total={10} label="测试" />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 30%');
    });
  });

  describe('动画效果', () => {
    it('应该在进度变化时显示动画', async () => {
      const { rerender } = render(
        <ProgressIndicator current={2} total={10} label="动画测试" />
      );
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('transition-all');
      expect(progressBar).toHaveClass('duration-300');
      
      // 更新进度
      rerender(<ProgressIndicator current={5} total={10} label="动画测试" />);
      
      await waitFor(() => {
        expect(progressBar).toHaveStyle('width: 50%');
      });
    });

    it('应该在悬停时显示缩放效果', () => {
      render(<ProgressIndicator current={5} total={10} label="悬停测试" />);
      
      const container = screen.getByText('悬停测试').closest('div');
      expect(container).toHaveClass('hover:scale-105');
    });
  });

  describe('可访问性', () => {
    it('应该有正确的ARIA属性', () => {
      render(<ProgressIndicator current={3} total={10} label="可访问性测试" />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '3');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '10');
      expect(progressBar).toHaveAttribute('aria-label', '可访问性测试: 3 / 10 (30%)');
    });

    it('应该支持键盘导航', () => {
      render(<ProgressIndicator current={5} total={10} label="键盘测试" />);
      
      const container = screen.getByText('键盘测试').closest('div');
      expect(container).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('自定义属性', () => {
    it('应该支持自定义className', () => {
      render(
        <ProgressIndicator 
          {...defaultProps} 
          className="custom-class" 
        />
      );
      
      const container = screen.getByText('学习进度').closest('div');
      expect(container).toHaveClass('custom-class');
    });

    it('应该支持自定义颜色主题', () => {
      render(
        <ProgressIndicator 
          current={5} 
          total={10} 
          label="自定义颜色" 
          color="blue"
        />
      );
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveClass('bg-blue-500');
    });

    it('应该支持隐藏百分比显示', () => {
      render(
        <ProgressIndicator 
          {...defaultProps} 
          showPercentage={false}
        />
      );
      
      expect(screen.queryByText('30%')).not.toBeInTheDocument();
      expect(screen.getByText('3 / 10')).toBeInTheDocument();
    });

    it('应该支持隐藏数值显示', () => {
      render(
        <ProgressIndicator 
          {...defaultProps} 
          showNumbers={false}
        />
      );
      
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.queryByText('3 / 10')).not.toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应该处理超过总数的当前值', () => {
      render(<ProgressIndicator current={15} total={10} label="超出范围" />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('15 / 10')).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 100%');
    });

    it('应该处理负数值', () => {
      render(<ProgressIndicator current={-5} total={10} label="负数" />);
      
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('-5 / 10')).toBeInTheDocument();
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle('width: 0%');
    });

    it('应该处理零总数', () => {
      render(<ProgressIndicator current={5} total={0} label="零总数" />);
      
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('5 / 0')).toBeInTheDocument();
    });

    it('应该处理小数值', () => {
      render(<ProgressIndicator current={3.7} total={10.5} label="小数" />);
      
      // 应该四舍五入到整数百分比
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText('3.7 / 10.5')).toBeInTheDocument();
    });
  });

  describe('交互功能', () => {
    it('应该支持点击事件', () => {
      const handleClick = jest.fn();
      render(
        <ProgressIndicator 
          {...defaultProps} 
          onClick={handleClick}
        />
      );
      
      const container = screen.getByText('学习进度').closest('div');
      fireEvent.click(container!);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('应该支持键盘事件', () => {
      const handleKeyDown = jest.fn();
      render(
        <ProgressIndicator 
          {...defaultProps} 
          onKeyDown={handleKeyDown}
        />
      );
      
      const container = screen.getByText('学习进度').closest('div');
      fireEvent.keyDown(container!, { key: 'Enter' });
      
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('性能优化', () => {
    it('应该在相同props时避免重新渲染', () => {
      const { rerender } = render(<ProgressIndicator {...defaultProps} />);
      
      const initialElement = screen.getByText('学习进度');
      
      // 使用相同的props重新渲染
      rerender(<ProgressIndicator {...defaultProps} />);
      
      const afterElement = screen.getByText('学习进度');
      expect(initialElement).toBe(afterElement);
    });
  });

  describe('响应式设计', () => {
    it('应该在小屏幕上调整布局', () => {
      render(<ProgressIndicator {...defaultProps} size="sm" />);
      
      const container = screen.getByText('学习进度').closest('div');
      expect(container).toHaveClass('text-sm');
    });

    it('应该在大屏幕上调整布局', () => {
      render(<ProgressIndicator {...defaultProps} size="lg" />);
      
      const container = screen.getByText('学习进度').closest('div');
      expect(container).toHaveClass('text-lg');
    });
  });
});