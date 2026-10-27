/**
 * Reusable drag-or-tap match boards for courseware practice.
 *
 * The shell is the same for every chapter: chips on one side, fixed slots
 * on the other, graded by pair id. This slice ships one board, taken from
 * the unit 5 courseware table `SRC` (overview pane ③ and the classroom page).
 * A later chapter adds another `MatchBoard` and, if it should mint a medal,
 * a catalog row whose criteria.type is `practice_clears:<board id>`.
 *
 * Grading stays in this module so the browser and the API share one answer
 * key. Points, cooldown, and medals are decided here and written by
 * `practice-match-record.ts`.
 */
import { POINTS_CONFIG } from '@/lib/points-system';

export const MATCH_CLEAR_EVENT = 'PRACTICE_CLEAR';

export interface MatchPair {
  id: string;
  /** Student-facing chip, for example 外部中断 0. */
  prompt: string;
  promptHint: string;
  /** Slot label, the request flag. */
  target: string;
  targetDetail: string;
}

export interface MatchBoard {
  id: string;
  title: string;
  prompt: string;
  /** Shown after a miss. Does not list the full mapping. */
  hint: string;
  chapterId: string;
  knowledgePointId: string;
  sectionId: string;
  moduleId: string;
  medalId: string;
  firstClearPoints: number;
  cooldownMs: number;
  pairs: readonly MatchPair[];
}

/**
 * 80C51 interrupt source → request flag.
 * Order matches the courseware: 外0、定0、外1、定1、串口.
 * IE0 is the flag bit; IE is the register name. Serial flags live in SCON.
 */
export const INTERRUPT_SOURCE_FLAG_BOARD: MatchBoard = {
  id: 'u5-interrupt-source-flags',
  title: '中断源 ↔ 请求标志',
  prompt: '把 80C51 的 5 个中断源对上各自的请求标志。',
  hint: '串口的标志 RI、TI 在 SCON，其余 4 个在 TCON。IE0 是标志位，IE 是寄存器名。',
  chapterId: '5',
  knowledgePointId: '5.2',
  sectionId: 'int-3',
  moduleId: 'u5-overview',
  medalId: 'interrupt_source_flags',
  firstClearPoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
  cooldownMs: 10 * 60 * 1000,
  pairs: [
    { id: 'int0', prompt: '外部中断 0', promptHint: 'INT0 · P3.2 引脚', target: 'IE0', targetDetail: 'TCON.1' },
    { id: 't0', prompt: '定时器 T0', promptHint: 'T0 溢出', target: 'TF0', targetDetail: 'TCON.5' },
    { id: 'int1', prompt: '外部中断 1', promptHint: 'INT1 · P3.3 引脚', target: 'IE1', targetDetail: 'TCON.3' },
    { id: 't1', prompt: '定时器 T1', promptHint: 'T1 溢出', target: 'TF1', targetDetail: 'TCON.7' },
    { id: 'uart', prompt: '串行口', promptHint: '串口 · 收完或发完一帧', target: 'RI / TI', targetDetail: 'SCON' },
  ],
};

const MATCH_BOARDS: readonly MatchBoard[] = [INTERRUPT_SOURCE_FLAG_BOARD];

export function findMatchBoard(boardId: string): MatchBoard | null {
  return MATCH_BOARDS.find((board) => board.id === boardId) ?? null;
}

export interface MatchGrade {
  correct: boolean;
  wrongSlotIds: string[];
  missingSlotIds: string[];
}

/** A placement maps a slot id (the pair id) to the chip id dropped on it. */
export function gradeMatch(
  board: MatchBoard,
  placements: Readonly<Record<string, string>>,
): MatchGrade {
  const wrongSlotIds: string[] = [];
  const missingSlotIds: string[] = [];
  for (const pair of board.pairs) {
    const placed = placements[pair.id];
    if (!placed) missingSlotIds.push(pair.id);
    else if (placed !== pair.id) wrongSlotIds.push(pair.id);
  }
  return {
    correct: wrongSlotIds.length === 0 && missingSlotIds.length === 0,
    wrongSlotIds,
    missingSlotIds,
  };
}

export function matchMissMessage(grade: MatchGrade, board: MatchBoard): string {
  const remaining = grade.wrongSlotIds.length + grade.missingSlotIds.length;
  return `还有 ${remaining} 处没对上。${board.hint}`;
}

export function matchReviewLines(board: MatchBoard): readonly string[] {
  return board.pairs.map((pair) => `${pair.prompt} → ${pair.target}（${pair.targetDetail}）`);
}

export type MatchRewardReason = 'incorrect' | 'first_clear' | 'cooldown' | 'repeat' | 'preview';

export interface MatchRewardDecision {
  recordEvent: boolean;
  practicePoints: number;
  grantMedals: boolean;
  reason: MatchRewardReason;
  cooldownUntilMs: number | null;
}

/**
 * First correct clear of a board awards practice points and may unlock medals.
 * The same board stays quiet for `cooldownMs` so refreshing cannot farm events.
 * A later correct clear is stored with 0 practice points; medal targets above 1
 * can still unlock from the new count.
 */
export function decideMatchReward(input: {
  correct: boolean;
  previousClears: number;
  lastClearAtMs: number | null;
  nowMs: number;
  cooldownMs: number;
  firstClearPoints: number;
  awardToStudent: boolean;
}): MatchRewardDecision {
  if (!input.correct) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'incorrect',
      cooldownUntilMs: null,
    };
  }
  if (!input.awardToStudent) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'preview',
      cooldownUntilMs: null,
    };
  }
  const lastClearAtMs = input.lastClearAtMs;
  const cooling = input.previousClears > 0
    && lastClearAtMs != null
    && input.nowMs - lastClearAtMs < input.cooldownMs;
  if (cooling) {
    return {
      recordEvent: false,
      practicePoints: 0,
      grantMedals: false,
      reason: 'cooldown',
      cooldownUntilMs: lastClearAtMs + input.cooldownMs,
    };
  }
  const firstClear = input.previousClears <= 0;
  return {
    recordEvent: true,
    practicePoints: firstClear ? input.firstClearPoints : 0,
    grantMedals: true,
    reason: firstClear ? 'first_clear' : 'repeat',
    cooldownUntilMs: null,
  };
}

export function matchClearMessage(input: {
  reason: MatchRewardReason;
  practicePoints: number;
  medalTitle: string | null;
  medalPoints: number;
  cooldownMinutes: number;
}): string {
  if (input.reason === 'preview') return '对上了。教师或管理员预览不记入学生积分和勋章。';
  if (input.reason === 'incorrect') return '还有没对上的。';
  if (input.reason === 'cooldown') {
    return `已经对上过了。同一题 ${input.cooldownMinutes} 分钟内不再记分，过一会儿可以再练。`;
  }
  if (input.reason === 'repeat') {
    return '又对上一次。学习记录已记下，积分和勋章只在首次通关发放。';
  }
  const medalClause = input.medalTitle
    ? `，解锁勋章「${input.medalTitle}」+${input.medalPoints}`
    : '';
  return `首次对上：+${input.practicePoints} 积分${medalClause}。`;
}

/** Stable shuffle so a reload does not become a new random puzzle, and tests stay quiet. */
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    const swapIndex = (state >>> 0) % (index + 1);
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}
