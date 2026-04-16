/**
 * video-library.ts 测试
 * 测试视频库的数据结构和内容
 */

import { videoLibrary, VideoInfo } from '@/lib/video-library';

describe('video-library', () => {
  describe('videoLibrary data structure', () => {
    it('should be an array', () => {
      expect(Array.isArray(videoLibrary)).toBe(true);
    });

    it('should contain video entries', () => {
      expect(videoLibrary.length).toBeGreaterThan(0);
    });

    it('should have valid VideoInfo structure for each entry', () => {
      videoLibrary.forEach((video) => {
        expect(video).toHaveProperty('title');
        expect(video).toHaveProperty('embedUrl');
        expect(video).toHaveProperty('keywords');
        
        expect(typeof video.title).toBe('string');
        expect(typeof video.embedUrl).toBe('string');
        expect(Array.isArray(video.keywords)).toBe(true);
        
        expect(video.title.length).toBeGreaterThan(0);
        expect(video.embedUrl.length).toBeGreaterThan(0);
        expect(video.keywords.length).toBeGreaterThan(0);
        
        // Check that all keywords are strings
        video.keywords.forEach((keyword) => {
          expect(typeof keyword).toBe('string');
          expect(keyword.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('video content validation', () => {
    it('should have valid embed URLs', () => {
      videoLibrary.forEach(video => {
        expect(video.embedUrl).toMatch(/^https?:\/\/.+/);
      });
    });

    it('should have bilibili embed URLs', () => {
      videoLibrary.forEach(video => {
        expect(video.embedUrl).toContain('player.bilibili.com');
        expect(video.embedUrl).toContain('bvid=');
      });
    });

    it('should have autoplay disabled', () => {
      videoLibrary.forEach(video => {
        expect(video.embedUrl).toContain('autoplay=0');
      });
    });

    it('should have meaningful titles', () => {
      videoLibrary.forEach(video => {
        expect(video.title.length).toBeGreaterThan(5);
        // Should contain some Chinese or English characters
        expect(video.title).toMatch(/[\u4e00-\u9fff]|[a-zA-Z]/);
      });
    });

    it('should have relevant keywords', () => {
      videoLibrary.forEach(video => {
        expect(video.keywords.length).toBeGreaterThanOrEqual(3);
        
        // Keywords should be relevant to the title
        const titleLower = video.title.toLowerCase();
        const hasRelevantKeywords = video.keywords.some(keyword => 
          titleLower.includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes('8051') ||
          keyword.toLowerCase().includes('led') ||
          keyword.toLowerCase().includes('timer') ||
          keyword.toLowerCase().includes('interrupt')
        );
        
        expect(hasRelevantKeywords).toBe(true);
      });
    });
  });

  describe('specific video content', () => {
    it('should contain timer/counter programming video', () => {
      const timerVideo = videoLibrary.find(video => 
        video.title.includes('定时器') || video.title.includes('Timer')
      );
      
      expect(timerVideo).toBeDefined();
      if (timerVideo) {
        expect(timerVideo.keywords).toContain('定时器');
        expect(timerVideo.keywords).toContain('timer');
      }
    });

    it('should contain interrupt system video', () => {
      const interruptVideo = videoLibrary.find(video => 
        video.title.includes('中断') || video.title.includes('Interrupt')
      );
      
      expect(interruptVideo).toBeDefined();
      if (interruptVideo) {
        expect(interruptVideo.keywords).toContain('中断');
        expect(interruptVideo.keywords).toContain('interrupt');
      }
    });

    it('should contain LED control video', () => {
      const ledVideo = videoLibrary.find(video => 
        video.title.includes('LED')
      );
      
      expect(ledVideo).toBeDefined();
      if (ledVideo) {
        expect(ledVideo.keywords).toContain('LED');
      }
    });

    it('should contain 7-segment display video', () => {
      const displayVideo = videoLibrary.find(video => 
        video.title.includes('数码管') || video.title.includes('7-Segment')
      );
      
      expect(displayVideo).toBeDefined();
      if (displayVideo) {
        expect(displayVideo.keywords).toContain('数码管');
        expect(displayVideo.keywords).toContain('7-segment');
      }
    });
  });

  describe('VideoInfo type compatibility', () => {
    it('should match VideoInfo type structure', () => {
      // This test ensures type compatibility
      const testVideo: VideoInfo = {
        title: 'Test Video',
        embedUrl: 'https://example.com/embed',
        keywords: ['test', 'video']
      };
      
      expect(testVideo.title).toBe('Test Video');
      expect(testVideo.embedUrl).toBe('https://example.com/embed');
      expect(testVideo.keywords).toEqual(['test', 'video']);
    });

    it('should allow all library entries to be assigned to VideoInfo type', () => {
      videoLibrary.forEach(video => {
        const typedVideo: VideoInfo = video;
        expect(typedVideo).toBeDefined();
      });
    });
  });

  describe('search functionality helpers', () => {
    it('should be searchable by keywords', () => {
      const searchKeyword = '定时器';
      const matchingVideos = videoLibrary.filter(video => 
        video.keywords.some(keyword => 
          keyword.toLowerCase().includes(searchKeyword.toLowerCase())
        )
      );
      
      expect(matchingVideos.length).toBeGreaterThan(0);
      matchingVideos.forEach(video => {
        expect(video.keywords.some(keyword => 
          keyword.toLowerCase().includes(searchKeyword.toLowerCase())
        )).toBe(true);
      });
    });

    it('should be searchable by title', () => {
      const searchTerm = 'LED';
      const matchingVideos = videoLibrary.filter(video => 
        video.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(matchingVideos.length).toBeGreaterThan(0);
      matchingVideos.forEach(video => {
        expect(video.title.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    });

    it('should support multi-language search', () => {
      // Test Chinese search
      const chineseResults = videoLibrary.filter(video => 
        video.keywords.some(keyword => /[\u4e00-\u9fff]/.test(keyword))
      );
      
      // Test English search
      const englishResults = videoLibrary.filter(video => 
        video.keywords.some(keyword => /[a-zA-Z]/.test(keyword))
      );
      
      expect(chineseResults.length).toBeGreaterThan(0);
      expect(englishResults.length).toBeGreaterThan(0);
    });
  });

  describe('data consistency', () => {
    it('should have unique titles', () => {
      const titles = videoLibrary.map(video => video.title);
      const uniqueTitles = new Set(titles);
      
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('should have unique embed URLs', () => {
      const urls = videoLibrary.map(video => video.embedUrl);
      const uniqueUrls = new Set(urls);
      
      expect(uniqueUrls.size).toBe(urls.length);
    });

    it('should have consistent keyword formatting', () => {
      videoLibrary.forEach(video => {
        video.keywords.forEach(keyword => {
          // Keywords should not have leading/trailing whitespace
          expect(keyword).toBe(keyword.trim());
          
          // Keywords should not be empty after trimming
          expect(keyword.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('library completeness', () => {
    it('should cover main 8051 topics', () => {
      const expectedTopics = ['定时器', '中断', 'LED', '数码管'];
      
      expectedTopics.forEach(topic => {
        const hasTopicVideo = videoLibrary.some(video => 
          video.title.includes(topic) || 
          video.keywords.some(keyword => keyword.includes(topic))
        );
        
        expect(hasTopicVideo).toBe(true);
      });
    });

    it('should have adequate number of videos', () => {
      // Should have at least 3 videos for a basic library
      expect(videoLibrary.length).toBeGreaterThanOrEqual(3);
      
      // Should not be too many for a curated list
      expect(videoLibrary.length).toBeLessThanOrEqual(20);
    });
  });
});