import { COMPREHENSIVE_QUIZ_ID } from '@/lib/diagnostic-attempt';
import { knowledgePoints } from '@/lib/knowledge-points';
import {
  analyticsMasteryDetail,
  buildAnalyticsKnowledgeMastery,
  type AnalyticsActivityRow,
} from '@/lib/analytics-mastery';

const comprehensiveWeak = [
  '1.1.1', '1.1.2', '1.1.3', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3', '1.3.1', '1.3.2', '1.4.1', '1.4.3',
];

function activity(id: string, createdAt: string, details: Record<string, unknown>): AnalyticsActivityRow {
  return { id, createdAt, details: JSON.stringify(details) };
}

/** Same receipt mix as the TEST0872001 graph case: newest paper is a chapter quiz. */
const test0872001Activities = [
  activity('ch1', '2026-10-26T17:03:08.000Z', {
    quizId: 'quiz-ch1',
    assessmentMode: 'initial',
    score: 58.3,
    weakAreas: ['1.2', '1.4.1', '1.4.3', '1.4.4'],
    scoresByKA: { '1.4.4': { score: 10 } },
  }),
  activity('comprehensive', '2026-10-26T17:02:53.000Z', {
    quizId: COMPREHENSIVE_QUIZ_ID,
    assessmentMode: 'initial',
    score: 20,
    weakAreas: comprehensiveWeak,
  }),
];

describe('analytics theme and atom mastery', () => {
  it('does not copy chapter reading progress onto sibling themes for TEST0872001', () => {
    const report = buildAnalyticsKnowledgeMastery({
      points: knowledgePoints,
      activities: test0872001Activities,
      learningProgress: [
        { chapterId: 'chapter-1', progress: 16 },
        { chapterId: '2', progress: 20 },
      ],
    });

    const overview = report.items.find((item) => item.id === '1');
    const hardware = report.items.find((item) => item.id === '2');
    const structure = overview?.themes.find((theme) => theme.id === '1.4');
    const tools = overview?.themes.find((theme) => theme.id === '1.5');
    const pins = structure?.atoms.find((atom) => atom.id === '1.4.1');
    const minimumSystem = structure?.atoms.find((atom) => atom.id === '1.4.4');

    expect(report.attempt?.quizId).toBe(COMPREHENSIVE_QUIZ_ID);
    expect(report.sourceLabel).toContain('综合测评');
    expect(overview?.chapterProgress).toBe(16);
    expect(overview?.mastery).toBeNull();
    expect(overview?.themes.every((theme) => theme.mastery === 16)).toBe(false);
    expect(new Set(overview?.themes.map((theme) => analyticsMasteryDetail(theme))).size).toBeGreaterThan(1);
    expect(analyticsMasteryDetail(structure!)).toBe('含薄弱点');
    expect(analyticsMasteryDetail(tools!)).toBe('N/A · 未形成记录');
    expect(analyticsMasteryDetail(pins!)).toBe('诊断薄弱');
    expect(analyticsMasteryDetail(minimumSystem!)).toBe('N/A · 未形成记录');
    expect(hardware?.chapterProgress).toBe(20);
    expect(hardware?.mastery).toBeNull();
    expect(hardware?.themes.every((theme) => theme.mastery === null && theme.band === null)).toBe(true);
  });

  it('keeps partial atom scores on the atoms that earned them', () => {
    const report = buildAnalyticsKnowledgeMastery({
      points: knowledgePoints,
      activities: [
        activity('comprehensive', '2026-10-26T17:02:53.000Z', {
          quizId: COMPREHENSIVE_QUIZ_ID,
          assessmentMode: 'initial',
          score: 20,
          weakAreas: ['1.4.4'],
          scoresByKA: {
            '1.1.1': { correct: 0, total: 1, score: 16 },
            '1.4.1': { score: 20 },
          },
        }),
      ],
      learningProgress: [{ chapterId: 'ch1', progress: 16 }],
    });

    const overview = report.items.find((item) => item.id === '1');
    const history = overview?.themes.find((theme) => theme.id === '1.1');
    const structure = overview?.themes.find((theme) => theme.id === '1.4');
    const tools = overview?.themes.find((theme) => theme.id === '1.5');
    const born = history?.atoms.find((atom) => atom.id === '1.1.1');
    const stages = history?.atoms.find((atom) => atom.id === '1.1.2');
    const pins = structure?.atoms.find((atom) => atom.id === '1.4.1');
    const minimumSystem = structure?.atoms.find((atom) => atom.id === '1.4.4');

    expect(history?.mastery).toBe(16);
    expect(structure?.mastery).toBe(20);
    expect(tools?.mastery).toBeNull();
    expect(overview?.themes.every((theme) => theme.mastery === 16 || theme.mastery === 20)).toBe(false);
    expect(analyticsMasteryDetail(born!)).toBe('16%');
    expect(analyticsMasteryDetail(stages!)).toBe('N/A · 未形成记录');
    expect(analyticsMasteryDetail(pins!)).toBe('20%');
    expect(analyticsMasteryDetail(minimumSystem!)).toBe('诊断薄弱');
    expect(overview?.chapterProgress).toBe(16);
    expect(overview?.details['单片机发展历史']).toBe(16);
    expect(overview?.details['开发工具与环境']).toBeNull();
  });

  it('leaves a chapter with only reading progress unscored at theme and atom level', () => {
    const report = buildAnalyticsKnowledgeMastery({
      points: knowledgePoints,
      activities: [],
      learningProgress: [
        { chapterId: 'chapter-5', progress: 80 },
        { chapterId: '6', progress: 60 },
      ],
    });
    const interrupts = report.items.find((item) => item.topic === '中断系统');
    const timers = report.items.find((item) => item.topic === '定时器/计数器');
    const frontier = report.items.find((item) => item.topic === '前沿应用');

    expect(interrupts?.chapterProgress).toBe(80);
    expect(interrupts?.mastery).toBeNull();
    expect(interrupts?.hasRecord).toBe(true);
    expect(interrupts?.details['89C51中断系统']).toBeNull();
    expect(interrupts?.themes.every((theme) => theme.mastery === null && theme.atoms.every((atom) => atom.band === null))).toBe(true);
    expect(timers?.chapterProgress).toBe(60);
    expect(timers?.details['定时器基础']).toBeNull();
    expect(frontier?.mastery).toBeNull();
    expect(frontier?.hasRecord).toBe(false);
    expect(frontier?.chapterProgress).toBeNull();
    expect(report.sourceLabel).toBeNull();
  });
});
