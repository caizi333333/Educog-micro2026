import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chapter 5 classroom stays one document so old anchors keep working,
 * and a lesson picker shows at most eight section tabs at a time.
 */
const ROOT = join(__dirname, '../../..');
const U5 = join(ROOT, 'public/resources/course/courseware/u5');

function read(name: string): string {
  return readFileSync(join(U5, name), 'utf8');
}

describe('unit 5 lesson split', () => {
  const classroom = read('u5-interrupt-classroom.html');
  const overview = read('u5-overview.html');
  const knowledge = read('u5-knowledge.html');
  const notes = readFileSync(join(ROOT, 'src/app/lesson-notes/page.tsx'), 'utf8');

  it('keeps every classroom pane and the hex-split anchor', () => {
    for (let pane = 1; pane <= 20; pane += 1) {
      expect(classroom).toContain(`id="p${pane}"`);
      expect(classroom).toContain(`data-p="${pane}"`);
    }
    expect(classroom).toContain('id="hex-split"');
    expect(classroom).toContain('id="rev-hex"');
    expect(classroom).toContain('80C51');
    expect(classroom).not.toContain('src="https://player.bilibili.com');
  });

  it('groups section tabs into three lessons of at most eight', () => {
    const match = classroom.match(/var LESSONS=\{([\s\S]*?)\};/);
    expect(match).toBeTruthy();
    const body = match?.[1] ?? '';
    const groups = [...body.matchAll(/([abc]):\[([0-9,\s]+)\]/g)].map((item) => ({
      id: item[1],
      panes: item[2].split(',').map((value) => Number(value.trim())).filter((value) => value > 0),
    }));
    expect(groups.map((group) => group.id)).toEqual(['a', 'b', 'c']);
    const seen = new Set<number>();
    for (const group of groups) {
      expect(group.panes.length).toBeGreaterThan(0);
      expect(group.panes.length).toBeLessThanOrEqual(8);
      for (const pane of group.panes) {
        expect(seen.has(pane)).toBe(false);
        seen.add(pane);
      }
    }
    expect([...seen].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(classroom).toContain('data-lesson="a"');
    expect(classroom).toContain('data-lesson="b"');
    expect(classroom).toContain('data-lesson="c"');
    expect(classroom).toContain('flex-wrap:wrap');
  });

  it('opens lesson sessions from stable entry pages without dropping hex-split', () => {
    expect(read('u5-lesson-1.html')).toContain('u5-interrupt-classroom.html#lesson-a');
    expect(read('u5-lesson-2.html')).toContain('u5-interrupt-classroom.html#lesson-b');
    expect(read('u5-lesson-3.html')).toContain('u5-interrupt-classroom.html#lesson-c');
    expect(read('u5-hex-split.html')).toContain('u5-interrupt-classroom.html#hex-split');
    expect(classroom).toContain("if(h==='#hex-split' || h==='#rev-hex')");
    expect(classroom).toContain("lessonFromToken");
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
