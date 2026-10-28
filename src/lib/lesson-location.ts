import { lessonFileForSection, lessonSectionLabel } from '@/lib/classroom-sections';
import { U2_LESSONS, u2LessonForFile, type U2Lesson } from '@/lib/u2-lessons';

/**
 * One step in 「章 › 课次 › 小节」.
 * `hash` is empty on a chapter chooser or a lesson page with no anchor.
 */
export interface LessonPlace {
  id: string;
  label: string;
  file: string;
  hash: string;
}

/** Where the student is, and where the chapter and lesson crumbs open. */
export interface LessonLocation {
  chapter: LessonPlace;
  lesson: LessonPlace;
  section: LessonPlace;
}

/** One choice in the shell's same-chapter lesson switch. */
export interface LessonSwitchChoice {
  id: string;
  title: string;
  topics: string;
  file: string;
  hash: string;
}

interface LessonDef {
  id: string;
  title: string;
  topics: string;
  file: string;
  hash: string;
  sections: readonly string[];
}

const SHELL_HASH = /^#[\w=%.~-]{1,160}$/;

/** In-page columns on a chapter 2 note. They are not a new 小节. */
const PAGE_COLUMN = new Set(['teach', 'pit', 'quiz']);

/**
 * Hashes that open a lesson card, not a subsection.
 * Chapter 2 lesson hashes still name the page the student is reading.
 */
const LESSON_ENTRY_SECTION = new Set([
  'u3-lesson-a', 'u3-lesson-b', 'u3-lesson-c', 'u3-lesson-d',
  'u3-l1', 'u3-l2', 'u3-l3', 'u3-l4',
  'u4-lesson-a', 'u4-lesson-b', 'u4-lesson-c', 'u4-lesson-d', 'u4-lesson-e',
]);

const U3_LESSONS: readonly LessonDef[] = [
  {
    id: 'u3-lesson-a',
    title: '第 1 次课',
    topics: '数在哪',
    file: 'u3-overview',
    hash: '#u3-lesson-a',
    sections: ['isa-map', 'addressing', 'bak-isa', 'bak-addressing', 'bak-classroom', 'bak-machine-cycle', 'u3-lesson-a', 'u3-l1'],
  },
  {
    id: 'u3-lesson-b',
    title: '第 2 次课',
    topics: '怎么搬',
    file: 'u3-overview',
    hash: '#u3-lesson-b',
    sections: ['transfer', 'movx-movc', 'stack', 'xch', 'bak-transfer', 'u3-lesson-b', 'u3-l2'],
  },
  {
    id: 'u3-lesson-c',
    title: '第 3 次课',
    topics: '怎么算',
    file: 'u3-overview',
    hash: '#u3-lesson-c',
    sections: ['arith', 'logic', 'bak-arith', 'bak-logic', 'u3-lesson-c', 'u3-l3'],
  },
  {
    id: 'u3-lesson-d',
    title: '第 4 次课',
    topics: '怎么跳',
    file: 'u3-overview',
    hash: '#u3-lesson-d',
    sections: ['jump', 'bit', 'bak-jump', 'u3-lesson-d', 'u3-l4'],
  },
];

