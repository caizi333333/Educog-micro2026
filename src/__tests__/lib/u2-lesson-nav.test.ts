import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  describeLearningTarget,
  lessonFileForSection,
  resolveLessonDeepLink,
  resolveLessonVisit,
} from '@/lib/classroom-sections';
import { U2_LESSONS, u2FileForLesson, u2LessonForFile } from '@/lib/u2-lessons';

/**
 * Chapter 2 keeps six files. Navigation is three lessons of two pages,
 * and a 390px screen must not grow a horizontal page scrollbar.
 */
const ROOT = join(__dirname, '../../..');
const COURSEWARE = join(ROOT, 'public/resources/course/courseware/u2');
const NOTES = join(ROOT, 'src/app/lesson-notes/page.tsx');

const U2_FILES = U2_LESSONS.flatMap((lesson) => lesson.pages.map((page) => page.file));

function read(name: string): string {
  return readFileSync(join(COURSEWARE, name), 'utf8');
}

describe('chapter 2 lesson navigation', () => {
  const notes = readFileSync(NOTES, 'utf8');
  const pages = readdirSync(COURSEWARE).filter((name) => name.endsWith('.html'));

  it('groups the six pages into three lessons without dropping a topic', () => {
    expect(U2_LESSONS).toHaveLength(3);
    expect(U2_FILES).toEqual([
      'u2-cpu-structure',
      'u2-memory',
      'u2-io-port',
      'u2-bus',
      'u2-clock-timing',
      'u2-reset',
    ]);
    U2_LESSONS.forEach((lesson) => {
      expect(lesson.pages).toHaveLength(2);
      expect(lesson.pages.length).toBeLessThanOrEqual(8);
    });
    expect(u2LessonForFile('u2-bus')?.id).toBe('u2-lesson-b');
    expect(u2FileForLesson('u2-lesson-c')).toBe('u2-clock-timing');
    expect(u2FileForLesson('lesson-a')).toBeNull();
    expect(notes).toContain("file: 'u2-memory'");
    expect(notes).toContain('data-u2-nav="chapter"');
    expect(notes).toContain('aria-label="第 2 章课次"');
    expect(notes).toContain('grid-cols-2');
    expect(notes).toContain('?note=u2-memory');
    expect(notes).not.toContain('职工');
  });

  it('lands lesson hashes and the three in-page tabs on the original file', () => {
    const notesInUnit = (unitId: number): readonly string[] => (unitId === 2 ? U2_FILES : []);
    const isKnownNote = (file: string): boolean => U2_FILES.includes(file);
    const resolve = (note: string | null, unitId: number | null, hash: string) => resolveLessonDeepLink({
      note,
      unitId,
      hash,
      alias: {},
      notesInUnit,
      isKnownNote,
    });

    expect(lessonFileForSection('u2-lesson-a')).toBe('u2-cpu-structure');
    expect(lessonFileForSection('u2-lesson-b')).toBe('u2-io-port');
    expect(lessonFileForSection('#u2-lesson-c')).toBe('u2-clock-timing');
    expect(lessonFileForSection('lesson-a')).toBeNull();
    expect(lessonFileForSection('teach')).toBeNull();
    expect(resolve('u2-memory', null, '')).toEqual({ file: 'u2-memory', hash: '' });
    expect(resolve('u2-memory', null, '#pit')).toEqual({ file: 'u2-memory', hash: '#pit' });
    expect(lessonFileForSection('bus')).toBe('u2-bus');
    expect(resolve(null, 2, '#bus')).toEqual({ file: 'u2-bus', hash: '#bus' });
    expect(resolve('u2-bus', null, '#bus')).toEqual({ file: 'u2-bus', hash: '#bus' });
    expect(describeLearningTarget('2.6#bus')).toContain('总线角色');
    expect(resolve('u2-reset', null, '#quiz')).toEqual({ file: 'u2-reset', hash: '#quiz' });
    expect(resolve(null, 2, '#u2-lesson-b')).toEqual({ file: 'u2-io-port', hash: '#u2-lesson-b' });
    expect(resolve(null, 2, '#quiz')).toEqual({ file: 'u2-cpu-structure', hash: '#quiz' });
    expect(resolve('u2-cpu-structure', null, '#u2-lesson-b')).toEqual({ file: 'u2-cpu-structure', hash: '' });
    expect(describeLearningTarget('2.3#u2-lesson-b')).toContain('第 2 次课');
    expect(resolveLessonVisit({
      unitId: 2,
      noteFile: 'u2-bus',
      pointId: '2.6',
      sectionId: 'u2-lesson-b',
    }).moduleId).toBe('u2-bus');
  });

  it('keeps a wrapping chapter door and a phone page that does not scroll sideways', () => {
    expect([...pages].sort()).toEqual([
      'u2-bus.html',
      'u2-clock-timing.html',
      'u2-cpu-structure.html',
      'u2-io-port.html',
      'u2-memory.html',
      'u2-reset.html',
    ]);
    for (const name of pages) {
      const html = read(name);
      expect(html).toContain("'aria-label': '第 2 章入口'");
      expect(html).toContain('flex-wrap:wrap');
      expect(html).toContain('overflow-x:hidden');
      expect(html).toContain('body.kp-embed .u2-doors{display:none}');
      expect(html).toContain("addEventListener('hashchange'");
      expect(html).toContain("type: 'lesson-note:open'");
      expect(html).toContain('id: t.k');
      expect(html).toContain('80C51');
      expect(html).not.toContain('职工');
      expect(html).not.toContain('min-width:720');
      const phoneStart = html.indexOf('<style id="phone-type">');
      const phone = html.slice(phoneStart, html.indexOf('</style>', phoneStart));
      expect(phone).toContain('repeat(4,minmax(0,1fr))');
      expect(phone).not.toContain('font-size:10px');
      expect(phone).not.toContain('font-size:11px');
      for (const lesson of U2_LESSONS) {
        expect(html).toContain(lesson.id);
        expect(html).toContain(lesson.topics);
        for (const page of lesson.pages) expect(html).toContain(page.title);
      }
    }
    const cpu = read('u2-cpu-structure.html');
    expect(cpu).toContain("wrap.className='psw-bits'");
    expect(cpu).not.toContain('repeat(8,1fr)');
    expect(read('u2-reset.html')).toContain('class="kp-scroll"');
  });
});
