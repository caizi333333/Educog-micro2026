import { U2_LESSONS, u2LessonForFile } from '@/lib/u2-lessons';

/** Where 「回课次」 opens. `hash` is empty on the chapter chooser. */
export interface LessonEntryTarget {
  file: string;
  hash: string;
}

const SHELL_HASH = /^#[\w=%.~-]{1,160}$/;

/**
 * Chapter or lesson entry for the shell 「回课次」 control.
 * Unit 2 opens the first page of the current lesson. Units 3–5 open the
 * chapter chooser with no section hash. This is not browser history.
 *
 * @param unitId - textbook chapter shown in the shell
 * @param noteFile - courseware file currently open
 * @returns file and hash the shell should open
 */
export function lessonEntryTarget(unitId: number, noteFile: string): LessonEntryTarget {
  if (unitId === 2) {
    const lesson = u2LessonForFile(noteFile) ?? U2_LESSONS[0];
    if (!lesson) return { file: noteFile, hash: '' };
    return { file: lesson.pages[0].file, hash: `#${lesson.id}` };
  }
  if (unitId === 3) return { file: 'u3-overview', hash: '' };
  if (unitId === 4) return { file: 'u4-classroom', hash: '' };
  if (unitId === 5) return { file: 'u5-overview', hash: '' };
  return { file: noteFile, hash: '' };
}

/**
 * Shell URL for a lesson entry. A hash that is not a courseware anchor is dropped.
 *
 * @param unitId - textbook chapter
 * @param hash - optional in-page anchor, including the leading `#`
 * @returns path, query, and hash for `history.replaceState`
 */
export function lessonEntryHref(unitId: number, hash: string): string {
  const safeHash = SHELL_HASH.test(hash) ? hash : '';
  return `/lesson-notes?unit=${unitId}${safeHash}`;
}

/**
 * Bring the courseware frame into the shell viewport.
 * A deep link such as `#int-6` is not an element id on this page, so the
 * document would otherwise stay at scrollY 0 with the frame below the fold.
 *
 * @param node - courseware wrapper in the lesson-notes shell
 */
export function scrollLessonCoursewareIntoView(node: HTMLElement | null): void {
  if (!node || typeof node.scrollIntoView !== 'function') return;
  node.scrollIntoView({ block: 'start', behavior: 'auto' });
}
