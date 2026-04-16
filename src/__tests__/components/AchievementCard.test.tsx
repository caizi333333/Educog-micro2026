/**
 * AchievementCard 组件测试
 * 测试成就卡片组件的渲染和交互
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AchievementCard } from '@/components/achievements/AchievementCard';
import { testUtils } from '../utils/test-helpers';
import { mockData } from '../utils/mock-data';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

// Mock dependencies
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: []
  })
}));

jest.mock('lucide-react', () => ({
  Trophy: (props: any) => <div data-testid="trophy-icon" {...props}>Trophy</div>,
  Star: (props: any) => <div data-testid="star-icon" {...props}>Star</div>,
  HelpCircle: (props: any) => <div data-testid="help-circle-icon" {...props}>HelpCircle</div>,
  Lock: (props: any) => <div data-testid="lock-icon" {...props}>Lock</div>,
  Sparkles: (props: any) => <div data-testid="sparkles-icon" {...props}>Sparkles</div>
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

describe('AchievementCard', () => {
  const defaultProps: any = {
    achievement: mockData.achievements.regular,
    progress: (mockData.achievements.progress.progress / mockData.achievements.progress.target) * 100,
    unlocked: mockData.achievements.progress.unlocked,
    userProgress: [mockData.achievements.progress],
    userStats: mockData.achievements.stats,
    onClick: jest.fn()
  };

  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('Regular Achievement Rendering', () => {
    it('should render achievement information correctly', () => {
      // Arrange & Act
      render(<AchievementCard {...defaultProps} />);

      // Assert
      expect(screen.getByText(mockData.achievements.regular.title)).toBeInTheDocument();
      expect(screen.getByText(mockData.achievements.regular.description)).toBeInTheDocument();
      expect(screen.getByText(`${mockData.achievements.regular.points} 积分`)).toBeInTheDocument();
    });

    it('should display progress bar with correct percentage', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        progress: 60, // 3/5 * 100 = 60%
        unlocked: false,
        userProgress: [{
          ...mockData.achievements.progress,
          progress: 3,
          target: 5
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '60'); // 3/5 * 100 = 60%
    });

    it('should show unlocked state when achievement is completed', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        progress: 100,
        unlocked: true,
        userProgress: [{
          ...mockData.achievements.progress,
          progress: 5,
          target: 5,
          unlocked: true,
          unlockedAt: new Date().toISOString()
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText('已解锁')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should display rarity badge correctly', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        achievement: {
          ...mockData.achievements.regular,
          rarity: 'rare'
        }
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText('罕见')).toBeInTheDocument();
    });
  });

  describe('Hidden Achievement Rendering', () => {
    it('should show hidden achievement when unlocked', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        achievement: mockData.achievements.hidden,
        progress: 100,
        unlocked: true,
        userProgress: [{
          ...mockData.achievements.progress,
          achievementId: mockData.achievements.hidden.id,
          unlocked: true,
          progress: 1,
          target: 1
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText(mockData.achievements.hidden.title)).toBeInTheDocument();
      expect(screen.getByText(mockData.achievements.hidden.description)).toBeInTheDocument();
      expect(screen.getByText('隐藏成就')).toBeInTheDocument();
    });

    it('should show placeholder when hidden achievement is not unlocked and should not be shown', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        achievement: mockData.achievements.hidden,
        progress: 0,
        unlocked: false,
        userStats: {}, // 确保没有满足显示条件的统计数据
        userProgress: [{
          ...mockData.achievements.progress,
          achievementId: mockData.achievements.hidden.id,
          unlocked: false,
          progress: 0,
          target: 1
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText('???')).toBeInTheDocument();
      expect(screen.getByText('完成特定条件解锁')).toBeInTheDocument();
      expect(screen.getByTestId('help-circle-icon')).toBeInTheDocument();
    });

    it('should show partial info when hidden achievement has >= 50% progress', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        achievement: mockData.achievements.hidden,
        progress: 50, // 1/2 * 100 = 50%
        unlocked: false,
        userProgress: [{
          ...mockData.achievements.progress,
          achievementId: mockData.achievements.hidden.id,
          unlocked: false,
          progress: 1,
          target: 2 // 50% progress
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText(mockData.achievements.hidden.title)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClick when card is clicked', async () => {
      // Arrange
      const onClick = jest.fn();
      const props = testUtils.createMockProps(defaultProps, { onClick });

      // Act
      render(<AchievementCard {...props} />);
      fireEvent.click(screen.getByRole('button'));

      // Assert
      await waitFor(() => {
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(mockData.achievements.regular);
      });
    });

    it('should handle keyboard navigation', async () => {
      // Arrange
      const onClick = jest.fn();
      const props = testUtils.createMockProps(defaultProps, { onClick });

      // Act
      render(<AchievementCard {...props} />);
      const card = screen.getByRole('button');
      card.focus();
      fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

      // Assert
      await waitFor(() => {
        expect(onClick).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle space key press', async () => {
      // Arrange
      const onClick = jest.fn();
      const props = testUtils.createMockProps(defaultProps, { onClick });

      // Act
      render(<AchievementCard {...props} />);
      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: ' ', code: 'Space' });

      // Assert
      await waitFor(() => {
        expect(onClick).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      // Arrange & Act
      render(<AchievementCard {...defaultProps} />);

      // Assert
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should have proper progress bar accessibility', () => {
      // Arrange & Act
      render(<AchievementCard {...defaultProps} />);

      // Assert
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('should provide screen reader friendly text for unlocked achievements', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        progress: 100,
        unlocked: true,
        userProgress: [{
          ...mockData.achievements.progress,
          unlocked: true,
          progress: 5,
          target: 5
        }]
      });

      // Act
      render(<AchievementCard {...props} />);

      // Assert
      expect(screen.getByText('已解锁')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing userProgress gracefully', () => {
      // Arrange
      const props = {
        ...defaultProps,
        userProgress: undefined
      };

      // Act & Assert
      expect(() => render(<AchievementCard {...props} />)).not.toThrow();
    });

    it('should handle missing userStats gracefully', () => {
      // Arrange
      const props = {
        ...defaultProps,
        userStats: undefined
      };

      // Act & Assert
      expect(() => render(<AchievementCard {...props} />)).not.toThrow();
    });

    it('should handle invalid progress values', () => {
      // Arrange
      const props = testUtils.createMockProps(defaultProps, {
        progress: -1,
        unlocked: false,
        userProgress: [{
          ...mockData.achievements.progress,
          progress: -1,
          target: 0
        }]
      });

      // Act & Assert
      expect(() => render(<AchievementCard {...props} />)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should render quickly with large datasets', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      render(<AchievementCard {...defaultProps} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Assert
      expect(renderTime).toBeLessThan(50); // 应该在50ms内渲染完成
    });

    it('should not cause memory leaks on multiple renders', () => {
      // Arrange
      const { rerender, unmount } = render(<AchievementCard {...defaultProps} />);

      // Act
      for (let i = 0; i < 10; i++) {
        const newProps = testUtils.createMockProps(defaultProps, {
          achievement: {
            ...mockData.achievements.regular,
            title: `Achievement ${i}`
          }
        });
        rerender(<AchievementCard {...newProps} />);
      }

      // Assert
      expect(() => unmount()).not.toThrow();
    });
  });
});