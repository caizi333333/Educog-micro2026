import React from 'react';
import { render, screen } from '@testing-library/react';
import AchievementsPage from '@/app/achievements/page';

jest.mock('@/components/hyper/HyperAchievementsPage', () => ({
  HyperAchievementsPage: () => (
    <div data-testid="achievements-v2-page">
      <h1>成就系统</h1>
      <p>完成挑战，收集成就，展现你的学习成果</p>
      <div data-testid="achievement-stats">Stats</div>
      <div data-testid="achievement-filter">Filter</div>
      <div data-testid="achievements-grid">
        <div data-testid="achievement-ach1">
          <h3>First Steps</h3>
          <p>Complete your first lesson</p>
        </div>
        <div data-testid="achievement-ach2">
          <h3>Quiz Master</h3>
          <p>Score 100% on a quiz</p>
        </div>
      </div>
    </div>
  ),
}));

describe('AchievementsPage', () => {
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
