import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonEntryHref, lessonEntryTarget, lessonPlace, lessonPlaceHref, observeCoursewareInput, scrollLessonCoursewareIntoView } from '@/lib/lesson-shell';

const ROOT = join(__dirname, '../../..');

describe('courseware input observation', () => {
  it('observes a dynamically added nested iframe and stops after cleanup', async () => {
    const outer = document.createElement('iframe');
    document.body.appendChild(outer);
    const input = jest.fn();
    const stop = observeCoursewareInput(outer, input);
    const inner = outer.contentDocument!.createElement('iframe');
    inner.srcdoc = '<button>练习</button>';
    outer.contentDocument!.body.appendChild(inner);
    await Promise.resolve(); // deliver the mutation observer
    inner.contentWindow!.dispatchEvent(new Event('wheel'));
    expect(input).toHaveBeenCalledTimes(1);
    stop();
    inner.contentWindow!.dispatchEvent(new Event('wheel'));
    expect(input).toHaveBeenCalledTimes(1);
    outer.remove();
  });

  it('safely cleans up if a previously accessible frame becomes cross-origin', () => {
    const inaccessible = new DOMException('Cross-origin frame', 'SecurityError');
    const fakeWindow = {
      document: document.implementation.createHTMLDocument(),
      addEventListener: jest.fn(),
      get removeEventListener(): never { throw inaccessible; },
    };
    const frame = { contentWindow: fakeWindow } as unknown as HTMLIFrameElement;
    const stop = observeCoursewareInput(frame, jest.fn());
    expect(fakeWindow.addEventListener).toHaveBeenCalledTimes(4);
    expect(() => stop()).not.toThrow();
  });
});

