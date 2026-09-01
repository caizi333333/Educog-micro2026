import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '@/app/analytics/page';

const mockUseAuth = jest.fn();
const mockUseAnalytics = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: (options?: unknown) => mockUseAnalytics(options),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: () => 'valid-token',
}));

jest.mock('@/components/shared/StatusBanner', () => ({
  EvidenceReadiness: () => null,
}));

jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const Icon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return {
    AlertCircle: Icon,
    ArrowRight: Icon,
    Award: Icon,
    BarChart3: Icon,
    BrainCircuit: Icon,
    ClipboardCheck: Icon,
    Loader2: Icon,
    Medal: Icon,
    RefreshCw: Icon,
    Search: Icon,
    Shield: Icon,
    TrendingUp: Icon,
    Trophy: Icon,
  };
});

global.fetch = mockFetch;

const zeroSummary = {
  totalPoints: 0,
  totalExperiments: 0,
  totalQuizzes: 0,
  totalAchievements: 0,
  completedExperiments: 0,
  completedModules: 0,
  totalTimeSpent: 0,
  avgQuizScore: 0,
};

const student = {
  id: 'student-1',
  username: 'student-1',
  email: 'student@example.com',
  name: '学生甲',
  role: 'STUDENT',
};

const teacher = {
  id: 'teacher-1',
  username: 'teacher',
  email: 'teacher@example.com',
  name: '教师甲',
  role: 'TEACHER',
};

const demoProvenance = { mode: 'DEMO', label: '演示数据', note: '用于功能演示' };

function analyticsState(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    refreshing: false,
    dataStatus: 'fresh',
    lastUpdatedAt: Date.parse('2026-08-15T08:00:00.000Z'),
    error: null,
    summary: zeroSummary,
    quizHistory: [],
    learningProgress: [],
    achievements: { stats: {} },
    calculateKnowledgeMastery: () => [],
    calculateLearningStats: () => ({
      totalModules: 0,
      completedModules: 0,
      totalTime: 0,
      averageScore: 0,
      quizCount: 0,
      quizScoreTrend: [],
    }),
    generateLearningAdvice: () => ({ weakAreas: [], strongAreas: [], suggestions: [] }),
    fetchAnalyticsData: jest.fn(),
    invalidateCache: jest.fn(),
    ...overrides,
  };
}

function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

