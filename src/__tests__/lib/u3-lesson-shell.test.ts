import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

/**
 * Chapter 3 overview is a four-lesson chooser. Old section hashes leave
 * for the atomic page that already holds that lesson. Lesson hashes stay
 * on the chooser. `#lesson-a` inside this file still means chapter 3
 * lesson 1; chapter 5 owns `#lesson-a` only on its own pages.
 */
const OVERVIEW = join(__dirname, '../../../public/resources/course/courseware/u3/u3-overview.html');

const LESSON_LINKS = {
  a: ['u3-isa-design.html#isa-map', 'u3-addressing-design.html#addressing'],
  b: [
    'u3-mov-design.html#transfer',
    'u3-movx-movc.html#movx-movc',
    'u3-stack-push-pop.html#stack',
    'u3-xch.html#xch',
  ],
  c: ['u3-arith-design.html#arith', 'u3-logic-design.html#logic'],
  d: ['u3-jump-design.html#jump', 'u3-bit.html#bit'],
} as const;

function overviewTarget(hash: string): string {
  const html = readFileSync(OVERVIEW, 'utf8');
  const code = html.match(/<script id="u3-lesson-redirect">([\s\S]*?)<\/script>/)?.[1];
  if (!code) throw new Error('lesson redirect missing');
  const context = createContext({
    window: {} as { u3OverviewTarget?: (nextHash: string) => string; addEventListener?: unknown },
    location: { hash, replace() {} },
  });
  runInContext(code, context);
  const target = context.window.u3OverviewTarget;
  if (!target) throw new Error('u3OverviewTarget missing');
  return target(hash);
}

function lessonBlock(html: string, id: keyof typeof LESSON_LINKS): string {
  const start = html.indexOf(`id="u3-lesson-${id}"`);
  const nextId = id === 'd' ? '' : String.fromCharCode(id.charCodeAt(0) + 1);
  const end = nextId ? html.indexOf(`id="u3-lesson-${nextId}"`) : html.indexOf('<details');
  return html.slice(start, end);
}

describe('unit 3 lesson shell', () => {
  const html = readFileSync(OVERVIEW, 'utf8');

  it('stays a light chooser and keeps the phone rules that drop a 720px floor', () => {
    expect(html.length).toBeLessThan(40_000);
    expect(html).not.toContain('var DATA=');
    expect(html).not.toContain('src="https://player.bilibili.com');
    expect(html).toContain('80C51');
    expect(html).toContain('@media(max-width:760px)');
    expect(html).toContain('overflow-x:hidden');
    expect(html).toContain('flex-wrap:wrap');
    expect(html).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(html).not.toContain('min-width:720');
    expect(html).not.toContain('white-space:nowrap');
    expect(html).not.toContain('flex-wrap:nowrap');
    expect(html).toContain("addEventListener('hashchange'");
  });

  it('groups the ten teaching sections into four lessons of at most four', () => {
    const seen = new Set<string>();
    (Object.keys(LESSON_LINKS) as Array<keyof typeof LESSON_LINKS>).forEach((id) => {
      const block = lessonBlock(html, id);
      const links = LESSON_LINKS[id];
      expect(block).toContain(`data-lesson="${id}"`);
      expect((block.match(/<a href="/g) ?? []).length).toBe(links.length);
      expect(links.length).toBeLessThanOrEqual(4);
      links.forEach((href) => {
        expect(seen.has(href)).toBe(false);
        seen.add(href);
        expect(block).toContain(`href="${href}"`);
      });
    });
    expect(seen.size).toBe(10);
    expect(html).toContain('aria-label="第几次课"');
    expect(html).toContain('aria-label="本次课小节"');
    expect(html).toContain('data-lesson="d"');
    expect(html).toContain('u3-transfer.html#bak-transfer');
    expect(html).toContain('u3-jump.html#bak-jump');
    expect(html).toContain('?note=u3-jump');
  });

  it('maps old file aliases and chapter-3 lesson hashes without taking chapter 5 #lesson-a off this page', () => {
    expect(html).toContain('"u3-jump": "jump"');
    expect(html).toContain('"u3-stack-push-pop": "stack"');
    expect(html).toContain('"u3-classroom": "addressing"');
    expect(html).toContain('"machine-cycle": "addressing"');
    expect(html).toContain('"classroom": "addressing"');
    expect(html).toContain('"transfer-all": "transfer"');
    expect(html).toContain('"beat": "bak-machine-cycle"');
    expect(html).toContain('"u3-lesson-a":"a"');
    expect(html).toContain('"lesson-a":"a"');
    expect(overviewTarget('#addressing')).toBe('u3-addressing-design.html#addressing');
    expect(overviewTarget('#jump')).toBe('u3-jump-design.html#jump');
    expect(overviewTarget('#u3-jump')).toBe('u3-jump-design.html#jump');
    expect(overviewTarget('#stack')).toBe('u3-stack-push-pop.html#stack');
    expect(overviewTarget('#u3-stack-push-pop')).toBe('u3-stack-push-pop.html#stack');
    expect(overviewTarget('#machine-cycle')).toBe('u3-addressing-design.html#addressing');
    expect(overviewTarget('#classroom')).toBe('u3-addressing-design.html#addressing');
    expect(overviewTarget('#u3-classroom')).toBe('u3-addressing-design.html#addressing');
    expect(overviewTarget('#transfer-all')).toBe('u3-mov-design.html#transfer');
    expect(overviewTarget('#beat')).toBe('u3-machine-cycle.html#beat');
    expect(overviewTarget('#bak-machine-cycle')).toBe('u3-machine-cycle.html#beat');
    expect(overviewTarget('#bak-transfer')).toBe('u3-transfer.html#bak-transfer');
    expect(overviewTarget('#bak-jump')).toBe('u3-jump.html#bak-jump');
    expect(overviewTarget('#u3-lesson-a')).toBe('');
    expect(overviewTarget('#u3-lesson-b')).toBe('');
    expect(overviewTarget('#lesson-a')).toBe('');
    expect(overviewTarget('#home')).toBe('');
    expect(overviewTarget('')).toBe('');
  });
});
