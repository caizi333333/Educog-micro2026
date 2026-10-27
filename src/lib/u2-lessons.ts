/**
 * Chapter 2 stays six courseware files. The shell only groups them into
 * three lessons so a phone can scan every entry without a horizontal strip.
 * Deep links still use the file name (`?note=u2-memory`).
 */

export interface U2Topic {
  file: string;
  title: string;
}

export interface U2Lesson {
  /** In-page and lesson-notes hash, for example `u2-lesson-b`. */
  id: string;
  title: string;
  /** Both topic names, short enough to read on a half-width phone button. */
  topics: string;
  pages: readonly [U2Topic, U2Topic];
}

export const U2_LESSONS: readonly U2Lesson[] = [
  {
    id: 'u2-lesson-a',
    title: '第 1 次课',
    topics: 'CPU · 存储器',
    pages: [
      { file: 'u2-cpu-structure', title: 'CPU 结构' },
      { file: 'u2-memory', title: '存储器组织' },
    ],
  },
  {
    id: 'u2-lesson-b',
    title: '第 2 次课',
    topics: 'I/O · 总线',
    pages: [
      { file: 'u2-io-port', title: 'I/O 接口' },
      { file: 'u2-bus', title: '总线结构' },
    ],
  },
  {
    id: 'u2-lesson-c',
    title: '第 3 次课',
    topics: '时钟 · 复位',
    pages: [
      { file: 'u2-clock-timing', title: '时钟与时序' },
      { file: 'u2-reset', title: '复位系统' },
    ],
  },
];

/** Lesson that owns a courseware file, if it is one of the six chapter 2 pages. */
export function u2LessonForFile(file: string): U2Lesson | undefined {
  return U2_LESSONS.find((lesson) => lesson.pages.some((page) => page.file === file));
}

/**
 * Courseware file a lesson hash should open.
 * Unknown ids return null so they are not treated as chapter 2 anchors.
 */
export function u2FileForLesson(lessonId: string): string | null {
  const lesson = U2_LESSONS.find((item) => item.id === lessonId);
  return lesson?.pages[0].file ?? null;
}
