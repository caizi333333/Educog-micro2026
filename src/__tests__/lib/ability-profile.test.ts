import { computeAbilityProfile, ABILITY_DIMENSIONS } from '@/lib/ability-profile';

const exp = (id: string, status = 'COMPLETED', score: number | null = null) => ({
  experimentId: id,
  status,
  score,
});

describe('computeAbilityProfile', () => {
  it('无记录时所有维度为 N/A，等级未评', () => {
    const p = computeAbilityProfile({ experiments: [], quizAverage: null });
    expect(p.level).toBe(0);
    expect(p.levelName).toBe('未评级');
    expect(p.dimensions.every((d) => d.score === null)).toBe(true);
    expect(p.nextLevel?.level).toBe(1);
  });

  it('完成 exp01 达到 L1', () => {
    const p = computeAbilityProfile({ experiments: [exp('exp01')], quizAverage: null });
    expect(p.level).toBe(1);
    expect(p.nextLevel?.level).toBe(2);
    const fund = p.dimensions.find((d) => d.id === 'fundamentals')!;
    expect(fund.completedCount).toBe(1);
    expect(fund.score).toBeGreaterThan(0);
  });

  it('完成 5 个 L2 实验达 L2；proj04 满分达 L4', () => {
    const p = computeAbilityProfile({
      experiments: [
        exp('exp01'), exp('exp03'), exp('exp04'), exp('exp05'), exp('exp06'), exp('exp07'),
        exp('proj01'), exp('proj02'), exp('proj04', 'COMPLETED', 85),
      ],
      quizAverage: 80,
    });
    expect(p.level).toBe(4);
    expect(p.nextLevel).toBeNull();
    const sd = p.dimensions.find((d) => d.id === 'systemDesign')!;
    expect(sd.completedCount).toBe(3);
    expect(sd.totalCount).toBe(4);
  });

  it('进行中的实验按 40 分贡献但不计入完成数', () => {
    const p = computeAbilityProfile({ experiments: [exp('exp01', 'IN_PROGRESS')], quizAverage: null });
    expect(p.level).toBe(0);
    const fund = p.dimensions.find((d) => d.id === 'fundamentals')!;
    expect(fund.completedCount).toBe(0);
    expect(fund.score).not.toBeNull();
  });

  it('quiz 成绩按 20% 权重混入维度分', () => {
    // exp01 完成(100) + exp02 未做(0) → 实验均分 50；混入 quiz 90 → 50*0.8+90*0.2=58
    const p = computeAbilityProfile({ experiments: [exp('exp01')], quizAverage: 90 });
    expect(p.dimensions.find((d) => d.id === 'fundamentals')!.score).toBe(58);
  });

  it('维度与实验的映射覆盖全部 5 维', () => {
    expect(ABILITY_DIMENSIONS).toHaveLength(5);
    const all = ABILITY_DIMENSIONS.flatMap((d) => d.experiments);
    expect(new Set(all).size).toBe(all.length); // 无重复映射
    expect(all).toContain('proj04');
  });
});
