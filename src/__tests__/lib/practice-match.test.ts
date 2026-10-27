import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { practiceClearStat, practiceMedalIdsForCount } from '@/lib/practice-medals';
import {
  ADDRESSING_MODE_BOARD,
  INTERRUPT_SOURCE_FLAG_BOARD,
  decideMatchReward,
  gradeMatch,
  matchClearMessage,
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
  const data = JSON.parse(html.slice(start + marker.length, end + 1)) as { int: string };
  return Buffer.from(data.int, 'base64').toString('utf8');
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
  const coded = answer.match(/=\s*([^，。]+)/);
  if (coded?.[1]) return coded[1].trim();
  const opcode = answer.match(/E8–EF/);
  if (opcode?.[0]) return opcode[0];
  throw new Error(`answer has no machine code: ${answer}`);
}

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
