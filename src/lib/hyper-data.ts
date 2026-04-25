import type { ExperimentConfig } from '@/lib/experiment-config';
import type { KnowledgePoint } from '@/lib/knowledge-points';

export type HyperExperimentState = 'completed' | 'in-progress' | 'pending';

export interface HyperExperimentRecord {
  experimentId: string;
  status?: string | null;
  timeSpent?: number | null;
  attempts?: number | null;
  updatedAt?: string | Date | null;
  completedAt?: string | Date | null;
  lastCode?: string | null;
  progress?: number | null;
}

export interface HyperLearningProgressRecord {
  moduleId?: string | null;
  chapterId?: string | null;
  progress?: number | null;
  timeSpent?: number | null;
  status?: string | null;
  completedAt?: string | Date | null;
  lastAccessAt?: string | Date | null;
}

export interface HyperAchievementStats {
  totalAchievements: number;
  unlockedAchievements: number;
  completionRate: number;
  totalPoints: number;
  latestAchievement: {
    name: string;
    unlockedAt?: string | Date | null;
  } | null;
}

export interface HyperUserStats {
  modulesCompleted: number;
  experimentsCompleted: number;
  dailyStreak: number;
  perfectQuiz: number;
  codeRuns: number;
}

export interface HyperExperimentCard {
  id: string;
  title: string;
  description: string;
  category: string;
  topic: string;
  difficulty: ExperimentConfig['difficulty'];
  level: number;
  duration: number;
  state: HyperExperimentState;
  stateLabel: string;
  progress: number | null;
  timeSpent: number;
  attempts: number;
  updatedAt: string | null;
  href: string;
  objectives: string[];
  knowledgePoints: string[];
}

export interface HyperKnowledgeSummary {
  total: number;
  levelOne: number;
  levelTwo: number;
  levelThree: number;
  chapters: number;
  completedChapters: number;
  averageProgress: number;
  totalTimeSpent: number;
}

export interface HyperApiResult<T> {
  ok: boolean;
  data: T | null;
  status?: number;
  error?: string;
}

export const EMPTY_ACHIEVEMENT_STATS: HyperAchievementStats = {
  totalAchievements: 0,
  unlockedAchievements: 0,
  completionRate: 0,
  totalPoints: 0,
  latestAchievement: null,
};

export const EMPTY_USER_STATS: HyperUserStats = {
  modulesCompleted: 0,
  experimentsCompleted: 0,
  dailyStreak: 0,
  perfectQuiz: 0,
  codeRuns: 0,
};

const difficultyLevel: Record<ExperimentConfig['difficulty'], number> = {
  basic: 1,
  intermediate: 3,
  advanced: 5,
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeState(status?: string | null): HyperExperimentState {
  const value = (status || '').toUpperCase();
  if (value === 'COMPLETED' || value === 'COMPLETE' || value === 'DONE') return 'completed';
  if (value === 'IN_PROGRESS' || value === 'IN-PROGRESS' || value === 'STARTED' || value === 'SAVED') return 'in-progress';
  return 'pending';
}

function stateLabel(state: HyperExperimentState): string {
  if (state === 'completed') return '已完成';
  if (state === 'in-progress') return '进行中';
  return '未开始';
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeExperimentRecords(payload: unknown): HyperExperimentRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as { experiments?: unknown };
  if (!Array.isArray(data.experiments)) return [];

  return data.experiments
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item.experimentId === 'string')
    .map((item) => ({
      experimentId: item.experimentId as string,
      status: typeof item.status === 'string' ? item.status : null,
      timeSpent: typeof item.timeSpent === 'number' ? item.timeSpent : null,
      attempts: typeof item.attempts === 'number' ? item.attempts : null,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
      lastCode: typeof item.lastCode === 'string' ? item.lastCode : null,
      progress: typeof item.progress === 'number' ? item.progress : null,
    }));
}

export function normalizeLearningProgress(payload: unknown): HyperLearningProgressRecord[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as { progress?: unknown };
  if (!Array.isArray(data.progress)) return [];

  return data.progress
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      moduleId: typeof item.moduleId === 'string' ? item.moduleId : null,
      chapterId: typeof item.chapterId === 'string' ? item.chapterId : null,
      progress: typeof item.progress === 'number' ? item.progress : null,
      timeSpent: typeof item.timeSpent === 'number' ? item.timeSpent : null,
      status: typeof item.status === 'string' ? item.status : null,
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
      lastAccessAt: typeof item.lastAccessAt === 'string' ? item.lastAccessAt : null,
    }));
}

