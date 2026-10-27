import { campusDateKey } from '@/lib/campus-time';

/** Minimum gap between two accepted submissions from the same student. */
export const FEEDBACK_MIN_INTERVAL_MS = 60_000;

/** Accepted submissions per Asia/Shanghai calendar day. */
export const FEEDBACK_MAX_PER_CAMPUS_DAY = 5;

export const FEEDBACK_MIN_BODY_LENGTH = 10;
export const FEEDBACK_MAX_BODY_LENGTH = 1000;
export const FEEDBACK_MAX_PAGE_PATH_LENGTH = 200;
export const FEEDBACK_MAX_USER_AGENT_LENGTH = 300;

export const FEEDBACK_CATEGORIES = [
  { id: 'bug', label: '问题缺陷' },
  { id: 'content', label: '课程内容' },
  { id: 'ux', label: '使用体验' },
  { id: 'suggestion', label: '改进建议' },
  { id: 'other', label: '其他' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['id'];

export function feedbackCategoryLabel(category: string): string {
  return FEEDBACK_CATEGORIES.find((item) => item.id === category)?.label ?? '其他';
}

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.some((item) => item.id === value);
}

export interface ParsedFeedbackSubmission {
  category: FeedbackCategory;
  body: string;
  anonymous: boolean;
  pagePath: string | null;
}

export function parseFeedbackSubmission(
  raw: unknown,
): { ok: true; value: ParsedFeedbackSubmission } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '提交内容无效' };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.category !== 'string' || !isFeedbackCategory(record.category)) {
    return { ok: false, error: '请选择反馈类别' };
  }
  if (typeof record.body !== 'string') {
    return { ok: false, error: '请填写反馈内容' };
  }
  const body = record.body.trim();
  if (body.length > FEEDBACK_MAX_BODY_LENGTH) {
    return { ok: false, error: `反馈内容请控制在 ${FEEDBACK_MAX_BODY_LENGTH} 字以内` };
  }
  const compact = body.replace(/\s+/g, '');
  if (compact.length < FEEDBACK_MIN_BODY_LENGTH || new Set(compact).size < 2) {
    return { ok: false, error: `请至少用 ${FEEDBACK_MIN_BODY_LENGTH} 个字说明具体情况，不要只重复同一个字符` };
  }
  let pagePath: string | null = null;
  if (record.pagePath != null && record.pagePath !== '') {
    if (typeof record.pagePath !== 'string' || !isSafePagePath(record.pagePath.trim())) {
      return { ok: false, error: '页面路径无效' };
    }
    pagePath = record.pagePath.trim();
  }
  return {
    ok: true,
    value: {
      category: record.category,
      body,
      anonymous: record.anonymous === true,
      pagePath,
    },
  };
}

function isSafePagePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.length > FEEDBACK_MAX_PAGE_PATH_LENGTH) return false;
  if (/[\s<>\\]/.test(value) || value.includes('://')) return false;
  return true;
}

/** Prefer the page the student was browsing; fall back to the form's own path. */
export function resolveFeedbackPagePath(candidate: string | null | undefined, fallback: string): string | null {
  const preferred = typeof candidate === 'string' ? candidate.trim() : '';
  if (preferred && isSafePagePath(preferred)) return preferred;
  const fallbackPath = fallback.trim();
  return isSafePagePath(fallbackPath) ? fallbackPath : null;
}

export function truncateUserAgent(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return trimmed.slice(0, FEEDBACK_MAX_USER_AGENT_LENGTH);
}

/** Start of the Asia/Shanghai calendar day that contains `now`. */
export function campusDayStart(now: Date): Date {
  return new Date(`${campusDateKey(now)}T00:00:00+08:00`);
}

export function secondsUntilNextCampusDay(now: Date): number {
  const next = campusDayStart(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function evaluateFeedbackRateLimit(input: {
  now: Date;
  latestCreatedAt: Date | null;
  submissionsOnCampusDay: number;
}): { ok: true } | { ok: false; error: string; retryAfterSeconds: number } {
  if (input.latestCreatedAt) {
    const elapsed = input.now.getTime() - input.latestCreatedAt.getTime();
    if (elapsed >= 0 && elapsed < FEEDBACK_MIN_INTERVAL_MS) {
      return {
        ok: false,
        error: '两次反馈至少间隔 1 分钟，请稍后再试',
        retryAfterSeconds: Math.max(1, Math.ceil((FEEDBACK_MIN_INTERVAL_MS - elapsed) / 1000)),
      };
    }
  }
  if (input.submissionsOnCampusDay >= FEEDBACK_MAX_PER_CAMPUS_DAY) {
    return {
      ok: false,
      error: `今天的反馈已达到 ${FEEDBACK_MAX_PER_CAMPUS_DAY} 条上限，请明天再试`,
      retryAfterSeconds: secondsUntilNextCampusDay(input.now),
    };
  }
  return { ok: true };
}

export interface FeedbackIdentity {
  name: string | null;
  username: string;
  studentId: string | null;
}

export interface StoredFeedbackRow {
  id: string;
  anonymous: boolean;
  category: string;
  body: string;
  pagePath: string | null;
  classId: string | null;
  createdAt: Date;
  user: FeedbackIdentity;
}

export interface TeacherFeedbackItem {
  id: string;
  createdAt: string;
  category: string;
  categoryLabel: string;
  body: string;
  pagePath: string | null;
  anonymous: boolean;
  displayName: string;
  studentName: string | null;
  studentId: string | null;
  className: string;
}

/**
 * Teacher-facing view. Anonymous rows keep the class snapshot but drop
 * name, student id, and any user id. The returned object has no userId field.
 */
export function presentTeacherFeedback(
  row: StoredFeedbackRow,
  className: string | null,
): TeacherFeedbackItem {
  const trimmedClassName = className?.trim() ?? '';
  const visibleClass = trimmedClassName || (row.classId ? '班级已归档' : '未分班');
  const shared = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    category: row.category,
    categoryLabel: feedbackCategoryLabel(row.category),
    body: row.body,
    pagePath: row.pagePath,
    anonymous: row.anonymous,
    className: visibleClass,
  };
  if (row.anonymous) {
    return {
      ...shared,
      displayName: '匿名',
      studentName: null,
      studentId: null,
    };
  }
  const studentName = row.user.name?.trim() || null;
  return {
    ...shared,
    displayName: studentName || row.user.username,
    studentName,
    studentId: row.user.studentId,
  };
}