const U4_LESSONS: readonly LessonDef[] = [
  {
    id: 'u4-lesson-a',
    title: '回炉复习',
    topics: '判对错 · 111 条',
    file: 'u4-classroom',
    hash: '#u4-lesson-a',
    sections: ['p-rev', 's-judge', 's-mode', 's-map', 'u4-lesson-a'],
  },
  {
    id: 'u4-lesson-b',
    title: '第 1 次课',
    topics: '顺序 · 查表',
    file: 'u4-classroom',
    hash: '#u4-lesson-b',
    sections: ['u4-lesson-b', 'ex-4-1', 'ex-4-2', 'ex-4-3', 'ex-4-4'],
  },
  {
    id: 'u4-lesson-c',
    title: '第 2 次课',
    topics: '分支 · 散转',
    file: 'u4-classroom',
    hash: '#u4-lesson-c',
    sections: ['u4-lesson-c', 'p-run', 'ex-4-5', 'ex-4-6', 'ex-4-6b', 'ex-4-7', 'ex-4-9'],
  },
  {
    id: 'u4-lesson-d',
    title: '第 2 次课',
    topics: '循环 · 子程序',
    file: 'u4-classroom',
    hash: '#u4-lesson-d',
    sections: ['u4-lesson-d', 'ex-4-11', 'ex-4-12', 'ex-4-14', 'ex-4-15', 'ex-4-16'],
  },
  {
    id: 'u4-lesson-e',
    title: '当堂自测',
    topics: '逐题 · 作业',
    file: 'u4-classroom',
    hash: '#u4-lesson-e',
    sections: ['u4-lesson-e', 'p-quiz', 'quiz-all', 'u4-quiz-all', 'hw', 'u4-hw'],
  },
];

const U5_INTERRUPT_A = ['int-1', 'int-2', 'int-3', 'int-4', 'int-5', 'int-6', 'int-7', 'int-8'];
const U5_INTERRUPT_B = ['int-9', 'int-10', 'int-11', 'int-12', 'int-13'];
const U5_INTERRUPT_C = ['int-14', 'int-15', 'int-16', 'int-17', 'hex-split', 'rev-hex'];

const U5_LESSONS: readonly LessonDef[] = [
  {
    id: 'u5-lesson-1',
    title: '第 1 次课',
    topics: '中断入门',
    file: 'u5-overview',
    hash: '#int-1',
    sections: U5_INTERRUPT_A,
  },
  {
    id: 'u5-lesson-2',
    title: '第 2 次课',
    topics: '案例与练习',
    file: 'u5-overview',
    hash: '#int-9',
    sections: U5_INTERRUPT_B,
  },
  {
    id: 'u5-lesson-3',
    title: '第 3 次课',
    topics: '定时与收口',
    file: 'u5-lesson-3',
    hash: '',
    sections: U5_INTERRUPT_C,
  },
  {
    id: 'u5-timer',
    title: '定时/计数器',
    topics: '四步',
    file: 'u5-overview',
    hash: '#tmr-dz',
    sections: ['tmr-dz', 'tmr-show', 'tmr-hand', 'tmr-qz'],
  },
];

const RESOURCE_FILE: Readonly<Record<string, LessonSwitchChoice>> = {
  'u3-video': { id: 'u3-video', title: '讲解视频', topics: '整篇', file: 'u3-video', hash: '' },
  'u4-video': { id: 'u4-video', title: '讲解视频', topics: '整篇', file: 'u4-video', hash: '' },
  'u5-knowledge': { id: 'u5-knowledge', title: '知识导览', topics: '三次课入口', file: 'u5-knowledge', hash: '' },
};

function catalogFor(unitId: number): readonly LessonDef[] {
  if (unitId === 3) return U3_LESSONS;
  if (unitId === 4) return U4_LESSONS;
  if (unitId === 5) return U5_LESSONS;
  return [];
}

function crumbLabel(choice: Pick<LessonSwitchChoice, 'title' | 'topics'>): string {
  if (choice.title.startsWith('第')) return `${choice.title} · ${choice.topics}`;
  return choice.title;
}

function u2CrumbLabel(lesson: U2Lesson): string {
  return lessonSectionLabel(lesson.id) || `${lesson.title} · ${lesson.topics}`;
}

function chapterPlace(unitId: number, unitName: string, noteFile: string): LessonPlace {
  const label = `第 ${unitId} 章 · ${unitName}`;
  if (unitId === 2) return { id: 'unit-2', label, file: 'u2-cpu-structure', hash: '#u2-lesson-a' };
  if (unitId === 3) return { id: 'unit-3', label, file: 'u3-overview', hash: '' };
  if (unitId === 4) return { id: 'unit-4', label, file: 'u4-classroom', hash: '' };
  if (unitId === 5) return { id: 'unit-5', label, file: 'u5-overview', hash: '' };
  return { id: `unit-${unitId}`, label, file: noteFile, hash: '' };
}

