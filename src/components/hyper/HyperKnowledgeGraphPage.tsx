'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType, CSSProperties } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps,
  type ReactFlowInstance,
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
  FlaskConical,
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
  Menu,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
  Cable,
  CircuitBoard,
  Clock,
  Cog,
  Radio,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { knowledgePoints as staticKnowledgePoints, getPrerequisiteReason, type KnowledgePoint, type KnowledgePointResource } from '@/lib/knowledge-points';
import { quizQuestions as staticQuizQuestions, type Question } from '@/lib/quiz-data';
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
import { useAuth } from '@/contexts/AuthContext';
import { NextStepBanner } from '@/components/onboarding/NextStepBanner';
type GraphView = 'knowledge' | 'problem' | 'ideological';

const graphViews: Array<{ id: GraphView; label: string; count: number }> = [
  { id: 'knowledge', label: '专业知识图谱', count: staticKnowledgePoints.length },
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

function QuizPreviewItem({ q, index }: { q: Question; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
      <div className="mb-2 flex items-start gap-2 text-[11px]">
        <span className="font-mono text-[10px] text-slate-500">Q{index + 1} · CH{q.chapter}</span>
        <span className="ml-auto rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
          {q.type === 'code-completion' ? '代码补全' : '选择'}
        </span>
      </div>
      <p className="text-[12px] leading-5 text-slate-200">{q.questionText}</p>
      {q.type === 'code-completion' && (
        <pre className="mt-2 max-h-24 overflow-y-auto rounded-sm border border-white/[0.05] bg-black/40 p-2 font-mono text-[10px] leading-4 text-slate-300">
          {q.code}
        </pre>
      )}
      {q.type === 'multiple-choice' && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
          {q.options.map((opt, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="font-mono text-[10px] text-slate-600">{String.fromCharCode(65 + i)}.</span>
              <span>{opt}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setShowAnswer((v) => !v)}
        className="mt-2 inline-flex h-6 items-center gap-1 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-2 text-[10px] text-emerald-200 hover:border-emerald-300/40 hover:bg-emerald-300/[0.12]"
      >
        {showAnswer ? '隐藏答案' : '查看答案'}
      </button>
      {showAnswer && (
        <div className="mt-2 rounded-sm border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-1.5 text-[11px] text-emerald-100">
          <span className="text-slate-500">正确答案：</span>
          <span className="ml-1 font-medium">{q.correctAnswer}</span>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  point,
  childPoints,
  pointById,
  experimentTitleByRefId,
  onSelectId,
  allPoints,
}: {
  point: KnowledgePoint | null;
  childPoints: KnowledgePoint[];
  pointById: Record<string, KnowledgePoint>;
  experimentTitleByRefId: Record<string, string>;
  onSelectId: (id: string) => void;
  allPoints: KnowledgePoint[];
}) {
  const [quizQuestions, setQuizQuestions] = useState<Question[]>(staticQuizQuestions);

  // Fetch quiz questions from API (DB-first) with static fallback
  useEffect(() => {
    let active = true;
    async function loadQuestions() {
      try {
        const res = await fetch('/api/quiz/questions');
        if (res.ok) {
          const json = await res.json();
          if (active && Array.isArray(json.data) && json.data.length > 0) {
            setQuizQuestions(json.data);
            return;
          }
        }
      } catch { /* fallback below */ }
    }
    loadQuestions();
    return () => { active = false; };
  }, []);

  if (!point) {
    return (
      <aside className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-6 transition-all text-sm text-slate-400">
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
  // 后继知识点：谁把当前节点列为前置（反向一跳），
  // 与前置知识一起构成"先学什么 → 本节点 → 支撑什么"的链路叙述
  const dependents = allPoints.filter((p) => p.prerequisites?.includes(point.id));
  const appliedExperiments = (point.appliedIn || []).map((refId) => ({
    refId,
    title: experimentTitleByRefId[refId] || refId,
  }));
  const parent = point.parentId ? pointById[point.parentId] : null;
  const nextPoint = getNextPoint(point, allPoints);
  const matchingQuestions = quizQuestions.filter((q) => q.ka === point.id).slice(0, 4);

  return (
    <aside className="glass-hover overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035] transition-all">
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
            className="group mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100"
          >
            <Layers className="h-3 w-3" />
            <span>上级</span>
            <span className="text-slate-500 group-hover:text-cyan-200/80">/</span>
            <span className="font-medium">{parent.name}</span>
          </button>
        )}
      </div>

      {point.tutor && (
        <div className="border-b border-white/[0.08] bg-cyan-500/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200">
            <Lightbulb className="h-3.5 w-3.5" />
            讲解
          </div>
          <div className="space-y-3 text-sm leading-6 text-slate-200">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-cyan-300/80">本质</div>
              <div className="mt-0.5">{point.tutor.core}</div>
            </div>
            {point.tutor.whyImportant && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-slate-400">为什么重要</div>
                <div className="mt-0.5 text-slate-300">{point.tutor.whyImportant}</div>
              </div>
            )}
            {point.tutor.commonMistake && (
              <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-amber-200">常见误区</div>
                <div className="mt-0.5 text-slate-200">{point.tutor.commonMistake}</div>
              </div>
            )}
            {point.tutor.takeaway && (
              <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.04] p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-emerald-200">带走这一句</div>
                <div className="mt-0.5 font-medium text-slate-50">{point.tutor.takeaway}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {prereqs.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <Link2 className="h-3.5 w-3.5" />
            前置知识 · 先学什么
          </div>
          <div className="space-y-1.5">
            {prereqs.map((p) => {
              const reason = getPrerequisiteReason(point.id, p.id);
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectId(p.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-cyan-100"
                  >
                    <span className="line-clamp-1">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">CH{p.chapter} · #{p.id}</span>
                  </button>
                  {reason && (
                    <div className="mt-1 px-3 text-[11px] leading-snug text-slate-500">{reason}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dependents.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-200/80">
            <GitBranch className="h-3.5 w-3.5" />
            支撑后续 · 学完能干什么
          </div>
          <div className="space-y-1.5">
            {dependents.slice(0, 6).map((p) => {
              const reason = getPrerequisiteReason(p.id, point.id);
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectId(p.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-left text-xs text-slate-200 hover:border-amber-300/40 hover:bg-amber-300/[0.08]"
                  >
                    <span className="line-clamp-1">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-amber-200/70">CH{p.chapter} · #{p.id}</span>
                  </button>
                  {reason && (
                    <div className="mt-1 px-3 text-[11px] leading-snug text-slate-500">{reason}</div>
                  )}
                </div>
              );
            })}
            {dependents.length > 6 && (
              <div className="px-3 pt-1 font-mono text-[10px] text-slate-600">+{dependents.length - 6} 个后续节点</div>
            )}
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

      {matchingQuestions.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              本节测验题 · {matchingQuestions.length}
            </div>
            <Link
              href={`/quiz?chapter=${point.chapter}`}
              className="font-mono text-[10px] text-cyan-300 hover:text-cyan-100"
            >
              到测验页 →
            </Link>
          </div>
          <div className="space-y-2">
            {matchingQuestions.map((q, i) => (
              <QuizPreviewItem key={q.id} q={q} index={i} />
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

type GraphTone =
  | 'cyan' | 'emerald' | 'amber' | 'red' | 'violet' | 'slate'
  | 'sky' | 'teal' | 'lime' | 'orange' | 'fuchsia' | 'rose';
type GraphNodeSize = 'core' | 'root' | 'branch' | 'leaf' | 'chapter' | 'hub' | 'net';

// 统一克制色板：全部色相共享同一饱和度/明度带（S≈0.62 L≈0.68），
// 只有色相在环上旋转——避免旧版 12 色各自不同纯度堆在一起的"彩虹爆炸"。
// red 单独保留给掌握度<60 预警语义，明度/饱和度对齐但色相独立以维持警示辨识度。
const graphTone: Record<GraphTone, { color: string; bg: string; border: string; text: string; minimap: string }> = {
  cyan: { color: '#7bcce0', bg: 'rgba(123, 204, 224, 0.15)', border: 'rgba(146, 215, 232, 0.40)', text: '#d7eef4', minimap: '#2ab3d5' },
  emerald: { color: '#7be0ad', bg: 'rgba(123, 224, 173, 0.15)', border: 'rgba(146, 232, 189, 0.40)', text: '#d7f4e6', minimap: '#2ad580' },
  amber: { color: '#e0be7b', bg: 'rgba(224, 190, 123, 0.15)', border: 'rgba(232, 203, 146, 0.40)', text: '#f4ead7', minimap: '#d59c2a' },
  red: { color: '#e0827b', bg: 'rgba(224, 130, 123, 0.16)', border: 'rgba(232, 151, 146, 0.42)', text: '#f4d9d7', minimap: '#d5352a' },
  violet: { color: '#a77be0', bg: 'rgba(167, 123, 224, 0.15)', border: 'rgba(183, 146, 232, 0.40)', text: '#e4d7f4', minimap: '#742ad5' },
  slate: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.22)', text: '#cbd5e1', minimap: '#64748b' },
  // 以下 6 色从原有色系扩展，供 10 个章节各配一个稳定主题色——同一色带内旋转色相
  sky: { color: '#7bb4e0', bg: 'rgba(123, 180, 224, 0.15)', border: 'rgba(146, 194, 232, 0.40)', text: '#d7e7f4', minimap: '#2a8bd5' },
  teal: { color: '#7be0d3', bg: 'rgba(123, 224, 211, 0.15)', border: 'rgba(146, 232, 220, 0.40)', text: '#d7f4f0', minimap: '#2ad5be' },
  lime: { color: '#a0e07b', bg: 'rgba(160, 224, 123, 0.15)', border: 'rgba(177, 232, 146, 0.40)', text: '#e2f4d7', minimap: '#69d52a' },
  orange: { color: '#e0a77b', bg: 'rgba(224, 167, 123, 0.15)', border: 'rgba(232, 183, 146, 0.40)', text: '#f4e4d7', minimap: '#d5742a' },
  fuchsia: { color: '#e07be0', bg: 'rgba(224, 123, 224, 0.15)', border: 'rgba(232, 146, 232, 0.40)', text: '#f4d7f4', minimap: '#d52ad5' },
  rose: { color: '#e07b94', bg: 'rgba(224, 123, 148, 0.15)', border: 'rgba(232, 146, 167, 0.40)', text: '#f4d7de', minimap: '#d52a55' },
};

// 圆形节点：宽高相等=直径，半径按层级分档（L1 最大 → L3 最小），
// 用大小直接编码重要性层级，替代此前"统一大小圆角矩形"的卡片感。
// 直径口径：core/hub(L1 章枢纽) 68-72px，root(单章 L1) 64px，
// branch/net(L2 节) 44-52px，leaf(L3 点) 30-34px，chapter(思政章节脚注) 40px。
const graphNodeSize: Record<GraphNodeSize, { width: number; height: number }> = {
  core: { width: 72, height: 72 },
  root: { width: 68, height: 68 },
  branch: { width: 52, height: 52 },
  leaf: { width: 32, height: 32 },
  chapter: { width: 40, height: 40 },
  // 全景网络视图专用：hub=章节枢纽，net=环绕 hub 的 L2 紧凑节点
  hub: { width: 70, height: 70 },
  net: { width: 46, height: 46 },
};

// Per-chapter Lucide icon — picked to match the topic so an 8051 student
// recognises the chapter at a glance without reading the label.
const chapterIconMap: Record<number, LucideIcon> = {
  1: Cpu,
  2: Layers,
  3: Code2,
  4: FileText,
  5: Zap,
  6: Clock,
  7: Radio,
  8: Cable,
  9: CircuitBoard,
  10: Sparkles,
};

function getChapterIcon(chapter: number | undefined): LucideIcon {
  if (typeof chapter !== 'number') return Cog;
  return chapterIconMap[chapter] || Cog;
}

type MapNodeData = {
  label: string;
  subtitle?: string;
  levelLabel?: string;
  tone: GraphTone;
  size: GraphNodeSize;
  selected: boolean;
  visible: boolean;
  clickable?: boolean;
  chapter?: number;
  mastery?: number;
  description?: string;
  dimmed?: boolean;
  // 实验关联角标：有 appliedIn 的节点显示烧瓶角标，悬停列出实验名
  experiments?: string[];
  // 全景网络视图里 L2 节点下辖的 L3 数（角标提示"可展开"）
  childCount?: number;
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

// 圆形节点：半径按层级分档（L1 最大 → L3 最小），配色是"填色圆盘"而不是
// 卡片边框，标签常态显示在圆外正下方（而不是塞进圆内截断成 6-8px）。
// L3 默认只显示极短的省略标签，完整名称走 hover 卡片（GraphMapStage 已有）。
function MapNode({ data }: NodeProps<RFNode<MapNodeData>>) {
  const tone = graphTone[data.tone];
  const size = getGraphNodeSize(data.size);
  const isLeaf = data.size === 'leaf';
  const isNet = data.size === 'net';
  const isRoot = data.size === 'root' || data.size === 'core' || data.size === 'hub';
  const isChapterFoot = data.size === 'chapter';
  // Focus mode: a non-selected node outside the kinship set fades to the
  // background. Visible-but-out-of-search filter still trumps focus dimming.
  const baseOpacity = data.visible || data.selected ? 1 : 0.18;
  const focusFactor = data.dimmed && !data.selected ? 0.22 : 1;
  const opacity = baseOpacity * focusFactor;
  // 常态标签长度：层级越低越短，L3/网状节点默认只留意到"这里有个点"，
  // 完整名称交给 hover 卡片（NodeHoverCard）
  const labelMax = isRoot ? 10 : data.size === 'branch' ? 8 : isNet ? 6 : 5;
  // 标签外框宽度（圆外正下方那一行文字的最大宽度）：这才是相邻簇标签会不会
  // physically 撞在一起的决定量。isNet(L2) 全景视图 52 个同屏，是密度主因，
  // 原来统一 104px 与节点自身实际横向间距（改完 ringGeometry 后中心距约
  // 70-95px）严重不成比例；收紧到 72px 后单个标签横向占用打对折，配合
  // ringGeometry 的纵向椭圆化，两者相加才是真正把"标签重叠"压下去的组合，
  // 而不是单靠某一项。root/branch 维持原宽度，因为它们数量少、间距天然大。
  const labelBoxW = isNet ? 72 : 104;
  const ChapterIcon = isRoot ? getChapterIcon(data.chapter) : null;
  const showMastery = typeof data.mastery === 'number' && !isLeaf && !isChapterFoot;
  const handleCls = '!h-1 !w-1 !border-0 !bg-transparent';
  // 隐形中心桩：层级边（hub→L2）走"节点中心→节点中心"的直线，
  // 视觉上像放射辐条而不是绕外框的折线
  const centerHandleStyle: CSSProperties = {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    opacity: 0,
    pointerEvents: 'none',
  };
  const fontSize = isRoot ? 12 : data.size === 'branch' || isNet ? 10.5 : 9;
  const mastery = typeof data.mastery === 'number' ? Math.max(0, Math.min(100, data.mastery)) : null;
  // 掌握度进度环：半径略小于节点半径的圆弧，stroke-dasharray 走百分比
  const ringR = size.width / 2 - 2.5;
  const ringCirc = 2 * Math.PI * ringR;

  return (
    <>
      <Handle type="target" position={Position.Top} className={handleCls} />
      <Handle id="lt" type="target" position={Position.Left} className={handleCls} />
      <Handle id="rt" type="target" position={Position.Right} className={handleCls} />
      <Handle id="ct" type="target" position={Position.Top} className={handleCls} style={centerHandleStyle} />
      <div
        className="relative flex items-center justify-center"
        style={{ width: size.width, height: size.height, opacity }}
      >
        {/* 选中脉冲：镜头聚焦(fitView)本身缩放幅度可能很小，单靠镜头移动
            不够醒目——这圈独立于镜头的扩散光环保证"点击生效了"看得见。
            data.selected 从 false→true 时该 span 从无到有，浏览器天然重新
            播放一次 CSS 动画；重复点击同一个已选中节点不会重播（selected
            始终为 true，不会重新 mount），forwards 让动画结束后保持透明
            不占用交互，不会一直闪烁骚扰。 */}
        {data.selected && (
          <span
            className="animate-node-select-pulse pointer-events-none absolute inset-0 rounded-full"
            style={{ border: `2px solid ${tone.color}` }}
            aria-hidden
          />
        )}
        {/* 掌握度环：圆盘外沿一圈细弧，绿/黄/红随分数着色，替代原来"底边一条色条" */}
        {showMastery && mastery !== null && (
          <svg
            width={size.width}
            height={size.height}
            className="pointer-events-none absolute inset-0 -rotate-90"
            aria-hidden
          >
            <circle
              cx={size.width / 2}
              cy={size.height / 2}
              r={ringR}
              fill="none"
              stroke={tone.color}
              strokeWidth={2}
              strokeOpacity={0.9}
              strokeLinecap="round"
              strokeDasharray={`${(mastery / 100) * ringCirc} ${ringCirc}`}
            />
          </svg>
        )}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border text-center backdrop-blur-sm transition',
            data.clickable === false ? 'cursor-default' : 'cursor-pointer hover:brightness-110',
            data.selected && 'scale-[1.12]',
          )}
          style={{
            width: size.width - 6,
            height: size.height - 6,
            color: tone.text,
            borderColor: data.selected ? '#f8fafc' : tone.border,
            borderWidth: data.selected ? 2 : isRoot ? 1.75 : 1.25,
            background: data.selected
              ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), ${tone.bg} 60%, rgba(6,10,16,0.65))`
              : data.visible
                ? `radial-gradient(circle at 35% 30%, ${tone.bg}, rgba(6,10,16,0.72) 78%)`
                : 'rgba(15, 23, 42, 0.65)',
            boxShadow: data.selected
              ? `0 0 0 3px ${tone.color}55, 0 0 0 5px rgba(248,250,252,0.14), 0 10px 26px ${tone.color}55`
              : isRoot
                ? `0 3px 14px ${tone.color}30, inset 0 1px 0 rgba(255,255,255,0.08)`
                : `0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`,
          }}
        >
          {ChapterIcon ? (
            <ChapterIcon className="h-[38%] w-[38%]" style={{ color: tone.color }} />
          ) : isChapterFoot ? (
            <span className="font-mono text-[10px] font-semibold tracking-wide">{data.label}</span>
          ) : (
            <span
              className="line-clamp-2 max-w-full break-words px-1 font-medium leading-[1.05]"
              style={{ fontSize }}
            >
              {truncateLabel(data.label, labelMax)}
            </span>
          )}
        </div>
        {/* L2/L3 层级角标：圆盘左上角的小徽标，替代原来内嵌的 levelLabel 胶囊 */}
        {!isRoot && !isChapterFoot && data.levelLabel && (
          <span
            className="pointer-events-none absolute -left-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] font-mono text-[7px] font-semibold leading-none"
            style={{ backgroundColor: '#05080d', color: tone.color, border: `1px solid ${tone.border}` }}
          >
            {data.levelLabel.replace('L', '')}
          </span>
        )}
        {isNet && typeof data.childCount === 'number' && data.childCount > 0 && (
          <span
            className="pointer-events-none absolute -bottom-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] font-mono text-[7px] font-semibold leading-none"
            style={{ backgroundColor: '#05080d', color: tone.color, border: `1px solid ${tone.border}` }}
          >
            +{data.childCount}
          </span>
        )}
        {/* 实验关联角标：置于圆盘外层，避免被 overflow 裁剪 */}
        {data.experiments && data.experiments.length > 0 && (
          <span
            className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/60 bg-[#04231a] text-emerald-200 shadow-md"
          >
            <FlaskConical className="h-2 w-2" />
          </span>
        )}
        {/* 常态标签：置于圆外正下方，不再挤进圆盘内部截断成 6-8px。
            L1/L2 默认可读（10.5-13px 见下方 labelBelow 逻辑）。
            L3 叶子节点数量最多（全景视图达211个）、间距最密，即使标签本身
            独立渲染在圆下方，密集区域仍会互相重叠糊成一团——默认干脆不显示
            文字，只留一个可辨色的圆点勾勒整体分布形态，选中态才现出标签；
            完整名称随时可从 hover 卡片（NodeHoverCard）查看，不丢信息。 */}
        {!isChapterFoot && (!isLeaf || data.selected) && (
          <div
            className="pointer-events-none absolute left-1/2 top-full mt-1 w-max -translate-x-1/2 text-center leading-tight"
            style={{ opacity: Math.max(opacity, data.selected ? 1 : opacity), maxWidth: labelBoxW }}
          >
            <span
              className={cn(
                'inline-block truncate rounded px-1 py-[1px]',
                isRoot ? 'text-[11px] font-semibold' : isNet || data.size === 'branch' ? 'text-[10px] font-medium' : 'text-[8.5px]',
              )}
              style={{
                color: isRoot ? '#f1f5f9' : tone.text,
                backgroundColor: isRoot ? 'rgba(5,8,13,0.72)' : 'transparent',
                maxWidth: labelBoxW,
              }}
            >
              {data.label}
            </span>
            {isRoot && data.subtitle && (
              <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] opacity-70" style={{ color: tone.color }}>
                {data.subtitle}
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="ls" type="source" position={Position.Left} className={handleCls} />
      <Handle id="rs" type="source" position={Position.Right} className={handleCls} />
      <Handle id="cs" type="source" position={Position.Bottom} className={handleCls} style={centerHandleStyle} />
    </>
  );
}

// —— 全景网络视图的章节簇光晕 ——
// 每个章节簇背后垫一层章色径向光晕：只提供"这一片属于同一章"的分区暗示，
// 不描边框、不装文字，避免退化成"卡片墙"的观感。
type ClusterHaloData = {
  color: string;
  width: number;
  height: number;
  [key: string]: unknown;
};

function ClusterHaloNode({ data }: NodeProps<RFNode<ClusterHaloData>>) {
  return (
    <div
      className="pointer-events-none"
      style={{
        width: data.width,
        height: data.height,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at center, ${data.color}17 0%, ${data.color}09 45%, transparent 72%)`,
      }}
    />
  );
}

const mapNodeTypes = { mapNode: MapNode, clusterHalo: ClusterHaloNode };

type HoverPayload = {
  x: number;
  y: number;
  data: MapNodeData;
};

// 命令式相机控制：点击章节 hub 从全景切到单章视图前，父组件（FullKnowledgeMap）
// 先调用 flyToNode 让镜头真正"飞"过去，播完动画再切换数据（remount）。此前只靠
// remount 时的 animate-fade-in 做透明度过渡，但全景→单章是完全不同的节点集合，
// 位置、大小都变了，单纯淡入盖不住"瞬间换了一张图"的生硬感——要有真正的镜头
// 运动，才能让人感觉是"点这里→镜头拉近→看到这一章"的连贯过程。
export type GraphMapStageHandle = {
  flyToNode: (nodeId: string, opts?: { duration?: number }) => void;
};

const GraphMapStage = forwardRef<GraphMapStageHandle, {
  nodes: RFNode[];
  edges: RFEdge[];
  onSelect: (id: string) => void;
  selectedId?: string;
  focusIds?: Set<string>;
  heightClassName?: string;
  // 初始 fitView 的留白与最大缩放：全景视图要贴边填满，径向视图要留呼吸感
  fitPadding?: number;
  fitMaxZoom?: number;
  // 聚合依赖边（data.kind === 'dep'）被点击时触发，用于展开"具体节点对+理由"面板
  onEdgeSelect?: (edgeId: string) => void;
}>(function GraphMapStage({
  nodes,
  edges,
  onSelect,
  selectedId,
  focusIds,
  heightClassName = 'h-[660px] md:h-[760px]',
  fitPadding = 0.18,
  fitMaxZoom = 1.1,
  onEdgeSelect,
}, forwardedRef) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const [hover, setHover] = useState<HoverPayload | null>(null);
  const [edgeHover, setEdgeHover] = useState<{ x: number; y: number; count: number } | null>(null);

  useImperativeHandle(forwardedRef, () => ({
    flyToNode: (nodeId, opts) => {
      const instance = instanceRef.current;
      if (!instance) return;
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const size = (target.data as { size?: GraphNodeSize } | undefined)?.size;
      const dim = size ? getGraphNodeSize(size) : { width: 60, height: 60 };
      instance.setCenter(
        target.position.x + dim.width / 2,
        target.position.y + dim.height / 2,
        { zoom: 1.35, duration: opts?.duration ?? 420 },
      );
    },
  }), [nodes]);

  // When the user picks a node, ease the camera so the node and its
  // immediate kinship fill the viewport. Skipped on first render and
  // when the focus set is empty (no selection).
  useEffect(() => {
    if (!selectedId || !focusIds || focusIds.size === 0) return;
    const instance = instanceRef.current;
    if (!instance) return;
    const targets = nodes.filter((n) => n.type === 'mapNode' && focusIds.has(n.id));
    if (targets.length === 0) return;
    instance.fitView({
      nodes: targets.map((n) => ({ id: n.id })),
      padding: 0.4,
      duration: 480,
      maxZoom: 1.25,
      minZoom: 0.45,
    });
    // Re-run only when the user actually picks a different node — the
    // focus set churn from a stale id would otherwise pin the camera.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div
      ref={stageRef}
      className={cn(
        'kg-map-stage relative overflow-hidden bg-[radial-gradient(ellipse_60%_40%_at_30%_15%,rgba(34,211,238,0.10),transparent_70%),radial-gradient(ellipse_50%_30%_at_80%_85%,rgba(168,85,247,0.06),transparent_70%),#05080d]',
        heightClassName,
      )}
    >
      {/* ReactFlow Controls 按钮默认白底，在深色画布上很扎眼；
          Tailwind 任意变体写不进带双下划线的类名，这里用作用域样式压成暗色，
          三个图谱视图共享同一观感 */}
      <style>{`
        .kg-map-stage .react-flow__controls-button {
          background: #0c1117;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
        }
        .kg-map-stage .react-flow__controls-button svg {
          fill: currentColor;
        }
        .kg-map-stage .react-flow__controls-button:hover {
          background: #16202b;
        }
        /* clusterHalo 内层 div 已 pointer-events-none，但 ReactFlow 给节点外层
           wrapper 内联了 pointer-events:all（style 属性，优先级高于普通 class 规则），
           实测该内联样式确实盖住了下方的依赖边(kg-dep-*)，点击展开面板永远弹不出来。
           光晕纯装饰、无任何交互语义，用 !important 压过内联样式让整个节点穿透点击。 */
        .kg-map-stage .react-flow__node-clusterHalo {
          pointer-events: none !important;
        }
      `}</style>
      {/* 前置依赖边的青→琥珀渐变：userSpaceOnUse 以画布世界坐标取色，
          跨簇长曲线会自然呈现"从前置流向后继"的色彩过渡 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id="kg-dep-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1500" y2="900">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="55%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={mapNodeTypes}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => {
          if (node.type !== 'mapNode') return;
          if ((node.data as MapNodeData).clickable === false) return;
          onSelect(node.id);
        }}
        onNodeMouseEnter={(event, node) => {
          if (node.type !== 'mapNode') return;
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (!stageRect) return;
          setHover({
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
            data: node.data as MapNodeData,
          });
        }}
        onNodeMouseLeave={() => setHover(null)}
        onEdgeClick={(_, edge) => {
          const kind = (edge.data as { kind?: string } | undefined)?.kind;
          if (kind !== 'dep') return;
          onEdgeSelect?.(edge.id);
        }}
        onEdgeMouseEnter={(event, edge) => {
          const data = edge.data as { kind?: string; pairs?: Array<[string, string]> } | undefined;
          if (data?.kind !== 'dep') return;
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (!stageRect) return;
          setEdgeHover({
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
            count: data.pairs?.length || 0,
          });
        }}
        onEdgeMouseLeave={() => setEdgeHover(null)}
        onPaneClick={() => { setHover(null); setEdgeHover(null); }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: fitPadding, maxZoom: fitMaxZoom }}
        minZoom={0.32}
        maxZoom={2.4}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={0.6} color="rgba(148,163,184,0.05)" />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-white/[0.08] !bg-[#0c1117]/90 !shadow-xl"
        />
      </ReactFlow>
      {hover && <NodeHoverCard hover={hover} />}
      {edgeHover && (
        <div
          className="pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-amber-300/30 bg-[#0b1117] px-2.5 py-1.5 text-[11px] text-amber-100 shadow-2xl"
          style={{ left: Math.max(8, edgeHover.x - 60), top: Math.max(8, edgeHover.y - 40) }}
        >
          点击查看 {edgeHover.count} 条具体依赖
        </div>
      )}
    </div>
  );
});

function NodeHoverCard({ hover }: { hover: HoverPayload }) {
  const { data } = hover;
  const tone = graphTone[data.tone];
  // Place above-and-right of the cursor by default; flip to the left edge
  // when we'd otherwise overflow the canvas.
  const left = Math.max(8, hover.x - 120);
  const top = Math.max(8, hover.y - 96);
  return (
    <div
      className="pointer-events-none absolute z-50 max-w-[260px] rounded-lg border bg-[#0b1117] p-3 shadow-2xl backdrop-blur"
      style={{ left, top, borderColor: tone.border }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
        {typeof data.chapter === 'number' && <span>CH{data.chapter}</span>}
        {data.levelLabel && (
          <span className="rounded-sm px-1 py-0.5 text-[9px]" style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: tone.color }}>
            {data.levelLabel}
          </span>
        )}
        {typeof data.mastery === 'number' && (
          <span style={{ color: tone.color }}>掌握 {Math.round(data.mastery)}%</span>
        )}
      </div>
      <div className="mt-1 text-[13px] font-semibold leading-tight text-slate-50">{data.label}</div>
      {data.description && (
        <div className="mt-1.5 text-[11px] leading-snug text-slate-400 line-clamp-3">{data.description}</div>
      )}
      {data.experiments && data.experiments.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-white/[0.08] pt-1.5">
          {data.experiments.slice(0, 3).map((title) => (
            <div key={title} className="flex items-center gap-1 text-[10px] leading-snug text-emerald-200">
              <FlaskConical className="h-2.5 w-2.5 shrink-0" />
              <span className="line-clamp-1">{title}</span>
            </div>
          ))}
        </div>
      )}
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
    // Bezier curves give the canvas a softer, more organic look than the
    // right-angled smoothstep paths.
    type: dashed ? 'default' : 'default',
    animated: active && (dashed || width > 1.5),
    style: {
      stroke: color,
      strokeWidth: active ? width + 0.2 : 0.7,
      opacity: active ? (dashed ? 0.62 : 0.55) : 0.08,
      strokeDasharray: dashed ? '8 6' : undefined,
      strokeLinecap: 'round',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
      width: active ? 12 : 6,
      height: active ? 12 : 6,
    },
  };
}

// 每章一个稳定主题色：10 色和谐色板，章号固定取色，
// 全景卡片与单章树两种视图保持同色，便于评委建立“章=色”的映射。
// 刻意不用 red——红色留给掌握度 <60 的预警节点，避免语义冲突。
const chapterTonePalette: GraphTone[] = ['cyan', 'emerald', 'amber', 'violet', 'rose', 'teal', 'orange', 'sky', 'lime', 'fuchsia'];

function knowledgeTone(chapter: number): GraphTone {
  return chapterTonePalette[(chapter - 1) % chapterTonePalette.length] || 'cyan';
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

// Map a quiz mastery percentage to the existing GraphTone palette so the
// canvas can re-tint nodes that the student is weak / strong on.
function masteryTone(score: number | undefined): GraphTone | null {
  if (typeof score !== 'number') return null;
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'amber';
  return 'red';
}

function FullKnowledgeMap({
  points,
  selectedId,
  visibleIds,
  progress,
  onSelect,
  onFocusChapter,
  chapterFilter,
  masteryByKa,
  experimentTitleByRefId,
}: {
  points: KnowledgePoint[];
  selectedId: string;
  visibleIds: Set<string>;
  progress: HyperLearningProgressRecord[];
  onSelect: (point: KnowledgePoint) => void;
  // 全景视图点击章节 hub 时触发，父组件负责切到单章放射树视图
  onFocusChapter?: (chapter: number) => void;
  chapterFilter: number | 'all';
  masteryByKa?: Record<string, number>;
  // 实验 refId → 实验标题，节点烧瓶角标的悬停提示用
  experimentTitleByRefId: Record<string, string>;
}) {
  // 回调经 ref 转发进布局 useMemo，避免父组件每次渲染都因回调身份变化
  // 触发整图重排（性能红线：布局不随渲染帧重算）。
  const selectRef = useRef(onSelect);
  const focusChapterRef = useRef(onFocusChapter);
  useEffect(() => {
    selectRef.current = onSelect;
    focusChapterRef.current = onFocusChapter;
  });

  // 聚合依赖边被点击后选中，驱动下方"具体节点对+理由"展开面板；
  // 切换章节筛选或重选节点时清空，避免面板残留指向不存在的边。
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  useEffect(() => { setSelectedEdgeKey(null); }, [chapterFilter]);

  // 点击章节 hub 切单章视图前，先让镜头真正飞过去再切数据（remount）——
  // 详见 GraphMapStage 的 flyToNode 注释。pendingFocusTimer 记录待执行的
  // "动画播完后切数据"定时器，用户连续快速点不同 hub 时清掉上一个，
  // 避免旧的延时切换在动画途中抢先把 chapter 切到别处。
  const stageHandleRef = useRef<GraphMapStageHandle>(null);
  const pendingFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
  }, []);

  // 关系索引：byId 正查 + dependents 反查（"谁把我当前置"）。
  const relationIndex = useMemo(() => {
    const byId: Record<string, KnowledgePoint> = {};
    const dependents: Record<string, string[]> = {};
    points.forEach((p) => { byId[p.id] = p; });
    points.forEach((p) => {
      (p.prerequisites || []).forEach((pre) => {
        if (!byId[pre]) return;
        (dependents[pre] ||= []).push(p.id);
      });
    });
    return { byId, dependents };
  }, [points]);

  // 关联链路：选中节点的全部前置链（沿 prerequisites 向上递归）
  // 与全部后继链（沿反向索引向下递归）。
  const chain = useMemo(() => {
    const up = new Set<string>();
    const down = new Set<string>();
    if (selectedId && relationIndex.byId[selectedId]) {
      const upQueue = [selectedId];
      while (upQueue.length) {
        const id = upQueue.pop()!;
        (relationIndex.byId[id]?.prerequisites || []).forEach((pre) => {
          if (relationIndex.byId[pre] && !up.has(pre)) {
            up.add(pre);
            upQueue.push(pre);
          }
        });
      }
      const downQueue = [selectedId];
      while (downQueue.length) {
        const id = downQueue.pop()!;
        (relationIndex.dependents[id] || []).forEach((next) => {
          if (!down.has(next)) {
            down.add(next);
            downQueue.push(next);
          }
        });
      }
    }
    return { up, down };
  }, [relationIndex, selectedId]);

  // 全景视图的"屏上代表"：L3 汇聚到父级 L2（默认不逐个上屏），L1/L2 即自身。
  const repOf = useMemo(() => {
    return (id: string): string | null => {
      const p = relationIndex.byId[id];
      if (!p) return null;
      if (p.level === 3) return p.parentId ?? null;
      return p.id;
    };
  }, [relationIndex]);

  // Focus set：选中节点 + 层级亲缘（父链/子孙）+ 前置链 + 后继链。
  // 全景视图折算成屏上代表节点，供画布聚焦镜头与调光使用。
  const focusIds = useMemo(() => {
    if (!selectedId || !relationIndex.byId[selectedId]) return new Set<string>();
    const raw = new Set<string>([selectedId]);
    let cursor: KnowledgePoint | undefined = relationIndex.byId[selectedId];
    while (cursor?.parentId) {
      raw.add(cursor.parentId);
      cursor = relationIndex.byId[cursor.parentId];
    }
    const queue = [selectedId];
    while (queue.length) {
      const id = queue.shift()!;
      points.forEach((p) => {
        if (p.parentId === id && !raw.has(p.id)) {
          raw.add(p.id);
          queue.push(p.id);
        }
      });
    }
    chain.up.forEach((id) => raw.add(id));
    chain.down.forEach((id) => raw.add(id));
    if (chapterFilter !== 'all') return raw;
    const reps = new Set<string>();
    raw.forEach((id) => {
      const rep = repOf(id);
      if (rep) reps.add(rep);
    });
    // 选中 L2（或其 L3 子节点）时，按需展开的整簇 L3 也保持明亮
    const sel = relationIndex.byId[selectedId];
    const expandId = sel?.level === 2 ? sel.id : sel?.level === 3 ? sel.parentId : null;
    if (expandId) {
      points.forEach((p) => {
        if (p.parentId === expandId) reps.add(p.id);
      });
    }
    return reps;
  }, [points, relationIndex, chain, selectedId, chapterFilter, repOf]);

  const layout = useMemo(() => {
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const pointById: Record<string, KnowledgePoint> = {};
    points.forEach((p) => { pointById[p.id] = p; });
    const chapterNumbers = Array.from(new Set(points.map((point) => point.chapter))).sort((a, b) => a - b);

    // 节点（含子级汇总）的实验标题清单：给烧瓶角标的悬停提示用
    const expTitlesOf = (point: KnowledgePoint, rollupChildren: boolean): string[] => {
      const refs = new Set<string>(point.appliedIn || []);
      if (rollupChildren) {
        points.forEach((c) => {
          if (c.parentId === point.id) (c.appliedIn || []).forEach((r) => refs.add(r));
        });
      }
      return Array.from(refs).map((r) => experimentTitleByRefId[r] || r);
    };

    if (chapterFilter === 'all') {
      // —— 十章全景 = 真正的知识网络 ——
      // 10 个章节 hub 沿学习主线蛇形两行布点（上行左→右，下行右→左），
      // 每章的 L2 节点环绕 hub 成簇（52 个全部上屏、双行标签不截断），
      // L3 默认聚合为 hub 计数徽标 + L2 角标，点击 L2 才按需展开该簇。
      // 三类边分层渲染：层级辐条（极淡）、前置依赖（主角：青→琥珀渐变
      // 曲线，跨章微流动）、学习主线（章序粗线）。实验关联以烧瓶角标呈现。
      const COLS = 5;
      const CELL_W = 352;
      const X0 = 220;
      const ROW_Y = [225, 700];
      const hubPos = new Map<number, { x: number; y: number }>();
      const l2Angle = new Map<string, number>();
      const l2Pos = new Map<string, { x: number; y: number }>();
      const onScreen = new Set<string>();

      // 环几何按 L2 数量微调：保证相邻簇不贴脸、环上节点不压 hub。
      // 第三轮教训：单纯放大半径无效——fitView 会把整张图等比缩回容器，
      // 半径和簇间距同时放大互相抵消。真正决定"挤不挤"的是【相邻簇同排
      // L2 节点的最小间距】与【标签本身宽度】的比值，这两个量必须分开调：
      // 1) CELL_W 300→352：拉开簇间距的分母；
      // 2) rx 不再一味加大，改为压低（尤其 6/7 档从 124→108），把环整体
      //    从"接近正圆"改造成"竖向椭圆"——因为章节是同排横向排列，横向空间
      //    (CELL_W) 比纵向空间(行距 475px) 紧张得多，环该往纵向要空间，
      //    不该往横向要空间，横向越推越挤邻簇；
      // 3) 标签宽度本身也收紧（见 labelBox），双管齐下才是标签宽度 vs
      //    节点间距的比值真正改善，而不是被 fitView 缩放抵消的假象。
      const ringGeometry = (count: number) => {
        if (count <= 4) return { rx: 112, ry: 160, start: -Math.PI * 0.75 };
        if (count === 5) return { rx: 96, ry: 192, start: -Math.PI / 2 };
        return { rx: 108, ry: 172, start: -Math.PI / 2 };
      };

      chapterNumbers.forEach((chapter, index) => {
        const row = index < COLS ? 0 : 1;
        const rawCol = index % COLS;
        const col = row === 1 ? COLS - 1 - rawCol : rawCol;
        hubPos.set(chapter, { x: X0 + col * CELL_W, y: ROW_Y[row] ?? ROW_Y[1] });
      });

      chapterNumbers.forEach((chapter) => {
        const center = hubPos.get(chapter)!;
        const chapterPoints = points.filter((point) => point.chapter === chapter);
        const root = chapterPoints.find((point) => point.level === 1);
        const levelTwo = chapterPoints.filter((point) => point.level === 2);
        const levelThreeCount = chapterPoints.filter((point) => point.level === 3).length;
        const tone = knowledgeTone(chapter);
        const chapterProgress = progressForChapter(progress, chapter);
        const geo = ringGeometry(levelTwo.length);

        // 簇光晕：分区暗示（不描边不带文字，避免"卡片墙"观感）
        const haloW = geo.rx * 2 + 190;
        const haloH = geo.ry * 2 + 150;
        nodes.push({
          id: `kg-halo-${chapter}`,
          type: 'clusterHalo',
          position: { x: center.x - haloW / 2, y: center.y - haloH / 2 },
          draggable: false,
          selectable: false,
          style: { zIndex: 0 },
          data: { color: graphTone[tone].color, width: haloW, height: haloH },
        });

        if (root) {
          onScreen.add(root.id);
          nodes.push(createMapNode(root.id, center.x, center.y, {
            label: root.name,
            subtitle: `CH${chapter} · ${levelTwo.length}节 · ${levelThreeCount}点${chapterProgress === null ? '' : ` · ${chapterProgress}%`}`,
            tone: masteryTone(masteryByKa?.[root.id]) ?? tone,
            size: 'hub',
            selected: root.id === selectedId,
            visible: chapterPoints.some((point) => visibleIds.has(point.id)),
            chapter,
            mastery: masteryByKa?.[root.id],
            experiments: expTitlesOf(root, false),
          }));
        }

        levelTwo.forEach((parent, parentIndex) => {
          const angle = geo.start + (parentIndex / Math.max(levelTwo.length, 1)) * Math.PI * 2;
          const x = center.x + Math.cos(angle) * geo.rx;
          const y = center.y + Math.sin(angle) * geo.ry;
          const childCount = points.filter((c) => c.parentId === parent.id).length;
          l2Angle.set(parent.id, angle);
          l2Pos.set(parent.id, { x, y });
          onScreen.add(parent.id);
          nodes.push(createMapNode(parent.id, x, y, {
            label: parent.name,
            tone: masteryTone(masteryByKa?.[parent.id]) ?? tone,
            size: 'net',
            selected: parent.id === selectedId,
            visible: visibleIds.has(parent.id),
            chapter,
            mastery: masteryByKa?.[parent.id],
            childCount,
            experiments: expTitlesOf(parent, true),
          }));
          if (root) {
            edges.push({
              id: `kg-hier-${parent.id}`,
              source: root.id,
              target: parent.id,
              sourceHandle: 'cs',
              targetHandle: 'ct',
              type: 'straight',
              animated: false,
              style: { stroke: graphTone[tone].color, strokeWidth: 1, opacity: 0.14, strokeLinecap: 'round' },
              data: { kind: 'hier' },
            });
          }
        });
      });

      // L3 按需展开：选中某个 L2（或它的 L3 子节点）时，把该簇 L3
      // 沿这个 L2 背离 hub 的方向扇形铺开，其余簇的 L3 不渲染。
      const sel = pointById[selectedId];
      const expandParent = sel?.level === 2 ? sel : sel?.level === 3 ? pointById[sel.parentId || ''] : undefined;
      if (expandParent && l2Pos.has(expandParent.id)) {
        const base = l2Pos.get(expandParent.id)!;
        const baseAngle = l2Angle.get(expandParent.id) ?? -Math.PI / 2;
        const kids = points.filter((p) => p.parentId === expandParent.id);
        const tone = knowledgeTone(expandParent.chapter);
        const spread = Math.min(Math.PI * 0.85, 0.5 * Math.max(kids.length, 2));
        kids.forEach((child, childIndex) => {
          const kidAngle = baseAngle - spread / 2 + (spread * (childIndex + 0.5)) / Math.max(kids.length, 1);
          const kx = base.x + Math.cos(kidAngle) * 128;
          const ky = base.y + Math.sin(kidAngle) * 96;
          onScreen.add(child.id);
          const node = createMapNode(child.id, kx, ky, {
            label: child.name,
            levelLabel: 'L3',
            tone: masteryTone(masteryByKa?.[child.id]) ?? tone,
            size: 'leaf',
            selected: child.id === selectedId,
            visible: visibleIds.has(child.id),
            chapter: expandParent.chapter,
            mastery: masteryByKa?.[child.id],
            experiments: expTitlesOf(child, false),
          });
          node.style = { zIndex: 70 };
          nodes.push(node);
          edges.push({
            id: `kg-expand-${child.id}`,
            source: expandParent.id,
            target: child.id,
            sourceHandle: 'cs',
            targetHandle: 'ct',
            type: 'straight',
            animated: false,
            style: { stroke: graphTone[tone].color, strokeWidth: 1, opacity: 0.42, strokeLinecap: 'round' },
            data: { kind: 'expand' },
          });
        });
      }

      // 学习主线：章节 hub 按章号首尾相接。同行走左右桩的直线，
      // 换行（CH5→CH6）走下上桩的贝塞尔，蛇形排布保证主线不穿簇。
      const mainColor = graphTone.cyan.color;
      chapterNumbers.forEach((chapter, index) => {
        const next = chapterNumbers[index + 1];
        if (next === undefined) return;
        const rootA = points.find((p) => p.level === 1 && p.chapter === chapter);
        const rootB = points.find((p) => p.level === 1 && p.chapter === next);
        if (!rootA || !rootB) return;
        const a = hubPos.get(chapter)!;
        const b = hubPos.get(next)!;
        const sameRow = a.y === b.y;
        const edge: RFEdge = {
          id: `kg-mainline-${chapter}-${next}`,
          source: rootA.id,
          target: rootB.id,
          type: sameRow ? 'straight' : 'default',
          animated: true,
          style: { stroke: mainColor, strokeWidth: 2.4, opacity: 0.3, strokeLinecap: 'round' },
          markerEnd: { type: MarkerType.ArrowClosed, color: mainColor, width: 12, height: 12 },
          data: { kind: 'main' },
        };
        if (sameRow) {
          edge.sourceHandle = b.x > a.x ? 'rs' : 'ls';
          edge.targetHandle = b.x > a.x ? 'lt' : 'rt';
        }
        edges.push(edge);
      });

      // 前置依赖边（主角）：把 prerequisites 逐条折算到屏上代表
      // （L3→父级 L2），同一对代表聚合成一条曲线，线宽随条数微增；
      // 跨章边用微流动虚线强调，章内边为细实线。
      type RolledDep = { from: string; to: string; count: number; cross: boolean; pairs: Array<[string, string]> };
      const rolledDeps = new Map<string, RolledDep>();
      points.forEach((p) => {
        (p.prerequisites || []).forEach((preId) => {
          const from = repOf(preId);
          const to = repOf(p.id);
          if (!from || !to || from === to) return;
          if (!onScreen.has(from) || !onScreen.has(to)) return;
          const key = `${from}=>${to}`;
          const entry = rolledDeps.get(key) || {
            from,
            to,
            count: 0,
            cross: pointById[from]!.chapter !== pointById[to]!.chapter,
            pairs: [],
          };
          entry.count += 1;
          entry.pairs.push([preId, p.id]);
          rolledDeps.set(key, entry);
        });
      });
      rolledDeps.forEach((dep) => {
        edges.push({
          id: `kg-dep-${dep.from}-${dep.to}`,
          source: dep.from,
          target: dep.to,
          type: 'default',
          animated: dep.cross,
          style: {
            stroke: 'url(#kg-dep-gradient)',
            strokeWidth: Math.min(1.1 + dep.count * 0.3, 2.4),
            opacity: dep.cross ? 0.52 : 0.26,
            strokeLinecap: 'round',
            cursor: 'pointer',
            ...(dep.cross ? { strokeDasharray: '7 5' } : {}),
          },
          // 内含N条依赖的小徽标：让聚合边一眼看出不是装饰线，点击可展开明细
          label: dep.count > 1 ? `${dep.count}` : undefined,
          labelStyle: { fill: '#fef3c7', fontSize: 9, fontWeight: 600, fontFamily: 'monospace' },
          labelBgStyle: { fill: 'rgba(217, 119, 6, 0.55)' },
          labelBgPadding: [3, 2],
          labelBgBorderRadius: 5,
          interactionWidth: 16,
          markerEnd: { type: MarkerType.ArrowClosed, color: graphTone.amber.color, width: 9, height: 9 },
          data: { kind: 'dep', pairs: dep.pairs },
        });
      });
    } else {
      // Single-chapter hub-and-spoke: L1 sits at the centre, every L2
      // around it on a ring, and each L2's L3 leaves continue outward
      // along the same radial spoke. The radial form fits a square-ish
      // canvas naturally at 1280–1440 viewports without the wide shelf
      // getting auto-fit-zoomed into illegibility.
      const chapter = chapterFilter;
      const chapterPoints = points.filter((point) => point.chapter === chapter);
      const root = chapterPoints.find((point) => point.level === 1);
      const levelTwo = chapterPoints.filter((point) => point.level === 2);
      const tone = knowledgeTone(chapter);
      const chapterProgress = progressForChapter(progress, chapter);

      const cx = 480;
      const cy = 360;
      const L2_RADIUS = 210;
      const L3_FIRST_OFFSET = 78;
      const L3_STEP = 38;
      // Start the first L2 at the top of the ring (-π/2) so simple chapters
      // with 4–5 L2s read top-down rather than starting from the right.
      const startAngle = -Math.PI / 2;
      // The canvas header outside ReactFlow already renders the chapter
      // title and progress; we don't drop a group container inside the
      // radial layout because its label would land far from the visual
      // centre and clutter the spokes.

      if (root) {
        nodes.push(createMapNode(root.id, cx, cy, {
          label: root.name,
          subtitle: `CH${chapter}${chapterProgress === null ? '' : ` · ${chapterProgress}%`}`,
          levelLabel: 'L1',
          tone: masteryTone(masteryByKa?.[root.id]) ?? tone,
          size: 'root',
          selected: root.id === selectedId,
          visible: visibleIds.has(root.id),
          chapter,
          mastery: masteryByKa?.[root.id],
          experiments: expTitlesOf(root, false),
        }));
      }

      const lvl2Count = Math.max(levelTwo.length, 1);
      levelTwo.forEach((parent, parentIndex) => {
        const angle = startAngle + (parentIndex / lvl2Count) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const parentX = cx + cosA * L2_RADIUS;
        const parentY = cy + sinA * L2_RADIUS;
        const childPoints = points.filter((point) => point.parentId === parent.id);
        nodes.push(createMapNode(parent.id, parentX, parentY, {
          label: parent.name,
          subtitle: childPoints.length > 0 ? `${childPoints.length}` : undefined,
          levelLabel: 'L2',
          tone: masteryTone(masteryByKa?.[parent.id]) ?? tone,
          size: 'branch',
          selected: parent.id === selectedId,
          visible: visibleIds.has(parent.id),
          chapter,
          mastery: masteryByKa?.[parent.id],
          experiments: expTitlesOf(parent, false),
        }));
        if (root) {
          edges.push(graphEdge(root.id, parent.id, tone, visibleIds.has(root.id) && visibleIds.has(parent.id), 1.6));
        }

        childPoints.forEach((child, childIndex) => {
          const distance = L2_RADIUS + L3_FIRST_OFFSET + childIndex * L3_STEP;
          const childX = cx + cosA * distance;
          const childY = cy + sinA * distance;
          const childTone = visibleIds.has(child.id) ? tone : 'slate';
          nodes.push(createMapNode(child.id, childX, childY, {
            label: child.name,
            levelLabel: 'L3',
            tone: masteryTone(masteryByKa?.[child.id]) ?? childTone,
            size: 'leaf',
            selected: child.id === selectedId,
            visible: visibleIds.has(child.id),
            chapter,
            mastery: masteryByKa?.[child.id],
            experiments: expTitlesOf(child, false),
          }));
          edges.push(graphEdge(parent.id, child.id, tone, visibleIds.has(parent.id) && visibleIds.has(child.id), 0.9));
        });
      });
    }

    // —— Focus pass ——
    // 悬停提示需要节点描述，先给所有 mapNode 挂上；有选中节点时，
    // 把选中节点的关联链路（前置链+后继链+层级亲缘）保持明亮，
    // 其余节点与边降透明度，让"这个知识点从哪来、支撑什么"一眼可见。
    nodes.forEach((node) => {
      if (node.type !== 'mapNode') return;
      const data = node.data as MapNodeData;
      const point = pointById[node.id];
      if (point && !data.description) data.description = point.description;
    });
    // 全景下选中 L1（页面初始化的兜底选中就是第 1 章根节点）不进入聚焦调光：
    // 否则首屏整张网络被压暗成"只亮第一章"；链路聚焦叙事留给 L2/L3 的点击。
    const selPoint = pointById[selectedId];
    const hasFocus = focusIds.size > 0 && Boolean(selPoint) && !(chapterFilter === 'all' && selPoint.level === 1);
    if (chapterFilter === 'all') {
      if (hasFocus) {
        const inUp = (id: string) => id === selectedId || chain.up.has(id);
        const inDown = (id: string) => id === selectedId || chain.down.has(id);
        nodes.forEach((node) => {
          if (node.type !== 'mapNode') return;
          const data = node.data as MapNodeData;
          if (!focusIds.has(node.id)) data.dimmed = true;
        });
        edges.forEach((edge) => {
          const kind = (edge.data as { kind?: string } | undefined)?.kind;
          if (kind === 'dep') {
            // 依赖边是否落在选中节点的链路上：按折算前的原始节点对判定，
            // 前置链内部的边与后继链内部的边都算链上边。
            const pairs = (edge.data as { pairs?: Array<[string, string]> }).pairs || [];
            const onChain = pairs.some(([f, t]) => (inUp(f) && inUp(t)) || (inDown(f) && inDown(t)));
            if (onChain) {
              edge.style = { ...edge.style, opacity: 0.95, strokeWidth: 2.6 };
              edge.animated = true;
            } else {
              edge.style = { ...edge.style, opacity: 0.05 };
              edge.animated = false;
            }
          } else if (kind === 'hier') {
            const active = focusIds.has(edge.source) && focusIds.has(edge.target);
            edge.style = { ...edge.style, opacity: active ? 0.26 : 0.05 };
          } else if (kind === 'main') {
            edge.style = { ...edge.style, opacity: 0.07 };
            edge.animated = false;
          }
        });
      }
    } else if (hasFocus) {
      nodes.forEach((node) => {
        if (node.type !== 'mapNode') return;
        const data = node.data as MapNodeData;
        if (!focusIds.has(node.id)) data.dimmed = true;
      });
      edges.forEach((edge) => {
        if (focusIds.has(edge.source) && focusIds.has(edge.target)) return;
        edge.style = {
          ...edge.style,
          opacity: typeof edge.style?.opacity === 'number' ? edge.style.opacity * 0.18 : 0.08,
        };
        edge.animated = false;
      });
    }

    return { nodes, edges, hasFocus };
  }, [points, progress, selectedId, visibleIds, chapterFilter, masteryByKa, focusIds, chain, repOf, experimentTitleByRefId]);

  // 选中的聚合依赖边：从当前布局的边集里按 id 找回它折算前的具体节点对
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) return null;
    const edge = layout.edges.find((e) => e.id === selectedEdgeKey);
    if (!edge) return null;
    const pairs = (edge.data as { pairs?: Array<[string, string]> } | undefined)?.pairs || [];
    return { id: edge.id, pairs };
  }, [layout.edges, selectedEdgeKey]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* relative 定位容器：DepEdgeDetailPanel 以 absolute 浮层叠加在画布内部，
          不再作为文档流的兄弟块参与高度计算。此前面板是画布下方的普通块级元素，
          若外层容器高度（继承自更外层 main/body）超出视口，画布会把面板推到
          document 里很靠下的位置——1280×720 录制分辨率下实测面板 top ≈ 981px，
          而视口只有 720px 高，评委点击后完全看不到展开内容。浮层化后面板永远
          锚定在画布可视区域内，不受外层容器实际高度影响。 */}
      <div className="relative min-h-0 flex-1">
        <GraphMapStage
          ref={stageHandleRef}
          nodes={layout.nodes}
          edges={layout.edges}
          onSelect={(id) => {
            const point = points.find((item) => item.id === id);
            if (!point) return;
            // 全景视图点击章节 hub：进入该章的单章放射树（既有视图），
            // 在那里整簇 L3 全部展开。先让镜头飞到该 hub（420ms），
            // 播完再真正切数据——避免"瞬间跳变"的生硬感。
            if (chapterFilter === 'all' && point.level === 1) {
              if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
              stageHandleRef.current?.flyToNode(point.id, { duration: 420 });
              pendingFocusTimer.current = setTimeout(() => {
                onFocusChapter?.(point.chapter);
                pendingFocusTimer.current = null;
              }, 420);
              return;
            }
            setSelectedEdgeKey(null);
            onSelect(point);
          }}
          selectedId={selectedId}
          // 未进入聚焦态（如初始化兜底选中章根）时不传 focus 集，镜头保持全景
          focusIds={layout.hasFocus ? focusIds : undefined}
          // 跟随外层容器高度，避免内层画布高于容器把 MiniMap/Controls 裁掉
          heightClassName="h-full"
          fitPadding={chapterFilter === 'all' ? 0.05 : 0.18}
          onEdgeSelect={(edgeId) => setSelectedEdgeKey((prev) => (prev === edgeId ? null : edgeId))}
        />
        {selectedEdge && selectedEdge.pairs.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <div className="pointer-events-auto w-full max-w-2xl">
              <DepEdgeDetailPanel
                pairs={selectedEdge.pairs}
                pointById={relationIndex.byId}
                onClose={() => setSelectedEdgeKey(null)}
                onSelectPoint={(id) => {
                  const point = relationIndex.byId[id];
                  if (point) onSelect(point);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 聚合依赖边展开面板：把 rolledDeps 折算前的具体 (前置 → 后继) 节点对
// 逐条列出，配合 getPrerequisiteReason 展示课程逻辑理由，
// 让评委点开一条聚合曲线就能看到"连的是什么、为什么连"。
function DepEdgeDetailPanel({
  pairs,
  pointById,
  onClose,
  onSelectPoint,
}: {
  pairs: Array<[string, string]>;
  pointById: Record<string, KnowledgePoint>;
  onClose: () => void;
  onSelectPoint: (id: string) => void;
}) {
  return (
    <div className="glass-hover max-h-[280px] shrink-0 overflow-y-auto rounded-md border border-amber-300/25 bg-[#0b1117]/95 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-200">
          <GitBranch className="h-3.5 w-3.5" />
          聚合边展开 · 内含 {pairs.length} 条具体依赖
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        {pairs.map(([fromId, toId]) => {
          const from = pointById[fromId];
          const to = pointById[toId];
          const reason = getPrerequisiteReason(toId, fromId);
          return (
            <div
              key={`${fromId}-${toId}`}
              className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectPoint(fromId)}
                  className="rounded px-1.5 py-0.5 text-cyan-200 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                >
                  {from?.name || fromId}
                </button>
                <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" />
                <button
                  type="button"
                  onClick={() => onSelectPoint(toId)}
                  className="rounded px-1.5 py-0.5 text-amber-200 hover:bg-amber-300/[0.08] hover:text-amber-100"
                >
                  {to?.name || toId}
                </button>
              </div>
              {reason ? (
                <div className="mt-1 text-[11px] leading-snug text-slate-400">{reason}</div>
              ) : (
                <div className="mt-1 text-[11px] leading-snug text-slate-600">暂无课程逻辑理由说明</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
    // 四个问题域按"概念理解→编程实现→实验操作→项目设计"的教学环节顺序
    // 摆成紧凑 2×2 网格（水平/垂直间距均收紧到 540×360），取代旧版四角
    // 散开(740×410 间距+540×415卡片框)后中央大片黑底的孤岛观感。四域彼此
    // 没有真实依赖关系，不画连接边，靠"网格顺序+紧凑间距+统一光晕"制造
    // 连贯感，而不是编造不存在的因果箭头。
    // 网格间距 500×400：光晕直径(470×366，见下)+约30px 干净间隙，四个光晕
    // 彼此贴近但不再物理相交——上一版 540×360 的纵向间距小于光晕高度(406)，
    // 导致上下两簇光晕在边界处目视"糊"在一起，DOM 标签虽不重叠但视觉观感
    // 仍是"挤压"而非"疏朗紧凑"，这版把纵向间距放宽 40px 修正。
    const centers = [
      { x: 440, y: 300 },
      { x: 940, y: 300 },
      { x: 440, y: 700 },
      { x: 940, y: 700 },
    ];
    // 每域固定 10 个二级问题类（数据口径），ellipse 半径按"横向空间比纵向
    // 紧张"原则收成竖向椭圆——呼应专业图谱 ringGeometry 的同一条经验，
    // 具体数值按问题图谱自身间距(500×400)重新标定，不是照抄专业图谱的值。
    const domainRx = 150;
    const domainRy = 118;
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];

    roots.forEach((root, rootIndex) => {
      const center = centers[rootIndex] || centers[0];
      const domains = problemGraph.filter((node) => node.parentId === root.id);
      const tone = problemTone(root.category);
      const leafTotal = problemGraph.filter((node) => node.category === root.category && node.level === 3).length;

      // 无边框径向光晕代替旧的实线矩形卡片框：同一视觉语言复用专业图谱
      // 的 ClusterHaloNode（不描边不带文字），只提供"这一片属于同一问题域"
      // 的柔和分区暗示。光晕留白从 200/170 收紧到 170/130，避免相邻簇的
      // 光晕在网格间距下彼此侵入。
      const haloW = domainRx * 2 + 170;
      const haloH = domainRy * 2 + 130;
      nodes.push({
        id: `problem-halo-${root.id}`,
        type: 'clusterHalo',
        position: { x: center.x - haloW / 2, y: center.y - haloH / 2 },
        draggable: false,
        selectable: false,
        style: { zIndex: 0 },
        data: { color: graphTone[tone].color, width: haloW, height: haloH },
      });

      nodes.push(createMapNode(root.id, center.x, center.y, {
        label: root.name,
        subtitle: `${leafTotal}`,
        levelLabel: 'L1',
        tone,
        size: 'root',
        selected: root.id === selectedId,
        visible: visibleIds.has(root.id),
      }));

      domains.forEach((domain, domainIndex) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * domainIndex) / Math.max(domains.length, 1);
        const domainX = center.x + Math.cos(angle) * domainRx;
        const domainY = center.y + Math.sin(angle) * domainRy;
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
          const leafSpread = Math.PI / 1.6;
          const leafAngle = angle - leafSpread / 2 + (leafSpread * (leafIndex + 0.5)) / Math.max(leaves.length, 1);
          const leafRadius = 62 + Math.min(leaves.length, 10) * 2.1;
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
    <GraphMapStage
      nodes={layout.nodes}
      edges={layout.edges}
      onSelect={onSelect}
      // 与专业知识图谱(kg-canvas-)同款 viewport-relative 高度：问题/思政图谱头部比
      // 专业图谱少一行图例(1280px下实测349px vs 366px)，复用同一公式的富余量绝对安全，
      // 不会导致"头部+画布"溢出可视视口（1280×720 实测通过）。
      heightClassName="h-[max(340px,calc(100vh-511px))] md:h-[max(340px,min(620px,calc(100vh-481px)))] lg:h-[max(340px,min(680px,calc(100vh-451px)))] xl:h-[max(340px,min(720px,calc(100vh-376px)))]"
    />
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
      <aside className="glass-hover order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 transition-all xl:order-none xl:sticky xl:top-20 xl:self-start">
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
        <div className="glass-hover overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035] transition-all">
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

        <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
        <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] transition-all">
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
    const cy = 400;
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

    // 半径重新标定（原 325/270、150/126 是早期写死值，未经 DOM 实测校验）：
    // 收紧到 295/215（一级主题环）与 150/112（二级元素环）后，元素环最低点
    // Y≈727，与底部章节映射行(y=790)之间留出约63px干净间隙，不再挨得死近；
    // 同时保持竖向椭圆（ry<rx）呼应专业图谱"横向空间更紧张"的同一套经验。
    const rootRx = 295;
    const rootRy = 215;
    const elementRx = 150;
    const elementRy = 112;

    roots.forEach((root, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(roots.length, 1);
      const rootX = cx + Math.cos(angle) * rootRx;
      const rootY = cy + Math.sin(angle) * rootRy;
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
        // 扇面从 π/1.25 拉宽到 π：4 元素域(S1/S3/S6)顶点朝上/朝下时，中间两个
        // 元素此前几乎水平并排(仅82px)，标签(104px宽)必然相撞——拉宽扇面后
        // 同一根上相邻元素间距全部拉开到 88px+ 中心距，DOM 实测验证零重叠。
        const spread = Math.PI;
        const elementAngle = angle - spread / 2 + (spread * (elementIndex + 0.5)) / Math.max(elements.length, 1);
        const elementX = rootX + Math.cos(elementAngle) * elementRx;
        const elementY = rootY + Math.sin(elementAngle) * elementRy;
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
      const y = 790;
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
    <GraphMapStage
      nodes={layout.nodes}
      edges={layout.edges}
      onSelect={onSelect}
      // 与专业知识图谱(kg-canvas-)同款 viewport-relative 高度：问题/思政图谱头部比
      // 专业图谱少一行图例(1280px下实测349px vs 366px)，复用同一公式的富余量绝对安全，
      // 不会导致"头部+画布"溢出可视视口（1280×720 实测通过）。
      heightClassName="h-[max(340px,calc(100vh-511px))] md:h-[max(340px,min(620px,calc(100vh-481px)))] lg:h-[max(340px,min(680px,calc(100vh-451px)))] xl:h-[max(340px,min(720px,calc(100vh-376px)))]"
    />
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
      <aside className="glass-hover order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 transition-all xl:order-none xl:sticky xl:top-20 xl:self-start">
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
        <div className="glass-hover overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035] transition-all">
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

        <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
        <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] transition-all">
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
        <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [view, setView] = useState<GraphView>('knowledge');
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kgLoading, setKgLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState(problemGraph[0]?.id || '');
  const [selectedIdeologicalId, setSelectedIdeologicalId] = useState(ideologicalNodes[0]?.id || '');
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<number | 'all'>('all');
  const [progress, setProgress] = useState<HyperLearningProgressRecord[]>([]);
  const [kaScores, setKaScores] = useState<Record<string, number>>({});
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const initialUrlAppliedRef = useRef(false);

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

  // Fetch knowledge points from API (DB-first) with static fallback
  useEffect(() => {
    let active = true;
    // 关系数据（前置依赖/实验关联/讲解）的单一可信源在静态库：
    // DB 返回的节点若缺这些字段（历史种子数据未含关系），按节点 id
    // 从静态库合并进来，保证线上（DB 路径）同样能画出关系边，
    // 无需任何数据库迁移；DB 里已被编辑过的非空关系仍以 DB 为准。
    function withStaticRelations(dbPoints: KnowledgePoint[]): KnowledgePoint[] {
      const staticById = new Map(staticKnowledgePoints.map((p) => [p.id, p]));
      return dbPoints.map((p) => {
        const s = staticById.get(p.id);
        if (!s) return p;
        return {
          ...p,
          prerequisites: p.prerequisites && p.prerequisites.length > 0 ? p.prerequisites : s.prerequisites,
          appliedIn: p.appliedIn && p.appliedIn.length > 0 ? p.appliedIn : s.appliedIn,
          tutor: p.tutor ?? s.tutor,
        };
      });
    }
    async function loadKnowledgePoints() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/knowledge-graph?type=raw', { headers });
        if (res.ok) {
          const json = await res.json();
          if (active && Array.isArray(json.data) && json.data.length > 0) {
            setKnowledgePoints(withStaticRelations(json.data));
            return;
          }
        }
      } catch { /* fallback below */ }
      if (active) setKnowledgePoints(staticKnowledgePoints);
    }
    loadKnowledgePoints().finally(() => { if (active) setKgLoading(false); });
    return () => { active = false; };
  }, []);

  // Set default selected node after knowledge points loaded
  useEffect(() => {
    if (!selectedId && knowledgePoints.length > 0) {
      setSelectedId(knowledgePoints[0]?.id || '');
    }
  }, [knowledgePoints]);

  // Load latest quiz scores from localStorage so the canvas can re-tint the
  // nodes the student is weak / strong on. Re-runs when the user identity
  // changes (storage key is namespaced by user id).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = user ? `assessment-results-${user.id}` : 'assessment-results';
      const raw = localStorage.getItem(key);
      if (!raw) {
        setKaScores({});
        return;
      }
      const parsed = JSON.parse(raw) as { scores?: Record<string, { score?: number }> };
      const direct: Record<string, number> = {};
      Object.entries(parsed.scores || {}).forEach(([ka, value]) => {
        if (typeof value?.score === 'number' && /^\d+(\.\d+)*$/.test(ka)) {
          direct[ka] = value.score;
        }
      });
      // Aggregate child scores up to parents (L3 -> L2 -> L1) so the heat map
      // shows on hierarchy nodes even when only leaves were quizzed.
      const childIds: Record<string, string[]> = {};
      knowledgePoints.forEach((p) => {
        if (p.parentId) {
          (childIds[p.parentId] ||= []).push(p.id);
        }
      });
      const resolve = (id: string): number | null => {
        if (typeof direct[id] === 'number') return direct[id];
        const kids = childIds[id];
        if (!kids?.length) return null;
        const vals = kids.map(resolve).filter((v): v is number => typeof v === 'number');
        if (!vals.length) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const out: Record<string, number> = { ...direct };
      knowledgePoints.forEach((p) => {
        if (typeof out[p.id] !== 'number') {
          const v = resolve(p.id);
          if (typeof v === 'number') out[p.id] = v;
        }
      });
      setKaScores(out);
    } catch {
      setKaScores({});
    }
  }, [user, knowledgePoints]);

  const pointById = useMemo(() => {
    const m: Record<string, KnowledgePoint> = {};
    knowledgePoints.forEach((p) => { m[p.id] = p; });
    return m;
  }, [knowledgePoints]);
  const knowledgePointByGraphId = useMemo(() => {
    const map: Record<string, KnowledgePoint> = {};
    knowledgePoints.forEach((point) => {
      if (point.graphNodeId && !map[point.graphNodeId]) map[point.graphNodeId] = point;
    });
    return map;
  }, [knowledgePoints]);
  const experimentTitleByRefId = useMemo(() => {
    const m: Record<string, string> = {};
    knowledgePoints.forEach((p) => {
      p.resources?.forEach((r) => {
        if (r.type === 'experiment' && r.refId && !m[r.refId]) m[r.refId] = r.title;
      });
    });
    return m;
  }, [knowledgePoints]);

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
    // After the initial deep-link is applied, the state→URL effect keeps
    // searchParams in sync with the in-memory state. Re-applying URL→state
    // on every searchParams change would force-override fields that the
    // user just touched (e.g. clicking a node in the "all chapters"
    // overview snaps the canvas to that node's single-chapter view because
    // we re-derive chapter from the node id). Run this effect only on the
    // very first render where the URL is the only source of truth.
    if (initialUrlAppliedRef.current) return;

    const viewParam = searchParams.get('view');
    const nodeParam = searchParams.get('node');
    const chapterParam = parseChapterParam(searchParams.get('chapter'));
    const qParam = searchParams.get('q');

    if (isGraphView(viewParam)) setView(viewParam);
    if (qParam) setQuery(qParam);

    if (chapterParam !== null) {
      setChapter(chapterParam);
      if (!viewParam) setView('knowledge');
    }

    if (nodeParam) {
      const knowledgePoint = knowledgePoints.find((point) => point.id === nodeParam) || knowledgePointByGraphId[nodeParam];
      if (knowledgePoint) {
        setView('knowledge');
        setSelectedId(knowledgePoint.id);
        // Only honour a node-derived chapter switch on the initial deep
        // link — never re-apply it from a state→URL round-trip.
        if (chapterParam === null) setChapter(knowledgePoint.chapter);
      } else if (problemGraph.some((node) => node.id === nodeParam)) {
        setView('problem');
        setSelectedProblemId(nodeParam);
      } else if (ideologicalNodes.some((node) => node.id === nodeParam)) {
        setView('ideological');
        setSelectedIdeologicalId(nodeParam);
      } else {
        setView('knowledge');
      }
    }

    initialUrlAppliedRef.current = true;
  }, [knowledgePointByGraphId, searchParams]);

  // Sync state -> URL (replace, no history pollution). Skipped on the very
  // first render so we don't trample the deep-link applied above.
  useEffect(() => {
    if (!initialUrlAppliedRef.current) return;
    const base = pathname || '/knowledge-graph';
    const next = new URLSearchParams();
    if (view !== 'knowledge') next.set('view', view);
    if (chapter !== 'all') next.set('chapter', String(chapter));
    const trimmedQ = query.trim();
    if (trimmedQ) next.set('q', trimmedQ);
    let nodeForUrl = '';
    if (view === 'knowledge') nodeForUrl = selectedId;
    else if (view === 'problem') nodeForUrl = selectedProblemId;
    else if (view === 'ideological') nodeForUrl = selectedIdeologicalId;
    if (nodeForUrl) next.set('node', nodeForUrl);
    const qs = next.toString();
    const url = qs ? `${base}?${qs}` : base;
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== url) {
      router.replace(url, { scroll: false });
    }
  }, [view, chapter, query, selectedId, selectedProblemId, selectedIdeologicalId, pathname, router]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return knowledgePoints.filter((point) => {
      const chapterMatch = chapter === 'all' || point.chapter === chapter;
      const queryMatch = !q || `${point.name} ${point.description || ''}`.toLowerCase().includes(q);
      return chapterMatch && queryMatch;
    });
  }, [chapter, query, knowledgePoints]);
  const visibleKnowledgeIds = useMemo(() => new Set(filteredList.map((point) => point.id)), [filteredList]);
  const chapterNumbers = useMemo(() => Array.from(new Set(knowledgePoints.map((point) => point.chapter))).sort((a, b) => a - b), [knowledgePoints]);
  const levelCounts = useMemo(() => ({
    l1: knowledgePoints.filter((point) => point.level === 1).length,
    l2: knowledgePoints.filter((point) => point.level === 2).length,
    l3: knowledgePoints.filter((point) => point.level === 3).length,
  }), [knowledgePoints]);
  // 关系网统计：依赖边/跨章边/实验关联，按当前实际加载的数据实时计算
  //（DB 路径与静态回退口径一致），供统计面板展示
  const relationCounts = useMemo(() => {
    const byId = new Map(knowledgePoints.map((p) => [p.id, p]));
    let deps = 0;
    let cross = 0;
    let expLinks = 0;
    knowledgePoints.forEach((p) => {
      (p.prerequisites || []).forEach((pre) => {
        const source = byId.get(pre);
        if (!source) return;
        deps += 1;
        if (source.chapter !== p.chapter) cross += 1;
      });
      expLinks += (p.appliedIn || []).length;
    });
    return { deps, cross, expLinks };
  }, [knowledgePoints]);

  if (kgLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">正在加载知识图谱...</div>
      </div>
    );
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100">
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

      {view === 'knowledge' && (
        <div className="px-4 pt-4 md:px-6">
          <NextStepBanner />
        </div>
      )}

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
      <main className="grid items-start gap-5 px-4 py-5 lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_300px] md:px-6">
        {isMobileSidebarOpen && (
          <button
            type="button"
            aria-label="关闭目录"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
        <aside
          className={cn(
            'rounded-md border border-white/[0.08] bg-[#0c1117] p-3 text-slate-100',
            'fixed inset-y-0 left-0 z-50 w-72 transform overflow-y-auto transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:transform-none lg:overflow-visible lg:bg-white/[0.035]',
            'lg:order-none lg:sticky lg:top-20 lg:self-start',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="text-xs font-semibold text-slate-200">章节 · 知识点</span>
            <button
              type="button"
              aria-label="关闭目录"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="rounded-md border border-white/[0.08] bg-black/30 p-1 text-slate-300 hover:bg-white/[0.06]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
          <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">知识点列表 · {knowledgePoints.length}点课程清单</div>
          <div className="max-h-[640px] space-y-1 overflow-y-auto pr-1">
            {filteredList.map((point) => {
              const chapterProgress = progressForChapter(progress, point.chapter);
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => {
                    goToPoint(point.id);
                    // L1 即章节根：点击列表里的章节直接聚焦到该章单章树，
                    // 而不是只在原地高亮
                    if (point.level === 1) setChapter(point.chapter);
                    setIsMobileSidebarOpen(false);
                  }}
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
              <button
                type="button"
                aria-label="展开目录"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded-md border border-white/[0.08] bg-black/30 p-1 text-slate-300 hover:bg-white/[0.06] lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <Network className="h-4 w-4 text-cyan-200" />
              <span className="text-[15px]">
                {knowledgePoints.length} 个知识点 · <span className="text-cyan-200">{chapter === 'all' ? '全部章节' : `第 ${chapter} 章`}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(kaScores).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-300">
                  <span className="text-slate-500">掌握度</span>
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ≥80
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 60–79
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 text-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> &lt;60
                  </span>
                </div>
              )}
              {/* 层级图例：三种节点的样式示意 + 计数（数字口径不变） */}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-slate-300">
                <span className="inline-flex items-center gap-1.5 rounded border border-white/[0.1] bg-black/25 px-2 py-1">
                  <span className="inline-block h-3 w-3 rounded-[3px] border border-cyan-300/70 bg-cyan-400/25" />
                  L1 章 {levelCounts.l1}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded border border-white/[0.1] bg-black/25 px-2 py-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-cyan-300/45 bg-cyan-400/15" />
                  L2 节 {levelCounts.l2}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded border border-white/[0.1] bg-black/25 px-2 py-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
                  L3 点 {levelCounts.l3}
                </span>
              </div>
              {/* 连线图例：全景视图的三类边 + 实验关联角标 */}
              {chapter === 'all' && (
                <div className="hidden flex-wrap items-center gap-2.5 font-mono text-[10px] text-slate-400 md:flex">
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="24" height="6" aria-hidden>
                      <defs>
                        <linearGradient id="kg-legend-dep" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#67e8f9" />
                          <stop offset="100%" stopColor="#fbbf24" />
                        </linearGradient>
                      </defs>
                      <line x1="1" y1="3" x2="19" y2="3" stroke="url(#kg-legend-dep)" strokeWidth="1.8" strokeDasharray="5 3" strokeLinecap="round" />
                      <path d="M18 0.5 23 3 18 5.5 Z" fill="#fbbf24" opacity="0.85" />
                    </svg>
                    前置依赖
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="24" height="6" aria-hidden>
                      <line x1="1" y1="3" x2="19" y2="3" stroke="#67e8f9" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
                      <path d="M18 0.5 23 3 18 5.5 Z" fill="#67e8f9" opacity="0.6" />
                    </svg>
                    学习主线
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="24" height="6" aria-hidden>
                      <line x1="1" y1="3" x2="23" y2="3" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
                    </svg>
                    章内层级
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/60 bg-[#04231a] text-emerald-200">
                      <FlaskConical className="h-2 w-2" />
                    </span>
                    实验关联
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* Re-keying on chapter change forces React to remount the
              canvas, which lets the existing animate-fade-in keyframe
              cross-fade the new layout in instead of snapping it on.
              Height is viewport-relative (100vh minus the measured header
              height at each breakpoint, +margin) instead of a fixed px
              value, so "header + canvas" never exceeds the visible
              viewport (verified at 1280x720, the official recording
              resolution) while still growing generously on taller
              screens. Floors at 340px keep the graph usable; the page's
              outer overflow-auto remains as a scroll fallback for
              viewports too short even for the floor (e.g. 1024x768). */}
          <div
            key={`kg-canvas-${chapter}`}
            className="h-[max(340px,calc(100vh-511px))] animate-fade-in md:h-[max(340px,min(620px,calc(100vh-481px)))] lg:h-[max(340px,min(680px,calc(100vh-451px)))] xl:h-[max(340px,min(720px,calc(100vh-376px)))]"
          >
            <FullKnowledgeMap
              points={knowledgePoints}
              selectedId={selectedId}
              visibleIds={visibleKnowledgeIds}
              progress={progress}
              onSelect={(point) => goToPoint(point.id)}
              onFocusChapter={(value) => {
                // 点击章节 hub：切到该章单章放射树视图，并选中章根节点
                setChapter(value);
                const root = knowledgePoints.find((p) => p.level === 1 && p.chapter === value);
                if (root) setSelectedId(root.id);
              }}
              chapterFilter={chapter}
              masteryByKa={kaScores}
              experimentTitleByRefId={experimentTitleByRefId}
            />
          </div>
        </section>

        <div className="order-3 space-y-4 lg:order-none lg:col-span-2 2xl:col-span-1">
          <DetailPanel
            point={selected}
            childPoints={childPoints}
            pointById={pointById}
            experimentTitleByRefId={experimentTitleByRefId}
            onSelectId={goToPoint}
            allPoints={knowledgePoints}
          />
          <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
          <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
              <div className="rounded-md border border-amber-300/15 bg-amber-300/[0.04] p-3">
                <div className="font-mono text-xl text-amber-100">{relationCounts.deps}</div>
                <div className="text-xs text-slate-500">依赖边 · 跨章 {relationCounts.cross}</div>
              </div>
              <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] p-3">
                <div className="font-mono text-xl text-emerald-100">{relationCounts.expLinks}</div>
                <div className="text-xs text-slate-500">实验关联</div>
              </div>
            </div>
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
