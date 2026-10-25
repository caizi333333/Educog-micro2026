/**
 * video-library.ts 测试
 *
 * 视频库只允许放入已确认的课程视频。没有真实录课或授权外链时，
 * 保持空列表，避免 AI 助教和课程页推荐错误素材。
 */

import { videoLibrary, type VideoInfo, validateVideoEntry, keywordsFromKnowledgePoints } from '@/lib/video-library';

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
      // http(s) 外链或站内 /videos/ 路径均可
      expect(video.embedUrl).toMatch(/^(https?:\/\/|\/videos\/).+/);
      expect(Array.isArray(video.keywords)).toBe(true);
      expect(video.keywords.length).toBeGreaterThan(0);
      // 逐条入库校验：知识点 id 必须真实存在于图谱
      expect(validateVideoEntry(video)).toEqual([]);

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

  it('validateVideoEntry 拦住坏条目、放好条目', () => {
    expect(validateVideoEntry({ title: '', embedUrl: 'x', keywords: [] }).length).toBeGreaterThan(0);
    expect(validateVideoEntry({ title: 'T', embedUrl: 'ftp://x', keywords: ['k'] })).toContain('embedUrl 须为 http(s) 外链或站内 /videos/ 路径');
    expect(validateVideoEntry({ title: 'T', embedUrl: '/videos/a.mp4', keywords: ['k'], chapter: 99 })).toContain('chapter 99 超出 1-11');
    expect(validateVideoEntry({ title: 'T', embedUrl: '/videos/a.mp4', keywords: ['k'], knowledgePoints: ['9.9.9'] })).toContain('知识点 id "9.9.9" 不在知识图谱中');
    expect(validateVideoEntry({
      title: '第1章 单片机概述', embedUrl: '/videos/ch1.mp4',
      keywords: ['单片机'], chapter: 1, durationSec: 447, knowledgePoints: ['1'],
    })).toEqual([]);
  });

  it('keywordsFromKnowledgePoints 用知识点名生成关键词', () => {
    const kws = keywordsFromKnowledgePoints(['1', '1.1', '1.2']);
    expect(kws).toContain('单片机概述');
    expect(kws).toContain('单片机发展历史');
    expect(keywordsFromKnowledgePoints(['不存在的id'])).toEqual([]);
  });
});
