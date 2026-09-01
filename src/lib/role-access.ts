export type ApplicationRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type RoleMismatchReason = 'student-role' | 'teacher-role' | 'admin-role';

const STUDENT_ROLES: readonly ApplicationRole[] = ['STUDENT'];
const TEACHER_ROLES: readonly ApplicationRole[] = ['TEACHER', 'ADMIN'];
const ADMIN_ROLES: readonly ApplicationRole[] = ['ADMIN'];
const STUDENT_ROUTE_PREFIXES = [
  '/tasks',
  '/weak-nodes',
  '/learning-path',
  '/obe',
  '/classes/join',
  '/achievements',
  '/certificate',
] as const;
const TEACHER_ROUTE_PREFIXES = ['/teacher', '/obe/teacher'] as const;
const ADMIN_ROUTE_PREFIXES = ['/admin', '/obe/admin'] as const;
const TEACHER_SHARED_ADMIN_ROUTE_PREFIXES = ['/admin/knowledge-graph'] as const;

export function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getMostSpecificRouteMatch(
  pathname: string | null | undefined,
  routes: readonly string[],
): string | null {
  if (!pathname) return null;

  return routes
    .filter((route) => matchesRoutePrefix(pathname, route))
    .sort((left, right) => right.length - left.length)[0] ?? null;
}

export function getAllowedRolesForPath(pathname: string | null | undefined): readonly ApplicationRole[] | null {
  if (!pathname) return null;
  if (TEACHER_SHARED_ADMIN_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return TEACHER_ROLES;
  }
  if (ADMIN_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return ADMIN_ROLES;
  }
  if (TEACHER_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return TEACHER_ROLES;
  }
  if (STUDENT_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix))) {
    return STUDENT_ROLES;
  }
  return null;
}

export function getRoleMismatchReasonForPath(pathname: string): RoleMismatchReason {
  const allowedRoles = getAllowedRolesForPath(pathname);
  if (allowedRoles?.length === 1 && allowedRoles[0] === 'STUDENT') return 'student-role';
  return allowedRoles?.length === 1 && allowedRoles[0] === 'ADMIN' ? 'admin-role' : 'teacher-role';
}
