'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label: string;
  className?: string;
  color?: 'red' | 'yellow' | 'green' | 'blue';
  showPercentage?: boolean;
  showNumbers?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressIndicator({
  current,
  total,
  label,
  className,
  color,
  showPercentage = true,
  showNumbers = true,
  onClick,
  onKeyDown,
  size = 'md'
}: ProgressIndicatorProps) {
  // 计算进度百分比
  const percentage = total === 0 ? 0 : Math.min(Math.max((current / total) * 100, 0), 100);
  const roundedPercentage = Math.round(percentage);
  
  // 根据进度自动选择颜色（如果没有指定颜色）
  const getProgressColor = () => {
    if (color) return color;
    if (percentage < 30) return 'red';
    if (percentage < 70) return 'yellow';
    return 'green';
  };
  
  const progressColor = getProgressColor();
  
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500'
  };
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-lg'
  };

  return (
    <div 
      className={cn(
        'flex items-center gap-2 transition-all duration-300 hover:scale-105',
        sizeClasses[size],
        className
      )}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span>{label}</span>
      
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
        <div
          className={cn(
            'h-2 rounded-full transition-all duration-300',
            colorClasses[progressColor]
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${label}: ${current} / ${total} (${roundedPercentage}%)`}
        />
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {showNumbers && (
          <span>{current} / {total}</span>
        )}
        {showPercentage && (
          <span>{roundedPercentage}%</span>
        )}
      </div>
    </div>
  );
}