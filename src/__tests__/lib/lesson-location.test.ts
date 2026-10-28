import { resolveLessonDeepLink } from '@/lib/classroom-sections';
import {
  lessonLocationTrail,
  lessonShellHref,
  lessonSwitchChoices,
  resolveLessonLocation,
} from '@/lib/lesson-location';

const KNOWN = new Set([
  'u2-cpu-structure',
  'u2-memory',
  'u2-io-port',
  'u2-bus',
  'u2-clock-timing',
  'u2-reset',
  'u3-video',
  'u3-overview',
  'u4-video',
  'u4-classroom',
  'u5-overview',
  'u5-knowledge',
  'u5-lesson-3',
]);

function notesInUnit(unitId: number): readonly string[] {
  if (unitId === 2) return ['u2-cpu-structure', 'u2-memory', 'u2-io-port', 'u2-bus', 'u2-clock-timing', 'u2-reset'];
  if (unitId === 3) return ['u3-video', 'u3-overview'];
  if (unitId === 4) return ['u4-video', 'u4-classroom'];
  if (unitId === 5) return ['u5-overview', 'u5-knowledge', 'u5-lesson-3'];
  return [];
}

function roundTrip(unitId: number, file: string, hash: string): { file: string; hash: string } | null {
  const href = lessonShellHref(unitId, file, hash, notesInUnit(unitId)[0] ?? file);
  const url = new URL(href, 'https://lesson.local');
  return resolveLessonDeepLink({
    note: url.searchParams.get('note'),
    unitId: Number(url.searchParams.get('unit')),
    hash: url.hash,
    alias: {},
    notesInUnit,
    isKnownNote: (item) => KNOWN.has(item),
  });
}

describe('lesson location', () => {
  const chapter5 = {
    unitId: 5,
    unitName: '中断系统与定时器',
    noteFile: 'u5-overview',
    noteTitle: '第 5 章交互总览',
  };

  it('names chapter, lesson, and section for the regression anchors', () => {
    const interrupt = resolveLessonLocation({ ...chapter5, sectionId: 'int-2' });
    expect(lessonLocationTrail(interrupt)).toBe('第 5 章 · 中断系统与定时器 › 第 1 次课 · 中断入门 › 查询与中断');
    expect(interrupt.chapter).toMatchObject({ file: 'u5-overview', hash: '' });
    expect(interrupt.lesson).toMatchObject({ file: 'u5-overview', hash: '#int-1' });

    const priority = resolveLessonLocation({ ...chapter5, sectionId: 'int-6' });
    expect(lessonLocationTrail(priority)).toBe('第 5 章 · 中断系统与定时器 › 第 1 次课 · 中断入门 › 优先级');

    const split = resolveLessonLocation({
      ...chapter5,
      noteFile: 'u5-lesson-3',
      noteTitle: '第 3 次课 · 定时与收口',
      sectionId: 'hex-split',
    });
    expect(lessonLocationTrail(split)).toBe('第 5 章 · 中断系统与定时器 › 第 3 次课 · 定时与收口 › ÷256 拆字节');
    expect(split.lesson).toMatchObject({ file: 'u5-lesson-3', hash: '' });
    expect(split.chapter.file).toBe('u5-overview');

    const map = resolveLessonLocation({
      unitId: 4,
      unitName: '汇编语言程序设计',
      noteFile: 'u4-classroom',
      noteTitle: '课堂互动台',
      sectionId: 's-map',
    });
    expect(lessonLocationTrail(map)).toBe('第 4 章 · 汇编语言程序设计 › 回炉复习 › 111 条全景');
    expect(map.chapter).toMatchObject({ file: 'u4-classroom', hash: '' });
    expect(map.lesson).toMatchObject({ file: 'u4-classroom', hash: '#u4-lesson-a' });
  });

  it('keeps a chapter chooser and a chapter 2 page readable without a section hash', () => {
    expect(lessonLocationTrail(resolveLessonLocation({ ...chapter5, sectionId: '' }))).toBe(
      '第 5 章 · 中断系统与定时器 › 先选课次 › 第 5 章交互总览',
    );
    expect(lessonLocationTrail(resolveLessonLocation({
      unitId: 2,
      unitName: '硬件结构',
      noteFile: 'u2-memory',
      noteTitle: '存储器组织',
      sectionId: 'pit',
    }))).toBe('第 2 章 · 硬件结构 › 第 1 次课 · 片子里面 › 存储器组织');
    expect(resolveLessonLocation({
      unitId: 2,
      unitName: '硬件结构',
      noteFile: 'u2-bus',
      noteTitle: '总线结构',
      sectionId: 'int-2',
    }).section.label).toBe('总线结构');
  });

  it('offers the same lesson entries the breadcrumb opens', () => {
    expect(lessonSwitchChoices(2)).toEqual([]);
    expect(lessonSwitchChoices(5).map((item) => item.title)).toEqual(['第 1 次课', '第 2 次课', '第 3 次课', '定时/计数器']);
    expect(lessonSwitchChoices(5)[2]).toMatchObject({ file: 'u5-lesson-3', hash: '' });
    expect(lessonSwitchChoices(3)).toHaveLength(4);
    expect(lessonSwitchChoices(4).map((item) => item.id)).toEqual([
      'u4-lesson-a', 'u4-lesson-b', 'u4-lesson-c', 'u4-lesson-d', 'u4-lesson-e',
    ]);
  });

  it('builds a shell URL that opens the same file and hash again', () => {
    expect(roundTrip(5, 'u5-overview', '#int-2')).toEqual({ file: 'u5-overview', hash: '#int-2' });
    expect(roundTrip(5, 'u5-overview', '#int-6')).toEqual({ file: 'u5-overview', hash: '#int-6' });
    expect(roundTrip(5, 'u5-lesson-3', '#hex-split')).toEqual({ file: 'u5-lesson-3', hash: '#hex-split' });
    expect(roundTrip(4, 'u4-classroom', '#s-map')).toEqual({ file: 'u4-classroom', hash: '#s-map' });
    expect(roundTrip(5, 'u5-overview', '')).toEqual({ file: 'u5-overview', hash: '' });
    expect(roundTrip(4, 'u4-classroom', '')).toEqual({ file: 'u4-classroom', hash: '' });
    expect(roundTrip(3, 'u3-overview', '#u3-lesson-d')).toEqual({ file: 'u3-overview', hash: '#u3-lesson-d' });
    expect(roundTrip(2, 'u2-memory', '#pit')).toEqual({ file: 'u2-memory', hash: '#pit' });
    expect(lessonShellHref(5, 'u5-overview', 'javascript:alert(1)', 'u5-overview')).toBe('/lesson-notes?unit=5');
  });
});
