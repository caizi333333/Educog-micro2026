'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, BookOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  knowledgePoints,
  getPointsByChapter,
  getChildPoints,
  knowledgePointStats,
  type KnowledgePoint,
} from '@/lib/knowledge-points';

const chapterNames: Record<number, string> = {
  1: '单片机概述',
  2: '硬件结构',
  3: '存储器组织',
  4: 'I/O端口',
  5: '寻址方式与指令系统',
  6: '汇编语言程序设计',
  7: '定时器/计数器',
  8: '中断系统',
  9: '串行通信',
  10: '综合应用与项目实践',
};

const levelColors: Record<number, string> = {
  1: 'bg-chart-1/10 text-chart-1 border-chart-1',
  2: 'bg-chart-2/10 text-chart-2 border-chart-2',
  3: 'bg-chart-3/10 text-chart-3 border-chart-3',
};

function TreeNode({ point, searchQuery }: { point: KnowledgePoint; searchQuery: string }) {
  const [expanded, setExpanded] = useState(point.level === 1);
  const children = useMemo(() => getChildPoints(point.id), [point.id]);
  const hasChildren = children.length > 0;

  const matchesSearch = searchQuery
    ? point.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (point.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    : true;

  const childMatchesSearch = searchQuery
    ? children.some(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          getChildPoints(c.id).some(
            (gc) =>
              gc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (gc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
          )
      )
    : true;

  if (searchQuery && !matchesSearch && !childMatchesSearch) {
    return null;
  }

  const isAutoExpanded = searchQuery ? (matchesSearch || childMatchesSearch) : expanded;

  return (
    <div className={point.level === 1 ? 'mb-1' : ''}>
      <div
        className={`flex items-start gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
          point.level === 1 ? 'font-semibold' : point.level === 2 ? 'pl-6 font-medium' : 'pl-10 text-sm text-muted-foreground'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren ? (
          isAutoExpanded ? (
            <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${levelColors[point.level]}`}>
              {point.id}
            </Badge>
            <span className="truncate">{point.name}</span>
          </div>
          {point.level === 3 && point.description && isAutoExpanded && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{point.description}</p>
          )}
        </div>
      </div>
      {isAutoExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.id} point={child} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgePointTree({ selectedChapter }: { selectedChapter?: number }) {
  const [searchQuery, setSearchQuery] = useState('');

  const topLevelPoints = useMemo(() => {
    if (selectedChapter) {
      return getPointsByChapter(selectedChapter).filter((p) => p.level === 1);
    }
    return knowledgePoints.filter((p) => p.level === 1);
  }, [selectedChapter]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b text-xs text-muted-foreground">
        <span>共 <strong className="text-foreground">{knowledgePointStats.total}</strong> 个知识点</span>
        <span className="text-chart-1">一级 {knowledgePointStats.level1}</span>
        <span className="text-chart-2">二级 {knowledgePointStats.level2}</span>
        <span className="text-chart-3">三级 {knowledgePointStats.level3}</span>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {topLevelPoints.map((point) => (
            <TreeNode key={point.id} point={point} searchQuery={searchQuery} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
