import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chapter 3 stays one overview document so old anchors keep working.
 * A lesson picker shows only the current lesson's sections.
 * `#lesson-a` stays with chapter 5; chapter 3 uses `#u3-lesson-a`.
 */
const OVERVIEW = join(__dirname, '../../../public/resources/course/courseware/u3/u3-overview.html');

const LESSON_SECTIONS = {
  a: ['isa-map', 'addressing'],
  b: ['transfer', 'movx-movc', 'stack', 'xch'],
  c: ['arith', 'logic'],
  d: ['jump', 'bit'],
} as const;

describe('unit 3 lesson shell', () => {
  const html = readFileSync(OVERVIEW, 'utf8');
  const shell = html.slice(0, html.indexOf('var DATA='));

  it('keeps the embedded lessons and the phone rules that drop a 720px floor', () => {
    expect(shell).toContain('80C51');
    expect(shell).toContain('@media(max-width:760px)');
    expect(shell).toContain('overflow-x:hidden');
    expect(shell).not.toContain('min-width:720');
    expect(html).toContain('"u3-jump": "jump"');
    expect(html).toContain("addEventListener('hashchange'");
    expect(html).toContain('"machine-cycle": "addressing"');
    expect(html).toContain('"classroom": "addressing"');
    expect(html).toContain('"transfer-all": "transfer"');
    expect(html).toContain('"beat": "bak-machine-cycle"');
    expect(html).not.toContain('min-width:720px');
  });

  it('groups the ten teaching sections into four lessons of at most four', () => {
    const match = html.match(/var LESSONS=\{([\s\S]*?)\};/);
    expect(match).toBeTruthy();
    const body = match?.[1] ?? '';
    const groups = [...body.matchAll(/([abcd]):\["([^"]+)"(?:,"([^"]+)")?(?:,"([^"]+)")?(?:,"([^"]+)")?\]/g)];
    expect(groups.map((item) => item[1])).toEqual(['a', 'b', 'c', 'd']);
    const seen = new Set<string>();
    groups.forEach((item) => {
      const id = item[1] as keyof typeof LESSON_SECTIONS;
      const sections = item.slice(2).filter((value): value is string => Boolean(value));
      expect(sections).toEqual([...LESSON_SECTIONS[id]]);
      expect(sections.length).toBeLessThanOrEqual(4);
      sections.forEach((section) => {
        expect(seen.has(section)).toBe(false);
        seen.add(section);
        expect(html).toContain(`href="#${section}"`);
      });
    });
    expect([...seen]).toEqual([
      'isa-map', 'addressing', 'transfer', 'movx-movc', 'stack', 'xch', 'arith', 'logic', 'jump', 'bit',
    ]);
    expect(shell).toContain('aria-label="第几次课"');
    expect(shell).toContain('aria-label="本次课小节"');
    expect(shell).toContain('data-lesson="d"');
    expect(shell).toContain('.subs a[hidden]{display:none !important}');
  });

  it('maps old file aliases and chapter-3 lesson hashes without taking chapter 5 #lesson-a', () => {
    expect(html).toContain('"u3-jump": "jump"');
    expect(html).toContain('"u3-stack-push-pop": "stack"');
    expect(html).toContain('"u3-classroom": "addressing"');
    expect(html).toContain('"u3-lesson-a":"a"');
    expect(html).toContain('"lesson-a":"a"');
    expect(html).toContain('href="#bak-jump"');
    expect(html).toContain('href="#bak-transfer"');
    expect(shell).toContain('?note=u3-jump');
  });
});
