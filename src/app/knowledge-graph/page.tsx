'use client';

import { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KnowledgeGraphComponent, type KnowledgeGraphRef } from './graph-component';
import { RotateCcw, Network, List, ChevronRight, ChevronDown, BookOpen, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  problemGraph,
  problemGraphStats,
  getChildProblems,
  type ProblemNode,
} from '@/lib/problem-graph';
import {
  ideologicalNodes,
  sipMappings,
  ideologicalGraphStats,
  categoryMeta,
} from '@/lib/ideological-graph';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgePointTree } from '@/components/knowledge-graph/KnowledgePointTree';

const chapterToNodeMapping: Record<string, string[]> = {
  ch1: ['mcu', 'cpu', 'memory', 'io', 'timers', 'interrupts', 'uart'],
  ch2: ['memory', 'harvard', 'program_mem', 'data_mem', 'internal_ram', 'sfr', 'register_banks', 'bit_addr_ram', 'general_ram'],
  ch3: ['io', 'p0', 'p1', 'p2', 'p3'],
  ch4: ['assembly', 'addressing_modes', 'immediate_addr', 'direct_addr', 'register_addr', 'indirect_addr'],
  ch5: ['timers', 'tmod', 'tcon', 'timer_mode1', 'timer_mode2'],
  ch6: ['interrupts', 'ie', 'ip', 'isr', 'int_sources', 'ext_int0', 'timer0_int', 'ext_int1', 'timer1_int', 'p3'],
  ch7: ['led_scan', 'io', 'timers'],
  ch8: ['adc_app', 'io'],
  ch9: ['uart', 'scon', 'sbuf', 'timers', 'timer_mode2'],
};

const chapters = [
  { value: 'ch1', label: '第 1 章：绪论' },
  { value: 'ch2', label: '第 2 章：8051 单片机结构' },
  { value: 'ch3', label: '第 3 章：8051 指令系统与寻址方式' },
  { value: 'ch4', label: '第 4 章：I/O 端口编程' },
  { value: 'ch5', label: '第 5 章：定时器/计数器应用' },
  { value: 'ch6', label: '第 6 章：中断系统设计' },
  { value: 'ch7', label: '第 7 章：显示技术与数码管应用' },
  { value: 'ch8', label: '第 8 章：模数转换与数据采集' },
  { value: 'ch9', label: '第 9 章：串行通信与网络接口' },
];

// ---------------------------------------------------------------------------
// Difficulty color helpers for Problem Graph
// ---------------------------------------------------------------------------
const difficultyColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  easy:   { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', label: '简单' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', label: '中等' },
  hard:   { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: '困难' },
};

const categoryLabels: Record<string, string> = {
  concept: '概念理解',
  coding: '编程实践',
  experiment: '实验操作',
  project: '项目综合',
};

