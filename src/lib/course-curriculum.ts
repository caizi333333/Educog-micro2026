import { sipMappings } from '@/lib/ideological-graph';
import { getPointsByLevel } from '@/lib/knowledge-points';
import { getModuleIdForChapter } from '@/lib/lesson-tasks';

export type CourseChapterScheduleItem = {
  chapterNumber: number;
  chapterId: string;
  moduleId: string;
  name: string;
  weekStart: number;
  weekEnd: number;
};

const chapterRoots = new Map(getPointsByLevel(1).map((point) => [point.chapter, point]));
const levelTwoCountByChapter = new Map<number, number>();
for (const point of getPointsByLevel(2)) {
  levelTwoCountByChapter.set(point.chapter, (levelTwoCountByChapter.get(point.chapter) ?? 0) + 1);
}

/**
 * 课程章节口径从正式知识树和 17 周思政映射派生。缺章、缺周次或缺模块时
 * 立即失败，避免种子数据和旧记录兼容层继续传播错位名称。
 */
export const COURSE_CHAPTER_SCHEDULE: readonly CourseChapterScheduleItem[] = Array.from(
  { length: 10 },
  (_, index) => {
    const chapterNumber = index + 1;
    const root = chapterRoots.get(chapterNumber);
    const moduleId = getModuleIdForChapter(chapterNumber);
    const weeks = sipMappings
      .filter((mapping) => mapping.chapter === chapterNumber)
      .map((mapping) => Number(mapping.weekRange.match(/\d+/)?.[0]))
      .filter((week) => Number.isInteger(week));
    if (!root || !moduleId || weeks.length === 0) {
      throw new Error(`正式课程第${chapterNumber}章的名称、模块或周次映射不完整`);
    }
    return {
      chapterNumber,
      chapterId: `ch${chapterNumber}`,
      moduleId,
      name: `第${chapterNumber}章 ${root.name}`,
      weekStart: Math.min(...weeks),
      weekEnd: Math.max(...weeks),
    };
  },
);

export const COURSE_CHAPTER_BY_ID: ReadonlyMap<string, CourseChapterScheduleItem> = new Map(
  COURSE_CHAPTER_SCHEDULE.map((chapter) => [chapter.chapterId, chapter]),
);

export const COURSE_KA_COUNT_BY_CHAPTER: Readonly<Record<number, number>> = Object.fromEntries(
  COURSE_CHAPTER_SCHEDULE.map((chapter) => [
    chapter.chapterNumber,
    levelTwoCountByChapter.get(chapter.chapterNumber) ?? 0,
  ]),
);