/**
 * Keep a section id only when it belongs to the file now on screen.
 * A stale id left over from another note must not rename the breadcrumb.
 *
 * @param unitId - textbook chapter
 * @param noteFile - courseware file currently shown
 * @param sectionId - anchor last read from that file, or from the shell URL
 * @returns the id to show, or `''` when it belongs somewhere else
 */
function usableSection(unitId: number, noteFile: string, sectionId: string): string {
  const id = sectionId.replace(/^#/, '').trim();
  if (!id || id === 'home') return '';
  if (PAGE_COLUMN.has(id)) return noteFile.startsWith('u2-') ? id : '';
  if (id.startsWith('u2-lesson-')) {
    return u2LessonForFile(noteFile)?.id === id ? id : '';
  }
  const owner = lessonFileForSection(id);
  if (owner) return owner === noteFile ? id : '';
  const listed = catalogFor(unitId).some((lesson) => lesson.file === noteFile && lesson.sections.includes(id));
  return listed ? id : '';
}

function sectionLabelFor(noteFile: string, noteTitle: string, sectionId: string): string {
  const id = sectionId.trim();
  if (!id || PAGE_COLUMN.has(id) || id.startsWith('u2-lesson-')) {
    if (!id && (noteFile === 'u5-lesson-3' || noteFile === 'u4-classroom')) return '课次入口';
    return noteTitle;
  }
  if (LESSON_ENTRY_SECTION.has(id)) return '课次入口';
  return lessonSectionLabel(id) || noteTitle;
}

function listedLesson(unitId: number, noteFile: string, sectionId: string): LessonDef | null {
  if (noteFile === 'u5-lesson-3') {
    return U5_LESSONS.find((lesson) => lesson.id === 'u5-lesson-3') ?? null;
  }
  if (sectionId) {
    const named = catalogFor(unitId).find((lesson) => lesson.sections.includes(sectionId));
    if (named) return named;
  }
  if (unitId === 4 && noteFile === 'u4-classroom') {
    return U4_LESSONS.find((lesson) => lesson.id === 'u4-lesson-a') ?? null;
  }
  return null;
}

function lessonPlaceFromDef(lesson: LessonDef): LessonPlace {
  return {
    id: lesson.id,
    label: crumbLabel(lesson),
    file: lesson.file,
    hash: lesson.hash,
  };
}

/**
 * Chapter, lesson, and section the lesson-notes shell should say out loud.
 * Deep links such as `#int-2`, `#s-map`, and `#hex-split` keep a real 小节 name.
 *
 * @param input.unitId - textbook chapter
 * @param input.unitName - chapter title already shown in the shell
 * @param input.noteFile - courseware file currently shown
 * @param input.noteTitle - that file's tab title
 * @param input.sectionId - in-page anchor, without `#`
 * @returns three places; chapter and lesson include the file they open
 *
 * @example
 * resolveLessonLocation({
 *   unitId: 5, unitName: '中断系统与定时器', noteFile: 'u5-overview',
 *   noteTitle: '第 5 章交互总览', sectionId: 'int-2',
 * }).section.label // '查询与中断'
 */
export function resolveLessonLocation(input: {
  unitId: number;
  unitName: string;
  noteFile: string;
  noteTitle: string;
  sectionId?: string;
}): LessonLocation {
  const sectionId = usableSection(input.unitId, input.noteFile, input.sectionId ?? '');
  const chapter = chapterPlace(input.unitId, input.unitName, input.noteFile);
  const resource = RESOURCE_FILE[input.noteFile];
  if (resource) {
    return {
      chapter,
      lesson: { id: resource.id, label: resource.title, file: resource.file, hash: resource.hash },
      section: {
        id: sectionId || input.noteFile,
        label: sectionId ? sectionLabelFor(input.noteFile, input.noteTitle, sectionId) : '本篇',
        file: input.noteFile,
        hash: sectionId ? `#${sectionId}` : '',
      },
    };
  }

  if (input.unitId === 2) {
    const lesson = u2LessonForFile(input.noteFile) ?? U2_LESSONS[0];
    const entry = lesson?.pages[0];
    return {
      chapter,
      lesson: {
        id: lesson?.id ?? 'u2-lesson-a',
        label: lesson ? u2CrumbLabel(lesson) : '第 1 次课',
        file: entry?.file ?? input.noteFile,
        hash: lesson ? `#${lesson.id}` : '',
      },
      section: {
        id: sectionId || input.noteFile,
        label: sectionLabelFor(input.noteFile, input.noteTitle, sectionId),
        file: input.noteFile,
        hash: sectionId && !sectionId.startsWith('u2-lesson-') && !PAGE_COLUMN.has(sectionId) ? `#${sectionId}` : '',
      },
    };
  }

  const listed = listedLesson(input.unitId, input.noteFile, sectionId);
  if (!listed) {
    return {
      chapter,
      lesson: {
        id: `unit-${input.unitId}-chooser`,
        label: '先选课次',
        file: chapter.file,
        hash: chapter.hash,
      },
      section: {
        id: input.noteFile,
        label: input.noteTitle,
        file: input.noteFile,
        hash: '',
      },
    };
  }

  return {
    chapter,
    lesson: lessonPlaceFromDef(listed),
    section: {
      id: sectionId || listed.id,
      label: sectionLabelFor(input.noteFile, input.noteTitle, sectionId),
      file: input.noteFile,
      hash: sectionId ? `#${sectionId}` : '',
    },
  };
}

/**
 * Visible trail, using the same separator the breadcrumb renders.
 *
 * @param location - places from `resolveLessonLocation`
 * @returns `章 › 课次 › 小节`
 */
export function lessonLocationTrail(location: LessonLocation): string {
  return `${location.chapter.label} › ${location.lesson.label} › ${location.section.label}`;
}

/**
 * Lesson buttons for units 3–5. Unit 2 keeps its own three-lesson grid.
 *
 * @param unitId - textbook chapter
 * @returns choices in teaching order; empty when this chapter has no shell switch
 */
export function lessonSwitchChoices(unitId: number): readonly LessonSwitchChoice[] {
  return catalogFor(unitId).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    topics: lesson.topics,
    file: lesson.file,
    hash: lesson.hash,
  }));
}

