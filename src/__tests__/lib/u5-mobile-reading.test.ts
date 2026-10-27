import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phone reading fixes for the unit 5 classroom and the overview copy
 * lesson notes actually embed. Deep-link handlers stay in place.
 */
const REPO_ROOT = join(__dirname, '../../..');
const U5 = join(REPO_ROOT, 'public/resources/course/courseware/u5');
const OVERVIEW = join(REPO_ROOT, 'public/resources/course/courseware/u5/u5-overview.html');
const REPORT = join(REPO_ROOT, 'src/app/teacher/report/page.tsx');

function embeddedInterrupt(overviewHtml: string): string {
  const marker = 'var DATA=';
  const start = overviewHtml.indexOf(marker);
  if (start < 0) throw new Error('overview DATA payload missing');
  let index = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let cursor = index; cursor < overviewHtml.length; cursor += 1) {
    const character = overviewHtml[cursor];
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
        const parsed: unknown = JSON.parse(overviewHtml.slice(index, cursor + 1));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('overview DATA is not an object');
        }
        const encoded = (parsed as { int?: unknown }).int;
        if (typeof encoded !== 'string') throw new Error('overview DATA.int missing');
        return Buffer.from(encoded, 'base64').toString('utf8');
      }
    }
  }
  throw new Error('unterminated overview DATA payload');
}

function expectPhoneReading(html: string, label: string): void {
  const styleStart = html.indexOf('<style id="phone-read">');
  const styleEnd = html.indexOf('</style>', styleStart);
  expect(styleStart).toBeGreaterThan(-1);
  const style = html.slice(styleStart, styleEnd);
  expect(style).toContain('.tabs{');
  expect(style).toContain('overflow-x:auto');
  expect(style).toContain('min-height:44px');
  expect(style).toContain('.drill-strip,.qz-calc{position:static;top:auto}');
  expect(style).toContain('scroll-margin-top:84px');
  expect(html).toContain('<script id="phone-read-tabs">');
  expect(html).toContain('80C51');
  if (!label) throw new Error('missing label');
}

describe('mobile reading containment', () => {
  const overviewHtml = readFileSync(OVERVIEW, 'utf8');
  const reportSource = readFileSync(REPORT, 'utf8');

  it('keeps each lesson tab strip inside the page and preserves #hex-split', () => {
    for (const name of ['u5-interrupt-classroom.html', 'u5-lesson-1.html', 'u5-lesson-2.html', 'u5-lesson-3.html']) {
      expectPhoneReading(readFileSync(join(U5, name), 'utf8'), name);
    }
    const runtime = readFileSync(join(U5, 'lib/u5-interrupt-classroom.js'), 'utf8');
    expect(runtime).toContain("if(h==='#hex-split' || h==='#rev-hex'){show(14);");
    expect(readFileSync(join(U5, 'u5-lesson-3.html'), 'utf8')).toContain('id="hex-split"');
  });

  it('applies the same narrow-screen rules to the overview interrupt pane', () => {
    const shell = overviewHtml.slice(0, overviewHtml.indexOf('var DATA='));
    expect(shell).toContain('.b{min-height:44px;padding:6px 12px}');
    expect(shell).toContain('href="#int-2"');
    expectPhoneReading(embeddedInterrupt(overviewHtml), 'overview interrupt');
  });

  it('drops the report tables’ forced min-width so phone rows can stack', () => {
    expect(reportSource).not.toContain('min-w-[680px]');
    expect(reportSource).not.toContain('min-w-[520px]');
    expect(reportSource).not.toContain('min-w-[500px]');
    expect(reportSource).toContain('className="report-fit w-full text-sm"');
    expect(reportSource).toContain('data-label="在册学生"');
    expect(reportSource).toContain('data-label="排除原因"');
  });
});
