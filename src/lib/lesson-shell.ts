import { lessonFileForSection, lessonSectionLabel } from '@/lib/classroom-sections';
import { U2_LESSONS, u2LessonForFile } from '@/lib/u2-lessons';

/** Where 「回课次」 opens. `hash` is empty on the chapter chooser. */
export interface LessonEntryTarget {
  file: string;
  hash: string;
}

const SHELL_HASH = /^#[\w=%.~-]{1,160}$/;

/**
 * Chapter or lesson entry for the shell 「回课次」 control.
 * Unit 2 opens the first page of the current lesson. Units 3–5 open the
 * chapter chooser with no section hash. This is not browser history.
 *
 * @param unitId - textbook chapter shown in the shell
 * @param noteFile - courseware file currently open
 * @returns file and hash the shell should open
 */
export function lessonEntryTarget(unitId: number, noteFile: string): LessonEntryTarget {
  if (unitId === 2) {
    const lesson = u2LessonForFile(noteFile) ?? U2_LESSONS[0];
    if (!lesson) return { file: noteFile, hash: '' };
    return { file: lesson.pages[0].file, hash: `#${lesson.id}` };
  }
  if (unitId === 3) return { file: 'u3-overview', hash: '' };
  if (unitId === 4) return { file: 'u4-classroom', hash: '' };
  if (unitId === 5) return { file: 'u5-overview', hash: '' };
  return { file: noteFile, hash: '' };
}

/**
 * Shell URL for a lesson entry. A hash that is not a courseware anchor is dropped.
 *
 * @param unitId - textbook chapter
 * @param hash - optional in-page anchor, including the leading `#`
 * @returns path, query, and hash for `history.replaceState`
 */
export function lessonEntryHref(unitId: number, hash: string): string {
  const safeHash = SHELL_HASH.test(hash) ? hash : '';
  return `/lesson-notes?unit=${unitId}${safeHash}`;
}

/**
 * Bring the courseware frame into the shell viewport.
 * A deep link such as `#int-6` is not an element id on this page, so the
 * document would otherwise stay at scrollY 0 with the frame below the fold.
 *
 * @param node - courseware wrapper in the lesson-notes shell
 */
export function scrollLessonCoursewareIntoView(node: HTMLElement | null): void {
  if (!node || typeof node.scrollIntoView !== 'function') return;
  node.scrollIntoView({ block: 'start', behavior: 'auto' });
}

/**
 * One step in 「章 › 课次 › 小节」.
 * Ancestors carry `file` so the shell can open them. The current step does not.
 */
export interface LessonPlaceCrumb {
  id: string;
  label: string;
  file?: string;
  hash?: string;
}

/** Chapter chooser inside the shell. Unit 2 has no separate chooser file. */
const CHAPTER_HUB: Readonly<Record<number, string>> = {
  3: 'u3-overview',
  4: 'u4-classroom',
  5: 'u5-overview',
};

interface LessonBand {
  id: string;
  label: string;
  file: string;
  hash: string;
  sections: readonly string[];
}

const U3_BANDS: readonly LessonBand[] = [
  {
    id: 'u3-lesson-a',
    label: '第 1 次课 · 数在哪',
    file: 'u3-overview',
    hash: '#u3-lesson-a',
    sections: ['isa-map', 'bak-isa', 'addressing', 'bak-addressing', 'u3-lesson-a', 'u3-l1'],
  },
  {
    id: 'u3-lesson-b',
    label: '第 2 次课 · 怎么搬',
    file: 'u3-overview',
    hash: '#u3-lesson-b',
    sections: ['transfer', 'movx-movc', 'stack', 'xch', 'u3-lesson-b', 'u3-l2'],
  },
  {
    id: 'u3-lesson-c',
    label: '第 3 次课 · 怎么算',
    file: 'u3-overview',
    hash: '#u3-lesson-c',
    sections: ['arith', 'logic', 'u3-lesson-c', 'u3-l3'],
  },
  {
    id: 'u3-lesson-d',
    label: '第 4 次课 · 怎么跳',
    file: 'u3-overview',
    hash: '#u3-lesson-d',
    sections: ['jump', 'bit', 'u3-lesson-d', 'u3-l4'],
  },
];

const U4_BANDS: readonly LessonBand[] = [
  {
    id: 'u4-lesson-a',
    label: '回炉复习',
    file: 'u4-classroom',
    hash: '#u4-lesson-a',
    sections: ['s-judge', 's-mode', 's-map', 'p-rev', 'u4-lesson-a'],
  },
  {
    id: 'u4-lesson-b',
    label: '第 1 次课 · 顺序与查表',
    file: 'u4-classroom',
    hash: '#u4-lesson-b',
    sections: ['ex-4-1', 'ex-4-2', 'ex-4-3', 'ex-4-4', 'u4-lesson-b'],
  },
  {
    id: 'u4-lesson-c',
    label: '第 2 次课 · 分支与散转',
    file: 'u4-classroom',
    hash: '#u4-lesson-c',
    sections: ['ex-4-5', 'ex-4-6', 'ex-4-6b', 'ex-4-7', 'ex-4-9', 'p-run', 'u4-lesson-c'],
  },
  {
    id: 'u4-lesson-d',
    label: '第 2 次课 · 循环与子程序',
    file: 'u4-classroom',
    hash: '#u4-lesson-d',
    sections: ['ex-4-11', 'ex-4-12', 'ex-4-14', 'ex-4-15', 'ex-4-16', 'u4-lesson-d'],
  },
  {
    id: 'u4-lesson-e',
    label: '当堂自测',
    file: 'u4-classroom',
    hash: '#u4-lesson-e',
    sections: ['p-quiz', 'quiz-all', 'u4-quiz-all', 'hw', 'u4-hw', 'u4-lesson-e'],
  },
];

