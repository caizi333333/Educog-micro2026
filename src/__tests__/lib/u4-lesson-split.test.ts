import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonFileForSection, resolveLessonDeepLink, resolveLessonVisit } from '@/lib/classroom-sections';

/**
 * Chapter 4 classroom stays one document so old anchors keep working.
 * A session picker shows one interaction at a time, at most eight subtabs.
 */
const CLASSROOM = join(__dirname, '../../../public/resources/course/courseware/u4/u4-classroom.html');
const NOTES = join(__dirname, '../../../src/app/lesson-notes/page.tsx');

const EXPECTED: Record<string, readonly string[]> = {
  a: ['judge', 'mode', 'map'],
  b: ['4-1', '4-2', '4-3', '4-4'],
  c: ['4-5', '4-6', '4-6b', '4-7', '4-9'],
  d: ['4-11', '4-12', '4-14', '4-15', '4-16'],
  e: ['quiz', 'quiz-all', 'hw'],
};

function readLessons(html: string): Record<string, string[]> {
  const match = html.match(/var LESSONS = \{([\s\S]*?)\};/);
  if (!match?.[1]) throw new Error('LESSONS missing');
  return JSON.parse(`{${match[1]}}`) as Record<string, string[]>;
}

describe('unit 4 classroom sessions', () => {
  const html = readFileSync(CLASSROOM, 'utf8');
  const notes = readFileSync(NOTES, 'utf8');

  it('keeps the three panes, the homework, and the 80C51 examples', () => {
    expect(html).toContain('id="p-rev"');
    expect(html).toContain('id="p-run"');
    expect(html).toContain('id="p-quiz"');
    expect(html).toContain('id="s-judge"');
    expect(html).toContain('id="s-mode"');
    expect(html).toContain('id="s-map"');
    expect(html).toContain('id="hwCard"');
    expect(html).toContain('课后作业');
    expect(html).toContain('80C51');
    expect(html).toContain('var JUDGE = [');
    expect(html).toContain('var READS = [');
    expect(html).not.toContain('min-width:720');
    expect(html).toContain('overflow-x:hidden');
    expect(html).toContain('flex-wrap:wrap');
    expect(html).toContain("addEventListener('hashchange'");
  });

  it('groups interactions so each session shows at most eight subtabs', () => {
    const lessons = readLessons(html);
    expect(Object.keys(lessons)).toEqual(['a', 'b', 'c', 'd', 'e']);
    const seen = new Set<string>();
    for (const [id, subs] of Object.entries(EXPECTED)) {
      expect(lessons[id]).toEqual([...subs]);
      expect(subs.length).toBeLessThanOrEqual(8);
      subs.forEach((sub) => {
        expect(seen.has(sub)).toBe(false);
        seen.add(sub);
      });
    }
    const exampleIds = [...html.matchAll(/id: '(4-[0-9]+b?)'/g)].map((item) => item[1]);
    expect(exampleIds.filter((id, index) => exampleIds.indexOf(id) === index).sort()).toEqual(
      ['4-1', '4-11', '4-12', '4-14', '4-15', '4-16', '4-2', '4-3', '4-4', '4-5', '4-6', '4-6b', '4-7', '4-9'],
    );
    const nav = html.slice(html.indexOf('aria-label="互动类型"'), html.indexOf('aria-label="本次课小节"'));
    const primary = nav.match(/data-lesson="/g) ?? [];
    expect(primary.length).toBe(5);
    expect(primary.length).toBeLessThanOrEqual(8);
  });

  it('lands old hashes on the same screen and keeps lesson-notes on this file', () => {
    expect(html).toContain("'p-rev': 'judge'");
    expect(html).toContain("'p-run': '4-7'");
    expect(html).toContain("'p-quiz': 'quiz'");
    expect(html).toContain("'s-mode': 'mode'");
    expect(html).toContain("'s-map': 'map'");
    expect(html).toContain("'u4-lesson-b': '4-1'");
    expect(html).toContain("'u4-lesson-d': '4-11'");
    expect(notes).toContain("file: 'u4-classroom'");
    expect(notes).toContain('#p-rev');
    expect(notes).toContain('#p-run');
    expect(notes).toContain('#p-quiz');
    expect(lessonFileForSection('p-rev')).toBe('u4-classroom');
    expect(lessonFileForSection('p-run')).toBe('u4-classroom');
    expect(lessonFileForSection('p-quiz')).toBe('u4-classroom');
    expect(lessonFileForSection('s-mode')).toBe('u4-classroom');
    expect(lessonFileForSection('ex-4-7')).toBe('u4-classroom');
    expect(lessonFileForSection('u4-lesson-c')).toBe('u4-classroom');
    expect(lessonFileForSection('lesson-a')).toBeNull();
    expect(resolveLessonVisit({
      unitId: 4,
      noteFile: 'u4-classroom',
      pointId: '3.5',
      sectionId: 'p-quiz',
    }).targetId).toBe('3.5#p-quiz');
    expect(resolveLessonDeepLink({
      note: null,
      unitId: 4,
      hash: '#p-run',
      alias: {},
      notesInUnit: () => ['u4-classroom'],
      isKnownNote: (file) => file === 'u4-classroom',
    })).toEqual({ file: 'u4-classroom', hash: '#p-run' });
    expect(resolveLessonDeepLink({
      note: 'u4-classroom',
      unitId: null,
      hash: '#s-map',
      alias: {},
      notesInUnit: () => ['u4-classroom'],
      isKnownNote: (file) => file === 'u4-classroom',
    })).toEqual({ file: 'u4-classroom', hash: '#s-map' });
  });
});
