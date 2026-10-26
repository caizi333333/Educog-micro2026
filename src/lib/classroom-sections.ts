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
  'p-rev': '指令复习',
  'p-run': '例程演练',
  'p-quiz': '当堂自测',
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
