import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/**
 * Chapter 5 classroom is a three-lesson chooser. Each lesson page keeps
 * its own panes and shows at most eight section tabs. Old hashes on the
 * chooser still open the lesson that owns that section.
 */
const ROOT = join(__dirname, '../../..');
const U5 = join(ROOT, 'public/resources/course/courseware/u5');
const LESSON_FILES = ['u5-lesson-1.html', 'u5-lesson-2.html', 'u5-lesson-3.html'] as const;

function read(name: string): string {
  return readFileSync(join(U5, name), 'utf8');
}

function tabIds(html: string): number[] {
  const nav = html.slice(html.indexOf('id="tabs"'), html.indexOf('<section'));
  return [...nav.matchAll(/data-p="(\d+)"/g)].map((item) => Number(item[1]));
}

function classroomTarget(hash: string, search = ''): string {
  const html = read('u5-interrupt-classroom.html');
  const code = html.match(/<script id="u5-lesson-redirect">([\s\S]*?)<\/script>/)?.[1];
  if (!code) throw new Error('lesson redirect missing');
  const context = createContext({
    window: {} as { u5ClassroomTarget?: (nextHash: string, nextSearch: string) => string; addEventListener?: unknown },
    location: { hash, search, replace() {} },
    URLSearchParams,
  });
  runInContext(code, context);
  const target = context.window.u5ClassroomTarget;
  if (!target) throw new Error('u5ClassroomTarget missing');
  return target(hash, search);
}

