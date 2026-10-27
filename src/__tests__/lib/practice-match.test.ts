import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { practiceClearStat, practiceMedalIdsForCount } from '@/lib/practice-medals';
import {
  INTERRUPT_SOURCE_FLAG_BOARD,
  decideMatchReward,
  gradeMatch,
  matchClearMessage,
  stableShuffle,
} from '@/lib/practice-match';

const COURSEWARE = join(__dirname, '../../../public/resources/course/courseware/u5');

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
