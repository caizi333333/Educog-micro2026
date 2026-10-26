import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chapter 5 classroom media keeps the R2 clips and does not embed the
 * Bilibili player, which often answers 412 to third-party iframes.
 */
const classroomHtml = readFileSync(
  join(__dirname, '../../../public/resources/course/courseware/u5/u5-interrupt-classroom.html'),
  'utf8',
);

describe('u5 classroom media', () => {
  it('keeps the R2 clips and drops the Bilibili player iframe', () => {
    expect(classroomHtml).toContain('https://videos.sunyancai.top/u5/u5-why-interrupt.mp4');
    expect(classroomHtml).toContain('https://videos.sunyancai.top/u5/u5-lab4-0872.mp4');
    expect(classroomHtml).toContain('https://videos.sunyancai.top/u5/u5-lab4-3084.mp4');
    expect(classroomHtml).toContain('https://www.bilibili.com/video/BV1Hd4y1t7ub/');
    expect(classroomHtml).not.toContain('src="https://player.bilibili.com');
  });
});
