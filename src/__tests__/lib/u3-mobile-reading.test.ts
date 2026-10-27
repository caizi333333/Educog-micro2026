import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phone reading leftovers after the unit 5 pass: chapter 3 diagrams that
 * forced a 720px width, 10–11px courseware labels, and the embedded copies
 * lesson notes actually open. Deep links stay on the overview hash handler.
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

function parseEmbeddedData(html: string): Record<string, string> {
  const marker = 'var DATA=';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('overview DATA payload missing');
  let index = start + marker.length;
  if (html[index] !== '{') throw new Error('overview DATA is not an object');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let cursor = index; cursor < html.length; cursor += 1) {
    const character = html[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        const parsed: unknown = JSON.parse(html.slice(index, cursor + 1));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('overview DATA is not an object');
        }
        const data: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== 'string') throw new Error(`DATA.${key} is not a string`);
          data[key] = Buffer.from(value, 'base64').toString('utf8');
        }
        return data;
      }
    }
  }
  throw new Error('unterminated overview DATA payload');
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
  const embedded = parseEmbeddedData(overviewHtml);

  it('makes the eight wide diagrams fluid and keeps 80C51 copy', () => {
    for (const name of WIDE_DIAGRAMS) {
      const html = read(join(COURSEWARE, 'u3', name));
      expectFluidDiagram(html, name);
      expectPhoneType(html);
    }
    expect(read(join(COURSEWARE, 'u3/u3-isa-design.html'))).toContain('80C51');
    expect(embedded.isa).toContain('80C51');
    expect(embedded['old-transfer']).toContain(FLUID_MARK);
    expect(embedded.bit).not.toContain('min-width:720px');
  });

  it('applies the same rules inside the overview lesson notes embed', () => {
    expect(overviewHtml).toContain("addEventListener('hashchange'");
    expect(overviewHtml).toContain('80C51');
    expect(overviewHtml).toContain('"u3-jump": "jump"');
    for (const [key, html] of Object.entries(embedded)) {
      expect(html).not.toContain('min-width:720px');
      if (html.includes('.kp-eyebrow')) expectPhoneType(html);
      if (html.includes('min-width:720px')) throw new Error(`${key} still forces 720px`);
    }
    expect(Object.keys(embedded)).toEqual(expect.arrayContaining(['isa', 'bit', 'old-transfer']));
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
