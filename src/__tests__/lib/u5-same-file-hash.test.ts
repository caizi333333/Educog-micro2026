import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 第 3 次课同一篇里换 hash。冷启动能打开 #hex-split / #gate；
 * 页内 hashchange 必须切到对应页签，不能停在第一次挂上的那一节。
 */
const ROOT = join(__dirname, '../../..');
const lessonHtml = readFileSync(
  join(ROOT, 'public/resources/course/courseware/u5/u5-lesson-3.html'),
  'utf8',
).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const runtime = readFileSync(
  join(ROOT, 'public/resources/course/courseware/u5/lib/u5-interrupt-classroom.js'),
  'utf8',
);

function visiblePane(frame: HTMLIFrameElement): string {
  return [...frame.contentDocument!.querySelectorAll('section.pane.on')].map((pane) => pane.id).join(',');
}

function openLesson(hash: string): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.setAttribute('src', `/resources/course/courseware/u5/u5-lesson-3.html${hash}`);
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) throw new Error('lesson frame missing');
  doc.open();
  doc.write(lessonHtml);
  doc.close();
  win.HTMLElement.prototype.scrollIntoView = () => undefined;
  if (win.location.hash !== hash) win.location.hash = hash;
  win.eval(runtime);
  return frame;
}

function replaceHash(frame: HTMLIFrameElement, hash: string): void {
  const win = frame.contentWindow;
  if (!win) throw new Error('lesson frame missing');
  const here = `${win.location.pathname}${win.location.search}`;
  win.location.replace(`${here}${hash}`);
}

describe('unit 5 lesson 3 same-file hash', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens #hex-split and #gate on the matching pane at cold load', () => {
    const split = openLesson('#hex-split');
    expect(visiblePane(split)).toBe('p14');
    expect(split.contentDocument?.getElementById('hex-split')).toBeTruthy();

    const gate = openLesson('#gate');
    expect(visiblePane(gate)).toBe('p19');
    expect(gate.contentDocument?.getElementById('gate-win')?.textContent).toContain('GATE');
  });

  it('follows #hex-split ↔ #gate and the GATE aliases without leaving the file', async () => {
    const frame = openLesson('#hex-split');
    expect(visiblePane(frame)).toBe('p14');
    const win = frame.contentWindow;
    if (!win) throw new Error('lesson frame missing');

    for (const hash of ['#gate', '#p-gate', '#gate-win', '#p19']) {
      replaceHash(frame, '#hex-split');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(visiblePane(frame)).toBe('p14');
      expect(win.location.hash).toBe('#hex-split');

      replaceHash(frame, hash);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(win.location.hash).toBe(hash);
      expect(visiblePane(frame)).toBe('p19');
    }
  });

  it('follows a replaceState hashchange the shell dispatches when replace does not', () => {
    const frame = openLesson('#gate');
    expect(visiblePane(frame)).toBe('p19');
    const win = frame.contentWindow;
    if (!win) throw new Error('lesson frame missing');

    const here = `${win.location.pathname}${win.location.search}`;
    const oldURL = win.location.href;
    win.history.replaceState(null, '', `${here}#hex-split`);
    expect(visiblePane(frame)).toBe('p19');
    win.dispatchEvent(new win.HashChangeEvent('hashchange', { oldURL, newURL: win.location.href }));
    expect(win.location.hash).toBe('#hex-split');
    expect(visiblePane(frame)).toBe('p14');
  });
});