describe('unit 5 lesson split', () => {
  const classroom = read('u5-interrupt-classroom.html');
  const lessons = LESSON_FILES.map((name) => read(name));
  const lessonHtml = lessons.join('\n');
  const runtime = read('lib/u5-interrupt-classroom.js');
  const overview = read('u5-overview.html');
  const knowledge = read('u5-knowledge.html');
  const notes = readFileSync(join(ROOT, 'src/app/lesson-notes/page.tsx'), 'utf8');

  it('keeps every classroom pane on a lesson page and the hex-split anchor', () => {
    for (let pane = 1; pane <= 20; pane += 1) {
      expect(lessonHtml).toContain(`id="p${pane}"`);
      expect(lessonHtml).toContain(`data-p="${pane}"`);
    }
    expect(read('u5-lesson-3.html')).toContain('id="hex-split"');
    expect(read('u5-lesson-3.html')).toContain('id="rev-hex"');
    expect(lessonHtml).toContain('80C51');
    expect(classroom).toContain('80C51');
    expect(lessonHtml).not.toContain('src="https://player.bilibili.com');
    expect(classroom).not.toContain('src="https://player.bilibili.com');
  });

  it('gives each lesson page at most eight section tabs', () => {
    const seen = new Set<number>();
    for (const html of lessons) {
      const panes = tabIds(html);
      expect(panes.length).toBeGreaterThan(0);
      expect(panes.length).toBeLessThanOrEqual(8);
      expect(html.match(/class="tab"/g)?.length).toBe(panes.length);
      for (const pane of panes) {
        expect(seen.has(pane)).toBe(false);
        seen.add(pane);
      }
      expect(html).toContain('data-lesson="a"');
      expect(html).toContain('data-lesson="b"');
      expect(html).toContain('data-lesson="c"');
      expect(html).toContain('flex-wrap:wrap');
    }
    expect([...seen].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(classroom.match(/class="tab"/g)).toBeNull();
    expect(runtime).toContain('var LESSONS={');
    const chooserLessons = [...classroom.matchAll(/data-lesson="([abc])"/g)].map((item) => item[1]);
    expect(chooserLessons).toEqual(['a', 'b', 'c']);
  });

  it('opens old hashes on the lesson that owns the section', () => {
    expect(classroomTarget('#lesson-a')).toBe('u5-lesson-1.html#lesson-a');
    expect(classroomTarget('#lesson-b')).toBe('u5-lesson-2.html#lesson-b');
    expect(classroomTarget('#lesson-c')).toBe('u5-lesson-3.html#lesson-c');
    expect(classroomTarget('#p2')).toBe('u5-lesson-1.html#p2');
    expect(classroomTarget('#int-2')).toBe('u5-lesson-1.html#int-2');
    expect(classroomTarget('#hex-split')).toBe('u5-lesson-3.html#hex-split');
    expect(classroomTarget('#rev-hex')).toBe('u5-lesson-3.html#rev-hex');
    expect(classroomTarget('#p10')).toBe('u5-lesson-2.html#p10');
    expect(classroomTarget('#actA')).toBe('u5-lesson-2.html#actA');
    expect(classroomTarget('', '?lesson=3')).toBe('u5-lesson-3.html');
    expect(classroomTarget('')).toBe('');
    expect(read('u5-lesson-1.html')).toContain('id="p2"');
    expect(read('u5-lesson-1.html')).not.toContain('http-equiv="refresh"');
    expect(read('u5-hex-split.html')).toContain('u5-interrupt-classroom.html#hex-split');
    expect(runtime).toContain("if(h==='#hex-split' || h==='#rev-hex')");
    expect(runtime).toContain('lessonFromToken');
    expect(classroom).toContain('lessonFromToken');
  });

  it('splits the overview into interrupt and timer doors and keeps deep links', () => {
    const shell = overview.slice(0, overview.indexOf('var DATA='));
    expect(overview).toContain('id="door-int"');
    expect(overview).toContain('id="door-tmr"');
    expect(shell).toContain('data-lesson="int"');
    expect(shell).toContain('data-lesson="tmr"');
    expect(shell).toContain('aria-label="中断或定时"');
    expect(shell).toContain('aria-label="第几次课"');
    expect(shell).toContain('overflow-x:hidden');
    expect(shell).toContain('flex-wrap:wrap');
    expect(overview).toContain('data-go="int-1"');
    expect(overview).toContain('data-go="int-9"');
    expect(overview).toContain('data-go="int-14"');
    expect(overview).toContain('data-go="tmr-dz"');
    expect(overview).toContain('href="#int-2"');
    expect(overview).toContain('href="#tmr-show"');
    expect(overview).toContain('u5-interrupt-classroom.html#hex-split');
    expect(overview).toContain('mountInterruptLessons');
    expect(overview).toContain('第 1 次课 · 中断入门');
    expect(overview).toContain('定时/计数器');
    expect(overview).toContain("'lesson-a':'int-1'");
    expect(overview).toContain("'hex-split':'int-14'");
    expect(overview).toContain("return 'int-'+pane[1]");

    const lessons = shell.slice(shell.indexOf('id="lessons"'), shell.indexOf('id="sessions"'));
    const topLevel = [...lessons.matchAll(/data-lesson="(int|tmr)"/g)].map((item) => item[1]);
    expect(topLevel).toEqual(['int', 'tmr']);

    const sessionNav = shell.slice(shell.indexOf('id="sessions"'), shell.indexOf('<main'));
    const sessionButtons = [...sessionNav.matchAll(/data-lesson="([abc])"/g)].map((item) => item[1]);
    expect(sessionButtons).toEqual(['a', 'b', 'c']);
    expect(sessionButtons.length).toBeLessThanOrEqual(8);

    const match = overview.match(/var SESSIONS=\{([\s\S]*?)\};/);
    expect(match).toBeTruthy();
    const groups = [...(match?.[1] ?? '').matchAll(/(a|b|c|tmr):\[([^\]]+)\]/g)].map((item) => ({
      id: item[1],
      sections: [...item[2].matchAll(/'([^']+)'/g)].map((section) => section[1]),
    }));
    expect(groups.map((group) => group.id)).toEqual(['a', 'b', 'c', 'tmr']);
    const seen = new Set<string>();
    for (const group of groups) {
      expect(group.sections.length).toBeGreaterThan(0);
      expect(group.sections.length).toBeLessThanOrEqual(8);
      for (const section of group.sections) {
        expect(seen.has(section)).toBe(false);
        seen.add(section);
        expect(shell).toContain(`href="#${section}" data-a="${section}" data-lesson="${group.id}"`);
      }
    }
    expect(seen.has('int-2')).toBe(true);
    expect(seen.has('tmr-show')).toBe(true);
  });

  it('points knowledge and lesson notes at the same sessions', () => {
    expect(knowledge).toContain('u5-lesson-1.html');
    expect(knowledge).toContain('u5-lesson-2.html');
    expect(knowledge).toContain('u5-lesson-3.html');
    expect(knowledge).toContain("hash==='#lesson-b'");
    expect(knowledge).toContain("file==='u5-lesson-2'");
    expect(knowledge).toContain("hash==='#hex-split'");
    expect(notes).toContain("file: 'u5-overview'");
    expect(notes).toContain("file: 'u5-knowledge'");
    expect(notes).toContain('第 1 次课入门');
    expect(notes).not.toMatch(/file:\s*'u5-interrupt-classroom'/);
  });
});
