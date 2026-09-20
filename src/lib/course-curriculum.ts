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
 * 历史平台单元日程由知识树和 17 周思政映射派生；这里的 chapterNumber
 * 是平台标识，不等于教学大纲章号。保留原导出与名称，兼容已有任务和记录。
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

export type CourseSyllabusTopic = {
  chapterNumber: number;
  name: string;
  theoryHours: number;
  platformUnits: readonly number[];
  studyNote: string;
};

/**
 * 原件：微控制器原理及应用技术+2024大纲+王寒迎 - 机械电子工程-2026.docx，表2。
 * 原表列出章号 1—6、8—11，共10个教学条目、48理论学时；没有第7章条目。
 * 不补造第7章，也不把平台 C51 / 前沿拓展单元等同于原大纲章节。
 */
export const COURSE_SYLLABUS_TOPICS: readonly CourseSyllabusTopic[] = [
  { chapterNumber: 1, name: '绪论', theoryHours: 2, platformUnits: [1], studyNote: '单片机概述；开发工具等内容为配套拓展。' },
  { chapterNumber: 2, name: '80C51的基本结构和工作原理', theoryHours: 4, platformUnits: [2], studyNote: '处理器、存储器、输入输出接口及工作时序。' },
  { chapterNumber: 3, name: 'MCS-51微控制器的指令系统', theoryHours: 8, platformUnits: [3], studyNote: '寻址方式及各类指令。' },
  { chapterNumber: 4, name: 'MCS-51微控制器的汇编语言程序设计', theoryHours: 4, platformUnits: [3], studyNote: '结合指令系统和实验工作台学习汇编程序；平台单元4另设 C51 编程拓展。' },
  { chapterNumber: 5, name: 'MCS-51微控制器的中断系统及定时/计数器', theoryHours: 6, platformUnits: [5, 6], studyNote: '平台分别组织中断系统和定时器/计数器。' },
  { chapterNumber: 6, name: '微控制器的串行通信技术', theoryHours: 4, platformUnits: [7], studyNote: '授课课件第6章对应平台单元7。' },
  { chapterNumber: 8, name: '微控制器模拟量输入/输出通道的接口技术', theoryHours: 4, platformUnits: [8], studyNote: '对应 8.3 模数/数模转换接口相关知识点。' },
  { chapterNumber: 9, name: '微控制器的人机接口技术', theoryHours: 8, platformUnits: [8], studyNote: '对应 8.1 显示接口、8.2 键盘接口及 8.6 蜂鸣器相关知识点。' },
  { chapterNumber: 10, name: '常用外部电路控制程序的设计', theoryHours: 6, platformUnits: [8], studyNote: '授课课件第10章的开关量、电机和步进电机控制，对应接口技术及相关实验。' },
  { chapterNumber: 11, name: '微控制器的应用系统设计方法', theoryHours: 2, platformUnits: [9], studyNote: '对应平台系统设计单元及综合项目。' },
];

/** Student-facing topic correspondence, keyed by stable platform unit number. */
export const COURSE_UNIT_ALIGNMENT: Readonly<Record<number, string>> = {
  1: '大纲第1章“绪论”；开发工具等内容为配套拓展。',
  2: '大纲第2章“80C51基本结构”。',
  3: '大纲第3章“指令系统”；配合实验工作台学习大纲第4章的汇编程序设计。',
  4: 'C51 编程拓展。大纲第4章为汇编语言程序设计，可从平台单元3与实验工作台进入。',
  5: '大纲第5章的中断系统部分；定时/计数器部分见平台单元6。',
  6: '大纲第5章的定时/计数器部分；中断系统部分见平台单元5。',
  7: '大纲及授课课件第6章“串行通信”。',
  8: '汇集大纲第8章模拟量接口、第9章人机接口及第10章外部电路控制；传感器等内容含应用拓展。',
  9: '大纲第11章“单片机应用系统设计”。',
  10: '前沿应用拓展；大纲及授课课件第10章“外部电路控制”请从平台单元8进入。',
};
