import { parseRealTelemetry, compareWithVirtual } from '@/lib/real-compare';

describe('parseRealTelemetry', () => {
  it('解析串口日志中的 JSON 帧并忽略噪声', () => {
    const log = [
      'boot ok',
      '{"temp":25.4,"humi":61,"alarm":0,"ts":2048}',
      'garbage line',
      '{"temp":25.6,"humi":60,"alarm":0,"ts":4072}',
    ].join('\n');
    const { samples, badLines } = parseRealTelemetry(log);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ temp: 25.4, humi: 61, alarm: 0, ts: 2048 });
    expect(badLines).toBe(0); // 噪声行不含 temp 字段，不匹配帧正则，不计坏帧
  });

  it('丢弃物理不合理帧（断线 NaN/超量程）', () => {
    const log = '{"temp":25.0,"humi":60}\n{"temp":999,"humi":50}\n{"temp":-99,"humi":60}';
    const { samples, badLines } = parseRealTelemetry(log);
    expect(samples).toHaveLength(1);
    expect(badLines).toBe(2);
  });

  it('坏 JSON 计为坏帧', () => {
    // 形如完整帧但非法 JSON（尾逗号）：命中帧正则、解析失败 → 坏帧计数
    const { samples, badLines } = parseRealTelemetry('{"temp":25.0,"humi":60,}');
    expect(samples).toHaveLength(0);
    expect(badLines).toBe(1);
  });
});

describe('compareWithVirtual', () => {
  const mk = (temps: number[], humis: number[]) =>
    temps.map((t, i) => ({ temp: t, humi: humis[i] }));

  it('空样本返回 none', () => {
    expect(compareWithVirtual([], 25, 60).verdict).toBe('none');
  });

  it('偏差在精度内 → good', () => {
    const r = compareWithVirtual(mk([25.2, 25.8], [61, 62]), 25.0, 60);
    expect(r.verdict).toBe('good');
    expect(r.tempAvg).toBeCloseTo(25.5);
    expect(r.tempDev).toBeCloseTo(0.5);
    expect(r.humiDev).toBeCloseTo(1.5);
    expect(r.count).toBe(2);
  });

  it('中等偏差 → ok', () => {
    const r = compareWithVirtual(mk([28.5], [72]), 25.0, 60);
    expect(r.verdict).toBe('ok');
  });

  it('大偏差 → poor', () => {
    const r = compareWithVirtual(mk([35], [30]), 25.0, 60);
    expect(r.verdict).toBe('poor');
  });

  it('不给虚拟参照 → 只统计不判定', () => {
    const r = compareWithVirtual(mk([25], [60]), null, null);
    expect(r.verdict).toBe('none');
    expect(r.tempDev).toBeNull();
    expect(r.count).toBe(1);
  });

  it('统计报警帧计数', () => {
    const r = compareWithVirtual(
      [{ temp: 31, humi: 40, alarm: 1 }, { temp: 30, humi: 41, alarm: 0 }],
      null, null,
    );
    expect(r.alarmCount).toBe(1);
  });
});