// ---------------------------------------------------------------------------
// Problem Graph Tree Node
// ---------------------------------------------------------------------------
function ProblemTreeNode({ node }: { node: ProblemNode }) {
  const [expanded, setExpanded] = useState(node.level === 1);
  const children = getChildProblems(node.id);
  const hasChildren = children.length > 0;
  const diff = difficultyColors[node.difficulty];

  return (
    <div className={cn("ml-0", node.level === 2 && "ml-4", node.level === 3 && "ml-8")}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 py-2 px-3 rounded-lg text-left transition-colors",
          "hover:bg-[#313244]/50",
          hasChildren && "cursor-pointer",
          !hasChildren && "cursor-default"
        )}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-4 h-4 text-[#6c7086] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#6c7086] flex-shrink-0" />
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className={cn("font-mono text-xs px-1.5 py-0.5 rounded", diff.bg, diff.text)}>{node.id}</span>
        <span className={cn("text-sm flex-1", node.level === 1 ? "font-semibold text-[#cdd6f4]" : "text-[#bac2de]")}>{node.name}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", diff.bg, diff.text, diff.border)}>{diff.label}</span>
      </button>
      {expanded && hasChildren && (
        <div className="border-l border-[#313244]/50 ml-5">
          {children.map(child => <ProblemTreeNode key={child.id} node={child} />)}
        </div>
      )}
      {expanded && !hasChildren && node.description && (
        <div className="ml-10 mb-2 px-3 py-2 text-xs text-[#a6adc8] bg-[#181825] rounded-lg border border-[#313244]/50">
          <p>{node.description}</p>
          {node.solution && <p className="mt-1 text-[#89b4fa]">提示: {node.solution}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Problem Graph View
// ---------------------------------------------------------------------------
function ProblemGraphView() {
  const l1Nodes = problemGraph.filter(n => n.level === 1);

  return (
    <div className="h-full bg-[#1e1e2e] flex flex-col">
      {/* Stats bar */}
      <div className="flex gap-4 px-4 py-3 border-b border-[#313244] bg-[#181825] flex-shrink-0 flex-wrap">
        <div className="text-xs text-[#6c7086]">
          共 <span className="text-[#cdd6f4] font-semibold">{problemGraphStats.level3}</span> 个具体问题
        </div>
        <div className="flex gap-3 text-xs">
          {Object.entries(problemGraphStats.byDifficulty).map(([k, v]) => {
            const d = difficultyColors[k];
            return <span key={k} className={d.text}>{d.label}: {v}</span>;
          })}
        </div>
        <div className="flex gap-3 text-xs text-[#6c7086]">
          {Object.entries(problemGraphStats.byCategory).map(([k, v]) => (
            <span key={k}>{categoryLabels[k]}: {v}</span>
          ))}
        </div>
      </div>
      {/* Tree */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-1">
          {l1Nodes.map(node => <ProblemTreeNode key={node.id} node={node} />)}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ideological Graph View
// ---------------------------------------------------------------------------
function IdeologicalGraphView() {
  const [activeTab, setActiveTab] = useState<'categories' | 'mapping'>('categories');
  const l1Nodes = ideologicalNodes.filter(n => n.level === 1);

  return (
    <div className="h-full bg-[#1e1e2e] flex flex-col">
      {/* Stats + sub-tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#313244] bg-[#181825] flex-shrink-0">
        <div className="text-xs text-[#6c7086]">
          <span className="text-[#cdd6f4] font-semibold">{ideologicalGraphStats.totalCategories}</span> 个主题 /
          <span className="text-[#cdd6f4] font-semibold ml-1">{ideologicalGraphStats.totalElements}</span> 个思政元素 /
          <span className="text-[#cdd6f4] font-semibold ml-1">{ideologicalGraphStats.totalWeeklyMappings}</span> 周教学映射
        </div>
        <div className="flex gap-1 bg-[#11111b] rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('categories')}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              activeTab === 'categories' ? "bg-[#313244] text-[#cdd6f4]" : "text-[#6c7086] hover:text-[#a6adc8]"
            )}
          >
            分类视图
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              activeTab === 'mapping' ? "bg-[#313244] text-[#cdd6f4]" : "text-[#6c7086] hover:text-[#a6adc8]"
            )}
          >
            周次映射
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'categories' ? (
          <div className="p-4 space-y-4">
            {l1Nodes.map(parent => {
              const meta = categoryMeta[parent.category];
              const children = ideologicalNodes.filter(n => n.parentId === parent.id);
              return (
                <div key={parent.id} className="rounded-xl border border-[#313244] overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `4px solid ${meta.color}` }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                      {parent.id}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#cdd6f4]">{parent.name}</div>
                      <div className="text-xs text-[#6c7086] mt-0.5">{parent.description}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                      {children.length} 个元素
                    </span>
                  </div>
                  {/* Children */}
                  <div className="border-t border-[#313244]/50 divide-y divide-[#313244]/30">
                    {children.map(child => (
                      <div key={child.id} className="px-4 py-2.5 pl-8 hover:bg-[#313244]/20 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: meta.color + '15', color: meta.color }}>
                            {child.id}
                          </span>
                          <span className="text-sm text-[#bac2de]">{child.name}</span>
                        </div>
                        <p className="text-xs text-[#6c7086] mt-1 ml-0">{child.description}</p>
                        {child.caseStudy && (
                          <p className="text-xs mt-1 ml-0" style={{ color: meta.color }}>
                            案例: {child.caseStudy}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Week-by-week mapping table */
          <div className="p-4">
            <div className="rounded-xl border border-[#313244] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#181825] text-[#6c7086] text-xs">
                    <th className="text-left px-3 py-2.5 font-medium w-[70px]">周次</th>
                    <th className="text-left px-3 py-2.5 font-medium">知识点</th>
                    <th className="text-left px-3 py-2.5 font-medium">思政主题</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">教学方法</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden xl:table-cell">预期成效</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#313244]/30">
                  {sipMappings.map((mapping, i) => (
                    <tr key={i} className="hover:bg-[#313244]/20 transition-colors">
                      <td className="px-3 py-2.5 text-[#89b4fa] font-mono text-xs whitespace-nowrap">{mapping.weekRange}</td>
                      <td className="px-3 py-2.5 text-[#cdd6f4] text-xs">{mapping.knowledgePointName}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#89b4fa]/10 text-[#89b4fa]">
                          {mapping.ideologicalTheme}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#a6adc8] hidden lg:table-cell">{mapping.teachingMethod}</td>
                      <td className="px-3 py-2.5 text-xs text-[#6c7086] hidden xl:table-cell">{mapping.expectedOutcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function KnowledgeGraphContent() {
  const graphRef = useRef<KnowledgeGraphRef>(null);
  const searchParams = useSearchParams();
  const chapterFromQuery = searchParams?.get('chapter');
  const nodeFromQuery = searchParams?.get('node');

  const [selectedChapter, setSelectedChapter] = useState('');
  const [highlightNode, setHighlightNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [graphType, setGraphType] = useState<'knowledge' | 'problem' | 'ideological'>('knowledge');

  const nodeToChapterMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const chapterKey in chapterToNodeMapping) {
      const chapterNumber = chapterKey.replace('ch', '');
      for (const nodeId of chapterToNodeMapping[chapterKey] || []) {
        if (!map[nodeId]) map[nodeId] = chapterNumber;
      }
    }
    return map;
  }, []);

  useEffect(() => {
    if (chapterFromQuery) { setSelectedChapter(chapterFromQuery); setHighlightNode(null); }
    else if (nodeFromQuery) { setHighlightNode(nodeFromQuery); setSelectedChapter(''); }
    else { setSelectedChapter(''); setHighlightNode(null); }
  }, [chapterFromQuery, nodeFromQuery]);

  const handleReset = () => {
    graphRef.current?.reset();
    setSelectedChapter('');
    setHighlightNode(null);
  };

  const handleChapterSelect = (chapter: string) => {
    setSelectedChapter(chapter);
    setHighlightNode(null);
  };

  const filterHighlightIds = useMemo(() => {
    if (!selectedChapter || !chapterToNodeMapping[selectedChapter]) return null;
    return new Set(chapterToNodeMapping[selectedChapter]);
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedChapter && chapterToNodeMapping[selectedChapter]) graphRef.current?.reset();
  }, [selectedChapter]);

  const initialNode = filterHighlightIds ? null : highlightNode;

  return (
    <div className="flex flex-col gap-4 w-full -m-6 -mt-4 p-4 h-[calc(100vh-3.5rem)] bg-[#0d0d14]">
      {/* Graph type selector */}
      <div className="flex border-b border-[#313244] bg-[#181825] flex-shrink-0 rounded-t-xl">
        {([
          { key: 'knowledge' as const, label: '学科知识图谱', icon: Network },
          { key: 'problem' as const, label: '问题图谱', icon: BookOpen },
          { key: 'ideological' as const, label: '思政图谱', icon: Flag },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setGraphType(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all border-b-2",
              graphType === tab.key
                ? "border-[#89b4fa] text-[#89b4fa] bg-[#89b4fa]/5"
                : "border-transparent text-[#6c7086] hover:text-[#a6adc8] hover:bg-[#313244]/30"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Controls bar - only for knowledge graph type */}
      {graphType === 'knowledge' && (
      <div className="flex flex-wrap gap-3 justify-between items-center flex-shrink-0 px-2">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'graph' | 'list')}>
          <TabsList className="bg-[#1e1e2e] border border-[#313244]">
            <TabsTrigger value="graph" className="gap-1.5 data-[state=active]:bg-[#313244]">
              <Network className="h-4 w-4" />
              图谱视图
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5 data-[state=active]:bg-[#313244]">
              <List className="h-4 w-4" />
              知识点列表
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={selectedChapter} onValueChange={handleChapterSelect}>
            <SelectTrigger className="w-auto min-w-[200px] bg-[#1e1e2e] border-[#313244]">
              <SelectValue placeholder="按章节筛选..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-[#313244]">
              {chapters.map(ch => (
                <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode === 'graph' && (
            <Button variant="outline" onClick={handleReset} className="bg-[#1e1e2e] border-[#313244] hover:bg-[#313244]">
              <RotateCcw className="mr-2 h-4 w-4" />
              重置视图
            </Button>
          )}
        </div>
      </div>
      )}

      {/* Graph area */}
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-[#313244]">
        {graphType === 'knowledge' && (
          viewMode === 'graph' ? (
            <KnowledgeGraphComponent
              ref={graphRef}
              filterHighlightIds={filterHighlightIds}
              initialSelectedNodeId={initialNode}
              nodeToChapterMap={nodeToChapterMap}
            />
          ) : (
            <div className="h-full bg-[#1e1e2e]">
              <KnowledgePointTree
                selectedChapter={selectedChapter ? parseInt(selectedChapter.replace('ch', '')) : undefined}
              />
            </div>
          )
        )}
        {graphType === 'problem' && <ProblemGraphView />}
        {graphType === 'ideological' && <IdeologicalGraphView />}
      </div>
    </div>
  );
}

export default function KnowledgeGraphPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-4 -m-6 -mt-4 p-4 h-[calc(100vh-3.5rem)] bg-[#0d0d14]">
        <div className="flex gap-3 justify-end items-center">
          <div className="w-[200px] h-10 bg-[#1e1e2e] animate-pulse rounded-md" />
          <div className="w-24 h-10 bg-[#1e1e2e] animate-pulse rounded-md" />
        </div>
        <div className="flex-1 rounded-xl border border-[#313244] bg-[#0d0d14] flex items-center justify-center">
          <div className="text-[#585b70]">加载中...</div>
        </div>
      </div>
    }>
      <KnowledgeGraphContent />
    </Suspense>
  );
}