describe('AnalyticsPage role and data states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: student, loading: false });
    mockUseAnalytics.mockReturnValue(analyticsState());
  });

  it('keeps teacher-only ranking and analyses out of the student view', () => {
    render(<AnalyticsPage />);

    expect(screen.getByRole('region', { name: '我的学习反馈' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.queryByText('班级排行榜')).not.toBeInTheDocument();
    expect(screen.queryByText('教学过程数据')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 使用与成绩的描述性统计')).not.toBeInTheDocument();
    expect(screen.getByText('无测验记录')).toBeInTheDocument();
    expect(screen.getByText('当前账户累计')).toBeInTheDocument();
    expect(screen.getByText('暂无学习进度记录')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /查看学习任务/ })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: '进入自主测评' })).toHaveAttribute('href', '/quiz');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('routes a student with low recorded mastery to weak-point review without changing results', () => {
    mockUseAnalytics.mockReturnValue(analyticsState({
      summary: { ...zeroSummary, totalQuizzes: 1, avgQuizScore: 58 },
      quizHistory: [{ id: 'attempt-1', score: 58 }],
      learningProgress: [{ id: 'progress-1', moduleId: 'module-1', chapterId: 'ch1', progress: 55, timeSpent: 30 }],
      calculateKnowledgeMastery: () => [
        { topic: '寻址方式', mastery: 55, hasRecord: true, details: { 立即寻址: 55 } },
      ],
    }));

    render(<AnalyticsPage />);

    expect(screen.getByText(/已记录章节的平均掌握度为 55%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /查看薄弱点/ })).toHaveAttribute('href', '/weak-nodes');
    expect(screen.getByText(/不会直接改变测验得分、任务进度或实验完成状态/)).toBeInTheDocument();
  });

  it('excludes chapters without progress records from the personal mastery average', () => {
    mockUseAnalytics.mockReturnValue(analyticsState({
      dataProvenance: demoProvenance,
      asOf: '2026-08-26T08:00:00.000Z',
      sampleSize: {
        quizAttempts: 0,
        learningProgressRecords: 1,
        experimentRecords: 0,
        achievementRecords: 0,
        achievementRules: 22,
      },
      learningProgress: [{
        id: 'progress-1', moduleId: 'module-1', chapterId: 'ch1', progress: 100,
        timeSpent: 60, lastAccessAt: '2026-08-26T07:00:00.000Z',
      }],
      calculateKnowledgeMastery: () => [
        { topic: '单片机概述', mastery: 100, hasRecord: true, details: { 基础概念: 100 } },
        { topic: '前沿应用', mastery: null, hasRecord: false, details: { 物联网应用: null } },
      ],
    }));

    render(<AnalyticsPage />);

    expect(screen.getByText('知识掌握').parentElement).toHaveTextContent('100%');
    expect(screen.getByText('知识掌握').parentElement).toHaveTextContent('按 1 个有记录章节计算');
    expect(screen.getByText('前沿应用').parentElement).toHaveTextContent('N/A');
    expect(screen.getByText('N/A · 未形成记录')).toBeInTheDocument();
  });

  it('shows a personal overview failure instead of converting it to zero', () => {
    const fetchAnalyticsData = jest.fn();
    const invalidateCache = jest.fn();
    mockUseAnalytics.mockReturnValue(analyticsState({
      error: '个人统计接口不可用',
      summary: null,
      fetchAnalyticsData,
      invalidateCache,
    }));

    render(<AnalyticsPage />);

    expect(screen.getAllByText('读取失败').length).toBeGreaterThan(0);
    expect(screen.getAllByText('个人统计接口不可用').length).toBeGreaterThan(0);
    expect(screen.getByText('获得成就').parentElement).toHaveTextContent('N/A');
    fireEvent.click(screen.getByRole('button', { name: '重试个人统计' }));
    expect(invalidateCache).not.toHaveBeenCalled();
    expect(fetchAnalyticsData).toHaveBeenCalledWith(true);
  });

  it('keeps stale cached metrics visible with an explicit calibration failure', () => {
    const fetchAnalyticsData = jest.fn();
    mockUseAnalytics.mockReturnValue(analyticsState({
      dataStatus: 'stale',
      error: '最新数据校准失败：HTTP 503',
      summary: { ...zeroSummary, totalAchievements: 7 },
      fetchAnalyticsData,
    }));

    render(<AnalyticsPage />);

    expect(screen.getByText('获得成就').parentElement).toHaveTextContent('7');
    expect(screen.getByText('获得成就').parentElement).toHaveTextContent('上次已确认值，校准失败');
    expect(screen.getByText(/不代表此刻最新状态/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试校准' }));
    expect(fetchAnalyticsData).toHaveBeenCalledWith(true);
  });

  it('labels cached metrics while the server calibration is still running', () => {
    mockUseAnalytics.mockReturnValue(analyticsState({
      refreshing: true,
      dataStatus: 'cached',
      summary: { ...zeroSummary, totalAchievements: 7 },
    }));

    render(<AnalyticsPage />);

    expect(screen.getByText('正在校准服务端最新记录')).toBeInTheDocument();
    expect(screen.getByText('获得成就').parentElement).toHaveTextContent('7');
    expect(screen.getByText('获得成就').parentElement).toHaveTextContent('缓存值，正在校准');
  });

  it('shows independent retry actions when teacher endpoints fail', async () => {
    mockUseAuth.mockReturnValue({ user: teacher, loading: false });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: '服务暂不可用' }),
    });

    render(<AnalyticsPage />);

    expect(await screen.findByRole('button', { name: '重试班级排行' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '重试教学效果' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '重试AI统计' })).toBeInTheDocument();
    expect(screen.getAllByText('服务暂不可用')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: '重试教学效果' }));
    await waitFor(() => {
      expect(mockFetch.mock.calls.filter(([url]) => url === '/api/analytics/learning-gains')).toHaveLength(2);
    });
  });

  it('renders a submitted zero score differently from no quiz record', async () => {
    mockUseAuth.mockReturnValue({ user: teacher, loading: false });
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/teacher/dashboard') {
        return okJson({
          dataProvenance: demoProvenance,
          students: [
            { id: 'student-zero', name: '真实零分', avgQuizScore: 0, quizAttemptCount: 1 },
            { id: 'student-empty', name: '尚未作答', avgQuizScore: 0, quizAttemptCount: 0 },
          ],
        });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: async () => ({ error: '暂不可用' }),
      });
    });

    render(<AnalyticsPage />);

    const zeroScoreRow = (await screen.findByText('真实零分')).parentElement?.parentElement;
    const noRecordRow = screen.getByText('尚未作答').parentElement?.parentElement;
    expect(zeroScoreRow).toHaveTextContent('0');
    expect(noRecordRow).toHaveTextContent('无测验记录');
    expect(noRecordRow).toHaveTextContent('—');
  });

  it('distinguishes successful empty teacher datasets from read failures', async () => {
    mockUseAuth.mockReturnValue({ user: teacher, loading: false });
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/teacher/dashboard') {
        return okJson({
          students: [],
          dataProvenance: demoProvenance,
        });
      }
      if (url === '/api/analytics/learning-gains') {
        return okJson({
          dataProvenance: demoProvenance,
          scoreDistribution: [],
          scoreSummary: { avg: 0, total: 0 },
          experimentCorrelation: [],
          timeCorrelation: [],
          prePostComparison: [],
          chapterMasteryAvg: [],
        });
      }
      return okJson({
        dataProvenance: demoProvenance,
        summary: {
          totalAiUsers: 0,
          totalAiEvents: 0,
          avgAiPerUser: 0,
          avgAiUserScore: null,
          avgNonAiUserScore: null,
          aiUsageRate: 0,
          scoreDifference: null,
        },
        usageVsScore: [],
        weeklyUsage: [],
        topAiStudents: [],
      });
    });

    render(<AnalyticsPage />);

    expect(await screen.findByText('暂无班级学生记录')).toBeInTheDocument();
    expect(await screen.findByText('当前范围暂无测评记录')).toBeInTheDocument();
    expect(await screen.findByText('当前范围暂无AI问答记录')).toBeInTheDocument();
    expect(screen.queryByText('读取失败')).not.toBeInTheDocument();
  });

  it('uses class-level summary cards for teachers and keeps personal learning cards out of the first screen', async () => {
    mockUseAuth.mockReturnValue({ user: teacher, loading: false });
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/teacher/dashboard') {
        return okJson({
          dataProvenance: demoProvenance,
          students: [
            { id: 'student-1', name: '学生甲', avgQuizScore: 80, quizAttemptCount: 1 },
            { id: 'student-2', name: '学生乙', avgQuizScore: 0, quizAttemptCount: 0 },
          ],
        });
      }
      if (url === '/api/analytics/learning-gains') {
        return okJson({
          dataProvenance: demoProvenance,
          scoreDistribution: [],
          scoreSummary: { avg: 80, total: 1 },
          experimentCorrelation: [],
          timeCorrelation: [],
          prePostComparison: [],
          chapterMasteryAvg: [],
        });
      }
      return okJson({
        dataProvenance: demoProvenance,
        summary: {
          totalAiUsers: 0,
          totalAiEvents: 0,
          avgAiPerUser: 0,
          avgAiUserScore: null,
          avgNonAiUserScore: null,
          aiUsageRate: 0,
          scoreDifference: null,
        },
        usageVsScore: [],
        weeklyUsage: [],
        topAiStudents: [],
      });
    });

    render(<AnalyticsPage />);

    expect(await screen.findByText('学生甲')).toBeInTheDocument();
    expect(screen.getByText('所辖学生').parentElement).toHaveTextContent('2');
    expect(screen.getByText('有测评记录').parentElement).toHaveTextContent('1');
    expect(screen.getByText('测验均分').parentElement).toHaveTextContent('80%');
    expect(screen.getByText('AI 问答记录').parentElement).toHaveTextContent('0');
    expect(screen.queryByText('累计学习')).not.toBeInTheDocument();
    expect(screen.queryByText('知识点掌握度')).not.toBeInTheDocument();
    expect(mockUseAnalytics).toHaveBeenCalledWith({ enabled: false });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('reloads all teacher datasets on account change and ignores late responses from the previous account', async () => {
    let activeTeacher = teacher;
    mockUseAuth.mockImplementation(() => ({ user: activeTeacher, loading: false }));
    const pending = new Map<string, Array<(value: unknown) => void>>();
    mockFetch.mockImplementation((url: string) => new Promise((resolve) => {
      const resolvers = pending.get(url) ?? [];
      resolvers.push(resolve);
      pending.set(url, resolvers);
    }));

    const responseFor = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    const { rerender } = render(<AnalyticsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

    activeTeacher = { ...teacher, id: 'teacher-2', username: 'teacher-2', name: '教师乙' };
    rerender(<AnalyticsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(6));

    pending.get('/api/teacher/dashboard')?.[1]?.(responseFor({
      dataProvenance: demoProvenance,
      students: [{ id: 'new-student', name: '新账号学生', avgQuizScore: 88, quizAttemptCount: 1 }],
    }));
    pending.get('/api/analytics/learning-gains')?.[1]?.(responseFor({
      dataProvenance: demoProvenance,
      scoreDistribution: [],
      scoreSummary: { avg: 88, total: 1 },
      experimentCorrelation: [],
      timeCorrelation: [],
      prePostComparison: [],
      chapterMasteryAvg: [],
    }));
    pending.get('/api/analytics/ai-usage')?.[1]?.(responseFor({
      dataProvenance: demoProvenance,
      summary: {
        totalAiUsers: 1,
        totalAiEvents: 5,
        avgAiPerUser: 5,
        avgAiUserScore: 88,
        avgNonAiUserScore: null,
        aiUsageRate: 100,
        scoreDifference: null,
      },
      usageVsScore: [],
      weeklyUsage: [],
      topAiStudents: [],
    }));
    expect(await screen.findByText('新账号学生')).toBeInTheDocument();

    pending.get('/api/teacher/dashboard')?.[0]?.(responseFor({
      dataProvenance: demoProvenance,
      students: [{ id: 'old-student', name: '旧账号学生', avgQuizScore: 10, quizAttemptCount: 1 }],
    }));
    pending.get('/api/analytics/learning-gains')?.[0]?.(responseFor({
      dataProvenance: demoProvenance,
      scoreDistribution: [],
      scoreSummary: { avg: 10, total: 1 },
      experimentCorrelation: [],
      timeCorrelation: [],
      prePostComparison: [],
      chapterMasteryAvg: [],
    }));
    pending.get('/api/analytics/ai-usage')?.[0]?.(responseFor({
      dataProvenance: demoProvenance,
      summary: {
        totalAiUsers: 1,
        totalAiEvents: 99,
        avgAiPerUser: 99,
        avgAiUserScore: 10,
        avgNonAiUserScore: null,
        aiUsageRate: 100,
        scoreDifference: null,
      },
      usageVsScore: [],
      weeklyUsage: [],
      topAiStudents: [],
    }));

    await waitFor(() => {
      expect(screen.queryByText('旧账号学生')).not.toBeInTheDocument();
      expect(screen.getByText('测验均分').parentElement).toHaveTextContent('88%');
      expect(screen.getByText('AI 问答记录').parentElement).toHaveTextContent('5');
    });
  });
});
