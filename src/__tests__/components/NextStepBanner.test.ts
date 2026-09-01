import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { fetchClientRequest } from '@/lib/client-fetch';
import { computeStep, NextStepBanner, WelcomeOnboarding } from '@/components/onboarding/NextStepBanner';

jest.mock('lucide-react', () => ({
  ArrowRight: 'svg',
  BookOpen: 'svg',
  FlaskConical: 'svg',
  GraduationCap: 'svg',
  Rocket: 'svg',
  Sparkles: 'svg',
  Target: 'svg',
  X: 'svg',
}));

jest.mock('next/link', () => (
  function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return React.createElement('a', { href, ...props }, children);
  }
));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: jest.fn(),
}));

jest.mock('@/lib/client-fetch', () => ({
  fetchClientRequest: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const mockFetchClientRequest = fetchClientRequest as jest.MockedFunction<typeof fetchClientRequest>;

const student = {
  id: 'student-next-step',
  name: '测试学生',
  role: 'STUDENT' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUseAuth.mockReturnValue({ user: student } as ReturnType<typeof useAuth>);
  mockGetStoredAccessToken.mockReturnValue('test-token');
  mockFetchClientRequest.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ activities: [] }),
  } as unknown as Response);
});

describe('NextStepBanner teaching order', () => {
  it('asks for a diagnostic only when there is no assessment record', () => {
    expect(computeStep(null, false).kind).toBe('no-quiz');
  });

  it('prioritizes weak-point remediation before experiment practice', () => {
    expect(computeStep({ weakKAs: ['3.1.2'] }, false)).toMatchObject({
      kind: 'has-weak',
      cta: { href: '/weak-nodes' },
    });
  });

  it('sends a student with no weak points to practice when no experiment is complete', () => {
    expect(computeStep({ weakKAs: [], totalScore: 100 }, false)).toMatchObject({
      kind: 'no-experiment',
      cta: { href: '/simulation' },
    });
  });

  it('offers a further challenge after assessment and experiment completion', () => {
    expect(computeStep({ weakKAs: [], totalScore: 100 }, true).kind).toBe('all-strong');
  });
});

describe('NextStepBanner assessment ownership', () => {
  it('keeps a stable skeleton and does not request activities while managed assessment is pending', async () => {
    const { rerender } = render(React.createElement(NextStepBanner, {
      compact: true,
      assessmentManaged: true,
      assessmentSnapshot: undefined,
      hasExperimentProgress: false,
    }));

    expect(screen.getByLabelText('正在判断下一项学习动作')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('正在判断下一项学习动作')).toHaveClass('h-[60px]');
    await waitFor(() => expect(mockFetchClientRequest).not.toHaveBeenCalled());

    rerender(React.createElement(NextStepBanner, {
      compact: true,
      assessmentManaged: true,
      assessmentSnapshot: null,
      hasExperimentProgress: false,
    }));

    expect(await screen.findByText('先做一次诊断测验')).toBeInTheDocument();
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it('uses a managed assessment without requesting the activity endpoint', async () => {
    render(React.createElement(NextStepBanner, {
      assessmentManaged: true,
      assessmentSnapshot: { weakKAs: ['3.1.2'] },
      hasExperimentProgress: false,
    }));

    expect(await screen.findByText('你有 1 个薄弱点等着补')).toBeInTheDocument();
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it('continues to request the latest assessment activity in unmanaged mode', async () => {
    render(React.createElement(NextStepBanner, {
      hasExperimentProgress: false,
    }));

    await waitFor(() => {
      expect(mockFetchClientRequest).toHaveBeenCalledTimes(1);
      expect(mockFetchClientRequest.mock.calls[0]?.[0]).toBe('/api/user/activities?action=COMPLETE_QUIZ&limit=1');
    });
  });
});

describe('WelcomeOnboarding evidence boundary', () => {
  it('shows the three-step guide only before the student has learning evidence', () => {
    const { rerender } = render(React.createElement(WelcomeOnboarding, { hasLearningEvidence: false }));
    expect(screen.getByText('三步开始你的 8051 学习之旅')).toBeInTheDocument();

    rerender(React.createElement(WelcomeOnboarding, { hasLearningEvidence: true }));
    expect(screen.queryByText('三步开始你的 8051 学习之旅')).not.toBeInTheDocument();
  });
});
