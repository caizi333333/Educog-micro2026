import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { practiceClearStat, practiceMedalIdsForCount } from '@/lib/practice-medals';
import {
  ADDRESSING_MODE_BOARD,
  CPU_STRUCTURE_BOARD,
  EXTERNAL_BUS_BOARD,
  INSTRUCTION_TEAMS_BOARD,
  INTERRUPT_IE_ENABLE_BOARD,
  INTERRUPT_PRIORITY_BOARD,
  INTERRUPT_SOURCE_FLAG_BOARD,
  INTERRUPT_VECTOR_BOARD,
  MEMORY_REGION_BOARD,
  TCON_CONTROL_BITS_BOARD,
  TIMER_TMOD_BOARD,
  decideMatchReward,
  findMatchBoard,
  gradeMatch,
  matchClearMessage,
  matchMissMessage,
  stableShuffle,
} from '@/lib/practice-match';

const COURSEWARE = join(__dirname, '../../../public/resources/course/courseware/u5');
const ADDRESSING_DESIGN = join(__dirname, '../../../public/resources/course/courseware/u3/u3-addressing-design.html');

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
  const classroom = sourceTable(readFileSync(join(COURSEWARE, 'lib/u5-interrupt-classroom.js'), 'utf8'));

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

/** Short labels on the addressing design page's `var DZ`, and the course name of each slot. */
const ADDRESSING_MODE_NAME: Readonly<Record<string, string>> = {
  寄存器: '寄存器寻址',
  立即: '立即寻址',
  直接: '直接寻址',
  间接: '寄存器间接寻址',
  变址: '变址寻址',
  相对: '相对寻址',
  位: '位寻址',
};

