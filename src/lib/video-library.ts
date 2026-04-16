/**
 * @fileOverview A centralized library of curated video resources for the course.
 * This acts as a mock database for video content that can be recommended by AI agents.
 */

export type VideoInfo = {
  title: string;
  embedUrl: string;
  keywords: string[];
};

export const videoLibrary: VideoInfo[] = [
  {
    title: '8051 定时器/计数器编程 (Timer Programming)',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1U4411V7hL&autoplay=0',
    keywords: ['定时器', '计数器', 'timer', 'counter', '编程', '模式1', '模式2'],
  },
  {
    title: '8051 中断系统详解 (Interrupts)',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1qt411T79Y&autoplay=0',
    keywords: ['中断', 'interrupt', 'ISR', '中断服务程序', '中断向量'],
  },
  {
    title: '8051 控制 LED 闪烁程序',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV15W411B7Dj&autoplay=0',
    keywords: ['LED', '闪烁', 'IO', '端口', '延时', 'blinking'],
  },
  {
    title: '8051 驱动7段数码管 (7-Segment Display)',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1Kb411T7St&autoplay=0',
    keywords: ['数码管', '七段', '动态扫描', 'LED', '显示', '7-segment'],
  },
];
