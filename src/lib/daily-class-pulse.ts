/**
 * 四个正式班的「今天」登录与学习汇总。
 *
 * 今天按 Asia/Shanghai 日历日，从 00:00 到调用时刻。
 * 只输出 CURRENT_CLASS_CODES。往期班即使传进来也不进入卡片。
 * TEST*、demo_、「测试-」账号从正式人数里拿开，单独放在 demo 列表。
 * 登录不算学习；学习沿用班级学情的事件类型。
 */

import { CAMPUS_TIME_ZONE, campusDayBounds } from '@/lib/campus-time';
import {
  CURRENT_CLASS_CODES,
  isSmokeTestUsername,
  normalizeClassName,
} from '@/lib/current-term';
import { STUDIED_EVENT_TYPES } from '@/lib/learning-presence-shared';

export const DAILY_PULSE_RECENT_LIMIT = 12;
export const DAILY_PULSE_DEMO_LIMIT = 40;
export const DAILY_PULSE_EVENT_TYPES = [...STUDIED_EVENT_TYPES, 'LOGIN'] as const;

const STUDIED_TYPE_SET = new Set<string>(STUDIED_EVENT_TYPES);
const DEMO_LABEL_PREFIX = '测试-';
const DEMO_USERNAME_PREFIX = 'demo_';

export type DailyPulseAvailability = 'visible' | 'out-of-scope' | 'missing';

export type DailyPulseClassRecord = {
  id: string;
  name: string;
};

export type DailyPulseRosterRow = {
  classId: string;
  userId: string;
  name: string | null;
  username: string;
  studentId: string | null;
  lastLoginAt: Date | null;
};

export type DailyPulseEvent = {
  classId: string | null;
  userId: string;
  eventType: string;
  lastAt: Date | null;
  durationSeconds: number;
};

export type DailyPulseStudent = {
  id: string;
  name: string;
  username: string;
  studentId: string | null;
  loggedIn: boolean;
  studied: boolean;
  lastLoginAt: string | null;
  lastStudyAt: string | null;
  durationSeconds: number;
};

export type DailyPulseDemoStudent = DailyPulseStudent & {
  classCode: string;
  classLabel: string;
};

export type DailyPulseClass = {
  code: string;
  label: string;
  availability: DailyPulseAvailability;
  classId: string | null;
  rosterCount: number;
  loggedInCount: number;
  studiedCount: number;
  students: DailyPulseStudent[];
  omittedActiveCount: number;
};

export type DailyClassPulse = {
  dateKey: string;
  timeZone: typeof CAMPUS_TIME_ZONE;
  asOf: string;
  windowStart: string;
  windowEnd: string;
  classes: DailyPulseClass[];
  demo: {
    count: number;
    omittedCount: number;
    students: DailyPulseDemoStudent[];
  };
};

/** 0872 在课表里称智工；3084 保持班号。 */
export function officialClassLabel(code: string): string {
  const normalized = normalizeClassName(code);
  if (normalized.startsWith('0872')) return `智工 ${normalized}`;
  return normalized;
}

/**
 * 演示号、自测号不进正式班人数。
 * 用户名 TEST 开头、demo_ 开头，或姓名/用户名以「测试-」开头。
 */
export function isDemoRosterAccount(account: { username?: string | null; name?: string | null }): boolean {
  if (isSmokeTestUsername(account.username)) return true;
  const username = (account.username ?? '').trim();
  const name = (account.name ?? '').trim();
  if (username.toLowerCase().startsWith(DEMO_USERNAME_PREFIX)) return true;
  return username.startsWith(DEMO_LABEL_PREFIX) || name.startsWith(DEMO_LABEL_PREFIX);
}

function emptyClass(code: string, availability: DailyPulseAvailability): DailyPulseClass {
  return {
    code,
    label: officialClassLabel(code),
    availability,
    classId: null,
    rosterCount: 0,
    loggedInCount: 0,
    studiedCount: 0,
    students: [],
    omittedActiveCount: 0,
  };
}

function latestDate(current: Date | null, next: Date | null): Date | null {
  if (!next) return current;
  if (!current || next.getTime() > current.getTime()) return next;
  return current;
}

function recentMs(student: DailyPulseStudent): number {
  const login = student.lastLoginAt ? Date.parse(student.lastLoginAt) : 0;
  const study = student.lastStudyAt ? Date.parse(student.lastStudyAt) : 0;
  return Math.max(Number.isNaN(login) ? 0 : login, Number.isNaN(study) ? 0 : study);
}

function summarizeStudent(
  member: DailyPulseRosterRow,
  memberEvents: readonly DailyPulseEvent[],
  inWindow: (time: Date | null | undefined) => time is Date,
): DailyPulseStudent {
  let lastLogin = inWindow(member.lastLoginAt) ? member.lastLoginAt : null;
  let lastStudy: Date | null = null;
  let durationSeconds = 0;
  let studied = false;
  for (const event of memberEvents) {
    if (!inWindow(event.lastAt)) continue;
    if (event.eventType === 'LOGIN') {
      lastLogin = latestDate(lastLogin, event.lastAt);
    }
    if (!STUDIED_TYPE_SET.has(event.eventType)) continue;
    studied = true;
    lastStudy = latestDate(lastStudy, event.lastAt);
    if (event.eventType === 'SECTION_VISIT') {
      durationSeconds += Math.max(0, event.durationSeconds);
    }
  }
  const name = (member.name ?? '').trim() || member.username;
  return {
    id: member.userId,
    name,
    username: member.username,
    studentId: member.studentId,
    loggedIn: lastLogin != null,
    studied,
    lastLoginAt: lastLogin ? lastLogin.toISOString() : null,
    lastStudyAt: lastStudy ? lastStudy.toISOString() : null,
    durationSeconds,
  };
}