function addressingReveals(html: string): { key: string; instruction: string; answer: string }[] {
  const block = html.match(/var DZ = \[([\s\S]*?)\n {2}\];/);
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
  const classroom = ['u5-lesson-1.html', 'u5-lesson-2.html', 'u5-lesson-3.html']
    .map((name) => readFileSync(join(COURSEWARE, name), 'utf8'))
    .join('\n');

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
  const classroomHtml = ['u5-lesson-1.html', 'u5-lesson-2.html', 'u5-lesson-3.html']
    .map((name) => readFileSync(join(COURSEWARE, name), 'utf8'))
    .join('\n');
  const overviewSources = sourceTable(overviewHtml);
  const classroomSources = sourceTable(readFileSync(join(COURSEWARE, 'lib/u5-interrupt-classroom.js'), 'utf8'));

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

/** Pane ⑤ bit order, high bit first: D4 ES … D0 EX0. */
const IE_SOURCE_BITS = /D4 (ES)，D3 (ET1)，D2 (EX1)，D1 (ET0)，D0 (EX0)/;
const IE_MASTER_SWITCH = 'IE 里 EA 是总开关，另外 5 位是分开关，两个都打开 CPU 才理。';

function ieSourceBits(html: string): RegExpMatchArray {
  const text = html.includes('var DATA=') ? decodeOverview(html) : html;
  const match = text.match(IE_SOURCE_BITS);
  if (!match) throw new Error('courseware is missing the IE source-bit note');
  return match;
}

function ieBitWhere(html: string, abbr: string): string {
  const match = html.match(new RegExp(`<td class="abbr">${abbr}</td>[\\s\\S]*?<td class="where">(IE\\.\\d)</td>`));
  if (!match?.[1]) throw new Error(`courseware is missing the ${abbr} bit address`);
  return match[1];
}

describe('IE enable match board', () => {
  const overviewHtml = readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8');
  const lesson1 = readFileSync(join(COURSEWARE, 'u5-lesson-1.html'), 'utf8');
  const lesson2 = readFileSync(join(COURSEWARE, 'u5-lesson-2.html'), 'utf8');
  const sources = sourceTable(overviewHtml);

  it('copies the five 80C51 source enables from pane ⑤ and leaves EA as the master switch', () => {
    const overviewBits = ieSourceBits(overviewHtml);
    const lessonBits = ieSourceBits(lesson1);
    expect(lessonBits.slice(1)).toEqual(overviewBits.slice(1));
    expect(decodeOverview(overviewHtml)).toContain(IE_MASTER_SWITCH);
    expect(lesson1).toContain(IE_MASTER_SWITCH);
    expect(overviewHtml).toContain('href="#int-5"');
    expect(lesson2).toContain('总中断允许（总闸）');
    expect(ieBitWhere(lesson2, 'EA')).toBe('IE.7');

    const lowToHigh = [overviewBits[5], overviewBits[4], overviewBits[3], overviewBits[2], overviewBits[1]];
    expect(INTERRUPT_IE_ENABLE_BOARD.chapterId).toBe('5');
    expect(INTERRUPT_IE_ENABLE_BOARD.knowledgePointId).toBe('5.2');
    expect(INTERRUPT_IE_ENABLE_BOARD.sectionId).toBe('int-5');
    expect(INTERRUPT_IE_ENABLE_BOARD.moduleId).toBe('u5-overview');
    expect(INTERRUPT_IE_ENABLE_BOARD.medalId).toBe('interrupt_ie_enables');
    expect(INTERRUPT_IE_ENABLE_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(INTERRUPT_IE_ENABLE_BOARD.zones).toBeUndefined();
    expect(INTERRUPT_IE_ENABLE_BOARD.pairs).toHaveLength(5);
    expect(INTERRUPT_IE_ENABLE_BOARD.pairs.map((pair) => pair.prompt)).toEqual(lowToHigh);
    expect(INTERRUPT_IE_ENABLE_BOARD.pairs.some((pair) => pair.prompt === 'EA')).toBe(false);
    expect(INTERRUPT_IE_ENABLE_BOARD.hint).toBe(IE_MASTER_SWITCH);
    expect(INTERRUPT_IE_ENABLE_BOARD.hint).not.toContain('EX0');
    expect(INTERRUPT_IE_ENABLE_BOARD.hint).not.toContain('外部中断');

    sources.forEach((row, index) => {
      const pair = INTERRUPT_IE_ENABLE_BOARD.pairs[index];
      expect(pair?.prompt).toBe(lowToHigh[index]);
      expect(pair?.promptHint).toBe(`D${index} · ${ieBitWhere(lesson2, pair?.prompt ?? '')}`);
      expect(pair?.target).toBe(row[0]);
      expect(pair?.targetDetail).toBe(INTERRUPT_SOURCE_FLAG_BOARD.pairs[index]?.promptHint);
    });
    expect(INTERRUPT_IE_ENABLE_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target])).toEqual([
      ['ex0', 'EX0', '外部中断 0'],
      ['et0', 'ET0', '定时器 T0'],
      ['ex1', 'EX1', '外部中断 1'],
      ['et1', 'ET1', '定时器 T1'],
      ['es', 'ES', '串行口'],
    ]);
  });

  it('grades a finished enable map and keeps a swapped bit wrong with 0 points', () => {
    const solved = Object.fromEntries(INTERRUPT_IE_ENABLE_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(INTERRUPT_IE_ENABLE_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, ex0: 'et0', et0: 'ex0' };
    const grade = gradeMatch(INTERRUPT_IE_ENABLE_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['ex0', 'et0']);
    expect(matchMissMessage(grade, INTERRUPT_IE_ENABLE_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, INTERRUPT_IE_ENABLE_BOARD)).toContain('总开关');
    expect(matchMissMessage(grade, INTERRUPT_IE_ENABLE_BOARD)).not.toContain('EX0');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(INTERRUPT_IE_ENABLE_BOARD.id)).toBe('practice_clears:u5-interrupt-ie-enables');
    expect(practiceMedalIdsForCount(INTERRUPT_IE_ENABLE_BOARD.id, 1)).toEqual(['interrupt_ie_enables']);
    expect(practiceMedalIdsForCount(INTERRUPT_IE_ENABLE_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'interrupt_ie_enables',
      'practice_streak_3',
      'practice_daily',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'interrupt_ie_enables');
    expect(medal?.title).toBe('允许位对上了');
    expect(medal?.points).toBe(10);
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「允许位对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
  });
});

interface GlossaryRow {
  abbr: string;
  how: string;
  cn: string;
  where: string;
}

function tconGlossary(html: string): GlossaryRow[] {
  const start = html.indexOf('四、TCON');
  const end = html.indexOf('五、SCON', start);
  if (start < 0 || end < 0) throw new Error('courseware is missing the TCON glossary');
  const block = html.slice(start, end);
  return [...block.matchAll(/<td class="abbr">([^<]+)<\/td><td class="how">([^<]+)<\/td><td class="cn">([^<]+)<\/td><td class="where">([^<]+)<\/td>/g)]
    .map((row) => ({ abbr: row[1] ?? '', how: row[2] ?? '', cn: row[3] ?? '', where: row[4] ?? '' }));
}

describe('TCON control-bit match board', () => {
  const overviewHtml = readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8');
  const lesson1 = readFileSync(join(COURSEWARE, 'u5-lesson-1.html'), 'utf8');
  const lesson2 = readFileSync(join(COURSEWARE, 'u5-lesson-2.html'), 'utf8');
  const timerPane = decodeTimerPane(overviewHtml);
  const glossary = tconGlossary(lesson2);
  const bitOrder = ['TR0', 'TR1', 'TF0', 'TF1', 'IT0', 'IT1'] as const;

  it('copies TR, TF, and IT from the TCON glossary and leaves request flags on the source board', () => {
    expect(overviewHtml).toContain('href="#int-4"');
    expect(decodeOverview(overviewHtml)).toContain('IT0=0 低电平触发，IT0=1 下降沿触发');
    expect(lesson1).toContain('IT0=0 低电平触发，IT0=1 下降沿触发');
    expect(lesson1).toContain('写 <code>0</code>＝低电平触发，写 <code>1</code>＝下降沿触发');
    expect(lesson2).toContain('TF</b>（满了）≠ <b>TR</b>（开跑）');
    expect(timerPane).toContain('GATE=0：只看 TR');
    expect(glossary.map((row) => row.abbr)).toEqual([
      'TCON', 'TF0', 'TF1', 'TR0', 'TR1', 'IE0', 'IE1', 'IT0', 'IT1',
    ]);

    expect(TCON_CONTROL_BITS_BOARD.chapterId).toBe('5');
    expect(TCON_CONTROL_BITS_BOARD.knowledgePointId).toBe('5.2');
    expect(TCON_CONTROL_BITS_BOARD.sectionId).toBe('int-4');
    expect(TCON_CONTROL_BITS_BOARD.moduleId).toBe('u5-overview');
    expect(TCON_CONTROL_BITS_BOARD.medalId).toBe('tcon_control_bits');
    expect(TCON_CONTROL_BITS_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(TCON_CONTROL_BITS_BOARD.zones).toBeUndefined();
    expect(TCON_CONTROL_BITS_BOARD.pairs).toHaveLength(6);
    expect(TCON_CONTROL_BITS_BOARD.pairs.map((pair) => pair.prompt)).toEqual([...bitOrder]);
    expect(TCON_CONTROL_BITS_BOARD.pairs.some((pair) => pair.prompt === 'IE0' || pair.prompt === 'IE1')).toBe(false);
    expect(TCON_CONTROL_BITS_BOARD.hint).toBe('TF 是满了，TR 是开跑。写 0 是低电平触发，写 1 是下降沿触发。GATE=0：只看 TR。');
    expect(TCON_CONTROL_BITS_BOARD.hint).not.toContain('TR0');
    expect(TCON_CONTROL_BITS_BOARD.hint).not.toContain('IE0');
    expect(TCON_CONTROL_BITS_BOARD.hint).not.toContain('波特');
    expect(JSON.stringify(TCON_CONTROL_BITS_BOARD)).not.toContain('8052');
    expect(JSON.stringify(TCON_CONTROL_BITS_BOARD)).not.toContain('波特');

    for (const abbr of bitOrder) {
      const row = glossary.find((item) => item.abbr === abbr);
      const pair = TCON_CONTROL_BITS_BOARD.pairs.find((item) => item.prompt === abbr);
      expect(row).toBeDefined();
      expect(pair?.target).toBe(row?.cn);
      expect(pair?.promptHint).toBe(row?.where);
      expect(pair?.targetDetail).toBe(row?.how);
    }
    expect(INTERRUPT_SOURCE_FLAG_BOARD.pairs.map((pair) => pair.target)).toEqual([
      'IE0', 'TF0', 'IE1', 'TF1', 'RI / TI',
    ]);
  });

  it('grades a finished TCON map and keeps a swapped run bit wrong with 0 points', () => {
    const solved = Object.fromEntries(TCON_CONTROL_BITS_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(TCON_CONTROL_BITS_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, tr0: 'tr1', tr1: 'tr0' };
    const grade = gradeMatch(TCON_CONTROL_BITS_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['tr0', 'tr1']);
    expect(matchMissMessage(grade, TCON_CONTROL_BITS_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, TCON_CONTROL_BITS_BOARD)).toContain('GATE=0：只看 TR');
    expect(matchMissMessage(grade, TCON_CONTROL_BITS_BOARD)).not.toContain('TR0');
    expect(matchMissMessage(grade, TCON_CONTROL_BITS_BOARD)).not.toContain('IE0');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: TCON_CONTROL_BITS_BOARD.cooldownMs,
      firstClearPoints: TCON_CONTROL_BITS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(TCON_CONTROL_BITS_BOARD.id)).toBe('practice_clears:u5-tcon-control-bits');
    expect(practiceMedalIdsForCount(TCON_CONTROL_BITS_BOARD.id, 1)).toEqual(['tcon_control_bits']);
    expect(practiceMedalIdsForCount(TCON_CONTROL_BITS_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'tcon_control_bits',
      'practice_streak_3',
      'practice_daily',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'tcon_control_bits');
    expect(medal?.title).toBe('TCON 对上了');
    expect(medal?.points).toBe(10);
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: TCON_CONTROL_BITS_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「TCON 对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: TCON_CONTROL_BITS_BOARD.cooldownMs,
      firstClearPoints: TCON_CONTROL_BITS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: TCON_CONTROL_BITS_BOARD.cooldownMs,
      firstClearPoints: TCON_CONTROL_BITS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
  });
});

/** Pane ⑥ bit order, high bit first: D4 PS … D0 PX0. */
const IP_PRIORITY_BITS = /D4 (PS)，D3 (PT1)，D2 (PX1)，D1 (PT0)，D0 (PX0)/;
const IP_PRIORITY_KEY = '先看 IP 分高低两级，同级再按“外0、定0、外1、定1、串”排；高级能打断低级，同级不能打断同级。';
const IP_HIGH_PRIORITY = '置 1 为高优先级';
const IP_NATURAL_SOURCES = ['INT0', 'T0', 'INT1', 'T1', '串口'] as const;

function priorityPane(html: string): string {
  const text = html.includes('var DATA=') ? decodeOverview(html) : html;
  const start = text.indexOf('id="p6"');
  const end = text.indexOf('id="p7"', start);
  if (start < 0 || end < 0) throw new Error('courseware is missing pane ⑥');
  return text.slice(start, end);
}

describe('IP priority match board', () => {
  const overviewHtml = readFileSync(join(COURSEWARE, 'u5-overview.html'), 'utf8');
  const lesson1 = readFileSync(join(COURSEWARE, 'u5-lesson-1.html'), 'utf8');
  const lesson2 = readFileSync(join(COURSEWARE, 'u5-lesson-2.html'), 'utf8');
  const classroomJs = readFileSync(join(COURSEWARE, 'lib/u5-interrupt-classroom.js'), 'utf8');

  it('copies PX0, PT0, PX1, PT1, and PS from pane ⑥ and leaves undefined bits off the board', () => {
    const pane = priorityPane(overviewHtml);
    const lessonPane = priorityPane(lesson1);
    const highToLow = pane.match(IP_PRIORITY_BITS);
    expect(highToLow?.slice(1)).toEqual(['PS', 'PT1', 'PX1', 'PT0', 'PX0']);
    expect(lessonPane.match(IP_PRIORITY_BITS)?.slice(1)).toEqual(highToLow?.slice(1));
    expect(pane).toContain(IP_PRIORITY_KEY);
    expect(lessonPane).toContain(IP_PRIORITY_KEY);
    expect(pane).toContain('D7–D5 未定义');
    expect(pane).toContain(IP_HIGH_PRIORITY);
    expect(pane).toContain('自然顺序：INT0 &gt; T0 &gt; INT1 &gt; T1 &gt; 串口');
    expect(decodeOverview(overviewHtml)).toContain(
      "var NM=['INT0','T0','INT1','T1','串口'];var IPbit=[0,1,2,3,4]; // PX0 PT0 PX1 PT1 PS",
    );
    expect(classroomJs).toContain("var NM=['INT0','T0','INT1','T1','串口'];");
    expect(classroomJs).toContain('var IPbit=[0,1,2,3,4];');
    expect(classroomJs).toContain('// PX0 PT0 PX1 PT1 PS');
    expect(overviewHtml).toContain('href="#int-6"');

    const lowToHigh = ['PX0', 'PT0', 'PX1', 'PT1', 'PS'];
    expect(INTERRUPT_PRIORITY_BOARD.chapterId).toBe('5');
    expect(INTERRUPT_PRIORITY_BOARD.knowledgePointId).toBe('5.2');
    expect(INTERRUPT_PRIORITY_BOARD.sectionId).toBe('int-6');
    expect(INTERRUPT_PRIORITY_BOARD.moduleId).toBe('u5-overview');
    expect(INTERRUPT_PRIORITY_BOARD.medalId).toBe('interrupt_priority');
    expect(INTERRUPT_PRIORITY_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(INTERRUPT_PRIORITY_BOARD.zones).toBeUndefined();
    expect(INTERRUPT_PRIORITY_BOARD.pairs).toHaveLength(5);
    expect(INTERRUPT_PRIORITY_BOARD.pairs.map((pair) => pair.prompt)).toEqual(lowToHigh);
    expect(INTERRUPT_PRIORITY_BOARD.pairs.map((pair) => pair.promptHint)).toEqual(['D0', 'D1', 'D2', 'D3', 'D4']);
    expect(INTERRUPT_PRIORITY_BOARD.pairs.map((pair) => pair.target)).toEqual([...IP_NATURAL_SOURCES]);
    expect(INTERRUPT_PRIORITY_BOARD.pairs.every((pair) => pair.targetDetail === IP_HIGH_PRIORITY)).toBe(true);
    expect(INTERRUPT_PRIORITY_BOARD.hint).toBe(IP_PRIORITY_KEY);
    expect(INTERRUPT_PRIORITY_BOARD.hint).not.toContain('PX0');
    expect(INTERRUPT_PRIORITY_BOARD.hint).not.toContain('INT0');
    expect(JSON.stringify(INTERRUPT_PRIORITY_BOARD)).not.toContain('8052');
    expect(JSON.stringify(INTERRUPT_PRIORITY_BOARD)).not.toContain('波特');
    expect(JSON.stringify(INTERRUPT_PRIORITY_BOARD)).not.toContain('PT2');
    expect(findMatchBoard(INTERRUPT_PRIORITY_BOARD.id)).toBe(INTERRUPT_PRIORITY_BOARD);

    const glossaryStart = lesson2.indexOf('三、IP');
    const glossaryEnd = lesson2.indexOf('四、TCON', glossaryStart);
    const glossary = lesson2.slice(glossaryStart, glossaryEnd);
    IP_NATURAL_SOURCES.forEach((source, index) => {
      const pair = INTERRUPT_PRIORITY_BOARD.pairs[index];
      expect(pair?.target).toBe(source);
      expect(glossary).toContain(`<td class="abbr">${pair?.prompt}</td>`);
      expect(glossary).toContain(source === '串口' ? '串口优先级' : `${source} 优先级`);
    });
  });

  it('grades a finished priority map and keeps a swapped bit wrong with 0 points', () => {
    const solved = Object.fromEntries(INTERRUPT_PRIORITY_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(INTERRUPT_PRIORITY_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, px0: 'pt0', pt0: 'px0' };
    const grade = gradeMatch(INTERRUPT_PRIORITY_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['px0', 'pt0']);
    expect(matchMissMessage(grade, INTERRUPT_PRIORITY_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, INTERRUPT_PRIORITY_BOARD)).toContain('高低两级');
    expect(matchMissMessage(grade, INTERRUPT_PRIORITY_BOARD)).not.toContain('PX0');
    expect(matchMissMessage(grade, INTERRUPT_PRIORITY_BOARD)).not.toContain('INT0');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_PRIORITY_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_PRIORITY_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(INTERRUPT_PRIORITY_BOARD.id)).toBe('practice_clears:u5-interrupt-priority');
    expect(practiceMedalIdsForCount(INTERRUPT_PRIORITY_BOARD.id, 1)).toEqual(['interrupt_priority']);
    expect(practiceMedalIdsForCount(INTERRUPT_PRIORITY_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'interrupt_priority',
      'practice_streak_3',
      'practice_daily',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT_SOURCE_FLAG_BOARD.id, 1)).toEqual(['interrupt_source_flags']);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'interrupt_priority');
    expect(medal?.title).toBe('优先级对上了');
    expect(medal?.points).toBe(10);
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: INTERRUPT_PRIORITY_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「优先级对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_PRIORITY_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_PRIORITY_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_PRIORITY_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_PRIORITY_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
  });
});

describe('addressing mode match board', () => {
  const reveals = addressingReveals(readFileSync(ADDRESSING_DESIGN, 'utf8'));

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

describe('external bus match board', () => {
  const courseware = readFileSync(
    join(__dirname, '../../../public/resources/course/courseware/u2/u2-bus.html'),
    'utf8',
  );

  it('matches the six bus roles written on the unit 2 bus page', () => {
    expect(findMatchBoard('u2-external-bus')).toBe(EXTERNAL_BUS_BOARD);
    expect(EXTERNAL_BUS_BOARD.chapterId).toBe('2');
    expect(EXTERNAL_BUS_BOARD.knowledgePointId).toBe('2.6');
    expect(EXTERNAL_BUS_BOARD.sectionId).toBe('bus');
    expect(EXTERNAL_BUS_BOARD.moduleId).toBe('u2-bus');
    expect(EXTERNAL_BUS_BOARD.medalId).toBe('external_bus');
    expect(EXTERNAL_BUS_BOARD.zones).toBeUndefined();
    expect(EXTERNAL_BUS_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(EXTERNAL_BUS_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target])).toEqual([
      ['p0', 'P0', '低 8 位地址 / 数据分时复用'],
      ['p2', 'P2', '高 8 位地址 A15~A8'],
      ['ale', 'ALE', '锁存 P0 低 8 位地址'],
      ['psen', 'PSEN', '选通外部程序存储器'],
      ['ea', 'EA', 'EA = 1 先片内，EA = 0 只片外'],
      ['rdwr', 'RD / WR', '读写外部数据存储器'],
    ]);
    expect(courseware).toContain("host.id='bus'");
    expect(courseware).toContain('P0 一条线干两件事');
    expect(courseware).toContain('低 8 位地址 / 数据');
    expect(courseware).toContain('分时复用');
    expect(courseware).toContain('先送低 8 位地址');
    expect(courseware).toContain('改作双向数据线 D7~D0');
    expect(courseware).toContain('它没有第二个身份');
    expect(courseware).toContain('高 8 位地址 A15~A8');
    expect(courseware).toContain('整条指令期间稳定');
    expect(courseware).toContain('不需要外接地址锁存器');
    expect(courseware).toContain('ALE 地址锁存允许');
    expect(courseware).toContain('其下降沿把 P0 上的低 8 位地址锁进 74LS373');
    expect(courseware).toContain('PSEN 外部程序存储器读选通');
    expect(courseware).toContain('选通外部程序存储器');
    expect(courseware).toContain('取指令时由它选通');
    expect(courseware).toContain('低电平有效');
    expect(courseware).toContain('内外程序存储器选择');
    expect(courseware).toContain('EA = 1（接 +5V）时，先访问片内 ROM');
    expect(courseware).toContain('EA = 0（接地）时只访问片外 ROM');
    expect(courseware).toContain('8031 片内没有 ROM，所以 EA 必须接地');
    expect(courseware).toContain('P3.7、P3.6 的第二功能');
    expect(courseware).toContain('读写外部数据存储器');
    expect(courseware).toContain('外扩数据存储器要用');
    expect(courseware).toContain('不分时就不需要锁存');
    expect(courseware).toContain('选通外部 ROM 的是 PSEN，选片内外的是 EA。');
    const spoken = [
      EXTERNAL_BUS_BOARD.title,
      EXTERNAL_BUS_BOARD.prompt,
      EXTERNAL_BUS_BOARD.hint,
      ...EXTERNAL_BUS_BOARD.pairs.flatMap((pair) => [pair.prompt, pair.promptHint, pair.target, pair.targetDetail]),
    ].join('\n');
    expect(spoken).not.toContain('8052');
    expect(spoken).not.toContain('波特');
    expect(spoken).toContain('80C51');
    expect(EXTERNAL_BUS_BOARD.hint).not.toContain('74LS373');
    expect(EXTERNAL_BUS_BOARD.hint).not.toContain('A15~A8');
    expect(EXTERNAL_BUS_BOARD.hint).toContain('不分时就不需要锁存');
  });

  it('grades a finished bus map and keeps a swapped port wrong', () => {
    const solved = Object.fromEntries(EXTERNAL_BUS_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(EXTERNAL_BUS_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, p0: 'p2', p2: 'p0' };
    const grade = gradeMatch(EXTERNAL_BUS_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['p0', 'p2']);
    expect(matchMissMessage(grade, EXTERNAL_BUS_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, EXTERNAL_BUS_BOARD)).toContain('不分时就不需要锁存');
    expect(matchMissMessage(grade, EXTERNAL_BUS_BOARD)).not.toContain('74LS373');
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(EXTERNAL_BUS_BOARD.id)).toBe('practice_clears:u2-external-bus');
    expect(practiceMedalIdsForCount(EXTERNAL_BUS_BOARD.id, 1)).toEqual(['external_bus']);
    expect(practiceMedalIdsForCount(EXTERNAL_BUS_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'external_bus',
      'practice_streak_3',
      'practice_daily',
    ]);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'external_bus');
    expect(medal?.title).toBe('总线对上了');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: EXTERNAL_BUS_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「总线对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: EXTERNAL_BUS_BOARD.cooldownMs,
      firstClearPoints: EXTERNAL_BUS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: EXTERNAL_BUS_BOARD.cooldownMs,
      firstClearPoints: EXTERNAL_BUS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: EXTERNAL_BUS_BOARD.cooldownMs,
      firstClearPoints: EXTERNAL_BUS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
  });
});

describe('instruction team match board', () => {
  const courseware = readFileSync(
    join(__dirname, '../../../public/resources/course/courseware/u4/u4-classroom.html'),
    'utf8',
  );

  it('matches the five teams on the unit 4 panorama', () => {
    expect(findMatchBoard('u4-instruction-teams')).toBe(INSTRUCTION_TEAMS_BOARD);
    expect(INSTRUCTION_TEAMS_BOARD.chapterId).toBe('4');
    expect(INSTRUCTION_TEAMS_BOARD.knowledgePointId).toBe('3.5');
    expect(INSTRUCTION_TEAMS_BOARD.sectionId).toBe('s-map');
    expect(INSTRUCTION_TEAMS_BOARD.moduleId).toBe('u4-classroom');
    expect(INSTRUCTION_TEAMS_BOARD.medalId).toBe('instruction_teams');
    expect(INSTRUCTION_TEAMS_BOARD.zones).toBeUndefined();
    expect(INSTRUCTION_TEAMS_BOARD.cooldownMs).toBe(10 * 60 * 1000);
    expect(INSTRUCTION_TEAMS_BOARD.pairs.map((pair) => [pair.id, pair.prompt, pair.target, pair.targetDetail])).toEqual([
      ['mov', '数据传送', 'MOV A,Rn', '只搬不算 · A←(Rn)'],
      ['alu', '算术运算', 'ADD A,Rn', '加减乘除与十进制调整 · A←(A)+(Rn)'],
      ['logic', '逻辑运算', 'ANL A,Rn', '按位做与、或、异或 · A←(A)∧(Rn)'],
      ['jump', '控制转移', 'LJMP addr16', '改写 PC · PC←addr16'],
      ['bit', '位操作', 'MOV C,bit', '只跟单个位打交道 · CY←(bit)'],
    ]);
    expect(courseware).toContain('id="s-map"');
    expect(courseware).toContain('var TEAMS = {');
    expect(courseware).toContain("name:'数据传送', alias:'搬运团队'");
    expect(courseware).toContain("sec:'3.3'");
    expect(courseware).toContain('只搬不算');
    expect(courseware).toContain("{ m:'MOV', ops:'A,Rn'");
    expect(courseware).toContain("fn:'A←(Rn)'");
    expect(courseware).toContain("name:'算术运算', alias:'计算团队'");
    expect(courseware).toContain('加减乘除与十进制调整');
    expect(courseware).toContain("{ m:'ADD',  ops:'A,Rn'");
    expect(courseware).toContain("fn:'A←(A)+(Rn)'");
    expect(courseware).toContain("name:'逻辑运算', alias:'逻辑思维团队'");
    expect(courseware).toContain('按位做与、或、异或');
    expect(courseware).toContain("{ m:'ANL', ops:'A,Rn'");
    expect(courseware).toContain("fn:'A←(A)∧(Rn)'");
    expect(courseware).toContain("name:'控制转移', alias:'引导团队'");
    expect(courseware).toContain('改写 PC');
    expect(courseware).toContain("{ m:'LJMP', ops:'addr16'");
    expect(courseware).toContain("fn:'PC←addr16'");
    expect(courseware).toContain("name:'位操作'");
    expect(courseware).toContain("alias:'位操作团队'");
    expect(courseware).toContain('只跟单个位打交道');
    expect(courseware).toContain("{ m:'MOV', ops:'C,bit'");
    expect(courseware).toContain("fn:'CY←(bit)'");
    expect(INSTRUCTION_TEAMS_BOARD.pairs.map((pair) => pair.target)).not.toContain('NOP');
    expect(INSTRUCTION_TEAMS_BOARD.pairs.map((pair) => pair.target)).not.toContain('SWAP A');
    const spoken = [
      INSTRUCTION_TEAMS_BOARD.title,
      INSTRUCTION_TEAMS_BOARD.prompt,
      INSTRUCTION_TEAMS_BOARD.hint,
      ...INSTRUCTION_TEAMS_BOARD.pairs.flatMap((pair) => [pair.prompt, pair.promptHint, pair.target, pair.targetDetail]),
    ].join('\n');
    expect(spoken).not.toContain('8052');
    expect(spoken).not.toContain('波特');
    expect(spoken).toContain('80C51');
    expect(INSTRUCTION_TEAMS_BOARD.hint).not.toContain('MOV A,Rn');
    expect(INSTRUCTION_TEAMS_BOARD.hint).not.toContain('只搬不算');
  });

  it('grades a finished team map and keeps a swapped class wrong', () => {
    const solved = Object.fromEntries(INSTRUCTION_TEAMS_BOARD.pairs.map((pair) => [pair.id, pair.id]));
    expect(gradeMatch(INSTRUCTION_TEAMS_BOARD, solved).correct).toBe(true);

    const swapped = { ...solved, mov: 'alu', alu: 'mov' };
    const grade = gradeMatch(INSTRUCTION_TEAMS_BOARD, swapped);
    expect(grade.correct).toBe(false);
    expect(grade.wrongSlotIds).toEqual(['mov', 'alu']);
    expect(matchMissMessage(grade, INSTRUCTION_TEAMS_BOARD)).toContain('还有 2 处没对上');
    expect(matchMissMessage(grade, INSTRUCTION_TEAMS_BOARD)).toContain('只碰一位');
    expect(matchMissMessage(grade, INSTRUCTION_TEAMS_BOARD)).not.toContain('MOV A,Rn');
  });

  it('uses the same first-clear medal path and the same cooldown as the other boards', () => {
    expect(practiceClearStat(INSTRUCTION_TEAMS_BOARD.id)).toBe('practice_clears:u4-instruction-teams');
    expect(practiceMedalIdsForCount(INSTRUCTION_TEAMS_BOARD.id, 1)).toEqual(['instruction_teams']);
    expect(practiceMedalIdsForCount(INSTRUCTION_TEAMS_BOARD.id, 3, { firstClearOfCampusDay: true })).toEqual([
      'instruction_teams',
      'practice_streak_3',
      'practice_daily',
    ]);
    const medal = ACHIEVEMENTS_V2.find((item) => item.id === 'instruction_teams');
    expect(medal?.title).toBe('指令大类对上了');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: INSTRUCTION_TEAMS_BOARD.firstClearPoints,
      medalTitle: medal?.title ?? null,
      medalPoints: medal?.points ?? 0,
      cooldownMinutes: 10,
    })).toBe('首次对上：+15 积分，解锁勋章「指令大类对上了」+10。');

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INSTRUCTION_TEAMS_BOARD.cooldownMs,
      firstClearPoints: INSTRUCTION_TEAMS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INSTRUCTION_TEAMS_BOARD.cooldownMs,
      firstClearPoints: INSTRUCTION_TEAMS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INSTRUCTION_TEAMS_BOARD.cooldownMs,
      firstClearPoints: INSTRUCTION_TEAMS_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
  });
});
