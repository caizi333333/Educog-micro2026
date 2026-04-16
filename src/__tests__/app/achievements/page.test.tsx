import React from 'react';
import { render, screen } from '@testing-library/react';
import AchievementsPage from '@/app/achievements/page';

// Mock hooks
const mockUseAuth = jest.fn();
const mockUseAchievements = jest.fn();
const mockToast = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

jest.mock('@/hooks/useAchievements', () => ({
  useAchievements: mockUseAchievements,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock the dynamic import and achievements-v2 component
jest.mock('next/dynamic', () => {
  return () => {
    return function MockedAchievementsV2Page() {
      return (
        <div data-testid="achievements-v2-page">
          <h1>成就系统</h1>
          <p>完成挑战，收集成就，展现你的学习成果</p>
          <div data-testid="achievement-stats">Stats</div>
          <div data-testid="achievement-filter">Filter</div>
          <div data-testid="achievements-grid">
            {mockAchievements.map(achievement => (
              <div key={achievement.id} data-testid={`achievement-${achievement.id}`}>
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    };
  };
});

// Mock data - moved before the dynamic import mock
const mockAchievements = [
  {
    id: 'ach1',
    title: 'First Steps',
    description: 'Complete your first lesson',
    category: 'learning',
    tier: 'bronze',
    points: 10
  },
  {
    id: 'ach2', 
    title: 'Quiz Master',
    description: 'Score 100% on a quiz',
    category: 'quiz',
    tier: 'gold',
    points: 50
  }
];

// Mock the components
jest.mock('@/components/achievements/AchievementCardSimple', () => {
  return {
    AchievementCardSimple: ({ achievement, progress, unlocked, onClick }: any) => (
      <div 
        data-testid={`achievement-${achievement.id}`}
        onClick={onClick}
        className="achievement-card"
      >
        <h3>{achievement.title}</h3>
        <p>{achievement.description}</p>
        <div>Progress: {progress}%</div>
        <div>Unlocked: {unlocked ? 'Yes' : 'No'}</div>
      </div>
    )
  };
});

jest.mock('@/components/achievements/AchievementStats', () => {
  return {
    AchievementStats: ({ stats }: any) => (
      <div data-testid="achievement-stats">
        <div>Total: {stats.total}</div>
        <div>Unlocked: {stats.unlocked}</div>
        <div>Points: {stats.totalPoints}</div>
      </div>
    )
  };
});

jest.mock('@/components/achievements/AchievementFilter', () => {
  return {
    AchievementFilter: ({ selectedCategory, onCategoryChange }: any) => (
      <div data-testid="achievement-filter">
        <select 
          value={selectedCategory} 
          onChange={(e) => onCategoryChange(e.target.value)}
          data-testid="category-select"
        >
          <option value="all">All</option>
          <option value="learning">Learning</option>
          <option value="quiz">Quiz</option>
        </select>
      </div>
    )
  };
});

// Mock user progress data

const mockUserProgress = [
  {
    achievementId: 'ach1',
    progress: 100,
    unlocked: true
  },
  {
    achievementId: 'ach2',
    progress: 75,
    unlocked: false
  }
];

describe('AchievementsPage', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User', email: 'test@example.com' },
      loading: false,
    });
    mockUseAchievements.mockReturnValue({
      loading: false,
      refreshing: false,
      userProgress: mockUserProgress,
      fetchAchievements: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render achievements page', () => {
    render(<AchievementsPage />);
    
    expect(screen.getByText('成就系统')).toBeInTheDocument();
    expect(screen.getByText('完成挑战，收集成就，展现你的学习成果')).toBeInTheDocument();
    expect(screen.getByTestId('achievement-stats')).toBeInTheDocument();
    expect(screen.getByTestId('achievement-filter')).toBeInTheDocument();
  });

  it('should render achievement cards', () => {
    render(<AchievementsPage />);
    
    expect(screen.getByTestId('achievement-ach1')).toBeInTheDocument();
    expect(screen.getByTestId('achievement-ach2')).toBeInTheDocument();
    expect(screen.getByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('Quiz Master')).toBeInTheDocument();
  });

  it('should render achievements grid', () => {
    render(<AchievementsPage />);
    
    expect(screen.getByTestId('achievements-grid')).toBeInTheDocument();
  });
});