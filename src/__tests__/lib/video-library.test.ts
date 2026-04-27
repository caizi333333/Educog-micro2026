/**
 * video-library.ts 测试
 *
 * 视频库只允许放入已确认的课程视频。没有真实录课或授权外链时，
 * 保持空列表，避免 AI 助教和课程页推荐错误素材。
 */

import { videoLibrary, type VideoInfo } from '@/lib/video-library';

describe('video-library', () => {
  it('should be an array', () => {
    expect(Array.isArray(videoLibrary)).toBe(true);
  });

  it('should match VideoInfo type structure', () => {
    const testVideo: VideoInfo = {
      title: 'Test Video',
      embedUrl: 'https://example.com/embed',
      keywords: ['test', 'video'],
    };

    expect(testVideo.title).toBe('Test Video');
    expect(testVideo.embedUrl).toBe('https://example.com/embed');
    expect(testVideo.keywords).toEqual(['test', 'video']);
  });

  it('should only contain verified video entries when populated', () => {
    videoLibrary.forEach((video) => {
      expect(video).toHaveProperty('title');
      expect(video).toHaveProperty('embedUrl');
      expect(video).toHaveProperty('keywords');

      expect(video.title.trim().length).toBeGreaterThan(0);
      expect(video.embedUrl).toMatch(/^https?:\/\/.+/);
      expect(Array.isArray(video.keywords)).toBe(true);
      expect(video.keywords.length).toBeGreaterThan(0);

      video.keywords.forEach((keyword) => {
        expect(keyword).toBe(keyword.trim());
        expect(keyword.length).toBeGreaterThan(0);
      });
    });
  });

  it('should not include placeholder Bilibili links', () => {
    videoLibrary.forEach((video) => {
      expect(video.embedUrl).not.toContain('BV1U4411V7hL');
      expect(video.embedUrl).not.toContain('BV1qt411T79Y');
      expect(video.embedUrl).not.toContain('BV15W411B7Dj');
      expect(video.embedUrl).not.toContain('BV1Kb411T7St');
    });
  });
});
