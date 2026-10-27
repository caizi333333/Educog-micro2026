import { GET } from '@/app/api/site/version/route';
import { SITE_VERSION } from '@/lib/site-version';

describe('GET /api/site/version', () => {
  it('returns the public version and highlights without internal notes', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(body).toEqual({
      version: SITE_VERSION,
      releasedAt: '2026-10-27',
      highlights: ['开放学生反馈与勋章', '版本号展示'],
    });
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/neon|password|billing|api_key/);
  });
});
