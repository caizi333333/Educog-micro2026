import {
  buildHyperExperiments,
  buildKnowledgeSummary,
  getContinueExperiment,
  normalizeAchievementStats,
  normalizeExperimentRecords,
  normalizeLearningProgress,
  normalizeUserStats,
} from '@/lib/hyper-data';
import type { ExperimentConfig } from '@/lib/experiment-config';
import type { KnowledgePoint } from '@/lib/knowledge-points';

const experiments: ExperimentConfig[] = [
  {
    id: 'exp01',
    title: 'LED 控制',
    description: 'P1 口 LED 控制',
    category: 'I/O',
    difficulty: 'basic',
    duration: 45,
    objectives: ['掌握 P1 口输出'],
    prerequisites: [],
    knowledgePoints: ['P1 口'],
    hardwareRequirements: [],
    code: 'ORG 0000H',
    expectedResults: [],
    troubleshooting: [],
    extensions: [],
  },
  {
    id: 'exp02',
    title: '定时器',
    description: 'T0 定时',
    category: 'Timer',
    difficulty: 'intermediate',
    duration: 90,
    objectives: ['配置定时器'],
    prerequisites: [],
    knowledgePoints: ['TMOD'],
    hardwareRequirements: [],
    code: 'ORG 0000H',
    expectedResults: [],
    troubleshooting: [],
    extensions: [],
  },
  {
    id: 'exp03',
    title: '串口',
    description: 'UART 通信',
    category: 'Serial',
    difficulty: 'advanced',
    duration: 120,
    objectives: ['配置 UART'],
    prerequisites: [],
    knowledgePoints: ['SCON'],
    hardwareRequirements: [],
    code: 'ORG 0000H',
    expectedResults: [],
    troubleshooting: [],
    extensions: [],
  },
];

describe('hyper-data adapter', () => {
  it('merges experiment records without inventing progress', () => {
    const records = normalizeExperimentRecords({
      success: true,
      experiments: [
        { experimentId: 'exp01', status: 'COMPLETED', attempts: 2, timeSpent: 300 },
        { experimentId: 'exp02', status: 'IN_PROGRESS', updatedAt: '2026-04-25T03:00:00.000Z' },
      ],
    });

    const cards = buildHyperExperiments(experiments, records);

    expect(cards[0]).toMatchObject({ state: 'completed', progress: 100, attempts: 2, timeSpent: 300 });
    expect(cards[1]).toMatchObject({ state: 'in-progress', progress: null });
    expect(cards[2]).toMatchObject({ state: 'pending', progress: null });
    expect(getContinueExperiment(cards)?.id).toBe('exp02');
  });

  it('normalizes missing API payloads to empty states', () => {
    expect(normalizeExperimentRecords(null)).toEqual([]);
    expect(normalizeLearningProgress({ error: 'offline' })).toEqual([]);
    expect(normalizeAchievementStats({})).toMatchObject({
      totalAchievements: 0,
      unlockedAchievements: 0,
      completionRate: 0,
      totalPoints: 0,
      latestAchievement: null,
    });
    expect(normalizeUserStats({})).toMatchObject({
      modulesCompleted: 0,
      experimentsCompleted: 0,
      dailyStreak: 0,
      perfectQuiz: 0,
      codeRuns: 0,
    });
  });

  it('builds knowledge summary from local points and real progress records', () => {
    const points: KnowledgePoint[] = [
      { id: '1', name: '概述', level: 1, chapter: 1 },
      { id: '1.1', name: '结构', level: 2, chapter: 1 },
      { id: '1.1.1', name: 'CPU', level: 3, chapter: 1 },
      { id: '2', name: 'I/O', level: 1, chapter: 2 },
    ];
    const progress = normalizeLearningProgress({
      progress: [
        { chapterId: 'ch1', status: 'COMPLETED', progress: 100, timeSpent: 120 },
        { chapterId: 'ch2', status: 'IN_PROGRESS', progress: 40, timeSpent: 60 },
      ],
    });

    expect(buildKnowledgeSummary(points, progress)).toMatchObject({
      total: 4,
      levelOne: 2,
      levelTwo: 1,
      levelThree: 1,
      chapters: 2,
      completedChapters: 1,
      averageProgress: 70,
      totalTimeSpent: 180,
    });
  });
});
