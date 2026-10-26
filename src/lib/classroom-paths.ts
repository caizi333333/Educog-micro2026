/**
 * Paths that serve courseware, lecture notes, or in-site teaching videos.
 * Middleware uses this list without touching the database.
 */

export function isClassroomPagePath(pathname: string): boolean {
  return pathname === '/lesson-notes' || pathname.startsWith('/lesson-notes/');
}

export function isClassroomFilePath(pathname: string): boolean {
  return pathname === '/resources/course'
    || pathname.startsWith('/resources/course/')
    || pathname === '/videos'
    || pathname.startsWith('/videos/');
}

export function isClassroomContentPath(pathname: string): boolean {
  return isClassroomPagePath(pathname) || isClassroomFilePath(pathname);
}

export function isUngatedStaticPath(pathname: string): boolean {
  if (
    pathname.startsWith('/_next')
    || pathname === '/favicon.ico'
    || pathname.startsWith('/public')
    || pathname.startsWith('/prinx')
  ) {
    return true;
  }
  if (pathname.startsWith('/resources/') && !isClassroomFilePath(pathname)) {
    return true;
  }
  return false;
}
