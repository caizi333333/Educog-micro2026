'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ComponentType, CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Cpu,
  ExternalLink,
  FileText,
  GitBranch,
  Flag,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Link2,
  ListTree,
  Monitor,
  Network,
  PlayCircle,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { knowledgePoints, type KnowledgePoint, type KnowledgePointResource } from '@/lib/knowledge-points';
import { fetchHyperJson, normalizeLearningProgress, type HyperLearningProgressRecord } from '@/lib/hyper-data';
import { problemGraph, problemGraphStats, type ProblemNode } from '@/lib/problem-graph';
import {
  categoryMeta,
  ideologicalGraphStats,
  ideologicalNodes,
  sipMappings,
  type IdeologicalCategory,
  type IdeologicalNode,
} from '@/lib/ideological-graph';
import { cn } from '@/lib/utils';
type GraphView = 'knowledge' | 'problem' | 'ideological';

const graphViews: Array<{ id: GraphView; label: string; count: number }> = [
  { id: 'knowledge', label: '专业知识图谱', count: knowledgePoints.length },
  { id: 'problem', label: '问题图谱', count: problemGraph.length },
  { id: 'ideological', label: '思政图谱', count: ideologicalNodes.length },
];

function parseChapterParam(value: string | null): number | 'all' | null {
  if (!value || value === 'all') return value === 'all' ? 'all' : null;
  const matched = value.match(/\d+/);
  if (!matched) return null;
  const chapter = Number(matched[0]);
  return Number.isInteger(chapter) && chapter > 0 ? chapter : null;
}

function isGraphView(value: string | null): value is GraphView {
  return value === 'knowledge' || value === 'problem' || value === 'ideological';
}