/**
 * 把名册和今日事件收成四张班卡。
 * 不可见的班不填人数，避免把「没有权限」显示成「今天 0 人」。
 */
export function buildDailyClassPulse(input: {
  asOf: Date;
  viewerSeesAllClasses: boolean;
  classes: readonly DailyPulseClassRecord[];
  roster: readonly DailyPulseRosterRow[];
  events: readonly DailyPulseEvent[];
}): DailyClassPulse {
  const bounds = campusDayBounds(input.asOf);
  const asOfMs = input.asOf.getTime();
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();
  const inWindow = (time: Date | null | undefined): time is Date => {
    if (!time || Number.isNaN(time.getTime())) return false;
    const ms = time.getTime();
    return ms >= startMs && ms <= asOfMs && ms < endMs;
  };

  const idsByCode = new Map<string, string[]>();
  for (const classGroup of input.classes) {
    const code = normalizeClassName(classGroup.name);
    if (!CURRENT_CLASS_CODES.includes(code as typeof CURRENT_CLASS_CODES[number])) continue;
    const ids = idsByCode.get(code) ?? [];
    ids.push(classGroup.id);
    idsByCode.set(code, ids);
  }

  const rosterByClass = new Map<string, DailyPulseRosterRow[]>();
  const seenEnrollment = new Set<string>();
  for (const row of input.roster) {
    const key = `${row.classId}:${row.userId}`;
    if (seenEnrollment.has(key)) continue;
    seenEnrollment.add(key);
    const list = rosterByClass.get(row.classId) ?? [];
    list.push(row);
    rosterByClass.set(row.classId, list);
  }

  const eventsByClassUser = new Map<string, DailyPulseEvent[]>();
  for (const event of input.events) {
    if (!event.classId || !inWindow(event.lastAt)) continue;
    const key = `${event.classId}:${event.userId}`;
    const list = eventsByClassUser.get(key) ?? [];
    list.push(event);
    eventsByClassUser.set(key, list);
  }

  const demoStudents: DailyPulseDemoStudent[] = [];
  const classes = CURRENT_CLASS_CODES.map((code) => {
    const classIds = idsByCode.get(code) ?? [];
    if (classIds.length === 0) {
      return emptyClass(code, input.viewerSeesAllClasses ? 'missing' : 'out-of-scope');
    }
    const membersByUser = new Map<string, DailyPulseRosterRow>();
    for (const classId of classIds) {
      for (const member of rosterByClass.get(classId) ?? []) {
        const previous = membersByUser.get(member.userId);
        if (!previous) {
          membersByUser.set(member.userId, member);
          continue;
        }
        const previousLogin = previous.lastLoginAt?.getTime() ?? 0;
        const nextLogin = member.lastLoginAt?.getTime() ?? 0;
        if (nextLogin > previousLogin) membersByUser.set(member.userId, member);
      }
    }

    const official: DailyPulseStudent[] = [];
    for (const member of membersByUser.values()) {
      const memberEvents = classIds.flatMap((classId) => eventsByClassUser.get(`${classId}:${member.userId}`) ?? []);
      const student = summarizeStudent(member, memberEvents, inWindow);
      if (isDemoRosterAccount(member)) {
        demoStudents.push({ ...student, classCode: code, classLabel: officialClassLabel(code) });
        continue;
      }
      official.push(student);
    }

    const active = official
      .filter((student) => student.loggedIn || student.studied)
      .sort((left, right) => recentMs(right) - recentMs(left) || left.name.localeCompare(right.name, 'zh'));

    return {
      code,
      label: officialClassLabel(code),
      availability: 'visible' as const,
      classId: classIds[0] ?? null,
      rosterCount: official.length,
      loggedInCount: official.filter((student) => student.loggedIn).length,
      studiedCount: official.filter((student) => student.studied).length,
      students: active.slice(0, DAILY_PULSE_RECENT_LIMIT),
      omittedActiveCount: Math.max(0, active.length - DAILY_PULSE_RECENT_LIMIT),
    };
  });

  demoStudents.sort((left, right) => {
    const byClass = CURRENT_CLASS_CODES.indexOf(left.classCode as typeof CURRENT_CLASS_CODES[number])
      - CURRENT_CLASS_CODES.indexOf(right.classCode as typeof CURRENT_CLASS_CODES[number]);
    if (byClass !== 0) return byClass;
    return recentMs(right) - recentMs(left) || left.name.localeCompare(right.name, 'zh');
  });

  return {
    dateKey: bounds.dateKey,
    timeZone: CAMPUS_TIME_ZONE,
    asOf: input.asOf.toISOString(),
    windowStart: bounds.start.toISOString(),
    windowEnd: bounds.end.toISOString(),
    classes,
    demo: {
      count: demoStudents.length,
      omittedCount: Math.max(0, demoStudents.length - DAILY_PULSE_DEMO_LIMIT),
      students: demoStudents.slice(0, DAILY_PULSE_DEMO_LIMIT),
    },
  };
}
