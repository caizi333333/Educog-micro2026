import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type FoldPlan = { fold: boolean; hidden: boolean[] };

// The browser script exports the fold rule when required, and boots only
// when it is loaded from a plain script tag.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { foldPlan } = require('../../../public/resources/course/courseware/lib/vlayout-tabs.js') as {
  foldPlan: (count: number, selectedIndex: number, narrow: boolean, open: boolean) => FoldPlan;
};

/**
 * Courseware pages cannot read the app :root. #68 copies the spacing
 * tokens into the courseware folder and keeps sticky tabs tappable
 * without a page-level horizontal scrollbar.
 */
const ROOT = join(__dirname, '../../..');
const COURSEWARE = join(ROOT, 'public/resources/course/courseware');
const DENSITY = join(COURSEWARE, 'lib/vlayout-density.css');
const TABS = join(COURSEWARE, 'lib/vlayout-tabs.js');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function coursewarePages(): string[] {
  return ['u2', 'u3', 'u4', 'u5'].flatMap((unit) =>
    readdirSync(join(COURSEWARE, unit))
      .filter((name) => name.endsWith('.html'))
      .map((name) => join(COURSEWARE, unit, name)),
  );
}

describe('courseware density tokens', () => {
  const density = read(DENSITY);
  const tabs = read(TABS);
  const classroom = read(join(COURSEWARE, 'u4/u4-classroom.html'));
  const overview = read(join(COURSEWARE, 'u5/u5-overview.html'));
  const cpu = read(join(COURSEWARE, 'u2/u2-cpu-structure.html'));
  const theme = read(join(COURSEWARE, 'u5/lib/kp-theme.css'));
  const interrupt = read(join(COURSEWARE, 'u5/lib/u5-interrupt-classroom.css'));

  it('uses an 800px prose width without limiting interactive containers to 800px', () => {
    expect(density).toContain('--space-1: 4px');
    expect(density).toContain('--space-2: 8px');
    expect(density).toContain('--space-3: 16px');
    expect(density).toContain('--space-4: 24px');
    expect(density).toContain('--content-max-width: 800px');
    expect(density).toContain('--interactive-max-width: 1360px');
    expect(density).toContain('--type-meta: 12px');
    expect(density).toContain('--type-ui: 14px');
    expect(density).toContain('--type-body: 16px');
    expect(density).toContain('--type-title: 20px');
    expect(density).toContain('--type-display: 24px');
    expect(density).toContain('--tap-min: 44px');
    expect(density).toContain('max-width: var(--content-max-width)');
    expect(density).toContain('min-height: var(--tap-min)');
    expect(density).toContain('overflow-x: clip');
    expect(density).toContain('.vlayout-more');
    expect(theme).toContain('--content-max-width: 800px');
    expect(theme).toContain('max-width:1360px');
    expect(theme).not.toContain('max-width:1120px');
    expect(interrupt).toContain('max-width:min(1360px,100%)');
    expect(interrupt).toContain('min-height:44px');
  });

  it('links every u2–u5 page and keeps the sampled anchors', () => {
    const pages = coursewarePages();
    expect(pages.length).toBeGreaterThan(30);
    for (const path of pages) {
      const html = read(path);
      expect(html).toContain('data-vlayout="density"');
      expect(html).toContain('../lib/vlayout-density.css');
      expect(html).toContain('../lib/vlayout-tabs.js');
    }
    expect(classroom).toContain('id="s-map"');
    expect(classroom).toContain('id="p-rev"');
    expect(classroom).not.toContain('1360px');
    expect(classroom).toContain('max-width:800px');
    expect(cpu).toContain("addEventListener('hashchange'");
    expect(cpu).toContain('overflow-x:hidden');
    expect(cpu).toContain("'u2-lesson-a'");
    const shell = overview.slice(0, overview.indexOf('var DATA='));
    expect(shell).toContain('href="#int-2"');
    expect(shell).toContain('href="#int-6"');
    expect(shell).toContain('max-width:800px');
    expect(shell).toContain('.b{min-height:44px;padding:6px 12px}');
    expect(overview).toContain("max-width:min(100%,1360px)");
    expect(overview).toContain('u5-interrupt-classroom.html#hex-split');
    expect(read(join(COURSEWARE, 'u5/u5-lesson-3.html'))).toContain('id="hex-split"');
    expect(tabs).toContain('更多');
    expect(tabs).toContain('VISIBLE_BEFORE_MORE = 5');
  });
});

describe('narrow sticky tabs', () => {
  it('keeps five tabs visible and hides the rest until 更多 is open', () => {
    const closed = foldPlan(8, 0, true, false);
    expect(closed.fold).toBe(true);
    expect(closed.hidden).toEqual([false, false, false, false, false, true, true, true]);

    const selectedLater = foldPlan(8, 5, true, false);
    expect(selectedLater.hidden[5]).toBe(false);
    expect(selectedLater.hidden[6]).toBe(true);
    expect(selectedLater.hidden[7]).toBe(true);

    const opened = foldPlan(8, 0, true, true);
    expect(opened.fold).toBe(true);
    expect(opened.hidden.every((hidden) => !hidden)).toBe(true);
  });

  it('leaves six-or-fewer strips and desktop strips unfolded', () => {
    expect(foldPlan(6, 0, true, false)).toEqual({
      fold: false,
      hidden: [false, false, false, false, false, false],
    });
    expect(foldPlan(5, 0, true, false).fold).toBe(false);
    expect(foldPlan(8, 0, false, false).fold).toBe(false);
    expect(foldPlan(8, 0, false, false).hidden.every((hidden) => !hidden)).toBe(true);
  });
});