const U5_OVERVIEW_BANDS: readonly LessonBand[] = [
  {
    id: 'u5-lesson-a',
    label: '第 1 次课 · 中断入门',
    file: 'u5-overview',
    hash: '#int-1',
    sections: ['int-1', 'int-2', 'int-3', 'int-4', 'int-5', 'int-6', 'int-7', 'int-8', 'lesson-a', 'lesson-1', 'la'],
  },
  {
    id: 'u5-lesson-b',
    label: '第 2 次课 · 案例与练习',
    file: 'u5-overview',
    hash: '#int-9',
    sections: ['int-9', 'int-10', 'int-11', 'int-12', 'int-13', 'lesson-b', 'lesson-2', 'lb'],
  },
  {
    id: 'u5-lesson-c',
    label: '第 3 次课 · 定时与收口',
    file: 'u5-overview',
    hash: '#int-14',
    sections: ['int-14', 'int-15', 'int-16', 'int-17', 'lesson-c', 'lesson-3', 'lc'],
  },
  {
    id: 'u5-timer',
    label: '定时/计数器',
    file: 'u5-overview',
    hash: '#tmr-dz',
    sections: ['tmr-dz', 'tmr-show', 'tmr-hand', 'tmr-qz'],
  },
];

const U5_LESSON3_BAND: LessonBand = {
  id: 'u5-lesson-3',
  label: '第 3 次课 · 定时与收口',
  file: 'u5-lesson-3',
  hash: '',
  sections: ['hex-split', 'rev-hex', 'int-14', 'int-15', 'int-16', 'int-17', 'lesson-c', 'lesson-3', 'lc'],
};

/** Hashes that name a lesson landing, not a subsection the student is reading. */
const LESSON_ENTRY_IDS = new Set([
  'u2-lesson-a', 'u2-lesson-b', 'u2-lesson-c',
  'u3-lesson-a', 'u3-lesson-b', 'u3-lesson-c', 'u3-lesson-d',
  'u3-l1', 'u3-l2', 'u3-l3', 'u3-l4',
  'u4-lesson-a', 'u4-lesson-b', 'u4-lesson-c', 'u4-lesson-d', 'u4-lesson-e',
  'lesson-a', 'lesson-b', 'lesson-c', 'lesson-1', 'lesson-2', 'lesson-3',
  'la', 'lb', 'lc',
]);

const U2_TOPIC: Readonly<Record<string, string>> = {
  'u2-lesson-a': '片子里面',
  'u2-lesson-b': '口和总线',
  'u2-lesson-c': '节拍和开机',
};

/** In-page columns on a chapter 2 page. They stay on that page's crumb. */
const U2_COLUMN: Readonly<Record<string, string>> = {
  teach: '讲解',
  pit: '疑点',
  quiz: '自测',
};

/** Anchors the shared label table does not name. The trail must still be readable. */
const EXTRA_SECTION_LABELS: Readonly<Record<string, string>> = {
  'int-9': '按键计数',
  'int-10': '学生互动',
  'int-11': '术语拼写',
  'int-15': '例题全览',
  'int-16': '速记寄存器',
};

const NOTE_FILE = /^[\w-]{1,64}$/;

