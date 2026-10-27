import packageJson from '../../package.json';

/**
 * Runtime site version. package.json is the string source of truth;
 * PUBLIC_RELEASE_NOTES[0].version must match it or this module throws.
 *
 * To publish a release:
 * 1. Bump package.json version (patch / minor / major).
 * 2. Prepend a student-safe entry here. Do not copy internal ops notes.
 * 3. Prepend the same version in docs/RELEASE_NOTES.md, with internal bullets
 *    kept under the 内部 heading.
 */
export const SITE_VERSION: string = packageJson.version;

/** Optional short label from NEXT_PUBLIC_SITE_BUILD_LABEL. Never required. */
export const SITE_BUILD_LABEL: string | null = process.env.NEXT_PUBLIC_SITE_BUILD_LABEL?.trim() || null;

export interface PublicReleaseNote {
  version: string;
  /** Calendar date YYYY-MM-DD. */
  date: string;
  highlights: readonly string[];
}

export const PUBLIC_RELEASE_NOTES: readonly PublicReleaseNote[] = [
  {
    version: '1.0.0',
    date: '2026-10-27',
    highlights: [
      '开放学生反馈与勋章',
      '版本号展示',
    ],
  },
];

export interface PublicSiteVersion {
  version: string;
  releasedAt: string;
  highlights: string[];
}

function currentPublicNote(): PublicReleaseNote {
  const current = PUBLIC_RELEASE_NOTES[0];
  if (!current || current.version !== SITE_VERSION) {
    throw new Error('PUBLIC_RELEASE_NOTES 的第一条必须对应当前 SITE_VERSION');
  }
  return current;
}

export function getPublicSiteVersion(): PublicSiteVersion {
  const current = currentPublicNote();
  return {
    version: SITE_VERSION,
    releasedAt: current.date,
    highlights: [...current.highlights],
  };
}
