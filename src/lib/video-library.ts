/**
 * @fileOverview A centralized library of curated video resources for the course.
 * Only verified course video assets should be listed here. Do not add generic
 * external videos as substitutes for course materials.
 */

export type VideoInfo = {
  title: string;
  embedUrl: string;
  keywords: string[];
};

export const videoLibrary: VideoInfo[] = [];
