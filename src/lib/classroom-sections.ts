import { knowledgePoints } from '@/lib/knowledge-points';

const U3_SECTION_POINTS: Readonly<Record<string, string>> = {
  home: '3',
  'isa-map': '3',
  'bak-isa': '3',
  addressing: '3.1',
  'bak-addressing': '3.1',
  transfer: '3.2',
  'movx-movc': '3.2',
  stack: '3.2',
  xch: '3.2',
  arith: '3.3',
  logic: '3.4',
  jump: '3.5',
  bit: '3.6',
  // `#lesson-a` is chapter 5. Chapter 3 lesson landings use a u3- prefix.
  'u3-lesson-a': '3',
  'u3-lesson-b': '3',
  'u3-lesson-c': '3',
  'u3-lesson-d': '3',
  'u3-l1': '3',
  'u3-l2': '3',
  'u3-l3': '3',
  'u3-l4': '3',
};

const U5_SECTION_POINTS: Readonly<Record<string, string>> = {
  home: '5',
  'int-1': '5.1',
  'int-2': '5.1',
  'int-3': '5.2',
  'int-4': '5.2',
  'int-5': '5.2',
  'int-6': '5.5',
  'int-7': '5.4',
  'int-8': '5.4',
  'int-9': '5.6',
  'int-10': '5.6',
  'int-11': '5',
  'int-12': '5.3',
  'int-13': '5.3',
  'int-14': '6.3',
  'int-15': '5',
  'int-16': '5.2',
  'int-17': '5',
  'tmr-dz': '6.1',
  'tmr-show': '6.1',
  'tmr-hand': '6.2',
  'tmr-qz': '6.3',
};

const U4_PANE_POINTS: Readonly<Record<string, string>> = {
  'p-rev': '3.5',
  'p-run': '3.5',
  'p-quiz': '3.5',
  's-judge': '3.5',
  's-mode': '3.5',
  's-map': '3.5',
  'u4-lesson-a': '3.5',
  'u4-lesson-b': '3.5',
  'u4-lesson-c': '3.5',
  'u4-lesson-d': '3.5',
  'u4-lesson-e': '3.5',
  'quiz-all': '3.5',
  'u4-quiz-all': '3.5',
  hw: '3.5',
  'u4-hw': '3.5',
  'ex-4-1': '3.5',
  'ex-4-2': '3.5',
  'ex-4-3': '3.5',
  'ex-4-4': '3.5',
  'ex-4-5': '3.5',
  'ex-4-6': '3.5',
  'ex-4-6b': '3.5',
  'ex-4-7': '3.5',
  'ex-4-9': '3.5',
  'ex-4-11': '3.5',
  'ex-4-12': '3.5',
  'ex-4-14': '3.5',
  'ex-4-15': '3.5',
  'ex-4-16': '3.5',
};

const SECTION_LABELS: Readonly<Record<string, string>> = {
  home: '本章主线',
  'isa-map': '指令全景',
  addressing: '寻址方式与机器周期',
  transfer: '数据传送',
  'movx-movc': 'MOVX / MOVC',
  stack: '堆栈',
  xch: '交换指令',
  arith: '算术运算',
  logic: '逻辑运算',
  jump: '控制转移',
  bit: '位操作',
  'u3-lesson-a': '第 1 次课 · 数在哪',
  'u3-lesson-b': '第 2 次课 · 怎么搬',
  'u3-lesson-c': '第 3 次课 · 怎么算',
  'u3-lesson-d': '第 4 次课 · 怎么跳',
  'u3-l1': '第 1 次课 · 数在哪',
  'u3-l2': '第 2 次课 · 怎么搬',
  'u3-l3': '第 3 次课 · 怎么算',
  'u3-l4': '第 4 次课 · 怎么跳',
  'p-rev': '指令复习',
  's-judge': '指令判对错',
  's-mode': '七种寻址',
  's-map': '111 条全景',
  'u4-lesson-a': '回炉复习',
  'u4-lesson-b': '第 1 次课 · 顺序与查表',
  'u4-lesson-c': '第 2 次课 · 分支与散转',
  'u4-lesson-d': '第 2 次课 · 循环与子程序',
  'u4-lesson-e': '当堂自测',
  'p-run': '例程演练',
  'p-quiz': '当堂自测',
  'quiz-all': '六题一览',
  'u4-quiz-all': '六题一览',
  hw: '课后作业',
  'u4-hw': '课后作业',
  'ex-4-1': '例 4-1',
  'ex-4-2': '例 4-2',
  'ex-4-3': '例 4-3',
  'ex-4-4': '例 4-4',
  'ex-4-5': '例 4-5',
  'ex-4-6': '例 4-6',
  'ex-4-6b': '例 4-6′',
  'ex-4-7': '例 4-7',
  'ex-4-9': '例 4-9',
  'ex-4-11': '例 4-11',
  'ex-4-12': '例 4-12',
  'ex-4-14': '例 4-14',
  'ex-4-15': '例 4-15',
  'ex-4-16': '例 4-16',
  'int-1': '接上调用',
  'int-2': '查询与中断',
  'int-3': '中断源',
  'int-4': 'TCON',
  'int-5': 'IE',
  'int-6': '优先级',
  'int-7': '响应条件',
  'int-8': '响应过程',
  'int-12': '外部中断例题',
  'int-13': '单外中断采数',
  'int-14': '定时器装值',
  'int-17': '课末测试',
  'tmr-dz': '定时器难题',
  'tmr-show': '定时器原理',
  'tmr-hand': '定时器动手练',
  'tmr-qz': '定时器小测',
};

export type LessonVisit = {
  targetId: string;
  chapterId: string;
  moduleId: string;
  sectionId: string;
  knowledgePointId: string;
};

