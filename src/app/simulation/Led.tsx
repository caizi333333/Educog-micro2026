'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { colorTheme } from '@/lib/color-theme';

interface LedProps {
  /**
   * 数值形式 0/1，用于兼容旧接口。高于 0 视为亮灯。可选。
   */
  value?: number;
  /**
   * 布尔形式，指示 LED 是否点亮。`true` 为亮灯。可选。
   */
  on?: boolean;
  /**
   * 仅用于流水灯布尔模式的调试标签（P1 bit 索引）。
   */
  index?: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'white';
  isAnimating?: boolean;
}

const Led: React.FC<LedProps> = memo(({
  value,
  on,
  // index, // 未使用的参数
  label,
  className,
  size = 'md',
  color = 'red',
  isAnimating = false
}) => {
  // 兼容两种调用方式：优先使用 on，其次使用 value
  const isOn = typeof on === 'boolean' ? on : (value ?? 0) > 0;
  
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };
  
  const colorClasses = {
    red: isOn 
      ? 'bg-red-500 shadow-lg shadow-red-500/50 border-red-300' 
      : 'bg-red-200 border-red-300',
    green: isOn 
      ? 'bg-green-500 shadow-lg shadow-green-500/50 border-green-300' 
      : 'bg-green-200 border-green-300',
    blue: isOn 
      ? 'bg-blue-500 shadow-lg shadow-blue-500/50 border-blue-300' 
      : 'bg-blue-200 border-blue-300',
    yellow: isOn 
      ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50 border-yellow-300' 
      : 'bg-yellow-200 border-yellow-300',
    white: isOn 
      ? 'bg-white shadow-lg shadow-white/50 border-border' 
      : `${colorTheme.neutral.bg} ${colorTheme.neutral.border} border`
  };

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div 
        className={cn(
          'rounded-full border-2 transition-all duration-300',
          sizeClasses[size],
          colorClasses[color],
          isAnimating && 'animate-pulse'
        )}
      />
      {label && (
        <span className="text-xs text-muted-foreground font-mono">
          {label}
        </span>
      )}
    </div>
  );
});

Led.displayName = 'Led';

export default Led;

// LCD显示器组件
interface LCDDisplayProps {
  displayData: string[][];
  cursorPosition: { row: number; col: number };
  backlight: boolean;
  enabled: boolean;
  className?: string;
}

export const LCDDisplay: React.FC<LCDDisplayProps> = ({
  displayData,
  cursorPosition,
  backlight,
  enabled,
  className
}) => {
  const rows = displayData.length;
  const cols = displayData[0]?.length || 16;
  
  return (
    <div className={cn('font-mono text-sm border-2 border-gray-400 p-2 rounded', className)}>
      <div className="text-xs text-muted-foreground mb-2 text-center">
        LCD显示器 ({rows}x{cols})
      </div>
      <div 
        className={cn(
          'grid gap-1 p-2 rounded border-inner transition-all duration-300',
          backlight && enabled ? 'bg-green-900 text-green-100' : 'bg-gray-800 text-gray-500',
          `grid-cols-${cols}`
        )}
      >
        {Array.from({ length: rows }).map((_, rowIndex) =>
          Array.from({ length: cols }).map((_, colIndex) => {
            const char = displayData[rowIndex]?.[colIndex] || ' ';
            const isCursor = cursorPosition.row === rowIndex && cursorPosition.col === colIndex;
            
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={cn(
                  'w-3 h-4 flex items-center justify-center text-xs border border-gray-600',
                  isCursor && enabled && 'bg-green-400 text-black animate-pulse'
                )}
              >
                {char}
              </div>
            );
          })
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>背光: {backlight ? '开' : '关'}</span>
        <span>使能: {enabled ? '是' : '否'}</span>
      </div>
    </div>
  );
};

// 矩阵键盘组件
interface KeypadProps {
  matrix: boolean[][];
  lastKeyPressed: string;
  scanActive: boolean;
  onKeyPress?: (row: number, col: number) => void;
  className?: string;
}

export const MatrixKeypad: React.FC<KeypadProps> = ({
  matrix,
  lastKeyPressed,
  scanActive,
  onKeyPress,
  className
}) => {
  const keyLabels = [
    ['1', '2', '3', 'A'],
    ['4', '5', '6', 'B'],
    ['7', '8', '9', 'C'],
    ['*', '0', '#', 'D']
  ];

  return (
    <div className={cn('p-3 border rounded-lg bg-gray-50', className)}>
      <div className="text-sm font-medium mb-2 text-center">4x4矩阵键盘</div>
      <div className="grid grid-cols-4 gap-2">
        {matrix.map((row, rowIndex) =>
          row.map((pressed, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                'w-10 h-10 border-2 rounded text-sm font-bold transition-all duration-200',
                pressed 
                  ? 'bg-blue-500 text-white border-blue-600 shadow-lg transform scale-95' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100',
                scanActive && 'animate-pulse'
              )}
              onClick={() => onKeyPress?.(rowIndex, colIndex)}
            >
              {keyLabels[rowIndex]?.[colIndex] || '?'}
            </button>
          ))
        )}
      </div>
      <div className="mt-2 text-xs text-center">
        <div>扫描状态: {scanActive ? '活动' : '停止'}</div>
        <div>最后按键: {lastKeyPressed || '无'}</div>
      </div>
    </div>
  );
};

// 蜂鸣器组件
interface BuzzerProps {
  active: boolean;
  frequency: number;
  soundPattern: 'continuous' | 'beep' | 'alarm' | 'melody';
  outputPin: string;
  className?: string;
}

export const BuzzerIndicator: React.FC<BuzzerProps> = ({
  active,
  frequency,
  soundPattern,
  outputPin,
  className
}) => {
  return (
    <div className={cn('p-3 border rounded-lg', className)}>
      <div className="text-sm font-medium mb-2 text-center">蜂鸣器控制</div>
      <div className="flex flex-col items-center space-y-2">
        <div 
          className={cn(
            'w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all duration-300',
            active 
              ? 'bg-yellow-400 border-yellow-600 shadow-lg shadow-yellow-400/50 animate-pulse' 
              : 'bg-gray-200 border-gray-400'
          )}
        >
          <div className="text-xs font-bold">
            {active ? '♪' : '○'}
          </div>
        </div>
        <div className="text-xs text-center space-y-1">
          <div>引脚: {outputPin}</div>
          <div>频率: {frequency}Hz</div>
          <div>模式: {soundPattern}</div>
          <div className={cn('font-bold', active ? 'text-yellow-600' : 'text-gray-500')}>
            {active ? '发声中' : '静音'}
          </div>
        </div>
      </div>
    </div>
  );
};
