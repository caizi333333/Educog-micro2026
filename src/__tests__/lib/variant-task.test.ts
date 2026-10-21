import { parseVariantTask, selectFallbackVariant, buildVariantUserPrompt } from '@/lib/variant-task';

describe('parseVariantTask', () => {
  it('解析合法 JSON 输出', () => {
    const raw = '```json\n{"title":"容错增强变体","scenario":"传感器失效","requirements":["r1","r2"],"selfChecks":["s1"],"rationale":"针对容错","targets":["容错"]}\n```';
    const t = parseVariantTask(raw);
    expect(t).not.toBeNull();
    expect(t!.title).toBe('容错增强变体');
    expect(t!.requirements).toHaveLength(2);
    expect(t!.source).toBe('generated');
  });

  it('容忍 JSON 前后的杂讯文本', () => {
    const raw = '好的，这是任务：{"title":"t","requirements":["a"],"selfChecks":["b"]} 以上。';
    expect(parseVariantTask(raw)).not.toBeNull();
  });

  it('字段缺失返回 null 走回退', () => {
    expect(parseVariantTask('{"title":"t"}')).toBeNull();
    expect(parseVariantTask('不是 JSON')).toBeNull();
    expect(parseVariantTask('')).toBeNull();
  });
});

describe('selectFallbackVariant', () => {
  it('按薄弱维度匹配对应变体', () => {
    const t = selectFallbackVariant({ reviewDimensions: [{ name: '容错设计', score: 45 }] });
    expect(t.source).toBe('fallback');
    expect(t.title.length).toBeGreaterThan(0);
  });

  it('全部维度达标时回退到综合变体', () => {
    const t = selectFallbackVariant({ reviewDimensions: [{ name: '协议时序', score: 92 }] });
    expect(t.source).toBe('fallback');
    expect(t.requirements.length).toBeGreaterThan(0);
  });

  it('无证据时也给出合法变体', () => {
    const t = selectFallbackVariant({});
    expect(t.requirements.length).toBeGreaterThan(0);
    expect(t.selfChecks.length).toBeGreaterThan(0);
  });
});

describe('buildVariantUserPrompt', () => {
  it('低分维度进入提示词，达标维度标记为免考', () => {
    const p = buildVariantUserPrompt('智慧农业大棚监控系统设计', {
      reviewDimensions: [
        { name: '容错设计', score: 45 },
        { name: '协议时序', score: 90 },
      ],
      diagnosisCount: 3,
      hasSubmission: true,
    });
    expect(p).toContain('容错设计 45');
    expect(p).toContain('协议时序');
    expect(p).toContain('3');
  });

  it('无证据时退化为综合变体提示', () => {
    const p = buildVariantUserPrompt('实验', {});
    expect(p).toContain('综合性进阶变体');
  });
});
