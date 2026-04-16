
'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

export const SevenSegmentDisplay = memo(({ digit, isActive = true }: { digit: string; isActive?: boolean }) => {
  // 7段数码管的段选映射 (a,b,c,d,e,f,g)
  const segmentMaps: { [key: string]: boolean[] } = {
    '0': [true, true, true, true, true, true, false],
    '1': [false, true, true, false, false, false, false],
    '2': [true, true, false, true, true, false, true],
    '3': [true, true, true, true, false, false, true],
    '4': [false, true, true, false, false, true, true],
    '5': [true, false, true, true, false, true, true],
    '6': [true, false, true, true, true, true, true],
    '7': [true, true, true, false, false, false, false],
    '8': [true, true, true, true, true, true, true],
    '9': [true, true, true, true, false, true, true],
    '-': [false, false, false, false, false, false, true],
    ' ': [false, false, false, false, false, false, false]
  };
  
  const segments: boolean[] = segmentMaps[digit] || segmentMaps[' '] || [false, false, false, false, false, false, false];
  
  // 确保所有段都有有效的布尔值，并且数组长度为7
  const safeSegments: boolean[] = Array.from({ length: 7 }, (_, i) => Boolean(segments[i]));
  const segmentClass = (isOn: boolean | undefined) => cn(
    "transition-all duration-300",
    isActive && Boolean(isOn) 
      ? "bg-red-500 shadow-lg shadow-red-500/50" 
      : "bg-gray-800/30 border border-gray-600/20"
  );
  
  return (
    <div className="relative w-12 h-16 mx-1">
      {/* 段a - 顶部 */}
      <div className={cn(
        "absolute top-0 left-1 right-1 h-1.5 rounded-sm",
        segmentClass(safeSegments[0])
      )} />
      
      {/* 段b - 右上 */}
      <div className={cn(
        "absolute top-1 right-0 w-1.5 h-6 rounded-sm",
        segmentClass(safeSegments[1])
      )} />
      
      {/* 段c - 右下 */}
      <div className={cn(
        "absolute bottom-1 right-0 w-1.5 h-6 rounded-sm",
        segmentClass(safeSegments[2])
      )} />
      
      {/* 段d - 底部 */}
      <div className={cn(
        "absolute bottom-0 left-1 right-1 h-1.5 rounded-sm",
        segmentClass(safeSegments[3])
      )} />
      
      {/* 段e - 左下 */}
      <div className={cn(
        "absolute bottom-1 left-0 w-1.5 h-6 rounded-sm",
        segmentClass(safeSegments[4])
      )} />
      
      {/* 段f - 左上 */}
      <div className={cn(
        "absolute top-1 left-0 w-1.5 h-6 rounded-sm",
        segmentClass(safeSegments[5])
      )} />
      
      {/* 段g - 中间 */}
      <div className={cn(
        "absolute top-1/2 left-1 right-1 h-1.5 -translate-y-1/2 rounded-sm",
        segmentClass(safeSegments[6])
      )} />
      
      {/* 数码管背景框 */}
      <div className="absolute inset-0 border border-gray-700/50 rounded bg-black/80 -z-10" />
    </div>
  );
});

SevenSegmentDisplay.displayName = 'SevenSegmentDisplay';
