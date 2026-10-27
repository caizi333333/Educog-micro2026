import type { JWTPayload } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import {
  filterClassesByTeachingScope,
  parseTeachingScope,
  type ClassTermIdentity,
  type TeachingScope,
} from '@/lib/current-term';
import { prisma } from '@/lib/prisma';

export type TeachingClassRecord = ClassTermIdentity & {
  id: string;
  name: string;
  courseName: string | null;
  semester: string | null;
};

export type ResolvedTeachingScope = {
  scope: TeachingScope;
  explicitClassId: string | null;
  accessibleClassIds: string[];
  accessibleClasses: TeachingClassRecord[];
  classIds: string[];
  classes: TeachingClassRecord[];
};

const CLASS_SELECT = {
  id: true,
  name: true,
  courseName: true,
  semester: true,
} as const;

/**
 * 教师/管理员学情用的班级范围。
 * 不传 classId 时按 scope 过滤（默认本学期四班）。
 * 传入 classId 时只返回该班，往期班也可以下钻，数据不删。
 */
export async function resolveTeachingScope(
  payload: JWTPayload,
  searchParams: URLSearchParams,
): Promise<{ ok: true; value: ResolvedTeachingScope } | { ok: false; status: 403; error: string }> {
  const requestedClassId = searchParams.get('classId')?.trim() || null;
  const scope = parseTeachingScope(searchParams.get('scope'));
  const accessibleClassIds = await getAccessibleClassIds(payload);

  if (requestedClassId && payload.role !== 'ADMIN' && !accessibleClassIds.includes(requestedClassId)) {
    return { ok: false, status: 403, error: '无权查看该班级' };
  }

  const lookupIds = requestedClassId && !accessibleClassIds.includes(requestedClassId)
    ? [...accessibleClassIds, requestedClassId]
    : accessibleClassIds;
  const accessibleClasses = lookupIds.length === 0
    ? []
    : await prisma.classGroup.findMany({
      where: { id: { in: lookupIds }, status: 'ACTIVE' },
      select: CLASS_SELECT,
      orderBy: { name: 'asc' },
    });

  if (requestedClassId) {
    return {
      ok: true,
      value: {
        scope,
        explicitClassId: requestedClassId,
        accessibleClassIds,
        accessibleClasses,
        classIds: [requestedClassId],
        classes: accessibleClasses.filter((classGroup) => classGroup.id === requestedClassId),
      },
    };
  }

  const classes = filterClassesByTeachingScope(accessibleClasses, scope);
  return {
    ok: true,
    value: {
      scope,
      explicitClassId: null,
      accessibleClassIds,
      accessibleClasses,
      classIds: classes.map((classGroup) => classGroup.id),
      classes,
    },
  };
}
