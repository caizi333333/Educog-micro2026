import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonEntryHref, lessonEntryTarget, scrollLessonCoursewareIntoView } from '@/lib/lesson-shell';

const ROOT = join(__dirname, '../../..');

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
    expect(css).toContain('width: min(100%, var(--content-max-width))');
    expect(css).toContain('gap: var(--space-4)');
    expect(css).toContain('gap: var(--space-3)');
    expect(css).toContain('max-width: 40%');
    expect(practice).toContain('var(--space-3)');
    expect(practice).toContain('var(--space-2)');
  });
});