function pointForSection(unitId: number, noteFile: string, sectionId: string, fallbackPointId: string): string {
  if (noteFile === 'u3-overview' && U3_SECTION_POINTS[sectionId]) return U3_SECTION_POINTS[sectionId];
  if (noteFile === 'u5-overview' && U5_SECTION_POINTS[sectionId]) return U5_SECTION_POINTS[sectionId];
  if (noteFile === 'u4-classroom' && U4_PANE_POINTS[sectionId]) return U4_PANE_POINTS[sectionId];
  if (unitId === 3 && U3_SECTION_POINTS[sectionId]) return U3_SECTION_POINTS[sectionId];
  if (unitId === 5 && U5_SECTION_POINTS[sectionId]) return U5_SECTION_POINTS[sectionId];
  return fallbackPointId;
}

/**
 * Map a courseware file plus its in-page anchor to the knowledge-point id
 * used by the graph. The anchor stays in the event target so a teacher can
 * tell addressing apart from the rest of chapter 3.
 */
export function resolveLessonVisit(input: {
  unitId: number;
  noteFile: string;
  pointId: string;
  sectionId?: string;
}): LessonVisit {
  const sectionId = (input.sectionId ?? '').trim().slice(0, 64);
  const knowledgePointId = pointForSection(input.unitId, input.noteFile, sectionId, input.pointId);
  const chapterId = knowledgePointId.split('.')[0] || String(input.unitId);
  const keepAnchor = sectionId.length > 0 && sectionId !== 'home' && sectionId !== input.noteFile;
  return {
    targetId: keepAnchor ? `${knowledgePointId}#${sectionId}` : knowledgePointId,
    chapterId,
    moduleId: input.noteFile,
    sectionId: sectionId || input.noteFile,
    knowledgePointId,
  };
}

type FrameLike = {
  contentWindow?: {
    location?: { hash?: string };
    document?: { querySelector?: (selector: string) => { id?: string } | null };
  } | null;
};

export function readEmbeddedSection(frame: FrameLike | null | undefined): string {
  const win = frame?.contentWindow;
  if (!win) return '';
  try {
    const hash = (win.location?.hash ?? '').replace(/^#/, '').split(/[?&]/)[0] ?? '';
    if (hash) return hash.slice(0, 64);
    const pane = win.document?.querySelector?.('section.pane.on');
    return (pane?.id ?? '').slice(0, 64);
  } catch {
    return '';
  }
}

const LESSON_HASH = /^#[\w=%.~-]{1,160}$/;
const LESSON_SECTION_ID = /^[\w=%.~-]{1,64}$/;

/**
 * Courseware file that owns an in-page anchor.
 * `home` is shared by more than one unit, so it does not pick a file.
 */
export function lessonFileForSection(sectionId: string): string | null {
  const id = sectionId.replace(/^#/, '').trim();
  if (!id || id === 'home') return null;
  if (Object.prototype.hasOwnProperty.call(U5_SECTION_POINTS, id)) return 'u5-overview';
  if (Object.prototype.hasOwnProperty.call(U3_SECTION_POINTS, id)) return 'u3-overview';
  if (Object.prototype.hasOwnProperty.call(U4_PANE_POINTS, id)) return 'u4-classroom';
  return null;
}

export interface LessonDeepLink {
  file: string;
  hash: string;
}

/**
 * Where /lesson-notes should open.
 * A unit-5 anchor such as `#int-2` opens the overview pane students actually
 * watch. An alias note (for example `u3-jump`) keeps its own hash.
 * A hash that belongs to a different note is not attached to the wrong file.
 */
export function resolveLessonDeepLink(input: {
  note: string | null;
  unitId: number | null;
  hash: string;
  alias: Readonly<Record<string, string>>;
  notesInUnit: (unitId: number) => readonly string[];
  isKnownNote: (file: string) => boolean;
}): LessonDeepLink | null {
  const hash = LESSON_HASH.test(input.hash) ? input.hash : '';
  const sectionFile = lessonFileForSection(hash.slice(1));
  const note = input.note?.trim() || null;

  if (note && (input.isKnownNote(note) || Object.prototype.hasOwnProperty.call(input.alias, note))) {
    if (Object.prototype.hasOwnProperty.call(input.alias, note)) return { file: note, hash: '' };
    if (sectionFile && sectionFile !== note) return { file: note, hash: '' };
    return { file: note, hash };
  }

  if (input.unitId != null) {
    const files = input.notesInUnit(input.unitId);
    const first = files[0];
    if (!first) return null;
    if (sectionFile && files.includes(sectionFile)) return { file: sectionFile, hash };
    return { file: first, hash: '' };
  }

  if (sectionFile && input.isKnownNote(sectionFile)) return { file: sectionFile, hash };
  return null;
}

/** Standalone courseware URL for the pane the shell is showing. */
export function standaloneCoursewareHref(base: string, file: string, sectionId: string): string {
  const path = `${base}/${file}.html`;
  const id = sectionId.trim();
  if (!LESSON_SECTION_ID.test(id)) return path;
  const owner = lessonFileForSection(id);
  if (owner && owner !== file) return path;
  return `${path}#${id}`;
}

export function describeLearningTarget(targetId: string): string {
  if (targetId === 'session') return '在线心跳';
  if (targetId.startsWith('/')) return `页面 ${targetId}`;
  const [pointId, anchor] = targetId.split('#');
  const point = knowledgePoints.find((item) => item.id === pointId);
  const anchorLabel = anchor ? (SECTION_LABELS[anchor] ?? anchor) : '';
  if (point && anchorLabel) return `${point.id} ${point.name} · ${anchorLabel}`;
  if (point) return `${point.id} ${point.name}`;
  return targetId;
}
