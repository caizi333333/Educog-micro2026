'use client';

import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MemoryViewProps {
  memoryData: number[]; // Array of 256 bytes for RAM
  sp: number; // Stack Pointer
  updatedAddress: number | null;
}

export const MemoryView = memo(({ memoryData, sp, updatedAddress }: MemoryViewProps) => {
  const renderMemoryCells = useMemo(() => () => {
    const rows = [];
    for (let i = 0; i < 8; i++) { // Display only the first 128 bytes (00H-7FH)
      const cells = [];
      for (let j = 0; j < 16; j++) {
        const address = i * 16 + j;
        const value = memoryData[address] ?? 0;
        const isSp = address === sp;
        const isUpdated = address === updatedAddress;

        cells.push(
          <div
            key={j}
            className={cn(
              'w-12 h-9 flex items-center justify-center text-xs font-mono font-bold rounded-lg border-2 shadow-md transition-all duration-200 hover:shadow-lg',
              isSp && 'bg-gradient-to-br from-blue-400/90 to-blue-600/90 border-blue-700 text-white shadow-blue-500/50',
              isUpdated && 'bg-gradient-to-br from-amber-400/90 to-orange-500/90 border-amber-600 text-white animate-pulse shadow-amber-500/50',
              !isSp && !isUpdated && 'bg-gradient-to-br from-slate-100/90 to-slate-200/90 dark:from-slate-700/90 dark:to-slate-600/90 border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-300 hover:from-slate-200/90 hover:to-slate-300/90 dark:hover:from-slate-600/90 dark:hover:to-slate-500/90'
            )}
            title={`地址: 0x${address.toString(16).toUpperCase().padStart(2, '0')}`}
          >
            {value.toString(16).toUpperCase().padStart(2, '0')}
          </div>
        );
      }
      rows.push(<div key={i} className="flex gap-2">{cells}</div>);
    }
    return rows;
  }, [memoryData, sp, updatedAddress]);

  return (
    <Card className="border-2 border-slate-300/80 dark:border-slate-600/80 bg-gradient-to-br from-white/95 to-slate-50/95 dark:from-slate-900/95 dark:to-slate-800/95 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300">
      <CardHeader className="px-4 py-4 bg-gradient-to-r from-slate-50/90 to-indigo-50/90 dark:from-slate-800/90 dark:to-indigo-900/30 border-b-2 border-slate-300/80 dark:border-slate-600/80 shadow-lg rounded-t-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
            <span className="text-white font-mono text-sm font-bold drop-shadow-sm">RAM</span>
          </div>
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-none tracking-wide drop-shadow-sm">内存监视器 (RAM: 00H-7FH)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <div className="flex gap-4">
          <div className="flex flex-col gap-2 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 bg-gradient-to-b from-slate-100/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-700/90 px-3 py-2 rounded-lg border-2 border-slate-300/80 dark:border-slate-600/80 shadow-md">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-9 flex items-center justify-center">{`${(i * 16).toString(16).toUpperCase().padStart(2, '0')}`}</div>
            ))}
          </div>
          <div className="flex-grow space-y-2 bg-gradient-to-br from-slate-50/90 to-gray-50/90 dark:from-slate-800/90 dark:to-gray-800/90 p-3 rounded-lg border-2 border-slate-300/80 dark:border-slate-600/80 shadow-md">
            {renderMemoryCells()}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-6 text-sm bg-gradient-to-r from-slate-100/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-700/90 px-4 py-3 rounded-lg border-2 border-slate-300/80 dark:border-slate-600/80 shadow-md">
            <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-blue-700 shadow-lg"></div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">堆栈指针 (SP)</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-amber-600 shadow-lg animate-pulse"></div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">最近更新</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
});

MemoryView.displayName = 'MemoryView';