import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { practiceClearStat, practiceMedalIdsForCount } from '@/lib/practice-medals';
import {
  ADDRESSING_MODE_BOARD,
  CPU_STRUCTURE_BOARD,
  INTERRUPT_SOURCE_FLAG_BOARD,
  INTERRUPT_VECTOR_BOARD,
  MEMORY_REGION_BOARD,
  TIMER_TMOD_BOARD,
  decideMatchReward,
  gradeMatch,
  matchClearMessage,
  matchMissMessage,
  stableShuffle,
} from '@/lib/practice-match';

const COURSEWARE = join(__dirname, '../../../public/resources/course/courseware/u5');
const UNIT3_OVERVIEW = join(__dirname, '../../../public/resources/course/courseware/u3/u3-overview.html');

function sourceTable(html: string): string[][] {
  const encoded = html.indexOf('var DATA=');
  const text = encoded >= 0 ? decodeOverview(html) : html;
  const match = text.match(/var SRC=(\[[\s\S]*?\]);/);
  if (!match?.[1]) throw new Error('courseware is missing var SRC');
  return JSON.parse(match[1].replace(/'/g, '"')) as string[][];
}

function decodeOverview(html: string): string {
  const marker = 'var DATA=';
  const start = html.indexOf(marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = start + marker.length;
  for (let cursor = end; cursor < html.length; cursor += 1) {
    const character = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }
  }
  const data = JSON.parse(html.slice(start + marker.length, end + 1)) as { int: string; tmr: string };
  return Buffer.from(data.int, 'base64').toString('utf8');
}

function decodeTimerPane(html: string): string {
  const marker = 'var DATA=';
  const start = html.indexOf(marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = start + marker.length;
  for (let cursor = end; cursor < html.length; cursor += 1) {
    const character = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        end = cursor;
        break;
      }
    }
  }
  const data = JSON.parse(html.slice(start + marker.length, end + 1)) as { tmr: string };
  return Buffer.from(data.tmr, 'base64').toString('utf8');
}

describe('interrupt source match board', () => {
  const overview = sourceTable(readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8'));
  const classroom = sourceTable(readFileSync(join(COURSEWARE, 'u5-interrupt-classroom.html'), 'utf8'));

  it('copies the five 80C51 sources from the courseware table', () => {
    expect(classroom).toEqual(overview);
    expect(INTERRUPT_SOURCE_FLAG_BOARD.pairs).toHaveLength(5);
    classroom.forEach((row, index) => {
      const pair = INTERRUPT_SOURCE_FLAG_BOARD.pairs[index];
      expect(pair?.prompt).toBe(row[0]);
      expect(pair?.promptHint).toContain(row[1]);
      expect(pair?.promptHint).toContain(row[4]);
      expect(pair?.target).toBe(row[2]);
      expect(pair?.targetDetail).toBe(row[3]);
    });
  });

  it('grades a complete mapping and rejects a swapped flag', () => {
    const solved = Object.fromEntries(INTERRUPT_SOURCE_FLAG_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(INTERRUPT_SOURCE_FLAG_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, int0: 't0', t0: 'int0' };
    const grade = gradeMatch(INTERRUPT_SOURCE_FLAG_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['int0', 't0']);
  });

  it('awards the first student clear, then cools down, then records a later clear without points', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    const first = decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_SOURCE_FLAG_BOARD.firstClearPoints,
      awardToStudent: true,
    });
    expect(first).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });

    const cooled = decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      firstClearPoints: 15,
      awardToStudent: true,
    });
    expect(cooled.reason).toBe('cooldown');
    expect(cooled.recordEvent).toBe(false);

    const later = decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      nowMs: now,
      cooldownMs: INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      firstClearPoints: 15,
      awardToStudent: true,
    });
    expect(later).toMatchObject({ reason: 'repeat', practicePoints: 0, recordEvent: true, grantMedals: true });

    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: 1,
      firstClearPoints: 15,
      awardToStudent: false,
    }).reason).toBe('preview');
  });

  it('names the first-clear medal and keeps a miss from listing the mapping', () => {
    expect(practiceClearStat(INTERRUPT_SOURCE_FLAG_BOARD.id)).toBe('practice_clears:u5-interrupt-source-flags');
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 0)).toEqual([]);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'interrupt_source_flags');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: 15,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「中断标志对上了」+10。');
    expect(matchClearMessage({
      reason: 'cooldown',
      practicePoints: 0,
      medalTitle: null,
      medalPoints: 0,
      cooldownMinutes: 10,
    })).toContain('10 分钟');
  });

  it('shuffles chips without dropping or duplicating a source', () => {
    const ids = INTERRUPT_SOURCE_FLAG_BOARD.pairs.map((pair) => pair.id);
    const shuffled = stableShuffle(ids, INTERRUPT_SOURCE_FLAG_BOARD.id);
    expect(shuffled.slice().sort()).toEqual(ids.slice().sort());
    expect(shuffled).not.toEqual(ids);
    expect(stableShuffle(ids, INTERRUPT_SOURCE_FLAG_BOARD.id)).toEqual(shuffled);
  });
});