describe('lesson shell entry', () => {
  it('returns to the chapter chooser or the current lesson, not browser history', () => {
    expect(lessonEntryTarget(5, 'u5-lesson-3')).toEqual({ file: 'u5-overview', hash: '' });
    expect(lessonEntryTarget(5, 'u5-overview')).toEqual({ file: 'u5-overview', hash: '' });
    expect(lessonEntryTarget(5, 'u5-knowledge')).toEqual({ file: 'u5-overview', hash: '' });
    expect(lessonEntryTarget(4, 'u4-video')).toEqual({ file: 'u4-classroom', hash: '' });
    expect(lessonEntryTarget(3, 'u3-video')).toEqual({ file: 'u3-overview', hash: '' });
    expect(lessonEntryTarget(2, 'u2-bus')).toEqual({ file: 'u2-io-port', hash: '#u2-lesson-b' });
    expect(lessonEntryTarget(2, 'u2-reset')).toEqual({ file: 'u2-clock-timing', hash: '#u2-lesson-c' });
    expect(lessonEntryTarget(2, 'u2-cpu-structure')).toEqual({ file: 'u2-cpu-structure', hash: '#u2-lesson-a' });
    expect(lessonEntryTarget(9, 'u2-bus')).toEqual({ file: 'u2-bus', hash: '' });
  });

  it('builds a shell URL and drops a hash that is not a courseware anchor', () => {
    expect(lessonEntryHref(5, '')).toBe('/lesson-notes?unit=5');
    expect(lessonEntryHref(2, '#u2-lesson-b')).toBe('/lesson-notes?unit=2#u2-lesson-b');
    expect(lessonEntryHref(5, '#int-6')).toBe('/lesson-notes?unit=5#int-6');
    expect(lessonEntryHref(5, 'javascript:alert(1)')).toBe('/lesson-notes?unit=5');
  });

  it('scrolls the courseware wrapper to the start of the viewport', () => {
    const scrollIntoView = jest.fn();
    const node = { scrollIntoView } as unknown as HTMLElement;
    scrollLessonCoursewareIntoView(node);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    scrollLessonCoursewareIntoView(null);
    scrollLessonCoursewareIntoView({} as HTMLElement);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('keeps the lesson-notes column on the spacing tokens', () => {
    const page = readFileSync(join(ROOT, 'src/app/lesson-notes/page.tsx'), 'utf8');
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
    const practice = readFileSync(join(ROOT, 'src/components/practice/DragMatchPractice.tsx'), 'utf8');
    expect(page).not.toContain('max-w-7xl');
    expect(page).toContain('lesson-shell__column');
    expect(page).toContain('回课次');
    expect(page).toContain('当前位置');
    expect(css).toContain('.lesson-shell__where');
    expect(css).toContain('flex: 1 1 16rem');
    expect(css).toContain('position: sticky');
    expect(css).toContain('width: min(100%, var(--content-max-width))');
    expect(css).toContain('gap: var(--space-4)');
    expect(css).toContain('gap: var(--space-3)');
    expect(css).toContain('max-width: 40%');
    expect(practice).toContain('var(--space-3)');
    expect(practice).toContain('var(--space-2)');
  });
});

describe('lesson place trail', () => {
  const chapter5 = {
    unitId: 5,
    unitName: '中断系统与定时器',
    noteFile: 'u5-overview',
    noteTitle: '第 5 章交互总览',
  };

  it('names chapter, lesson, and section for #int-2, #int-6, #s-map, and #hex-split', () => {
    expect(lessonPlace({ ...chapter5, sectionId: 'int-2' })).toEqual([
      { id: 'chapter-5', label: '第 5 章 · 中断系统与定时器', file: 'u5-overview', hash: '' },
      { id: 'u5-lesson-a', label: '第 1 次课 · 中断入门', file: 'u5-overview', hash: '#int-1' },
      { id: 'section-int-2', label: '查询与中断' },
    ]);
    expect(lessonPlace({ ...chapter5, sectionId: '#int-6' }).map((crumb) => crumb.label)).toEqual([
      '第 5 章 · 中断系统与定时器',
      '第 1 次课 · 中断入门',
      '优先级',
    ]);
    expect(lessonPlace({
      unitId: 4,
      unitName: '汇编语言程序设计',
      noteFile: 'u4-classroom',
      noteTitle: '课堂互动台',
      sectionId: 's-map',
    })).toEqual([
      { id: 'chapter-4', label: '第 4 章 · 汇编语言程序设计', file: 'u4-classroom', hash: '' },
      { id: 'u4-lesson-a', label: '回炉复习', file: 'u4-classroom', hash: '#u4-lesson-a' },
      { id: 'section-s-map', label: '111 条全景' },
    ]);
    expect(lessonPlace({
      ...chapter5,
      noteFile: 'u5-lesson-3',
      noteTitle: '第 3 次课 · 定时与收口',
      sectionId: 'hex-split',
    })).toEqual([
      { id: 'chapter-5', label: '第 5 章 · 中断系统与定时器', file: 'u5-overview', hash: '' },
      { id: 'u5-lesson-3', label: '第 3 次课 · 定时与收口', file: 'u5-lesson-3', hash: '' },
      { id: 'section-hex-split', label: '÷256 拆字节' },
    ]);
  });

  it('stops at the chapter door and keeps a chapter 2 page under its lesson', () => {
    expect(lessonPlace({ ...chapter5, sectionId: '' })).toEqual([
      { id: 'chapter-5', label: '第 5 章 · 中断系统与定时器' },
    ]);
    expect(lessonPlace({ ...chapter5, sectionId: 'home' })).toEqual([
      { id: 'chapter-5', label: '第 5 章 · 中断系统与定时器' },
    ]);
    expect(lessonPlace({
      unitId: 2,
      unitName: '硬件结构',
      noteFile: 'u2-memory',
      noteTitle: '存储器组织',
      sectionId: 'pit',
    })).toEqual([
      { id: 'chapter-2', label: '第 2 章 · 硬件结构', file: 'u2-cpu-structure', hash: '#u2-lesson-a' },
      { id: 'u2-lesson-a', label: '第 1 次课 · 片子里面', file: 'u2-cpu-structure', hash: '#u2-lesson-a' },
      { id: 'page-u2-memory', label: '存储器组织 · 疑点' },
    ]);
    expect(lessonPlace({
      unitId: 3,
      unitName: '指令系统',
      noteFile: 'u3-overview',
      noteTitle: '第 3 章交互总览',
      sectionId: 'addressing',
    }).map((crumb) => crumb.label)).toEqual([
      '第 3 章 · 指令系统',
      '第 1 次课 · 数在哪',
      '寻址方式与机器周期',
    ]);
  });

  it.each(['gate-win', 'p-gate', 'gate', 'p19'])('labels #%s under lesson 3', (sectionId) => {
    expect(lessonPlace({
      ...chapter5,
      noteFile: 'u5-lesson-3',
      noteTitle: '第 3 次课 · 定时与收口',
      sectionId,
    }).map((crumb) => crumb.label)).toEqual([
      '第 5 章 · 中断系统与定时器',
      '第 3 次课 · 定时与收口',
      'GATE：计时窗口',
    ]);
    expect(lessonPlaceHref(5, 'u5-lesson-3', `#${sectionId}`)).toBe(`/lesson-notes?unit=5#${sectionId}`);
  });

  it('builds a reloadable shell URL and drops a hash that is not an anchor', () => {
    expect(lessonPlaceHref(5, 'u5-overview', '')).toBe('/lesson-notes?unit=5');
    expect(lessonPlaceHref(5, 'u5-overview', '#int-1')).toBe('/lesson-notes?unit=5#int-1');
    expect(lessonPlaceHref(5, 'u5-lesson-3', '')).toBe('/lesson-notes?note=u5-lesson-3');
    expect(lessonPlaceHref(5, 'u5-lesson-3', '#hex-split')).toBe('/lesson-notes?unit=5#hex-split');
    expect(lessonPlaceHref(4, 'u4-classroom', '#s-map')).toBe('/lesson-notes?unit=4#s-map');
    expect(lessonPlaceHref(2, 'u2-cpu-structure', '#u2-lesson-a')).toBe('/lesson-notes?unit=2#u2-lesson-a');
    expect(lessonPlaceHref(5, 'u5-overview', 'javascript:alert(1)')).toBe('/lesson-notes?unit=5');
    expect(lessonPlaceHref(5, '../etc/passwd', '')).toBe('/lesson-notes?unit=5');
  });
});
