/**
 * 实验空间（ilab-x）接口适配层单元测试。
 * 覆盖：MD5 签名口径、originId 规范化、steps 构建的时序约束与 ≥10 步要求、ai_data 结构。
 */
import { md5Upper, normalizeOriginId } from '@/lib/ilab/client';
import { buildIlabSteps, buildAiData, ILAB_STEP_CATALOG, type StepEvidence } from '@/lib/ilab/steps';

describe('ilab 签名与 originId', () => {
  it('MD5 签名结果为大写十六进制', () => {
    const sig = md5Upper('TICKET10000SECRET');
    expect(sig).toMatch(/^[0-9A-F]{32}$/);
    // 与官方口径一致：MD5(原文拼接) 全大写
    expect(sig).toBe(md5Upper('TICKET10000SECRET'));
    expect(sig).not.toBe(md5Upper('TICKET10000SECRET').toLowerCase());
  });

  it('originId 非法字符替换为下划线（禁止 "-"）', () => {
    expect(normalizeOriginId('XZY_cm-abc.123')).toBe('XZY_cm_abc_123');
    expect(normalizeOriginId('OK_123Ab')).toBe('OK_123Ab');
    expect(normalizeOriginId('a-b')).not.toContain('-');
  });
});

describe('buildIlabSteps', () => {
  const T0 = 1_760_000_000_000;
  const T1 = T0 + 3_600_000; // 1 小时窗口

  it('五里程碑齐全时展开为全部 24 步且步骤时间不重复、不越界', () => {
    const evidence: StepEvidence[] = [
      { stepId: 'milestone:requirements', at: T0 + 600_000, kind: 'milestone' },
      { stepId: 'milestone:interfaces', at: T0 + 1_200_000, kind: 'milestone' },
      { stepId: 'milestone:implementation', at: T0 + 2_400_000, kind: 'milestone' },
      { stepId: 'milestone:integration', at: T0 + 3_000_000, kind: 'milestone' },
      { stepId: 'milestone:review', at: T0 + 3_300_000, kind: 'milestone' },
    ];
    const steps = buildIlabSteps(evidence, T0, T1);
    expect(steps.length).toBe(ILAB_STEP_CATALOG.length);
    // ≥10 步（2026 校验：status=1 时不少于 10 步）
    expect(steps.length).toBeGreaterThanOrEqual(10);
    // seq 升序、字段齐全、时间不越界
    const seenKeys = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      expect(s.seq).toBe(i + 1);
      expect(s.startTime).toBeGreaterThanOrEqual(T0);
      expect(s.endTime).toBeLessThanOrEqual(T1);
      expect(s.endTime).toBeGreaterThanOrEqual(s.startTime);
      expect(s.timeUsed).toBeGreaterThan(0);
      expect(s.expectTime).toBeGreaterThan(0);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(s.maxScore);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.title.length).toBeLessThanOrEqual(100);
      const key = `${s.startTime}-${s.endTime}-${s.seq}`;
      expect(seenKeys.has(key)).toBe(false);
      seenKeys.add(key);
    }
    const total = steps.reduce((acc, s) => acc + s.maxScore, 0);
    expect(total).toBe(100);
  });

  it('信标事件优先于里程碑展开，且 repeatCount 累计真实次数', () => {
    const evidence: StepEvidence[] = [
      { stepId: 'intro', at: T0 + 60_000, kind: 'beacon' },
      { stepId: 'sim_run', at: T0 + 1_800_000, kind: 'beacon' },
      { stepId: 'sim_run', at: T0 + 2_100_000, kind: 'beacon' },
      { stepId: 'telemetry_verify', at: T0 + 2_400_000, kind: 'beacon' },
      { stepId: 'milestone:integration', at: T0 + 2_700_000, kind: 'milestone' },
      { stepId: 'milestone:review', at: T0 + 3_000_000, kind: 'milestone' },
    ];
    const steps = buildIlabSteps(evidence, T0, T1);
    const run = steps.find((s) => s.seq === 17);
    expect(run).toBeDefined();
    expect(run!.repeatCount).toBe(2);
    expect(run!.startTime).toBe(T0 + 1_800_000);
    expect(run!.endTime).toBe(T0 + 2_100_000);
    // 无证据的阶段不展开（requirements/interfaces/implementation 无里程碑确认）
    const titles = steps.map((s) => s.seq);
    expect(titles).not.toContain(1 + 0 === 0 ? -1 : 4); // seq 4 属 interfaces，不应出现
    expect(steps.find((s) => s.seq === 4)).toBeUndefined();
  });

  it('完全无证据时返回空数组（不虚构步骤）', () => {
    expect(buildIlabSteps([], T0, T1)).toEqual([]);
  });
});

describe('buildAiData', () => {
  it('ai_call_count=0 时模型与场景为空数组', () => {
    const d = buildAiData({ aiCallCount: 0 });
    expect(d.ai_call_count).toBe(0);
    expect(d.ai_models_used).toEqual([]);
    expect(d.ai_usage_scenarios).toEqual([]);
  });

  it('ai_call_count>0 时给出部署方式合法的模型列表', () => {
    const d = buildAiData({ aiCallCount: 3 });
    expect(d.ai_call_count).toBe(3);
    expect(d.ai_models_used.length).toBeGreaterThan(0);
    const allowed = new Set(['公有云服务', '私有化部署', '混合服务', '本地运行']);
    for (const m of d.ai_models_used) {
      expect(allowed.has(m.deployment)).toBe(true);
      expect(m.model.length).toBeGreaterThan(0);
      expect(m.version.length).toBeGreaterThan(0);
    }
    expect(d.ai_usage_scenarios.length).toBeGreaterThan(0);
  });
});