/** Short labels on the overview's `var DZ`, and the course name of each slot. */
const ADDRESSING_MODE_NAME: Readonly<Record<string, string>> = {
  寄存器: '寄存器寻址',
  立即: '立即寻址',
  直接: '直接寻址',
  间接: '寄存器间接寻址',
  变址: '变址寻址',
  相对: '相对寻址',
  位: '位寻址',
};

function decodeOverviewPane(html: string, key: string): string {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"([A-Za-z0-9+/=]+)"`));
  if (!match?.[1]) throw new Error(`overview is missing pane ${key}`);
  return Buffer.from(match[1], 'base64').toString('utf8');
}

function addressingReveals(html: string): { key: string; instruction: string; answer: string }[] {
  const pane = decodeOverviewPane(html, 'addr');
  const block = pane.match(/var DZ = \[([\s\S]*?)\n {2}\];/);
  if (!block?.[1]) throw new Error('addressing pane is missing var DZ');
  const entries = [...block[1].matchAll(/k:\s*'([^']+)'[\s\S]*?ans:\s*'((?:\\'|[^'])*)'/g)];
  return entries.map((entry) => {
    const answer = entry[2] ?? '';
    const instruction = answer.match(/<span class="mono">([^<]+)<\/span>/)?.[1];
    if (!instruction) throw new Error(`DZ row ${entry[1]} has no revealed instruction`);
    return { key: entry[1] ?? '', instruction, answer };
  });
}

function revealedCode(answer: string): string {
  const coded = answer.match(/<\/span>\s*=\s*([^，。]+)/);
  if (coded?.[1]) return coded[1].trim();
  const opcode = answer.match(/E8–EF/);
  if (opcode?.[0]) return opcode[0];
  throw new Error(`answer has no machine code: ${answer}`);
}

describe('timer TMOD match board', () => {
  const timerPane = decodeTimerPane(readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8'));
  const classroom = readFileSync(join(COURSEWARE, 'u5-interrupt-classroom.html'), 'utf8');

  it('copies 80C51 TMOD mode, GATE, and C/T facts from the timer pane', () => {
    expect(TIMER_TMOD_BOARD.chapterId).toBe('5');
    expect(TIMER_TMOD_BOARD.knowledgePointId).toBe('6.2');
    expect(TIMER_TMOD_BOARD.sectionId).toBe('tmr-hand');
    expect(TIMER_TMOD_BOARD.moduleId).toBe('u5-overview');
    expect(TIMER_TMOD_BOARD.medalId).toBe('timer_tmod_modes');
    expect(TIMER_TMOD_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(TIMER_TMOD_BOARD.zones).toBeUndefined();
    expect(TIMER_TMOD_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target])).toEqual([
      ['mode0', 'M1 M0 = 00', '方式 0'],
      ['mode1', 'M1 M0 = 01', '方式 1'],
      ['mode2', 'M1 M0 = 10', '方式 2'],
      ['mode3', 'M1 M0 = 11', '方式 3'],
      ['ct0', 'C/T = 0', '定时'],
      ['ct1', 'C/T = 1', '计数'],
      ['gate0', 'GATE = 0', '只看 TR'],
      ['gate1', 'GATE = 1', '引脚高电平同时满足才数'],
    ]);
    expect(classroom).toContain('00/01/10/11→方式0–3');
    expect(timerPane).toContain('方式 0（13 位）');
    expect(timerPane).toContain('方式 1（16 位）');
    expect(timerPane).toContain('方式 2（8 位自动重装）');
    expect(timerPane).toContain('2<sup>13</sup> = 8192');
    expect(timerPane).toContain('2<sup>16</sup> = 65536');
    expect(timerPane).toContain('TL0 溢出时硬件把 TH0 抄回 TL0');
    expect(timerPane).toContain('只有 T0 有：TL0、TH0 拆成两个 8 位定时器，TH0 借用 TR1、TF1');
    expect(timerPane).toContain('T1：方式 3 → 停止计数');
    expect(timerPane).toContain('定时（数机器周期）');
    expect(timerPane).toContain("计数（数 ' + (who === 'T0' ? 'P3.4' : 'P3.5') + ' 引脚脉冲）");
    expect(timerPane).toContain('GATE=0：只看 TR');
    expect(timerPane).toContain('引脚高电平同时满足才数');
    expect(timerPane).toContain('高 4 位管 T1，低 4 位管 T0');
    expect(timerPane).toContain('id="p-hand"');
    expect(classroom).toContain('GATE=0：只要 TR=1 就加');
    expect(classroom).toContain('T0 看');
    expect(classroom).toContain('INT0');
    expect(classroom).toContain('T1 看');
    expect(classroom).toContain('INT1');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode0')?.targetDetail).toBe('13 位，最多 8192');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode1')?.targetDetail).toBe('16 位，最多 65536');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode2')?.targetDetail).toContain('8 位自动重装');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode2')?.targetDetail).toContain('TL0 溢出时硬件把 TH0 抄回 TL0');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode3')?.targetDetail).toContain('TH0 借用 TR1、TF1');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'mode3')?.targetDetail).toContain('停止计数');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'ct0')?.targetDetail).toBe('数机器周期');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'ct1')?.targetDetail).toContain('P3.4');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'ct1')?.targetDetail).toContain('P3.5');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'gate0')?.targetDetail).toBe('只要 TR=1 就加');
    expect(TIMER_TMOD_BOARD.pairs.find((pair) => pair.id === 'gate1')?.targetDetail).toBe('T0 看 INT0，T1 看 INT1');
    expect(TIMER_TMOD_BOARD.hint).toContain('高 4 位管 T1');
    expect(TIMER_TMOD_BOARD.hint).not.toContain('8192');
    expect(TIMER_TMOD_BOARD.hint).not.toContain('只看 TR');
  });

  it('grades a finished TMOD map and keeps a swapped mode wrong with 0 points', () => {
    const solved = Object.fromEntries(TIMER_TMOD_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(TIMER_TMOD_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, mode0: 'mode1', mode1: 'mode0' };
    const grade = gradeMatch(TIMER_TMOD_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['mode0', 'mode1']);
    expect(matchMissMessage(grade, TIMER_TMOD_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, TIMER_TMOD_BOARD)).toContain('高 4 位管 T1');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: TIMER_TMOD_BOARD.cooldownMs,
      firstClearPoints: TIMER_TMOD_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(TIMER_TMOD_BOARD.id)).toBe('practice_clears:u5-timer-tmod-modes');
    expect(practiceMedalIdsForCount(TIMER_TMOD_BOARD.id, 1)).toEqual(['timer_tmod_modes']);
    expect(practiceMedalIdsForCount(TIMER_TMOD_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'timer_tmod_modes',
      'practice_streak_3',
      'practice_daily',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'timer_tmod_modes');
    expect(medal?.title).toBe('TMOD 对上了');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: TIMER_TMOD_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「TMOD 对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: TIMER_TMOD_BOARD.cooldownMs,
      firstClearPoints: TIMER_TMOD_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: TIMER_TMOD_BOARD.cooldownMs,
      firstClearPoints: TIMER_TMOD_BOARD.firstClearPoints,
      awardToStudent: true,
    }).reason).toBe('cooldown');
  });
});

/** Courseware line shared by the overview interrupt pane and the classroom page. */
const VECTOR_ADDRESS_LINE = /入口地址：(INT0) (0003H) · (T0) (000BH) · (INT1) (0013H) · (T1) (001BH) · (串口) (0023H)，相隔 8 字节/;

function vectorAddressLine(html: string): RegExpMatchArray {
  const text = html.includes('var DATA=') ? decodeOverview(html) : html;
  const match = text.match(VECTOR_ADDRESS_LINE);
  if (!match) throw new Error('courseware is missing the vector address line');
  return match;
}

describe('interrupt vector match board', () => {
  const overviewHtml = readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8');
  const classroomHtml = readFileSync(join(COURSEWARE, 'u5-interrupt-classroom.html'), 'utf8');
  const overviewSources = sourceTable(overviewHtml);
  const classroomSources = sourceTable(classroomHtml);

  it('copies the five 80C51 vector addresses from the courseware line', () => {
    const overviewLine = vectorAddressLine(overviewHtml);
    const classroomLine = vectorAddressLine(classroomHtml);
    expect(classroomLine.slice(1)).toEqual(overviewLine.slice(1));
    expect(classroomSources).toEqual(overviewSources);
    expect(INTERRUPT_VECTOR_BOARD.chapterId).toBe('5');
    expect(INTERRUPT_VECTOR_BOARD.knowledgePointId).toBe('5.2');
    expect(INTERRUPT_VECTOR_BOARD.sectionId).toBe('int-2');
    expect(INTERRUPT_VECTOR_BOARD.moduleId).toBe('u5-overview');
    expect(INTERRUPT_VECTOR_BOARD.medalId).toBe('interrupt_vectors');
    expect(INTERRUPT_VECTOR_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(INTERRUPT_VECTOR_BOARD.zones).toBeUndefined();
    expect(INTERRUPT_VECTOR_BOARD.pairs).toHaveLength(5);
    expect(overviewHtml).toContain('href="#int-2"');
    expect(classroomHtml).toContain('各隔 8 字节');
    expect(classroomHtml).toContain('只放 LJMP');
    expect(classroomHtml).toContain('断点地址 ≠ 向量入口');

    overviewSources.forEach((row, index) => {
      const pair = INTERRUPT_VECTOR_BOARD.pairs[index];
      const abbr = overviewLine[index * 2 + 1];
      const address = overviewLine[index * 2 + 2];
      expect(pair?.prompt).toBe(row[0]);
      expect(pair?.promptHint).toContain(row[1]);
      expect(pair?.promptHint).toContain(row[4]);
      expect(abbr).toBe(row[1]);
      expect(pair?.target).toBe(address);
      expect(pair?.targetDetail).toBe('入口地址');
    });
    expect(INTERRUPT_VECTOR_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target])).toEqual([
      ['int0', '外部中断 0', '0003H'],
      ['t0', '定时器 T0', '000BH'],
      ['int1', '外部中断 1', '0013H'],
      ['t1', '定时器 T1', '001BH'],
      ['uart', '串行口', '0023H'],
    ]);
    expect(INTERRUPT_VECTOR_BOARD.hint).toContain('8 字节');
    expect(INTERRUPT_VECTOR_BOARD.hint).toContain('LJMP');
    expect(INTERRUPT_VECTOR_BOARD.hint).not.toContain('000BH');
    expect(INTERRUPT_VECTOR_BOARD.hint).not.toContain('0023H');
  });

  it('grades a finished vector map and keeps a swapped address wrong with 0 points', () => {
    const solved = Object.fromEntries(INTERRUPT_VECTOR_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(INTERRUPT_VECTOR_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, int0: 't0', t0: 'int0' };
    const grade = gradeMatch(INTERRUPT_VECTOR_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['int0', 't0']);
    expect(matchMissMessage(grade, INTERRUPT_VECTOR_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, INTERRUPT_VECTOR_BOARD)).toContain('8 字节');
    expect(matchMissMessage(grade, INTERRUPT_VECTOR_BOARD)).not.toContain('0003H');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_VECTOR_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_VECTOR_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(INTERRUPT_VECTOR_BOARD.id)).toBe('practice_clears:u5-interrupt-vectors');
    expect(practiceMedalIdsForCount(INTERRUPT_VECTOR_BOARD.id, 1)).toEqual(['interrupt_vectors']);
    expect(practiceMedalIdsForCount(INTERRUPT_VECTOR_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'interrupt_vectors',
      'practice_streak_3',
      'practice_daily',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'interrupt_vectors');
    expect(medal?.title).toBe('向量地址对上了');
    expect(medal?.points).toBe(10);
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: INTERRUPT_VECTOR_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「向量地址对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_VECTOR_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_VECTOR_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_VECTOR_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_VECTOR_BOARD.firstClearPoints,
      awardToStudent: true,
    }).reason).toBe('cooldown');
  });
});

describe('addressing mode match board', () => {
  const reveals = addressingReveals(readFileSync(UNIT3_OVERVIEW, 'utf8'));

  it('copies the seven 80C51 instructions the addressing pane reveals', () => {
    expect(reveals.map((row) => row.key)).toEqual(['寄存器', '立即', '直接', '间接', '变址', '相对', '位']);
    expect(ADDRESSING_MODE_BOARD.pairs).toHaveLength(reveals.length);
    reveals.forEach((row, index) => {
      const pair = ADDRESSING_MODE_BOARD.pairs[index];
      expect(pair?.prompt).toBe(row.instruction);
      expect(pair?.target).toBe(ADDRESSING_MODE_NAME[row.key]);
      expect(pair?.promptHint).toContain(revealedCode(row.answer));
    });
    expect(ADDRESSING_MODE_BOARD.sectionId).toBe('addressing');
    expect(ADDRESSING_MODE_BOARD.chapterId).toBe('3');
  });

  it('grades a complete mapping and rejects a swapped mode', () => {
    const solved = Object.fromEntries(ADDRESSING_MODE_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(ADDRESSING_MODE_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, imm: 'dir', dir: 'imm' };
    const grade = gradeMatch(ADDRESSING_MODE_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['imm', 'dir']);
    expect(grade.missingSlotIds).toEqual([]);
  });

  it('keeps the first-clear medal on this board and off the interrupt board', () => {
    expect(practiceClearStat(ADDRESSING_MODE_BOARD.id)).toBe('practice_clears:u3-addressing-modes');
    expect(practiceMedalIdsForCount(ADDRESSING_MODE_BOARD.id, 1)).toEqual(['addressing_modes']);
    expect(practiceMedalIdsForCount(ADDRESSING_MODE_BOARD.id, 0)).toEqual([]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'addressing_modes');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: 15,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「寻址方式对上了」+10。');
  });

  it('uses the same first-clear, cooldown, and later-clear scoring', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: ADDRESSING_MODE_BOARD.cooldownMs,
      firstClearPoints: ADDRESSING_MODE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });

    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: ADDRESSING_MODE_BOARD.cooldownMs,
      firstClearPoints: 15,
      awardToStudent: true,
    }).reason).toBe('cooldown');

    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - ADDRESSING_MODE_BOARD.cooldownMs,
      nowMs: now,
      cooldownMs: ADDRESSING_MODE_BOARD.cooldownMs,
      firstClearPoints: 15,
      awardToStudent: true,
    })).toMatchObject({ reason: 'repeat', practicePoints: 0, recordEvent: true, grantMedals: true });
  });
});

describe('CPU structure puzzle board', () => {
  const courseware = readFileSync(
    join(__dirname, '../../../public/resources/course/courseware/u2/u2-cpu-structure.html'),
    'utf8',
  );

  it('places the six figure 2-3 blocks into the three CPU groups', () => {
    expect(CPU_STRUCTURE_BOARD.chapterId).toBe('2');
    expect(CPU_STRUCTURE_BOARD.knowledgePointId).toBe('2.1');
    expect(CPU_STRUCTURE_BOARD.sectionId).toBe('cpu');
    expect(CPU_STRUCTURE_BOARD.medalId).toBe('cpu_structure_home');
    expect(CPU_STRUCTURE_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(CPU_STRUCTURE_BOARD.pairs.map((pair) => pair.prompt)).toEqual(['ALU', 'ACC', 'IR', 'ID', 'PC', 'DPTR']);
    expect(CPU_STRUCTURE_BOARD.zones?.map((zone) => [zone.title, ...zone.slotIds])).toEqual([
      ['运算器', 'alu', 'acc'],
      ['控制器', 'ir', 'id'],
      ['其他寄存器', 'pc', 'dptr'],
    ]);
    const slotIds = CPU_STRUCTURE_BOARD.zones?.flatMap((zone) => zone.slotIds) ?? [];
    expect(slotIds).toEqual(CPU_STRUCTURE_BOARD.pairs.map((pair) => pair.id));
    expect(new Set(slotIds).size).toBe(slotIds.length);
    for (const name of ['ALU', 'ACC', 'IR', 'ID', 'PC', 'DPTR']) {
      expect(courseware).toContain(`'${name}'`);
    }
    expect(courseware).toContain("host.id='cpu'");
    expect(CPU_STRUCTURE_BOARD.hint).not.toContain('ALU');
    expect(CPU_STRUCTURE_BOARD.hint).toContain('0000H');
  });

  it('grades a finished puzzle and keeps a swapped block inside one group wrong', () => {
    const solved = Object.fromEntries(CPU_STRUCTURE_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(CPU_STRUCTURE_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, alu: 'acc', acc: 'alu' };
    const grade = gradeMatch(CPU_STRUCTURE_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['alu', 'acc']);
    expect(matchMissMessage(grade, CPU_STRUCTURE_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, CPU_STRUCTURE_BOARD)).toContain('0000H');
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(CPU_STRUCTURE_BOARD.id)).toBe('practice_clears:u2-cpu-structure');
    expect(practiceMedalIdsForCount(CPU_STRUCTURE_BOARD.id, 1)).toEqual(['cpu_structure_home']);
    expect(practiceMedalIdsForCount(CPU_STRUCTURE_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'cpu_structure_home',
      'practice_streak_3',
      'practice_daily',
    ]);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'cpu_structure_home');
    expect(medal?.title).toBe('CPU 结构归位');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: CPU_STRUCTURE_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「CPU 结构归位」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: CPU_STRUCTURE_BOARD.cooldownMs,
      firstClearPoints: CPU_STRUCTURE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: CPU_STRUCTURE_BOARD.cooldownMs,
      firstClearPoints: CPU_STRUCTURE_BOARD.firstClearPoints,
      awardToStudent: true,
    }).reason).toBe('cooldown');
  });
});

describe('memory region match board', () => {
  const courseware = readFileSync(
    join(__dirname, '../../../public/resources/course/courseware/u2/u2-memory.html'),
    'utf8',
  );

  it('matches the five regions on the unit 2 memory map', () => {
    expect(MEMORY_REGION_BOARD.chapterId).toBe('2');
    expect(MEMORY_REGION_BOARD.knowledgePointId).toBe('2.2');
    expect(MEMORY_REGION_BOARD.sectionId).toBe('memory');
    expect(MEMORY_REGION_BOARD.moduleId).toBe('u2-memory');
    expect(MEMORY_REGION_BOARD.medalId).toBe('memory_regions');
    expect(MEMORY_REGION_BOARD.zones).toBeUndefined();
    expect(MEMORY_REGION_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(MEMORY_REGION_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target])).toEqual([
      ['bank', '工作寄存器区', '00H ~ 1FH'],
      ['bit', '位寻址区', '20H ~ 2FH'],
      ['user', '用户 RAM 区', '30H ~ 7FH'],
      ['sfr', 'SFR', '80H ~ FFH'],
      ['xram', '片外数据存储器', 'MOVX + DPTR'],
    ]);
    expect(courseware).toContain("host.id='memory'");
    expect(courseware).toContain('工作寄存器区 00H ~ 1FH');
    expect(courseware).toContain('位寻址区 20H ~ 2FH');
    expect(courseware).toContain('用户 RAM 区 30H ~ 7FH');
    expect(courseware).toContain('80H ~ FFH');
    expect(courseware).toContain('只能用直接寻址');
    expect(courseware).toContain('MOVX 指令 + DPTR');
    expect(MEMORY_REGION_BOARD.hint).not.toContain('20H');
    expect(MEMORY_REGION_BOARD.hint).toContain('MOVX');
  });

  it('grades a finished map and keeps a swapped internal band wrong', () => {
    const solved = Object.fromEntries(MEMORY_REGION_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(MEMORY_REGION_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, bit: 'user', user: 'bit' };
    const grade = gradeMatch(MEMORY_REGION_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['bit', 'user']);
    expect(matchMissMessage(grade, MEMORY_REGION_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, MEMORY_REGION_BOARD)).toContain('MOVX');
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(MEMORY_REGION_BOARD.id)).toBe('practice_clears:u2-memory-regions');
    expect(practiceMedalIdsForCount(MEMORY_REGION_BOARD.id, 1)).toEqual(['memory_regions']);
    expect(practiceMedalIdsForCount(MEMORY_REGION_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'memory_regions',
      'practice_streak_3',
      'practice_daily',
    ]);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'memory_regions');
    expect(medal?.title).toBe('存储区分清了');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: MEMORY_REGION_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「存储区分清了」+10。');
  });
});