function sectionKey(sectionId: string): string {
  const id = sectionId.replace(/^#/, '').trim();
  return id === 'home' ? '' : id;
}

function readableSection(sectionId: string): string {
  if (!sectionId) return '';
  return lessonSectionLabel(sectionId) || EXTRA_SECTION_LABELS[sectionId] || '';
}

function chapterCrumb(unitId: number, unitName: string, here: boolean): LessonPlaceCrumb {
  const label = `第 ${unitId} 章 · ${unitName}`;
  const id = `chapter-${unitId}`;
  if (here) return { id, label };
  if (unitId === 2) return { id, label, file: 'u2-cpu-structure', hash: '#u2-lesson-a' };
  const hub = CHAPTER_HUB[unitId];
  if (!hub) return { id, label };
  return { id, label, file: hub, hash: '' };
}

function bandsFor(unitId: number): readonly LessonBand[] {
  if (unitId === 3) return U3_BANDS;
  if (unitId === 4) return U4_BANDS;
  if (unitId === 5) return U5_OVERVIEW_BANDS;
  return [];
}

/**
 * Lesson that owns this screen.
 * A section is attached only when this courseware file actually contains it.
 *
 * @param unitId - textbook chapter
 * @param noteFile - courseware file open in the shell
 * @param sectionId - in-page anchor without `#`, or empty
 * @returns the lesson band, or undefined when the screen is a note outside the bands
 */
function bandFor(unitId: number, noteFile: string, sectionId: string): LessonBand | undefined {
  if (noteFile === 'u5-lesson-3') {
    if (!sectionId || LESSON_ENTRY_IDS.has(sectionId) || U5_LESSON3_BAND.sections.includes(sectionId)) {
      return U5_LESSON3_BAND;
    }
    return undefined;
  }
  if (!sectionId) return undefined;
  const band = bandsFor(unitId).find((item) => item.sections.includes(sectionId));
  if (!band || band.file !== noteFile) return undefined;
  return band;
}

function unit2Place(unitName: string, noteFile: string, noteTitle: string, sectionId: string): LessonPlaceCrumb[] {
  const lesson = u2LessonForFile(noteFile);
  const chapter = chapterCrumb(2, unitName, false);
  if (!lesson) return [chapter, { id: `note-${noteFile}`, label: noteTitle }];
  const column = U2_COLUMN[sectionId] ?? '';
  const pageLabel = column ? `${noteTitle} · ${column}` : noteTitle;
  return [
    chapter,
    {
      id: lesson.id,
      label: `${lesson.title} · ${U2_TOPIC[lesson.id] ?? lesson.topics}`,
      file: lesson.pages[0].file,
      hash: `#${lesson.id}`,
    },
    { id: `page-${noteFile}`, label: pageLabel },
  ];
}

/**
 * Where the student is, from the chapter down to the section.
 * The last crumb is the current screen. Earlier crumbs are the way back.
 * This does not replace 「回课次」: that control still uses `lessonEntryTarget`.
 *
 * @param input.unitId - textbook chapter shown in the shell
 * @param input.unitName - chapter title, for example `中断系统与定时器`
 * @param input.noteFile - courseware file currently open
 * @param input.noteTitle - tab title of that file
 * @param input.sectionId - in-page anchor, with or without `#`
 * @returns at least the chapter. A deep link adds the lesson and the section.
 *
 * @example
 * lessonPlace({ unitId: 5, unitName: '中断系统与定时器', noteFile: 'u5-overview', noteTitle: '第 5 章交互总览', sectionId: 'int-2' })
 */
export function lessonPlace(input: {
  unitId: number;
  unitName: string;
  noteFile: string;
  noteTitle: string;
  sectionId: string;
}): LessonPlaceCrumb[] {
  const sectionId = sectionKey(input.sectionId);
  const unitName = input.unitName.trim() || `单元 ${input.unitId}`;
  if (input.unitId === 2) return unit2Place(unitName, input.noteFile, input.noteTitle, sectionId);

  const hub = CHAPTER_HUB[input.unitId];
  const onChapterDoor = Boolean(hub) && input.noteFile === hub && !sectionId;
  if (onChapterDoor || !hub) return [chapterCrumb(input.unitId, unitName, true)];

  const chapter = chapterCrumb(input.unitId, unitName, false);
  const band = bandFor(input.unitId, input.noteFile, sectionId);
  if (!band) {
    const owned = lessonFileForSection(sectionId) === input.noteFile ? readableSection(sectionId) : '';
    const here = owned && owned !== input.noteTitle ? `${input.noteTitle} · ${owned}` : input.noteTitle;
    return [chapter, { id: `note-${input.noteFile}`, label: here }];
  }

  const labeled = readableSection(sectionId);
  const atLessonEntry = !sectionId || LESSON_ENTRY_IDS.has(sectionId) || !labeled || labeled === band.label;
  if (atLessonEntry) return [chapter, { id: band.id, label: band.label }];
  return [
    chapter,
    { id: band.id, label: band.label, file: band.file, hash: band.hash },
    { id: `section-${sectionId}`, label: labeled },
  ];
}

/**
 * Shell URL for a breadcrumb step.
 * Chapter doors stay on `?unit=`. A section hash stays on `?unit=` when that
 * file owns the anchor, so `#hex-split` still reloads on 第 3 次课.
 * Anything else is `?note=`, and a hash that is not an anchor is dropped.
 *
 * @param unitId - textbook chapter
 * @param file - courseware file the crumb opens
 * @param hash - optional anchor, including the leading `#`
 * @returns path and query for `history.replaceState`
 *
 * @example
 * lessonPlaceHref(5, 'u5-lesson-3', '') // '/lesson-notes?note=u5-lesson-3'
 */
export function lessonPlaceHref(unitId: number, file: string, hash: string): string {
  const safeHash = SHELL_HASH.test(hash) ? hash : '';
  const hub = CHAPTER_HUB[unitId];
  if (hub && file === hub && !safeHash) return `/lesson-notes?unit=${unitId}`;
  const owner = safeHash ? lessonFileForSection(safeHash.slice(1)) : null;
  if (safeHash && owner === file) return `/lesson-notes?unit=${unitId}${safeHash}`;
  if (!NOTE_FILE.test(file)) return `/lesson-notes?unit=${unitId}`;
  return `/lesson-notes?note=${file}${safeHash}`;
}