/**
 * Shell URL that `resolveLessonDeepLink` can open again.
 * A hash that belongs to the file uses `?unit=`. Anything else keeps `?note=`
 * so chapter 2 columns and later notes in a unit do not fall back to the first file.
 *
 * @param unitId - textbook chapter
 * @param file - courseware file to reopen
 * @param hash - optional anchor, including the leading `#`
 * @param unitEntryFile - first note of that unit in the shell
 * @returns path, query, and hash for `history.replaceState`
 *
 * @example
 * lessonShellHref(5, 'u5-overview', '#int-2', 'u5-overview')
 * // '/lesson-notes?unit=5#int-2'
 */
export function lessonShellHref(unitId: number, file: string, hash: string, unitEntryFile: string): string {
  const safeHash = SHELL_HASH.test(hash) ? hash : '';
  const sectionId = safeHash.startsWith('#') ? safeHash.slice(1) : '';
  if (safeHash) {
    const owner = lessonFileForSection(sectionId);
    if (owner === file) return `/lesson-notes?unit=${unitId}${safeHash}`;
    return `/lesson-notes?note=${encodeURIComponent(file)}${safeHash}`;
  }
  if (file && file === unitEntryFile) return `/lesson-notes?unit=${unitId}`;
  if (!file) return `/lesson-notes?unit=${unitId}`;
  return `/lesson-notes?note=${encodeURIComponent(file)}`;
}
