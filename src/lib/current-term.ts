/**
 * 本学期教学范围的唯一配置。
 *
 * ClassGroup 没有单独的 code / slug 字段，班级以 `name` 为准。
 * `CURRENT_CLASS_CODES` 必须与 ClassGroup.name 去首尾空白后完全一致。
 * `CURRENT_SEMESTER` 是这组配置对应的学期码，便于下学期整组替换；
 * 是否算「本学期」只看班级名白名单。因此机电2401 即使被改成当前学期码，
 * 也不会进入默认学情。
 *
 * 下学期切换：只改本文件的 CURRENT_SEMESTER 和 CURRENT_CLASS_CODES，
 * 不要删除历史 ClassGroup、Enrollment 或作答记录。
 * 每个本学期班级保留一个用户名以 TEST 开头的自测账号（按用户名排序取第一个）。
 */

export const CURRENT_SEMESTER = '2026-2027-1';

export const CURRENT_CLASS_CODES = ['0872-001', '0872-002', '3084-001', '3084-002'] as const;

const CURRENT_CLASS_CODE_SET = new Set<string>(CURRENT_CLASS_CODES);

export type TeachingScope = 'current' | 'history';

export type ClassTermIdentity = {
  name?: string | null;
};

export type TeachingRosterMember = {
  userId: string;
  classId: string;
  username?: string | null;
};

export function parseTeachingScope(value: string | null | undefined): TeachingScope {
  return value === 'history' ? 'history' : 'current';
}

export function normalizeClassName(name: string | null | undefined): string {
  return (name ?? '').trim();
}

/** 班级名是否属于本学期四个正式班。 */
export function isCurrentTermClass(classGroup: ClassTermIdentity): boolean {
  return CURRENT_CLASS_CODE_SET.has(normalizeClassName(classGroup.name));
}

export function classMatchesTeachingScope(classGroup: ClassTermIdentity, scope: TeachingScope): boolean {
  const current = isCurrentTermClass(classGroup);
  return scope === 'history' ? !current : current;
}

export function filterClassesByTeachingScope<T extends ClassTermIdentity>(
  classes: readonly T[],
  scope: TeachingScope,
): T[] {
  return classes.filter((classGroup) => classMatchesTeachingScope(classGroup, scope));
}

/** 本学期正式班才限制自测账号数量；往期班保持原名单。 */
export function shouldCapSmokeTests(classes: readonly ClassTermIdentity[]): boolean {
  return classes.length > 0 && classes.every((classGroup) => isCurrentTermClass(classGroup));
}

/** 用户名以 TEST 开头（忽略大小写）的班级自测账号。 */
export function isSmokeTestUsername(username: string | null | undefined): boolean {
  return (username ?? '').trim().toUpperCase().startsWith('TEST');
}

function compareSmokeTestAccounts(left: TeachingRosterMember, right: TeachingRosterMember): number {
  const byUsername = (left.username ?? '').localeCompare(right.username ?? '', 'en', { sensitivity: 'base' });
  if (byUsername !== 0) return byUsername;
  return left.userId.localeCompare(right.userId);
}

/**
 * 本学期每个班级只保留一个 TEST* 自测账号。
 * 被放下的账号仍留在数据库里，只是不进入本次教学聚合。
 * 非自测学生原样保留。
 */
export function filterTeachingRoster<T>(
  rows: readonly T[],
  memberOf: (row: T) => TeachingRosterMember,
  capSmokeTests: boolean,
): { rows: T[]; omittedSmokeTestCount: number } {
  if (!capSmokeTests) {
    return { rows: [...rows], omittedSmokeTestCount: 0 };
  }

  const smokeByClass = new Map<string, Map<string, TeachingRosterMember>>();
  for (const row of rows) {
    const member = memberOf(row);
    if (!isSmokeTestUsername(member.username)) continue;
    const byUser = smokeByClass.get(member.classId) ?? new Map<string, TeachingRosterMember>();
    if (!byUser.has(member.userId)) byUser.set(member.userId, member);
    smokeByClass.set(member.classId, byUser);
  }

  const chosenByClass = new Map<string, string>();
  for (const [classId, byUser] of smokeByClass) {
    const chosen = [...byUser.values()].sort(compareSmokeTestAccounts)[0];
    if (chosen) chosenByClass.set(classId, chosen.userId);
  }

  const omittedKeys = new Set<string>();
  const kept = rows.filter((row) => {
    const member = memberOf(row);
    if (!isSmokeTestUsername(member.username)) return true;
    if (chosenByClass.get(member.classId) === member.userId) return true;
    omittedKeys.add(`${member.classId}:${member.userId}`);
    return false;
  });

  return { rows: kept, omittedSmokeTestCount: omittedKeys.size };
}
