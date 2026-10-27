import packageJson from '../../../package.json';
import { getPublicSiteVersion, PUBLIC_RELEASE_NOTES, SITE_VERSION } from '@/lib/site-version';

const INTERNAL_MARKERS = ['neon', 'r2', 'password', 'jwt', 'billing', 'api_key', 'secret', '数据库'];

describe('public site version', () => {
  it('keeps package.json, the runtime version, and the newest public note on one version', () => {
    expect(SITE_VERSION).toBe(packageJson.version);
    expect(PUBLIC_RELEASE_NOTES[0]?.version).toBe(SITE_VERSION);
    expect(getPublicSiteVersion()).toEqual({
      version: '1.0.0',
      releasedAt: '2026-10-27',
      highlights: ['开放学生反馈与勋章', '版本号展示'],
    });
  });

  it('does not put internal operations into the public notes', () => {
    const serialized = JSON.stringify(PUBLIC_RELEASE_NOTES).toLowerCase();
    INTERNAL_MARKERS.forEach((marker) => {
      expect(serialized).not.toContain(marker);
    });
  });
});
