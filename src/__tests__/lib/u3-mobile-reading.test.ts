import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phone reading leftovers after the unit 5 pass: chapter 3 diagrams that
 * forced a 720px width, and 10–11px courseware labels. Lesson notes open
 * the overview chooser, which sends each section to its atomic page.
 * Deep links stay on the overview hash handler.
 */
const REPO_ROOT = join(__dirname, '../../..');
const COURSEWARE = join(REPO_ROOT, 'public/resources/course/courseware');
const FLUID_MARK = '图跟屏宽走，溢出留在图框里';
const PHONE_TYPE = 'id="phone-type"';
const NARROW = '@media (max-width:760px)';

const WIDE_DIAGRAMS = [
  'u3-addressing.html',
  'u3-arith.html',
  'u3-bit.html',
  'u3-classroom.html',
  'u3-isa-map.html',
  'u3-jump.html',
  'u3-logic.html',
  'u3-transfer.html',
] as const;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function expectFluidDiagram(html: string, label: string): void {
  const blockStart = html.indexOf(FLUID_MARK);
  expect(blockStart).toBeGreaterThan(-1);
  const block = html.slice(blockStart, html.indexOf('</style>', blockStart));
  expect(block).toContain(NARROW);
  expect(block).toContain('overflow-x:auto');
  expect(block).toContain('max-width:100%');
  expect(block).toContain('min-width:0');
  expect(block).not.toContain('min-width:720px');
  expect(html).not.toContain('min-width:720px');
  if (!label) throw new Error('missing label');
}

function expectPhoneType(html: string): void {
  const start = html.indexOf(`<style ${PHONE_TYPE}>`);
  expect(start).toBeGreaterThan(-1);
  const style = html.slice(start, html.indexOf('</style>', start));
  expect(style).toContain(NARROW);
  expect(style).toContain('font-size:14px');
  expect(style).toContain('.kp-read .k');
  expect(style).not.toContain('font-size:10px');
  expect(style).not.toContain('font-size:11px');
}

describe('chapter 3 phone reading', () => {
  const overviewHtml = read(join(COURSEWARE, 'u3/u3-overview.html'));

  it('makes the eight wide diagrams fluid and keeps 80C51 copy', () => {
    for (const name of WIDE_DIAGRAMS) {
      const html = read(join(COURSEWARE, 'u3', name));
      expectFluidDiagram(html, name);
      expectPhoneType(html);
    }
    expect(read(join(COURSEWARE, 'u3/u3-isa-design.html'))).toContain('80C51');
    expect(read(join(COURSEWARE, 'u3/u3-transfer.html'))).toContain(FLUID_MARK);
    expect(read(join(COURSEWARE, 'u3/u3-bit.html'))).not.toContain('min-width:720px');
  });

  it('keeps deep links on the overview and the atomic pages lesson notes open', () => {
    expect(overviewHtml).toContain("addEventListener('hashchange'");
    expect(overviewHtml).toContain('80C51');
    expect(overviewHtml).toContain('"u3-jump": "jump"');
    expect(overviewHtml).not.toContain('var DATA=');
    expect(overviewHtml).not.toContain('min-width:720px');
    const opened = [
      'u3-isa-design.html',
      'u3-addressing-design.html',
      'u3-mov-design.html',
      'u3-arith-design.html',
      'u3-logic-design.html',
      'u3-jump-design.html',
      'u3-bit.html',
    ];
    for (const name of opened) {
      const html = read(join(COURSEWARE, 'u3', name));
      expect(html).toContain('80C51');
      expect(html).not.toContain('min-width:720px');
      expect(html).not.toContain('id="hubCss"');
      if (html.includes('.kp-eyebrow')) expectPhoneType(html);
    }
  });

  it('bumps narrow-screen type on the other courseware pages that share the 10–11px chrome', () => {
    const theme = read(join(COURSEWARE, 'u5/lib/kp-theme.css'));
    expect(theme).toContain(NARROW);
    expect(theme).toContain('.kp-read .k');
    expect(theme).toContain('font-size:13px');
    expect(theme).toContain('.kp-eyebrow,.kp-chip');
    const pages = readdirSync(join(COURSEWARE, 'u2')).filter((name) => name.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(0);
    for (const name of pages) {
      expectPhoneType(read(join(COURSEWARE, 'u2', name)));
    }
    expectPhoneType(read(join(COURSEWARE, 'u4/u4-classroom.html')));
    const video = read(join(COURSEWARE, 'u3/u3-video.html'));
    expect(video).toContain(PHONE_TYPE);
    expect(video).toContain('h1 .tag{font-size:13px');
    expect(video).toContain('寻址方式收官');
  });
});