const problemCategoryMeta: Record<ProblemNode['category'], { label: string; icon: ComponentType<{ className?: string }>; tone: string }> = {
  concept: { label: '概念理解', icon: AlertTriangle, tone: 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100' },
  coding: { label: '编程实现', icon: Code2, tone: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100' },
  experiment: { label: '实验排障', icon: Target, tone: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100' },
  project: { label: '项目设计', icon: GitBranch, tone: 'border-violet-300/25 bg-violet-300/[0.08] text-violet-100' },
};

const difficultyTone: Record<ProblemNode['difficulty'], string> = {
  easy: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100',
  medium: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100',
  hard: 'border-red-300/25 bg-red-300/[0.08] text-red-100',
};

const ideologicalIconMap: Record<IdeologicalCategory, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  patriotism: Flag,
  craftsmanship: Target,
  ethics: ShieldCheck,
  innovation: Lightbulb,
  teamwork: Users,
  aerospace: Rocket,
};

function knowledgeNodeDomId(id: string) {
  return `kg-node-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function progressForChapter(progress: HyperLearningProgressRecord[], chapter: number) {
  const chapterKey = `ch${chapter}`;
  const records = progress.filter((item) => item.chapterId === chapterKey || item.chapterId === String(chapter));
  if (records.length === 0) return null;
  return Math.round(records.reduce((sum, item) => sum + (item.progress || 0), 0) / records.length);
}

const RESOURCE_META: Record<KnowledgePointResource['type'], { label: string; icon: LucideIcon }> = {
  video: { label: '视频', icon: PlayCircle },
  animation: { label: '动画', icon: Zap },
  slide: { label: '课件', icon: Monitor },
  quiz: { label: '测验', icon: CheckCircle2 },
  document: { label: '文档', icon: FileText },
  experiment: { label: '实验', icon: Cpu },
  image: { label: '图样', icon: ImageIcon },
};

function hrefForKgResource(resource: KnowledgePointResource): string | null {
  if (resource.url) return resource.url;
  if (resource.type === 'experiment' && resource.refId) return `/simulation?experiment=${encodeURIComponent(resource.refId)}`;
  if (resource.type === 'quiz') return '/quiz';
  return null;
}

function isInlineImage(resource: KnowledgePointResource): boolean {
  if (resource.type !== 'image' || !resource.url) return false;
  const url = resource.url.toLowerCase();
  return url.endsWith('.svg') || url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp');
}

function isMediaResource(resource: KnowledgePointResource): boolean {
  if (!resource.url) return false;
  if (resource.type === 'video') return true;
  const url = resource.url.toLowerCase();
  return url.endsWith('.pdf') || url.includes('/player.');
}

function getNextPoint(current: KnowledgePoint, all: KnowledgePoint[]): KnowledgePoint | null {
  const idx = all.findIndex((p) => p.id === current.id);
  if (idx < 0 || idx === all.length - 1) return null;
  return all[idx + 1];
}

function DetailPanel({
  point,
  childPoints,
  pointById,
  experimentTitleByRefId,
  onSelectId,
}: {
  point: KnowledgePoint | null;
  childPoints: KnowledgePoint[];
  pointById: Record<string, KnowledgePoint>;
  experimentTitleByRefId: Record<string, string>;
  onSelectId: (id: string) => void;
}) {
  if (!point) {
    return (
      <aside className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-sm text-slate-400">
        在画布或左侧列表选中一个节点，这里会展示节点说明、前置知识、配套资源、应用实验和下一节点的推荐路径。
      </aside>
    );
  }

  const resources = point.resources || [];
  const inlineImages = resources.filter(isInlineImage);
  const mediaResources = resources.filter(isMediaResource);
  const otherResources = resources.filter((r) => !inlineImages.includes(r) && !mediaResources.includes(r));
  const prereqs = (point.prerequisites || [])
    .map((id) => pointById[id])
    .filter((p): p is KnowledgePoint => Boolean(p));
  const appliedExperiments = (point.appliedIn || []).map((refId) => ({
    refId,
    title: experimentTitleByRefId[refId] || refId,
  }));
  const parent = point.parentId ? pointById[point.parentId] : null;
  const nextPoint = getNextPoint(point, knowledgePoints);

  return (
    <aside className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
      <div className="border-b border-white/[0.08] p-5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-200">
          <span>NODE · CH{point.chapter}</span>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">L{point.level}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">#{point.id}</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">{point.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{point.description || '该节点暂无详细说明。'}</p>
        {parent && (
          <button
            type="button"
            onClick={() => onSelectId(parent.id)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-200"
          >
            <Layers className="h-3 w-3" />
            上级：{parent.name}
          </button>
        )}
      </div>

      {prereqs.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <Link2 className="h-3.5 w-3.5" />
            前置知识
          </div>
          <div className="space-y-1.5">
            {prereqs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectId(p.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-cyan-100"
              >
                <span className="line-clamp-1">{p.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">CH{p.chapter} · #{p.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {inlineImages.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <ImageIcon className="h-3.5 w-3.5" />
            图样
          </div>
          <div className="space-y-3">
            {inlineImages.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-md border border-white/[0.08] bg-white"
              >
                <img src={resource.url} alt={resource.title} className="block w-full" loading="lazy" />
                <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#0c1117] px-3 py-2 text-[11px] text-slate-300 group-hover:text-cyan-100">
                  <span className="line-clamp-1">{resource.title}</span>
                  <ExternalLink className="ml-2 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {mediaResources.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <PlayCircle className="h-3.5 w-3.5" />
            视频 / PDF
          </div>
          <div className="space-y-3">
            {mediaResources.slice(0, 2).map((resource) => (
              <div key={`${resource.type}-${resource.title}-${resource.url}`} className="overflow-hidden rounded-md border border-white/[0.08] bg-black/25">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2 text-xs text-slate-300">
                  <span className="line-clamp-1">{resource.title}</span>
                  <a href={resource.url} target="_blank" rel="noreferrer" className="ml-2 shrink-0 text-slate-500 hover:text-cyan-200">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <iframe
                  src={resource.url}
                  title={resource.title}
                  className="h-44 w-full bg-black"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {otherResources.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <BookOpen className="h-3.5 w-3.5" />
            配套资源
          </div>
          <div className="space-y-1.5">
            {otherResources.map((resource) => {
              const meta = RESOURCE_META[resource.type];
              const Icon = meta.icon;
              const href = hrefForKgResource(resource);
              const inner = (
                <>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                  <span className="min-w-0 flex-1 truncate text-slate-200 group-hover:text-cyan-100">{resource.title}</span>
                  <span className="shrink-0 rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{meta.label}</span>
                </>
              );
              const baseCls = 'group flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-xs hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]';
              if (!href) {
                return (
                  <div key={`${resource.type}-${resource.title}`} className={cn(baseCls, 'cursor-default opacity-70')}>
                    {inner}
                  </div>
                );
              }
              if (href.startsWith('http') || href.startsWith('/')) {
                return (
                  <a key={`${resource.type}-${resource.title}`} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={baseCls}>
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={`${resource.type}-${resource.title}`} href={href} className={baseCls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {appliedExperiments.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            应用于实验
          </div>
          <div className="space-y-1.5">
            {appliedExperiments.map((exp) => (
              <Link
                key={exp.refId}
                href={`/simulation?experiment=${encodeURIComponent(exp.refId)}`}
                className="group flex items-center justify-between gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-2 text-xs text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-300/[0.08]"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
                  <span className="line-clamp-1">{exp.title}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-emerald-300">{exp.refId}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {childPoints.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <ListTree className="h-3.5 w-3.5" />
            下级节点 · {childPoints.length}
          </div>
          <div className="space-y-1">
            {childPoints.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectId(c.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              >
                <span className="line-clamp-1">{c.name}</span>
                <span className="font-mono text-[10px] text-slate-600">L{c.level}</span>
              </button>
            ))}
            {childPoints.length > 6 && (
              <div className="px-3 pt-1 font-mono text-[10px] text-slate-600">+{childPoints.length - 6} 个</div>
            )}
          </div>
        </div>
      )}

      {nextPoint && (
        <div className="p-5">
          <button
            type="button"
            onClick={() => onSelectId(nextPoint.id)}
            className="group flex w-full items-center justify-between gap-3 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-3 text-left hover:border-cyan-300/45 hover:bg-cyan-300/[0.10]"
          >
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-300">下一节点</div>
              <div className="mt-1 truncate text-sm font-medium text-slate-100">{nextPoint.name}</div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">CH{nextPoint.chapter} · L{nextPoint.level} · #{nextPoint.id}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </aside>
  );
}

function problemNodeDomId(id: string) {
  return `problem-node-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function ideologicalNodeDomId(id: string) {
  return `sip-node-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function truncateLabel(value: string, max = 9) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

type VisualEdge = {
  from: string;
  to: string;
  color?: string;
  width?: number;
  dashed?: boolean;
};

type GraphTone = 'cyan' | 'emerald' | 'amber' | 'red' | 'violet' | 'slate';
type GraphNodeSize = 'core' | 'root' | 'branch' | 'leaf' | 'chapter';

const graphTone: Record<GraphTone, { color: string; bg: string; border: string; text: string; minimap: string }> = {
  cyan: { color: '#67e8f9', bg: 'rgba(8, 145, 178, 0.16)', border: 'rgba(103, 232, 249, 0.38)', text: '#cffafe', minimap: '#06b6d4' },
  emerald: { color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(110, 231, 183, 0.34)', text: '#d1fae5', minimap: '#10b981' },
  amber: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(251, 191, 36, 0.34)', text: '#fef3c7', minimap: '#f59e0b' },
  red: { color: '#f87171', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(248, 113, 113, 0.34)', text: '#fee2e2', minimap: '#ef4444' },
  violet: { color: '#c084fc', bg: 'rgba(168, 85, 247, 0.14)', border: 'rgba(192, 132, 252, 0.36)', text: '#f3e8ff', minimap: '#a855f7' },
  slate: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.22)', text: '#cbd5e1', minimap: '#64748b' },
};

const graphNodeSize: Record<GraphNodeSize, { width: number; height: number }> = {
  core: { width: 154, height: 52 },
  root: { width: 148, height: 48 },
  branch: { width: 126, height: 38 },
  leaf: { width: 92, height: 26 },
  chapter: { width: 58, height: 26 },
};

type MapNodeData = {
  label: string;
  subtitle?: string;
  levelLabel?: string;
  tone: GraphTone;
  size: GraphNodeSize;
  selected: boolean;
  visible: boolean;
  clickable?: boolean;
  [key: string]: unknown;
};

type MapGroupData = {
  label: string;
  subtitle?: string;
  tone: GraphTone;
  width: number;
  height: number;
  [key: string]: unknown;
};

function getGraphNodeSize(size: GraphNodeSize) {
  return graphNodeSize[size];
}

function createMapNode(
  id: string,
  centerX: number,
  centerY: number,
  data: MapNodeData,
): RFNode<MapNodeData> {
  const size = getGraphNodeSize(data.size);
  const zIndex = data.selected ? 80 : data.size === 'root' || data.size === 'core' ? 40 : data.size === 'branch' ? 30 : 20;
  return {
    id,
    type: 'mapNode',
    position: { x: centerX - size.width / 2, y: centerY - size.height / 2 },
    data,
    draggable: false,
    style: { zIndex },
  };
}

function createMapGroup(
  id: string,
  x: number,
  y: number,
  data: MapGroupData,
): RFNode<MapGroupData> {
  return {
    id,
    type: 'mapGroup',
    position: { x, y },
    data,
    draggable: false,
    selectable: false,
    style: { zIndex: 0 },
  };
}

function MapGroupNode({ data }: NodeProps<RFNode<MapGroupData>>) {
  const tone = graphTone[data.tone];
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        borderColor: tone.border,
        background: `linear-gradient(135deg, ${tone.bg}, rgba(2, 6, 23, 0.2))`,
      }}
      className="rounded-lg border border-dashed px-4 py-3"
    >
      <div className="font-mono text-[11px] font-semibold text-slate-300">{data.label}</div>
      {data.subtitle && <div className="mt-1 font-mono text-[10px]" style={{ color: tone.color }}>{data.subtitle}</div>}
    </div>
  );
}

function MapNode({ data }: NodeProps<RFNode<MapNodeData>>) {
  const tone = graphTone[data.tone];
  const size = getGraphNodeSize(data.size);
  const isLeaf = data.size === 'leaf';
  const opacity = data.visible || data.selected ? 1 : 0.17;
  const labelMax = data.size === 'root' || data.size === 'core' ? 10 : data.size === 'branch' ? 9 : 7;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <div
        className={cn(
          'flex h-full w-full items-center gap-2 overflow-hidden rounded-md border px-2 text-left transition',
          data.clickable === false ? 'cursor-default' : 'cursor-pointer hover:scale-[1.03]',
          data.selected && 'scale-[1.08]',
          isLeaf ? 'justify-center' : 'justify-start',
        )}
        style={{
          width: size.width,
          height: size.height,
          opacity,
          color: tone.text,
          borderColor: data.selected ? '#f8fafc' : tone.border,
          background: data.selected
            ? `linear-gradient(135deg, ${tone.bg}, rgba(255,255,255,0.1))`
            : data.visible
              ? tone.bg
              : 'rgba(15, 23, 42, 0.65)',
          boxShadow: data.selected
            ? `0 0 0 1px rgba(248,250,252,0.4), 0 0 24px ${tone.color}55`
            : data.size === 'root' || data.size === 'core'
              ? `0 0 18px ${tone.color}20`
              : 'none',
        }}
      >
        {!isLeaf && (
          <span
            className="flex h-6 min-w-6 items-center justify-center rounded border font-mono text-[10px]"
            style={{ borderColor: tone.border, backgroundColor: 'rgba(0,0,0,0.22)', color: tone.color }}
          >
            {data.levelLabel}
          </span>
        )}
        <span className={cn('min-w-0 truncate', isLeaf ? 'text-[10px]' : 'text-xs font-semibold')}>
          {truncateLabel(data.label, labelMax)}
        </span>
        {data.subtitle && !isLeaf && (
          <span className="ml-auto shrink-0 font-mono text-[10px] opacity-70">{data.subtitle}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </>
  );
}

const mapNodeTypes = { mapNode: MapNode, mapGroup: MapGroupNode };

function GraphMapStage({
  nodes,
  edges,
  onSelect,
  heightClassName = 'h-[660px] md:h-[760px]',
}: {
  nodes: RFNode[];
  edges: RFEdge[];
  onSelect: (id: string) => void;
  heightClassName?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_32%),#05080d]', heightClassName)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={mapNodeTypes}
        onNodeClick={(_, node) => {
          if (node.type !== 'mapNode') return;
          if ((node.data as MapNodeData).clickable === false) return;
          onSelect(node.id);
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.14, maxZoom: 1.05 }}
        minZoom={0.18}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={0.85} color="rgba(148,163,184,0.08)" />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-white/[0.08] !bg-[#0c1117]/90 !shadow-xl"
        />
        <MiniMap
          nodeColor={(node) => graphTone[((node.data as MapNodeData)?.tone || 'slate') as GraphTone]?.minimap || '#64748b'}
          maskColor="rgba(2,6,23,0.58)"
          pannable
          zoomable
          className="!rounded-lg !border !border-white/[0.08] !bg-[#0c1117]/90 !shadow-xl"
          style={{ width: 158, height: 104 }}
        />
      </ReactFlow>
    </div>
  );
}

function graphEdge(
  from: string,
  to: string,
  tone: GraphTone,
  active = true,
  width = 1.2,
  dashed = false,
): RFEdge {
  const color = graphTone[tone].color;
  return {
    id: `${from}-${to}`,
    source: from,
    target: to,
    type: 'smoothstep',
    animated: active && width > 1.5,
    style: {
      stroke: color,
      strokeWidth: active ? width : 0.8,
      opacity: active ? 0.46 : 0.08,
      strokeDasharray: dashed ? '6 5' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
      width: active ? 14 : 8,
      height: active ? 14 : 8,
    },
  };
}

function knowledgeTone(chapter: number): GraphTone {
  const tones: GraphTone[] = ['cyan', 'emerald', 'amber', 'violet', 'red'];
  return tones[(chapter - 1) % tones.length] || 'cyan';
}

function problemTone(category: ProblemNode['category']): GraphTone {
  if (category === 'coding') return 'emerald';
  if (category === 'experiment') return 'amber';
  if (category === 'project') return 'violet';
  return 'cyan';
}

function ideologicalTone(category?: IdeologicalCategory): GraphTone {
  if (!category) return 'cyan';
  if (category === 'craftsmanship') return 'amber';
  if (category === 'ethics') return 'red';
  if (category === 'innovation') return 'emerald';
  if (category === 'teamwork') return 'violet';
  if (category === 'aerospace') return 'slate';
  return 'cyan';
}

type KnowledgeVisualNode = {
  id: string;
  label: string;
  subtitle?: string;
  level: KnowledgePoint['level'];
  chapter: number;
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
};

function FullKnowledgeMap({
  points,
  selectedId,
  visibleIds,
  progress,
  onSelect,
  chapterFilter,
}: {
  points: KnowledgePoint[];
  selectedId: string;
  visibleIds: Set<string>;
  progress: HyperLearningProgressRecord[];
  onSelect: (point: KnowledgePoint) => void;
  chapterFilter: number | 'all';
}) {
  const layout = useMemo(() => {
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const pointById: Record<string, KnowledgePoint> = {};
    points.forEach((p) => { pointById[p.id] = p; });
    const chapterNumbers = Array.from(new Set(points.map((point) => point.chapter))).sort((a, b) => a - b);

    if (chapterFilter === 'all') {
      // Compact 5x2 overview: each chapter is a small card with L1 root and L2 nodes
      // arrayed below it. L3 leaves are intentionally omitted to keep the canvas
      // scannable at fit-view zoom. Selecting a chapter from the sidebar drills into
      // the expanded single-chapter shelf below.
      const COL_COUNT = 5;
      const COL_W = 460;
      const ROW_H = 360;

      chapterNumbers.forEach((chapter, index) => {
        const col = index % COL_COUNT;
        const row = Math.floor(index / COL_COUNT);
        const cellX = 60 + col * COL_W;
        const cellY = 60 + row * ROW_H;
        const chapterPoints = points.filter((point) => point.chapter === chapter);
        const root = chapterPoints.find((point) => point.level === 1);
        const levelTwo = chapterPoints.filter((point) => point.level === 2);
        const tone = knowledgeTone(chapter);
        const chapterProgress = progressForChapter(progress, chapter);

        nodes.push(createMapGroup(`kg-card-${chapter}`, cellX, cellY, {
          label: `CH${chapter} · ${root?.name || '章节'}`,
          subtitle: chapterProgress === null
            ? `${chapterPoints.length} 个知识点 · ${levelTwo.length} 个二级`
            : `${chapterPoints.length} 个知识点 · 进度 ${chapterProgress}%`,
          tone,
          width: COL_W - 30,
          height: ROW_H - 30,
        }));

        if (root) {
          nodes.push(createMapNode(root.id, cellX + (COL_W - 30) / 2, cellY + 70, {
            label: root.name,
            subtitle: chapterProgress === null ? `CH${chapter}` : `${chapterProgress}%`,
            levelLabel: 'L1',
            tone,
            size: 'root',
            selected: root.id === selectedId,
            visible: visibleIds.has(root.id),
          }));
        }

        const cols = Math.min(3, Math.max(1, levelTwo.length));
        levelTwo.forEach((parent, parentIndex) => {
          const c = parentIndex % cols;
          const r = Math.floor(parentIndex / cols);
          const px = cellX + 50 + c * ((COL_W - 130) / Math.max(cols, 1));
          const py = cellY + 170 + r * 56;
          nodes.push(createMapNode(parent.id, px, py, {
            label: parent.name,
            levelLabel: 'L2',
            tone,
            size: 'branch',
            selected: parent.id === selectedId,
            visible: visibleIds.has(parent.id),
          }));
          if (root) {
            edges.push(graphEdge(root.id, parent.id, tone, visibleIds.has(root.id) && visibleIds.has(parent.id), 1.2));
          }
        });
      });
    } else {
      // Single-chapter expanded shelf: L1 anchor on left, L2 in a row to its right,
      // each L2's L3 leaves stacked tightly below it. Full canvas width + height to
      // a single chapter for readable detail.
      const chapter = chapterFilter;
      const chapterPoints = points.filter((point) => point.chapter === chapter);
      const root = chapterPoints.find((point) => point.level === 1);
      const levelTwo = chapterPoints.filter((point) => point.level === 2);
      const tone = knowledgeTone(chapter);
      const chapterProgress = progressForChapter(progress, chapter);

      const SHELF_X = 80;
      const ROOT_X = 130;
      const L2_START_X = 340;
      const L2_GAP_X = 200;
      const L3_OFFSET_Y = 90;
      const L3_GAP_Y = 40;
      const maxL3 = Math.max(0, ...levelTwo.map((p) => points.filter((c) => c.parentId === p.id).length));
      const shelfWidth = Math.max(1100, L2_START_X + Math.max(levelTwo.length, 1) * L2_GAP_X + 60);
      const shelfHeight = Math.max(280, L3_OFFSET_Y + maxL3 * L3_GAP_Y + 80);

      nodes.push(createMapGroup(`kg-shelf-${chapter}`, SHELF_X - 40, 50, {
        label: `CH${chapter} · ${root?.name || '章节'}`,
        subtitle: chapterProgress === null
          ? `${chapterPoints.length} 个知识点`
          : `${chapterPoints.length} 个知识点 · 进度 ${chapterProgress}%`,
        tone,
        width: shelfWidth,
        height: shelfHeight,
      }));

      const rootCenterY = 140;
      if (root) {
        nodes.push(createMapNode(root.id, SHELF_X + ROOT_X, rootCenterY, {
          label: root.name,
          subtitle: chapterProgress === null ? `CH${chapter}` : `${chapterProgress}%`,
          levelLabel: 'L1',
          tone,
          size: 'root',
          selected: root.id === selectedId,
          visible: visibleIds.has(root.id),
        }));
      }

      levelTwo.forEach((parent, parentIndex) => {
        const parentX = SHELF_X + L2_START_X + parentIndex * L2_GAP_X;
        const parentY = rootCenterY;
        const childPoints = points.filter((point) => point.parentId === parent.id);
        nodes.push(createMapNode(parent.id, parentX, parentY, {
          label: parent.name,
          subtitle: childPoints.length > 0 ? `${childPoints.length} 子项` : undefined,
          levelLabel: 'L2',
          tone,
          size: 'branch',
          selected: parent.id === selectedId,
          visible: visibleIds.has(parent.id),
        }));
        if (root) {
          edges.push(graphEdge(root.id, parent.id, tone, visibleIds.has(root.id) && visibleIds.has(parent.id), 1.6));
        }

        childPoints.forEach((child, childIndex) => {
          const childY = parentY + L3_OFFSET_Y + childIndex * L3_GAP_Y;
          nodes.push(createMapNode(child.id, parentX, childY, {
            label: child.name,
            levelLabel: 'L3',
            tone: visibleIds.has(child.id) ? tone : 'slate',
            size: 'leaf',
            selected: child.id === selectedId,
            visible: visibleIds.has(child.id),
          }));
          edges.push(graphEdge(parent.id, child.id, tone, visibleIds.has(parent.id) && visibleIds.has(child.id), 0.9));
        });
      });
    }

    // Cross-chapter prerequisite edges (amber, dashed) — show real semantic links
    // beyond hierarchy. Only draw when both endpoints are in the rendered node set
    // (i.e., overview mode where all L1/L2 are present).
    if (chapterFilter === 'all') {
      const renderedIds = new Set(nodes.map((n) => n.id));
      const prereqTone: GraphTone = 'amber';
      points.forEach((p) => {
        (p.prerequisites || []).forEach((preId) => {
          const pre = pointById[preId];
          if (!pre || pre.chapter === p.chapter) return;
          if (!renderedIds.has(p.id) || !renderedIds.has(pre.id)) return;
          const both = visibleIds.has(p.id) && visibleIds.has(pre.id);
          edges.push(graphEdge(pre.id, p.id, prereqTone, both, 1.2, true));
        });
      });
    }

    return { nodes, edges };
  }, [points, progress, selectedId, visibleIds, chapterFilter]);

  return (
    <GraphMapStage
      nodes={layout.nodes}
      edges={layout.edges}
      onSelect={(id) => {
        const point = points.find((item) => item.id === id);
        if (point) onSelect(point);
      }}
      heightClassName="h-[620px] md:h-[780px]"
    />
  );
}

type ProblemVisualNode = {
  id: string;
  label: string;
  category: ProblemNode['category'];
  level: ProblemNode['level'];
  x: number;
  y: number;
  r: number;
};

function ProblemGraphCanvas({
  selectedId,
  visibleIds,
  onSelect,
}: {
  selectedId: string;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const layout = useMemo(() => {
    const roots = problemGraph.filter((node) => node.level === 1);
    const centers = [
      { x: 380, y: 270 },
      { x: 1120, y: 270 },
      { x: 380, y: 680 },
      { x: 1120, y: 680 },
    ];
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];

    roots.forEach((root, rootIndex) => {
      const center = centers[rootIndex] || centers[0];
      const domains = problemGraph.filter((node) => node.parentId === root.id);
      const tone = problemTone(root.category);
      nodes.push(createMapGroup(`problem-group-${root.id}`, center.x - 270, center.y - 210, {
        label: root.name,
        subtitle: `${domains.length} 类 · ${problemGraph.filter((node) => node.category === root.category && node.level === 3).length} 个具体问题`,
        tone,
        width: 540,
        height: 415,
      }));
      nodes.push(createMapNode(root.id, center.x, center.y - 105, {
        label: root.name,
        subtitle: `${problemGraph.filter((node) => node.category === root.category && node.level === 3).length}`,
        levelLabel: 'L1',
        tone,
        size: 'root',
        selected: root.id === selectedId,
        visible: visibleIds.has(root.id),
      }));

      domains.forEach((domain, domainIndex) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * domainIndex) / Math.max(domains.length, 1);
        const domainX = center.x + Math.cos(angle) * 178;
        const domainY = center.y + 12 + Math.sin(angle) * 142;
        const leaves = problemGraph.filter((node) => node.parentId === domain.id);
        nodes.push(createMapNode(domain.id, domainX, domainY, {
          label: domain.name,
          subtitle: `${leaves.length}`,
          levelLabel: 'L2',
          tone,
          size: 'branch',
          selected: domain.id === selectedId,
          visible: visibleIds.has(domain.id),
        }));
        edges.push(graphEdge(root.id, domain.id, tone, visibleIds.has(root.id) && visibleIds.has(domain.id), 1.5));

        leaves.forEach((leaf, leafIndex) => {
          const leafSpread = Math.PI / 1.5;
          const leafAngle = angle - leafSpread / 2 + (leafSpread * (leafIndex + 0.5)) / Math.max(leaves.length, 1);
          const leafRadius = 82 + Math.min(leaves.length, 10) * 2.6;
          nodes.push(createMapNode(leaf.id, domainX + Math.cos(leafAngle) * leafRadius, domainY + Math.sin(leafAngle) * leafRadius, {
            label: leaf.name,
            levelLabel: 'L3',
            tone: visibleIds.has(leaf.id) ? problemTone(leaf.category) : 'slate',
            size: 'leaf',
            selected: leaf.id === selectedId,
            visible: visibleIds.has(leaf.id),
          }));
          edges.push(graphEdge(domain.id, leaf.id, tone, visibleIds.has(domain.id) && visibleIds.has(leaf.id), 0.85));
        });
      });
    });

    return { nodes, edges };
  }, [selectedId, visibleIds]);

  return (
    <GraphMapStage nodes={layout.nodes} edges={layout.edges} onSelect={onSelect} heightClassName="h-[620px] md:h-[740px]" />
  );
}

function ProblemGraphView({
  query,
  onQueryChange,
  selectedId,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const roots = problemGraph.filter((node) => node.level === 1);
  const selected = problemGraph.find((node) => node.id === selectedId) || roots[0] || null;
  const selectedChildren = selected ? problemGraph.filter((node) => node.parentId === selected.id) : [];
  const filteredProblems = problemGraph.filter((node) => {
    if (!q) return node.level === 3;
    return `${node.id} ${node.name} ${node.description || ''} ${node.solution || ''}`.toLowerCase().includes(q);
  });
  const visibleProblemIds = useMemo(() => {
    if (!q) return new Set(problemGraph.map((node) => node.id));
    const ids = new Set<string>();
    filteredProblems.forEach((node) => {
      ids.add(node.id);
      let parentId = node.parentId;
      while (parentId) {
        ids.add(parentId);
        parentId = problemGraph.find((item) => item.id === parentId)?.parentId;
      }
    });
    return ids;
  }, [filteredProblems, q]);

  return (
    <main className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_340px] md:px-6">
      <aside className="order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:order-none xl:sticky xl:top-20 xl:self-start">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索问题、原因、解法..."
            className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
          />
        </div>
        <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">问题类型 · 4类问题域</div>
        <div className="space-y-2">
          {roots.map((root) => {
            const meta = problemCategoryMeta[root.category];
            const Icon = meta.icon;
            const count = problemGraph.filter((node) => node.category === root.category && node.level === 3).length;
            return (
              <button
                key={root.id}
                type="button"
                onClick={() => onSelect(root.id)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition',
                  selected?.id === root.id ? meta.tone : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{root.name}</span>
                  <span className="ml-auto font-mono text-[10px] opacity-70">{count}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 opacity-75">{root.description}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
            <div key={difficulty} className={cn('rounded-md border p-2 text-center', difficultyTone[difficulty])}>
              <div className="font-mono text-lg">{problemGraphStats.byDifficulty[difficulty]}</div>
              <div className="font-mono text-[10px] uppercase opacity-70">{difficulty}</div>
            </div>
          ))}
        </div>
      </aside>

      <section className="order-1 space-y-5 xl:order-none">
        <div className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0c1117] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">问题节点网络</h2>
              <p className="mt-1 text-xs text-slate-500">4类问题域、40个问题类型、153个具体问题，按父子关系连线展示。</p>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
              <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L1 {problemGraphStats.level1}</span>
              <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L2 {problemGraphStats.level2}</span>
              <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L3 {problemGraphStats.level3}</span>
            </div>
          </div>
          <ProblemGraphCanvas selectedId={selected?.id || ''} visibleIds={visibleProblemIds} onSelect={onSelect} />
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Target className="h-4 w-4 text-cyan-200" />
              命中问题节点
            </div>
            <span className="font-mono text-[10px] text-slate-500">{filteredProblems.length}/{problemGraphStats.level3}</span>
          </div>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {filteredProblems.slice(0, 40).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-left text-xs transition',
                  selected?.id === node.id ? problemCategoryMeta[node.category].tone : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
              >
                {node.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="order-3 space-y-4 xl:order-none xl:col-span-2 2xl:col-span-1">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="font-mono text-[11px] text-cyan-200">PROBLEM · {selected?.id || 'N/A'}</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">{selected?.name || '未选择问题'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{selected?.description || '请选择一个问题节点查看详情。'}</p>
          </div>
          {selected && (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">L{selected.level}</div>
                  <div className="text-xs text-slate-500">问题层级</div>
                </div>
                <div className={cn('rounded-md border p-3', difficultyTone[selected.difficulty])}>
                  <div className="font-mono text-lg">{selected.difficulty}</div>
                  <div className="text-xs opacity-70">难度</div>
                </div>
              </div>
              {selected.solution && (
                <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                  <div className="mb-2 text-sm font-semibold text-cyan-100">解法提示</div>
                  <p className="text-sm leading-6 text-slate-300">{selected.solution}</p>
                </div>
              )}
              {selected.commonMistakes && selected.commonMistakes.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-100">常见误区</div>
                  <div className="space-y-2">
                    {selected.commonMistakes.map((mistake) => (
                      <div key={mistake} className="rounded-md border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-sm text-red-100">
                        {mistake}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.relatedKnowledgePoints.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-100">关联知识点</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <span key={id} className="rounded border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-300">
                        KP {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedChildren.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-100">下级问题</div>
                  <div className="space-y-1">
                    {selectedChildren.slice(0, 10).map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => onSelect(node.id)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                      >
                        <span className="line-clamp-1">{node.name}</span>
                        <span className="font-mono text-[10px] text-slate-600">L{node.level}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}

type IdeologicalVisualNode = {
  id: string;
  label: string;
  category?: IdeologicalCategory;
  level: number;
  x: number;
  y: number;
  r: number;
  selectable: boolean;
};

function IdeologicalGraphCanvas({
  selectedId,
  visibleIds,
  onSelect,
}: {
  selectedId: string;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const layout = useMemo(() => {
    const cx = 750;
    const cy = 430;
    const roots = ideologicalNodes.filter((node) => node.level === 1);
    const nodes: RFNode[] = [
      createMapNode('sip-core', cx, cy, {
        label: '课程思政',
        subtitle: `${ideologicalGraphStats.totalElements}`,
        levelLabel: 'SIP',
        tone: 'cyan',
        size: 'core',
        selected: false,
        visible: true,
        clickable: false,
      }),
    ];
    const edges: RFEdge[] = [];

    roots.forEach((root, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(roots.length, 1);
      const rootX = cx + Math.cos(angle) * 325;
      const rootY = cy + Math.sin(angle) * 270;
      const tone = ideologicalTone(root.category);
      const elements = ideologicalNodes.filter((node) => node.parentId === root.id);
      nodes.push(createMapNode(root.id, rootX, rootY, {
        label: root.name,
        subtitle: `${elements.length}`,
        levelLabel: 'L1',
        tone,
        size: 'root',
        selected: root.id === selectedId,
        visible: visibleIds.has(root.id),
      }));
      edges.push(graphEdge('sip-core', root.id, tone, visibleIds.has(root.id), 1.7));

      elements.forEach((element, elementIndex) => {
        const spread = Math.PI / 1.25;
        const elementAngle = angle - spread / 2 + (spread * (elementIndex + 0.5)) / Math.max(elements.length, 1);
        const elementX = rootX + Math.cos(elementAngle) * 150;
        const elementY = rootY + Math.sin(elementAngle) * 126;
        nodes.push(createMapNode(element.id, elementX, elementY, {
          label: element.name,
          subtitle: element.relatedChapters.length ? `CH${element.relatedChapters.join('/')}` : undefined,
          levelLabel: 'L2',
          tone,
          size: 'branch',
          selected: element.id === selectedId,
          visible: visibleIds.has(element.id),
        }));
        edges.push(graphEdge(root.id, element.id, tone, visibleIds.has(root.id) && visibleIds.has(element.id), 1.1));
      });
    });

    const chapters = ideologicalGraphStats.chaptersWithSip;
    chapters.forEach((chapter, index) => {
      const x = 130 + index * (1240 / Math.max(chapters.length - 1, 1));
      const y = 840;
      const id = `sip-chapter-${chapter}`;
      nodes.push(createMapNode(id, x, y, {
        label: `CH${chapter}`,
        levelLabel: 'CH',
        tone: 'slate',
        size: 'chapter',
        selected: false,
        visible: true,
        clickable: false,
      }));
      ideologicalNodes
        .filter((node) => node.level === 2 && node.relatedChapters.includes(chapter))
        .slice(0, 5)
        .forEach((node) => edges.push(graphEdge(node.id, id, ideologicalTone(node.category), visibleIds.has(node.id), 0.75, true)));
    });

    return { nodes, edges };
  }, [selectedId, visibleIds]);

  return (
    <GraphMapStage nodes={layout.nodes} edges={layout.edges} onSelect={onSelect} heightClassName="h-[620px] md:h-[740px]" />
  );
}

function IdeologicalGraphView({
  query,
  onQueryChange,
  selectedId,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const roots = ideologicalNodes.filter((node) => node.level === 1);
  const selected = ideologicalNodes.find((node) => node.id === selectedId) || roots[0] || null;
  const selectedChildren = selected ? ideologicalNodes.filter((node) => node.parentId === selected.id) : [];
  const filteredNodes = ideologicalNodes.filter((node) => {
    if (!q) return node.level === 2;
    return `${node.id} ${node.name} ${node.description} ${node.teachingMethod} ${node.caseStudy || ''}`.toLowerCase().includes(q);
  });
  const filteredMappings = sipMappings.filter((mapping) => {
    if (!q) return true;
    return `${mapping.weekRange} ${mapping.knowledgePointName} ${mapping.ideologicalTheme} ${mapping.ideologicalContent}`.toLowerCase().includes(q);
  });
  const visibleIdeologicalIds = useMemo(() => {
    if (!q) return new Set(ideologicalNodes.map((node) => node.id));
    const ids = new Set<string>();
    filteredNodes.forEach((node) => {
      ids.add(node.id);
      if (node.parentId) ids.add(node.parentId);
    });
    filteredMappings.forEach((mapping) => {
      ideologicalNodes
        .filter((node) => node.name === mapping.ideologicalTheme || node.description.includes(mapping.ideologicalTheme))
        .forEach((node) => {
          ids.add(node.id);
          if (node.parentId) ids.add(node.parentId);
        });
    });
    return ids;
  }, [filteredMappings, filteredNodes, q]);

  return (
    <main className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_340px] md:px-6">
      <aside className="order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:order-none xl:sticky xl:top-20 xl:self-start">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索思政主题、周次..."
            className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
          />
        </div>
        <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">思政主题 · 6类元素</div>
        <div className="space-y-2">
          {roots.map((root) => {
            const Icon = ideologicalIconMap[root.category];
            const meta = categoryMeta[root.category];
            const count = ideologicalNodes.filter((node) => node.parentId === root.id).length;
            return (
              <button
                key={root.id}
                type="button"
                onClick={() => onSelect(root.id)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition',
                  selected?.id === root.id ? 'text-slate-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
                style={selected?.id === root.id ? { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}18` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  <span className="text-sm font-semibold">{root.name}</span>
                  <span className="ml-auto font-mono text-[10px] opacity-70">{count}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 opacity-75">{root.description}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
            <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.totalElements}</div>
            <div className="text-xs text-slate-500">思政元素</div>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
            <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.totalWeeklyMappings}</div>
            <div className="text-xs text-slate-500">周次映射</div>
          </div>
        </div>
      </aside>

      <section className="order-1 space-y-5 xl:order-none">
        <div className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0c1117] px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">思政节点网络</h2>
              <p className="mt-1 text-xs text-slate-500">中心主题、6类思政主题、二级元素和章节映射以节点连线展示。</p>
            </div>
            <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-500">
              CH {ideologicalGraphStats.chaptersWithSip.join('/')}
            </span>
          </div>
          <IdeologicalGraphCanvas selectedId={selected?.id || ''} visibleIds={visibleIdeologicalIds} onSelect={onSelect} />
        </div>

        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <BookOpen className="h-4 w-4 text-cyan-200" />
              周次映射轨迹
            </div>
            <span className="font-mono text-[10px] text-slate-500">{filteredMappings.length}/{sipMappings.length}</span>
          </div>
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {filteredMappings.map((mapping) => (
              <button
                key={`${mapping.weekRange}-${mapping.knowledgePointName}`}
                type="button"
                className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-left text-xs text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-slate-100"
              >
                <span className="font-mono text-cyan-200">{mapping.weekRange}</span>
                <span className="mx-2 text-slate-600">·</span>
                {mapping.ideologicalTheme}
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="order-3 space-y-4 xl:order-none xl:col-span-2 2xl:col-span-1">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="border-b border-white/[0.08] p-5">
            <div className="font-mono text-[11px] text-cyan-200">SIP · {selected?.id || 'N/A'}</div>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">{selected?.name || '未选择主题'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{selected?.description || '请选择一个思政节点查看详情。'}</p>
          </div>
          {selected && (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">L{selected.level}</div>
                  <div className="text-xs text-slate-500">节点层级</div>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">{selected.relatedChapters.join('/') || '-'}</div>
                  <div className="text-xs text-slate-500">关联章节</div>
                </div>
              </div>
              <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                <div className="mb-2 text-sm font-semibold text-cyan-100">教学方式</div>
                <p className="text-sm leading-6 text-slate-300">{selected.teachingMethod}</p>
              </div>
              {selected.caseStudy && (
                <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <div className="mb-2 text-sm font-semibold text-amber-100">案例载体</div>
                  <p className="text-sm leading-6 text-slate-300">{selected.caseStudy}</p>
                </div>
              )}
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-100">预期成效</div>
                <p className="rounded-md border border-white/[0.08] bg-black/20 p-3 text-sm leading-6 text-slate-300">{selected.expectedOutcome}</p>
              </div>
              {selected.relatedKnowledgePoints.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-100">关联知识点</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <span key={id} className="rounded border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-300">
                        KP {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedChildren.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-100">下级元素</div>
                  <div className="space-y-1">
                    {selectedChildren.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => onSelect(node.id)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                      >
                        <span className="line-clamp-1">{node.name}</span>
                        <span className="font-mono text-[10px] text-slate-600">CH {node.relatedChapters.join('/')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Target className="h-4 w-4 text-cyan-200" />
            思政图谱统计
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
              <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.totalCategories}</div>
              <div className="text-xs text-slate-500">一级主题</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
              <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.totalElements}</div>
              <div className="text-xs text-slate-500">二级元素</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
              <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.totalWeeklyMappings}</div>
              <div className="text-xs text-slate-500">周次映射</div>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
              <div className="font-mono text-xl text-slate-50">{ideologicalGraphStats.chaptersWithSip.length}</div>
              <div className="text-xs text-slate-500">覆盖章节</div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

export function HyperKnowledgeGraphPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<GraphView>('knowledge');
  const [selectedId, setSelectedId] = useState(knowledgePoints[0]?.id || '');
  const [selectedProblemId, setSelectedProblemId] = useState(problemGraph[0]?.id || '');
  const [selectedIdeologicalId, setSelectedIdeologicalId] = useState(ideologicalNodes[0]?.id || '');
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<number | 'all'>('all');
  const [progress, setProgress] = useState<HyperLearningProgressRecord[]>([]);

  useEffect(() => {
    let active = true;
    async function loadProgress() {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const result = await fetchHyperJson<unknown>('/api/learning-progress', token);
      if (!active) return;
      setProgress(normalizeLearningProgress(result.data));
    }
    loadProgress();
    return () => {
      active = false;
    };
  }, []);

  const pointById = useMemo(() => {
    const m: Record<string, KnowledgePoint> = {};
    knowledgePoints.forEach((p) => { m[p.id] = p; });
    return m;
  }, []);
  const knowledgePointByGraphId = useMemo(() => {
    const map: Record<string, KnowledgePoint> = {};
    knowledgePoints.forEach((point) => {
      if (point.graphNodeId && !map[point.graphNodeId]) map[point.graphNodeId] = point;
    });
    return map;
  }, []);
  const experimentTitleByRefId = useMemo(() => {
    const m: Record<string, string> = {};
    knowledgePoints.forEach((p) => {
      p.resources?.forEach((r) => {
        if (r.type === 'experiment' && r.refId && !m[r.refId]) m[r.refId] = r.title;
      });
    });
    return m;
  }, []);

  const selected = pointById[selectedId] || null;
  const childPoints = selected ? knowledgePoints.filter((point) => point.parentId === selected.id) : [];
  const siblings = selected
    ? knowledgePoints.filter((point) => point.chapter === selected.chapter && point.id !== selected.id).slice(0, 8)
    : [];

  const goToPoint = (id: string) => {
    if (!pointById[id]) return;
    setSelectedId(id);
  };

  useEffect(() => {
    if (!searchParams) return;

    const viewParam = searchParams.get('view');
    const nodeParam = searchParams.get('node');
    const chapterParam = parseChapterParam(searchParams.get('chapter'));

    if (isGraphView(viewParam)) setView(viewParam);

    if (chapterParam !== null) {
      setChapter(chapterParam);
      if (!viewParam) setView('knowledge');
    }

    if (!nodeParam) return;

    const knowledgePoint = knowledgePoints.find((point) => point.id === nodeParam) || knowledgePointByGraphId[nodeParam];
    if (knowledgePoint) {
      setView('knowledge');
      setSelectedId(knowledgePoint.id);
      setChapter(knowledgePoint.chapter);
      return;
    }

    if (problemGraph.some((node) => node.id === nodeParam)) {
      setView('problem');
      setSelectedProblemId(nodeParam);
      return;
    }

    if (ideologicalNodes.some((node) => node.id === nodeParam)) {
      setView('ideological');
      setSelectedIdeologicalId(nodeParam);
      return;
    }

    setView('knowledge');
  }, [knowledgePointByGraphId, searchParams]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return knowledgePoints.filter((point) => {
      const chapterMatch = chapter === 'all' || point.chapter === chapter;
      const queryMatch = !q || `${point.name} ${point.description || ''}`.toLowerCase().includes(q);
      return chapterMatch && queryMatch;
    });
  }, [chapter, query]);
  const visibleKnowledgeIds = useMemo(() => new Set(filteredList.map((point) => point.id)), [filteredList]);
  const chapterNumbers = useMemo(() => Array.from(new Set(knowledgePoints.map((point) => point.chapter))).sort((a, b) => a - b), []);
  const levelCounts = useMemo(() => ({
    l1: knowledgePoints.filter((point) => point.level === 1).length,
    l2: knowledgePoints.filter((point) => point.level === 2).length,
    l3: knowledgePoints.filter((point) => point.level === 3).length,
  }), []);

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Network className="h-3.5 w-3.5" />
              Graph · Mastery · Storyline
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">知识图谱</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              汇总专业知识图谱、问题图谱和思政图谱，保留原有课程内容、问题域与周次映射。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {graphViews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    setQuery('');
                  }}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition',
                    view === item.id
                      ? 'border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-100'
                      : 'border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-slate-100',
                  )}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[10px] opacity-70">{item.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedId(knowledgePoints[0]?.id || '');
                setSelectedProblemId(problemGraph[0]?.id || '');
                setSelectedIdeologicalId(ideologicalNodes[0]?.id || '');
                setQuery('');
                setChapter('all');
              }}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              <RotateCcw className="h-4 w-4" />
              重置视图
            </button>
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              返回课程 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {view === 'problem' ? (
        <ProblemGraphView
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedProblemId}
          onSelect={setSelectedProblemId}
        />
      ) : view === 'ideological' ? (
        <IdeologicalGraphView
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedIdeologicalId}
          onSelect={setSelectedIdeologicalId}
        />
      ) : (
      <main className="grid items-start gap-5 px-4 py-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px] md:px-6">
        <aside className="order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 lg:order-none lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setChapter('all')}
              className={cn(
                'rounded-md border px-2 py-2 text-xs transition',
                chapter === 'all' ? 'border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-100' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06]',
              )}
            >
              全部章节
            </button>
            <div className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-2 text-center font-mono text-xs text-slate-400">
              {filteredList.length}/{knowledgePoints.length}
            </div>
          </div>
          <div className="mb-3 grid grid-cols-5 gap-1">
            {chapterNumbers.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChapter(value)}
                className={cn(
                  'h-7 rounded border font-mono text-[10px] transition',
                  chapter === value ? 'border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-100' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200',
                )}
              >
                CH{value}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索知识点..."
              className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
          </div>
          <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">知识点列表 · 270点课程清单</div>
          <div className="max-h-[640px] space-y-1 overflow-y-auto pr-1">
            {filteredList.map((point) => {
              const chapterProgress = progressForChapter(progress, point.chapter);
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => goToPoint(point.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition',
                    selectedId === point.id ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                  )}
                >
                  {point.level === 1 ? <GitBranch className="h-3.5 w-3.5" /> : <ListTree className="h-3.5 w-3.5" />}
                  <span className="line-clamp-1">{point.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-slate-500">
                    {chapterProgress !== null && <span>{chapterProgress}%</span>}
                    <span>L{point.level}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="order-1 min-w-0 overflow-hidden rounded-md border border-white/[0.08] bg-[#070b10] lg:order-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0c1117] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Network className="h-4 w-4 text-cyan-200" />
              270 个知识点 · {chapter === 'all' ? '全部章节' : `第 ${chapter} 章`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
                <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L1 {levelCounts.l1}</span>
                <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L2 {levelCounts.l2}</span>
                <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1">L3 {levelCounts.l3}</span>
              </div>
            </div>
          </div>
          <div className="h-[520px] md:h-[620px] xl:h-[720px]">
            <FullKnowledgeMap
              points={knowledgePoints}
              selectedId={selectedId}
              visibleIds={visibleKnowledgeIds}
              progress={progress}
              onSelect={(point) => goToPoint(point.id)}
              chapterFilter={chapter}
            />
          </div>
        </section>

        <div className="order-3 space-y-4 lg:order-none lg:col-span-2 xl:col-span-1">
          <DetailPanel
            point={selected}
            childPoints={childPoints}
            pointById={pointById}
            experimentTitleByRefId={experimentTitleByRefId}
            onSelectId={goToPoint}
          />
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ListTree className="h-4 w-4 text-cyan-200" />
              同章知识点
            </div>
            <div className="space-y-1">
              {siblings.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => goToPoint(point.id)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                >
                  <span className="line-clamp-1">{point.name}</span>
                  <span className="font-mono text-[10px] text-slate-600">L{point.level}</span>
                </button>
              ))}
              {siblings.length === 0 && <div className="text-xs text-slate-500">暂无同章节点。</div>}
            </div>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Target className="h-4 w-4 text-cyan-200" />
              图谱统计
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3">
                <div className="font-mono text-xl text-slate-50">{knowledgePoints.length}</div>
                <div className="text-xs text-slate-500">总节点</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3">
                <div className="font-mono text-xl text-slate-50">{new Set(knowledgePoints.map((point) => point.chapter)).size}</div>
                <div className="text-xs text-slate-500">章节</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3">
                <div className="font-mono text-xl text-slate-50">{levelCounts.l2}</div>
                <div className="text-xs text-slate-500">二级节点</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3">
                <div className="font-mono text-xl text-slate-50">{levelCounts.l3}</div>
                <div className="text-xs text-slate-500">三级节点</div>
              </div>
            </div>
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
