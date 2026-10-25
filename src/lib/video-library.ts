/**
 * @fileOverview A centralized library of curated video resources for the course.
 * Only verified course video assets should be listed here. Do not add generic
 * external videos as substitutes for course materials.
 *
 * 入库约定（逐章产出时按此登记）：
 *  - embedUrl 可为完整 http(s) 外链，也可为站内 `/videos/xxx.mp4`（public/videos/ 下的成片）
 *  - chapter 按课程章节填 1-11；knowledgePoints 填 knowledge-points.ts 的节点 id（如 '3.2'）
 *  - keywords 至少含 1 个词，供 AI 助教按问题关键词匹配；可用 keywordsFromKnowledgePoints 由知识点名生成
 */
import { knowledgePoints } from './knowledge-points';

export type VideoInfo = {
  title: string;
  /** 完整 http(s) 外链，或站内路径 `/videos/…` */
  embedUrl: string;
  keywords: string[];
  /** 对应课程章节（1-11） */
  chapter?: number;
  /** 时长（秒） */
  durationSec?: number;
  /** 挂载的知识图谱节点 id 列表（knowledge-points.ts 的 id） */
  knowledgePoints?: string[];
  /** 本地成片文件名（入库前核对用） */
  fileName?: string;
};

const KP_ID_SET = new Set(knowledgePoints.map(k => k.id));

export const videoLibrary: VideoInfo[] = [];

/** 由知识点 id 生成匹配关键词（知识点名即学生提问里最可能出现的词） */
export function keywordsFromKnowledgePoints(ids: string[]): string[] {
  const names = ids
    .map(id => knowledgePoints.find(k => k.id === id)?.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  return [...new Set(names)];
}

/** 入库校验：返回问题列表，空数组 = 通过 */
export function validateVideoEntry(entry: VideoInfo): string[] {
  const problems: string[] = [];
  if (!entry.title?.trim()) problems.push('缺少 title');
  if (!/^https?:\/\/.+/.test(entry.embedUrl) && !/^\/videos\/.+/.test(entry.embedUrl)) {
    problems.push('embedUrl 须为 http(s) 外链或站内 /videos/ 路径');
  }
  if (!Array.isArray(entry.keywords) || entry.keywords.length === 0 || entry.keywords.some(k => !k?.trim())) {
    problems.push('keywords 至少 1 个非空关键词');
  }
  if (entry.chapter !== undefined && (!Number.isInteger(entry.chapter) || entry.chapter < 1 || entry.chapter > 11)) {
    problems.push(`chapter ${entry.chapter} 超出 1-11`);
  }
  if (entry.durationSec !== undefined && (!Number.isFinite(entry.durationSec) || entry.durationSec <= 0)) {
    problems.push('durationSec 须为正数');
  }
  if (entry.knowledgePoints) {
    for (const id of entry.knowledgePoints) {
      if (!KP_ID_SET.has(id)) problems.push(`知识点 id "${id}" 不在知识图谱中`);
    }
  }
  return problems;
}

/** 按知识点 id 查视频（图谱节点详情页可挂"相关视频"） */
export function videosForKnowledgePoint(kpId: string): VideoInfo[] {
  return videoLibrary.filter(v => v.knowledgePoints?.includes(kpId));
}

/** 按章节查视频 */
export function videosForChapter(chapter: number): VideoInfo[] {
  return videoLibrary.filter(v => v.chapter === chapter);
}
