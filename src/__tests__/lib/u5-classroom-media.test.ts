import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lesson notes open the unit hub pages, not the standalone classroom file.
 * Unit 5's hub stores the interrupt pane as base64 `srcdoc`, so a raw-file
 * search misses `player.bilibili.com`. Decode those payloads before checking.
 * The player iframe answers 412 and is blocked by CORS; the outbound
 * bilibili.com/video link and the three R2 clips stay.
 */
const REPO_ROOT = join(__dirname, '../../..');
const COURSEWARE_ROOT = join(REPO_ROOT, 'public/resources/course/courseware');
const LESSON_NOTES_PAGE = join(REPO_ROOT, 'src/app/lesson-notes/page.tsx');
const PLAYER_SRC = 'src="https://player.bilibili.com';
const PLAYER_SRC_SINGLE = "src='https://player.bilibili.com";
const R2_CLIPS = [
  'https://videos.sunyancai.top/u5/u5-why-interrupt.mp4',
  'https://videos.sunyancai.top/u5/u5-lab4-0872.mp4',
  'https://videos.sunyancai.top/u5/u5-lab4-3084.mp4',
] as const;
const FEATURE_FILM_LINK = 'https://www.bilibili.com/video/BV1Hd4y1t7ub/';
const FEATURE_FILM_LABEL = '中断系统正片 · 不内嵌播放器';
const FEATURE_FILM_NOTE = '需要正片时用上方「打开 B 站视频页」（BV1Hd4y1t7ub）。';

const lessonNotesSource = readFileSync(LESSON_NOTES_PAGE, 'utf8');

function lessonNoteHtmlPaths(): string[] {
  const files = [...lessonNotesSource.matchAll(/file:\s*'([^']+)'/g)].map((match) => match[1]);
  const bases = [...lessonNotesSource.matchAll(/base:\s*'([^']+)'/g)].map((match) => match[1]);
  if (files.length === 0 || bases.length === 0) {
    throw new Error('lesson-notes page no longer lists courseware files');
  }
  return files.map((file) => {
    const unit = file?.split('-')[0] ?? '';
    const base = bases.find((item) => item.endsWith(`/${unit}`));
    if (!base || !file) throw new Error(`no courseware base for lesson note ${file}`);
    return join(REPO_ROOT, 'public', base.replace(/^\//, ''), `${file}.html`);
  });
}

function u5HtmlPaths(): string[] {
  return readdirSync(join(COURSEWARE_ROOT, 'u5'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => join(COURSEWARE_ROOT, 'u5', name));
}

function parseEmbeddedData(html: string): Record<string, string> | null {
  const marker = 'var DATA=';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let index = start + marker.length;
  if (html[index] !== '{') return null;
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
          throw new Error('courseware DATA payload is not an object');
        }
        const data: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value !== 'string') throw new Error(`courseware DATA.${key} is not a string`);
          data[key] = value;
        }
        return data;
      }
    }
  }
  throw new Error('unterminated courseware DATA payload');
}

function visibleDocuments(html: string): string[] {
  const documents = [html];
  const data = parseEmbeddedData(html);
  if (!data) return documents;
  for (const [key, value] of Object.entries(data)) {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (!decoded.includes('<')) throw new Error(`DATA.${key} did not decode to HTML`);
    documents.push(decoded);
  }
  return documents;
}

function assertNoBilibiliPlayer(documents: readonly string[], label: string): void {
  for (const document of documents) {
    expect(document).not.toContain(PLAYER_SRC);
    expect(document).not.toContain(PLAYER_SRC_SINGLE);
  }
  if (documents.length === 0) throw new Error(`${label} produced no documents`);
}

describe('u5 classroom media', () => {
  const classroomHtml = readFileSync(
    join(COURSEWARE_ROOT, 'u5/u5-interrupt-classroom.html'),
    'utf8',
  );
  const overviewHtml = readFileSync(join(COURSEWARE_ROOT, 'u5/u5-overview.html'), 'utf8');
  const overviewDocuments = visibleDocuments(overviewHtml);
  const overviewInterrupt = overviewDocuments.find((document) => document.includes('id="p2"') && document.includes(FEATURE_FILM_LABEL));

  it('keeps the R2 clips and drops the Bilibili player iframe', () => {
    const lessons = ['u5-lesson-1.html', 'u5-lesson-2.html', 'u5-lesson-3.html']
      .map((name) => readFileSync(join(COURSEWARE_ROOT, 'u5', name), 'utf8'))
      .join('\n');
    for (const clip of R2_CLIPS) expect(lessons).toContain(clip);
    expect(lessons).toContain(FEATURE_FILM_LINK);
    expect(lessons).toContain(FEATURE_FILM_LABEL);
    expect(lessons).toContain(FEATURE_FILM_NOTE);
    expect(lessons).not.toContain(PLAYER_SRC);
    expect(classroomHtml).not.toContain(PLAYER_SRC);
  });

  it('drops the player iframe from the overview pane lesson notes actually open', () => {
    expect(lessonNoteHtmlPaths().some((path) => path.endsWith('/u5/u5-overview.html'))).toBe(true);
    expect(lessonNoteHtmlPaths().some((path) => path.endsWith('/u5/u5-knowledge.html'))).toBe(true);
    expect(lessonNoteHtmlPaths().some((path) => path.endsWith('u5-interrupt-classroom.html'))).toBe(false);
    expect(overviewInterrupt).toBeTruthy();
    for (const clip of R2_CLIPS) expect(overviewInterrupt).toContain(clip);
    expect(overviewInterrupt).toContain(FEATURE_FILM_LINK);
    expect(overviewInterrupt).toContain(FEATURE_FILM_NOTE);
    expect(overviewInterrupt).not.toContain(PLAYER_SRC);
    assertNoBilibiliPlayer(overviewDocuments, 'u5-overview');
  });

  it('rejects a Bilibili player src on every lesson-notes page and other u5 HTML', () => {
    const paths = [...new Set([...lessonNoteHtmlPaths(), ...u5HtmlPaths()])];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const documents = visibleDocuments(readFileSync(path, 'utf8'));
      assertNoBilibiliPlayer(documents, path);
    }
  });
});
