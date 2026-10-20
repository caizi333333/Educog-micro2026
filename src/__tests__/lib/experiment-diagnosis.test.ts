import { experimentBrief, parseDiagnosis, snapshotText } from '@/lib/experiment-diagnosis';

describe('parseDiagnosis', () => {
  it('parses well-formed JSON output', () => {
    const raw = JSON.stringify({
      observation: 'P3.7 一直保持高电平',
      diagnosis: 'DS18B20 复位后未检测到存在脉冲',
      hints: ['检查复位时序是否超过 480μs', '用波形面板确认 DQ 拉低'],
      nextCheck: '单步执行复位段，观察 P3.7 变化',
    });
    const r = parseDiagnosis(raw);
    expect(r.observation).toContain('P3.7');
    expect(r.diagnosis).toContain('存在脉冲');
    expect(r.hints).toHaveLength(2);
    expect(r.nextCheck).toContain('单步');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"observation":"o","diagnosis":"d","hints":["h"],"nextCheck":"n"}\n```';
    expect(parseDiagnosis(raw).diagnosis).toBe('d');
  });

  it('falls back to raw text when model outputs non-JSON', () => {
    const r = parseDiagnosis('你的复位时序可能有问题，请检查 DQ 引脚。');
    expect(r.diagnosis).toContain('复位时序');
    expect(r.hints).toHaveLength(0);
  });

  it('filters non-string hints and caps at 4', () => {
    const raw = JSON.stringify({ diagnosis: 'd', hints: ['a', 1, 'b', 'c', 'd', 'e'] });
    const r = parseDiagnosis(raw);
    expect(r.hints).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('snapshotText', () => {
  it('renders all provided fields', () => {
    const text = snapshotText({
      registers: { A: 15, SP: 7 },
      portValues: { P3: 200 },
      pc: 12,
      currentLine: 34,
      currentInstruction: 'DJNZ R7,$',
      uartTail: 'TX:{"temp":26}',
      environment: { temperature: 26.4 },
      deviceNotes: ['蜂鸣器激活中'],
    });
    expect(text).toContain('寄存器');
    expect(text).toContain('PC: 12');
    expect(text).toContain('当前源码行: 35');
    expect(text).toContain('DJNZ R7');
    expect(text).toContain('环境模型');
    expect(text).toContain('蜂鸣器激活中');
  });

  it('returns placeholder for empty snapshot', () => {
    expect(snapshotText({})).toBe('(无可用快照)');
  });
});

describe('experimentBrief', () => {
  it('includes proj04 protocol mapping', () => {
    const brief = experimentBrief('proj04');
    expect(brief).toContain('P3.7');
    expect(brief).toContain('DS18B20');
    expect(brief).toContain('DHT11');
    expect(brief).toContain('CRC8');
  });

  it('returns empty for unknown experiment', () => {
    expect(experimentBrief('no-such-exp')).toBe('');
  });
});