export function normalizeAchievementStats(payload: unknown): HyperAchievementStats {
  if (!payload || typeof payload !== 'object') return EMPTY_ACHIEVEMENT_STATS;
  const stats = (payload as { stats?: unknown }).stats;
  if (!stats || typeof stats !== 'object') return EMPTY_ACHIEVEMENT_STATS;

  const source = stats as Record<string, unknown>;
  const latest = source.latestAchievement;
  const latestAchievement =
    latest && typeof latest === 'object' && typeof (latest as Record<string, unknown>).name === 'string'
      ? {
          name: (latest as Record<string, unknown>).name as string,
          unlockedAt: ((latest as Record<string, unknown>).unlockedAt as string | null | undefined) ?? null,
        }
      : null;

  return {
    totalAchievements: asNumber(source.totalAchievements),
    unlockedAchievements: asNumber(source.unlockedAchievements),
    completionRate: Math.max(0, Math.min(100, asNumber(source.completionRate))),
    totalPoints: asNumber(source.totalPoints),
    latestAchievement,
  };
}

export function normalizeUserStats(payload: unknown): HyperUserStats {
  if (!payload || typeof payload !== 'object') return EMPTY_USER_STATS;
  const stats = (payload as { stats?: unknown }).stats;
  if (!stats || typeof stats !== 'object') return EMPTY_USER_STATS;
  const source = stats as Record<string, unknown>;

  return {
    modulesCompleted: asNumber(source.modules_completed),
    experimentsCompleted: asNumber(source.experiments_completed),
    dailyStreak: asNumber(source.daily_streak),
    perfectQuiz: asNumber(source.perfect_quiz),
    codeRuns: asNumber(source.code_runs),
  };
}

export function buildHyperExperiments(
  configs: ExperimentConfig[],
  records: HyperExperimentRecord[],
): HyperExperimentCard[] {
  const recordMap = new Map(records.map((record) => [record.experimentId, record]));

  return configs.map((experiment) => {
    const record = recordMap.get(experiment.id);
    const state = normalizeState(record?.status);
    const explicitProgress = clampPercent(record?.progress ?? null);
    const progress = state === 'completed' ? 100 : explicitProgress;
    const updatedAt = normalizeDate(record?.updatedAt) || normalizeDate(record?.completedAt);

    return {
      id: experiment.id,
      title: experiment.title,
      description: experiment.description || '',
      category: experiment.category,
      topic: experiment.category,
      difficulty: experiment.difficulty,
      level: difficultyLevel[experiment.difficulty],
      duration: experiment.duration,
      state,
      stateLabel: stateLabel(state),
      progress,
      timeSpent: asNumber(record?.timeSpent),
      attempts: asNumber(record?.attempts),
      updatedAt,
      href: `/simulation?experiment=${encodeURIComponent(experiment.id)}`,
      objectives: experiment.objectives,
      knowledgePoints: experiment.knowledgePoints,
    };
  });
}

export function getContinueExperiment(cards: HyperExperimentCard[]): HyperExperimentCard | null {
  const inProgress = cards
    .filter((card) => card.state === 'in-progress')
    .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0));

  return inProgress[0] || null;
}

export function getNextExperiment(cards: HyperExperimentCard[]): HyperExperimentCard | null {
  return cards.find((card) => card.state === 'pending') || null;
}

export function buildKnowledgeSummary(
  points: KnowledgePoint[],
  progress: HyperLearningProgressRecord[],
): HyperKnowledgeSummary {
  const chapters = new Set(points.map((point) => point.chapter));
  const completedChapters = new Set(
    progress
      .filter((item) => item.status === 'COMPLETED' || asNumber(item.progress) >= 100)
      .map((item) => item.chapterId)
      .filter(Boolean),
  );
  const totalProgress = progress.reduce((sum, item) => sum + asNumber(item.progress), 0);

  return {
    total: points.length,
    levelOne: points.filter((point) => point.level === 1).length,
    levelTwo: points.filter((point) => point.level === 2).length,
    levelThree: points.filter((point) => point.level === 3).length,
    chapters: chapters.size,
    completedChapters: completedChapters.size,
    averageProgress: progress.length > 0 ? Math.round(totalProgress / progress.length) : 0,
    totalTimeSpent: progress.reduce((sum, item) => sum + asNumber(item.timeSpent), 0),
  };
}

export async function fetchHyperJson<T>(url: string, token: string): Promise<HyperApiResult<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { ok: false, data: null, status: response.status, error: response.statusText };
    }

    return { ok: true, data: (await response.json()) as T, status: response.status };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown request error',
    };
  }
}
