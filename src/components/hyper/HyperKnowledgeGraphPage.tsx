'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType, CSSProperties, ReactNode, RefObject } from 'react';
import { forwardRef, useCallback, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { ClientRequestTimeoutError, fetchClientRequest } from '@/lib/client-fetch';
import {
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
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer2,
  Network,
  PanelRightClose,
  PanelRightOpen,
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
import {
  knowledgePoints as staticKnowledgePoints,
  getPrerequisiteReason,
  LEGACY_GRAPH_NODE_TARGETS,
  resolveChapterSelection,
  resolveKnowledgeResourceHref,
  type KnowledgePoint,
  type KnowledgePointResource,
} from '@/lib/knowledge-points';
import type { PublicQuestion } from '@/lib/quiz-data';
import { fetchHyperJson, normalizeLearningProgress, type HyperLearningProgressRecord } from '@/lib/hyper-data';
import {
  getProblemRemediationPlan,
  problemGraph,
  problemGraphStats,
  type ProblemNode,
} from '@/lib/problem-graph';
import {
  categoryMeta,
  getExplicitSipMappingsForKnowledgePoint,
  ideologicalGraphStats,
  ideologicalNodes,
  sipMappings,
  type IdeologicalCategory,
  type IdeologicalNode,
} from '@/lib/ideological-graph';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { NextStepBanner, type NextStepSnapshot } from '@/components/onboarding/NextStepBanner';
import {
  ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_ROOT_NODE_ID,
  ADDRESSING_TASK_PRESET,
  buildTaskResourceEvidence,
} from '@/lib/lesson-tasks';
type GraphView = 'knowledge' | 'problem' | 'ideological';

/**
 * Every graph uses the same two-column desktop workspace. In canvas focus mode
 * the navigator is hidden, so the remaining section must explicitly span one
 * full-width column; otherwise CSS Grid places it in the former 220px sidebar.
 */
export function getGraphWorkspaceClassName(isCanvasFocus: boolean, elevated: boolean): string {
  return cn(
    'relative px-3 py-2 sm:px-4 lg:grid lg:gap-2.5',
    isCanvasFocus ? 'lg:grid-cols-1' : 'lg:grid-cols-[220px_minmax(0,1fr)]',
    elevated ? 'z-40 lg:z-10' : 'z-10',
  );
}

const DRAWER_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useGraphDrawerViewport(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = (): void => setMatches(query.matches);
    update();
    query.addEventListener?.('change', update);
    return (): void => query.removeEventListener?.('change', update);
  }, []);
  return matches;
}

/** Focus the page search from `/` only when no modal surface owns focus. */
export function useGraphSearchShortcut(
  searchInputRef: RefObject<HTMLInputElement>,
  disabled = false,
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '/') return;
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (isEditing || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (!disabled) searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, searchInputRef]);
}

type IsolatedGraphElement = {
  element: HTMLElement;
  hadInert: boolean;
  ariaHidden: string | null;
};

/**
 * Full-canvas mode visually covers the application shell, so it must also
 * behave like a contained, reversible focus surface. This hook locks page
 * scrolling, isolates every sibling branch outside the workbench, keeps Tab
 * inside the canvas, and restores the control that entered focus mode.
 */
export function useGraphCanvasFocusDialog(
  active: boolean,
  rootRef: RefObject<HTMLElement>,
  onRequestExit?: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root) return;

    const activeElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const returnTarget = activeElement?.isConnected ? activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const isolated: IsolatedGraphElement[] = [];

    // Walk from the workbench to <body>, isolating siblings at every level.
    // This leaves the active branch usable while preventing screen readers and
    // keyboard users from reaching visually covered application controls.
    let branch: HTMLElement | null = root;
    while (branch?.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === branch || !(sibling instanceof HTMLElement)) return;
        if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') return;
        isolated.push({
          element: sibling,
          hadInert: sibling.hasAttribute('inert'),
          ariaHidden: sibling.getAttribute('aria-hidden'),
        });
        sibling.setAttribute('inert', '');
        sibling.setAttribute('aria-hidden', 'true');
      });
      if (parent === document.body) break;
      branch = parent;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const focusableItems = (): HTMLElement[] => Array.from(
      root.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR),
    ).filter((element) => (
      !element.hasAttribute('inert')
      && element.getAttribute('aria-hidden') !== 'true'
      && element.getClientRects().length > 0
    ));
    const focusInitialControl = (): void => {
      if (root.contains(document.activeElement)) return;
      const preferred = root.querySelector<HTMLElement>('[data-kg-focus-exit="true"]');
      const target = preferred && focusableItems().includes(preferred)
        ? preferred
        : focusableItems()[0] ?? root;
      target.focus();
    };
    const focusFrame = window.requestAnimationFrame(focusInitialControl);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && onRequestExit) {
        event.preventDefault();
        event.stopPropagation();
        onRequestExit();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableItems();
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (!root.contains(current) || current === root) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', handleKeyDown, true);

    return (): void => {
      window.cancelAnimationFrame(focusFrame);
      root.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      isolated.forEach(({ element, hadInert, ariaHidden }) => {
        if (!element.isConnected) return;
        if (!hadInert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected && returnTarget.getClientRects().length > 0) {
          returnTarget.focus();
        }
      });
    };
  }, [active, onRequestExit, rootRef]);
}

/** Mobile graph drawers behave as real dialogs: trap focus, lock scroll and restore the trigger. */
function useMobileDrawerDialog(
  open: boolean,
  onClose: () => void,
  triggerRef: RefObject<HTMLButtonElement>,
  panelRef: RefObject<HTMLElement>,
  closeOnDesktop = true,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    if (desktopQuery.matches) {
      if (closeOnDesktop) onCloseRef.current();
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const activeBeforeOpen = document.activeElement instanceof HTMLElement
      && document.activeElement.matches(DRAWER_FOCUSABLE_SELECTOR)
      && !panel.contains(document.activeElement)
      ? document.activeElement
      : null;
    const fallbackReturnTarget = triggerRef.current;
    const returnTarget = activeBeforeOpen ?? fallbackReturnTarget;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const focusableItems = (): HTMLElement[] => Array.from(
      panel.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR),
    ).filter((element) => (
      element.getClientRects().length > 0
      && element.getAttribute('aria-hidden') !== 'true'
      && !element.closest('[aria-hidden="true"], [inert]')
    ));
    const focusInitialControl = (): void => {
      const preferred = panel.querySelector<HTMLElement>('[data-drawer-initial-focus="true"]');
      const visiblePreferred = preferred && focusableItems().includes(preferred) ? preferred : null;
      if (visiblePreferred) {
        visiblePreferred.focus();
        return;
      }
      // During the opening transform browsers can briefly report every child as
      // non-visible. Keep focus inside the dialog and retry after the transition
      // instead of leaving it on the trigger behind the modal.
      panel.focus();
    };
    const focusFrame = window.requestAnimationFrame(() => {
      focusInitialControl();
    });
    const focusRetryTimer = window.setTimeout(() => {
      const activeElement = document.activeElement;
      if (!panel.contains(activeElement) || activeElement === panel || activeElement === returnTarget) {
        focusInitialControl();
      }
    }, 340);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableItems();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const activeElement = document.activeElement;
      if (!panel.contains(activeElement) || activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleDesktopBreakpoint = (event: MediaQueryListEvent): void => {
      if (event.matches && closeOnDesktop) onCloseRef.current();
    };
    desktopQuery.addEventListener('change', handleDesktopBreakpoint);
    window.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(focusRetryTimer);
      desktopQuery.removeEventListener('change', handleDesktopBreakpoint);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      const focusTarget = returnTarget?.isConnected && returnTarget.getClientRects().length > 0
        ? returnTarget
        : fallbackReturnTarget?.isConnected && fallbackReturnTarget.getClientRects().length > 0
          ? fallbackReturnTarget
          : null;
      focusTarget?.focus();
    };
  }, [closeOnDesktop, open, panelRef, triggerRef]);
}

interface MobileDrawerDialogProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
  panelRef: RefObject<HTMLElement>;
  id: string;
  label: string;
  labelId: string;
  backdropLabel: string;
  className: string;
  closeOnDesktop?: boolean;
  children: ReactNode;
}

/** Shared shell keeps graph navigation, filters and detail drawers behaviorally identical. */
export function MobileDrawerDialog({
  open,
  onClose,
  triggerRef,
  panelRef,
  id,
  label,
  labelId,
  backdropLabel,
  className,
  closeOnDesktop = true,
  children,
}: MobileDrawerDialogProps) {
  useMobileDrawerDialog(open, onClose, triggerRef, panelRef, closeOnDesktop);
  const drawer = (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={backdropLabel}
          onClick={onClose}
          className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        ref={panelRef}
        id={id}
        aria-label={open ? undefined : label}
        aria-labelledby={open ? labelId : undefined}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        tabIndex={open ? -1 : undefined}
        data-kg-mobile-drawer-open={open ? 'true' : undefined}
        className={className}
      >
        {children}
      </aside>
    </>
  );
  // Portaling the open mobile sheet avoids clipping below AppLayout's sticky
  // header and the graph workbench's overflow boundary. The closed/desktop
  // sidebar remains inline so the existing two-column layout is unchanged.
  return open && typeof document !== 'undefined'
    ? createPortal(drawer, document.body)
    : drawer;
}

const publicQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.number().int(), type: z.literal('multiple-choice'), questionText: z.string(),
    options: z.array(z.string()), ka: z.string(), chapter: z.number().int(),
  }),
  z.object({
    id: z.number().int(), type: z.literal('code-completion'), questionText: z.string(),
    code: z.string(), ka: z.string(), chapter: z.number().int(),
  }),
]);
const questionResponseSchema = z.object({ data: z.array(publicQuestionSchema) });
const resourceSchema = z.object({
  type: z.enum(['video', 'animation', 'slide', 'quiz', 'document', 'experiment', 'image']),
  title: z.string(), url: z.string().optional(), refId: z.string().optional(), duration: z.number().optional(),
});
const knowledgePointSchema: z.ZodType<KnowledgePoint> = z.object({
  id: z.string(), name: z.string(), level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  parentId: z.string().optional(), chapter: z.number().int().positive(), description: z.string().optional(),
  graphNodeId: z.string().optional(), resources: z.array(resourceSchema).optional(),
  tutor: z.object({
    core: z.string(), whyImportant: z.string().optional(), commonMistake: z.string().optional(), takeaway: z.string().optional(),
  }).optional(),
  prerequisites: z.array(z.string()).optional(), appliedIn: z.array(z.string()).optional(),
  prerequisiteReasons: z.record(z.string(), z.string()).optional(),
});
const knowledgePointResponseSchema = z.object({
  data: z.array(knowledgePointSchema),
  source: z.enum(['db', 'static']).optional(),
});
const scoreMapSchema = z.record(z.string(), z.object({
  correct: z.number().optional(), total: z.number().optional(), score: z.number(),
}));
const localAssessmentSchema = z.object({
  scores: scoreMapSchema,
  weakKAs: z.array(z.string()).optional(),
  totalScore: z.number().optional(),
});
const serverAssessmentDetailsSchema = z.object({
  scoresByKA: scoreMapSchema,
  weakAreas: z.array(z.string()).optional(),
  score: z.number().optional(),
});
const activityResponseSchema = z.object({
  activities: z.array(z.object({ details: z.string().nullish() })).optional(),
  data: z.array(z.object({ details: z.string().nullish() })).optional(),
});

const graphViews: Array<{ id: GraphView; label: string; count: number; summary: string; icon: LucideIcon }> = [
  { id: 'knowledge', label: '专业知识', count: staticKnowledgePoints.length, summary: '概念、先修与实验', icon: Network },
  { id: 'problem', label: '问题诊断', count: problemGraph.length, summary: '错误、症状与排查', icon: AlertTriangle },
  { id: 'ideological', label: '育人主题', count: ideologicalNodes.length, summary: '周次、案例与价值', icon: Flag },
];

const graphViewTone: Record<GraphView, { active: string; icon: string; index: string }> = {
  knowledge: {
    active: 'border-cyan-300/35 bg-cyan-300/[0.10] text-cyan-50 shadow-[inset_0_-2px_0_rgba(103,232,249,.68)]',
    icon: 'text-cyan-200',
    index: '01',
  },
  problem: {
    active: 'border-amber-300/35 bg-amber-300/[0.10] text-amber-50 shadow-[inset_0_-2px_0_rgba(252,211,77,.68)]',
    icon: 'text-amber-200',
    index: '02',
  },
  ideological: {
    active: 'border-rose-300/35 bg-rose-300/[0.10] text-rose-50 shadow-[inset_0_-2px_0_rgba(253,164,175,.68)]',
    icon: 'text-rose-200',
    index: '03',
  },
};

const problemCategories: ProblemNode['category'][] = ['concept', 'coding', 'experiment', 'project'];
const problemDifficulties: ProblemNode['difficulty'][] = ['easy', 'medium', 'hard'];
const ideologicalCategories: IdeologicalCategory[] = ['patriotism', 'craftsmanship', 'ethics', 'innovation', 'teamwork', 'aerospace'];

function parseChapterParam(value: string | null): number | 'all' | null {
  if (!value || value === 'all') return value === 'all' ? 'all' : null;
  const matched = value.match(/^(?:ch)?(\d{1,2})$/i);
  if (!matched) return null;
  const chapter = Number(matched[1]);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 10 ? chapter : null;
}

function isGraphView(value: string | null): value is GraphView {
  return value === 'knowledge' || value === 'problem' || value === 'ideological';
}

export function buildGraphNodeSelectionUrl({
  pathname,
  currentSearch,
  currentHash = '',
  view,
  nodeId,
  chapter,
}: {
  pathname: string;
  currentSearch: string;
  currentHash?: string;
  view: GraphView;
  nodeId: string;
  chapter?: number;
}): string {
  const next = new URLSearchParams(currentSearch);
  next.set('node', nodeId);
  if (view === 'knowledge') {
    // The default knowledge view intentionally omits `view`; if a caller has
    // an explicit view value, correct it without discarding any task/filter
    // parameters already present in the URL.
    if (next.has('view')) next.set('view', 'knowledge');
    if (typeof chapter === 'number' && next.has('chapter')) next.set('chapter', String(chapter));
  } else {
    next.set('view', view);
  }
  const query = next.toString();
  return `${pathname}${query ? `?${query}` : ''}${currentHash}`;
}

export function shouldAutoOpenGraphInspector(isCanvasFocus: boolean, isInspectorOpen: boolean): boolean {
  return !isCanvasFocus && !isInspectorOpen;
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

const difficultyLabel: Record<ProblemNode['difficulty'], string> = {
  easy: '基础',
  medium: '进阶',
  hard: '综合',
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

function isSectionQuizFallback(resource: KnowledgePointResource): boolean {
  return resource.type === 'quiz'
    && Boolean(resource.refId?.match(/^quiz-ch\d{1,2}-.+/i))
    && resource.refId !== 'quiz-ch3-addressing'
    && resource.refId !== 'quiz-ch10-ai-literacy';
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

function QuizPreviewItem({ q, index }: { q: PublicQuestion; index: number }) {
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
      <div className="mt-2 text-[10px] leading-5 text-slate-500">答案在正式交卷后由服务端反馈。</div>
    </div>
  );
}

const ADDRESSING_MODES = [
  { id: '3.1.1', name: '立即寻址', syntax: '#data', formation: '指令中的立即数', operand: '常数本身', example: 'MOV A,#30H' },
  { id: '3.1.2', name: '直接寻址', syntax: 'direct', formation: '指令给出RAM/SFR地址', operand: '存储单元内容', example: 'MOV A,30H' },
  { id: '3.1.3', name: '寄存器寻址', syntax: 'Rn', formation: '寄存器编号选择R0—R7', operand: '寄存器内容', example: 'MOV A,R3' },
  { id: '3.1.4', name: '寄存器间接', syntax: '@Ri', formation: 'Ri内容作为有效地址', operand: '该地址中的数据', example: 'MOV A,@R0' },
  { id: '3.1.5', name: '变址寻址', syntax: '@A+DPTR', formation: '基址与变址相加', operand: '程序存储器表项', example: 'MOVC A,@A+DPTR' },
  { id: '3.1.6', name: '相对寻址', syntax: 'rel', formation: 'PC与有符号偏移相加', operand: '转移目标地址', example: 'SJMP LOOP' },
  { id: '3.1.7', name: '位寻址', syntax: 'bit', formation: '位地址选择单个位', operand: '位值0或1', example: 'SETB P1.0' },
] as const;

function addressingReviewStorageKey(pathId: string, stepId: string): string {
  return `kg-addressing-review:${pathId}:${stepId}`;
}

function loadAddressingReview(pathId: string | null, stepId: string | null): Set<number> {
  if (typeof window === 'undefined' || !pathId || !stepId) return new Set();
  try {
    const raw = window.localStorage.getItem(addressingReviewStorageKey(pathId, stepId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    const reviewedIds = new Set(parsed.filter((value): value is string => typeof value === 'string'));
    return new Set(ADDRESSING_MODES.flatMap((mode, index) => reviewedIds.has(mode.id) ? [index] : []));
  } catch {
    return new Set();
  }
}

function AddressingModeCompare({
  currentPointId,
  onSelectNode,
}: {
  currentPointId?: string;
  onSelectNode?: (id: string) => void;
}) {
  const searchParams = useSearchParams();
  const taskPathId = searchParams?.get('taskPathId') ?? null;
  const taskStepId = searchParams?.get('taskStepId') ?? null;
  const isGraphTaskStep = taskStepId === 'addressing-graph';
  const isAnimationTaskStep = taskStepId === 'addressing-animation';
  const isAddressingTaskStep = isGraphTaskStep || isAnimationTaskStep;
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visited, setVisited] = useState<Set<number>>(() => (
    isAddressingTaskStep ? loadAddressingReview(taskPathId, taskStepId) : new Set([0])
  ));
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'already-complete' | 'error'>('idle');
  const active = ADDRESSING_MODES[activeIndex]!;
  const taskGuidance = isGraphTaskStep
    ? '当前只核对 3.1 与七个子节点的层级。请逐个点击节点；完整动态对比将在下一步开放。'
    : isAnimationTaskStep
      ? '请逐一查看七种方式；达到 7/7 后，平台才会保存本步骤的学习记录。'
      : '可逐一查看七种方式，比较地址形成过程、操作数来源与适用场景。';

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % ADDRESSING_MODES.length;
        setVisited((previous) => {
          const nextVisited = new Set(previous).add(next);
          if (nextVisited.size >= ADDRESSING_MODES.length) setPlaying(false);
          return nextVisited;
        });
        return next;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    setPlaying(false);
    setSyncStatus('idle');
    setVisited(isAddressingTaskStep ? loadAddressingReview(taskPathId, taskStepId) : new Set([0]));
    setActiveIndex(0);
  }, [isAddressingTaskStep, taskPathId, taskStepId]);

  useEffect(() => {
    if (!isGraphTaskStep || !currentPointId?.startsWith('3.1.')) return;
    const currentIndex = ADDRESSING_MODES.findIndex((mode) => mode.id === currentPointId);
    if (currentIndex < 0) return;
    setVisited((previous) => previous.has(currentIndex) ? previous : new Set(previous).add(currentIndex));
  }, [currentPointId, isGraphTaskStep]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isAddressingTaskStep || !taskPathId || !taskStepId) return;
    const reviewedIds = ADDRESSING_MODES
      .filter((_, index) => visited.has(index))
      .map((mode) => mode.id);
    try {
      window.localStorage.setItem(
        addressingReviewStorageKey(taskPathId, taskStepId),
        JSON.stringify(reviewedIds),
      );
    } catch {
      // Storage can be restricted; the server completion receipt remains authoritative.
    }
  }, [isAddressingTaskStep, taskPathId, taskStepId, visited]);

  const syncTaskEvidence = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    const token = getStoredAccessToken();
    if (!taskPathId || !taskStepId) return;
    if (isGraphTaskStep && visited.size < ADDRESSING_MODES.length) return;
    const taskStep = ADDRESSING_TASK_PRESET.steps.find((step) => step.stepId === taskStepId);
    const evidence = taskStep ? buildTaskResourceEvidence(taskStep, taskPathId) : null;
    if (!evidence) return;
    if (!token) {
      setSyncStatus('error');
      return;
    }
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/learning-events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          events: [{
            ...evidence,
            progress: 100,
            metadata: isGraphTaskStep
              ? {
                  source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
                  pathId: taskPathId,
                  stepId: taskStepId,
                  rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
                  visitedNodeIds: ADDRESSING_MODES
                    .filter((_, index) => visited.has(index))
                    .map((mode) => mode.id),
                }
              : {
                  source: ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
                  pathId: taskPathId,
                  stepId: taskStepId,
                  visitedModes: ADDRESSING_MODES.map((mode) => mode.id),
                },
          }],
        }),
      });
      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => null);
        if (raw && typeof raw === 'object' && 'code' in raw && raw.code === 'TASK_PATH_COMPLETED') {
          setSyncStatus('already-complete');
          return;
        }
        const detail = raw && typeof raw === 'object' && 'error' in raw && typeof raw.error === 'string'
          ? raw.error
          : '学习记录同步失败';
        throw new Error(detail);
      }
      setSyncStatus('saved');
    } catch {
      setSyncStatus('error');
    }
  }, [isGraphTaskStep, taskPathId, taskStepId, visited]);

  useEffect(() => {
    if (taskStepId !== 'addressing-animation'
      || visited.size < ADDRESSING_MODES.length
      || syncStatus !== 'idle') return;
    void syncTaskEvidence();
  }, [syncStatus, syncTaskEvidence, taskStepId, visited.size]);

  const selectMode = (index: number) => {
    setActiveIndex(index);
    setVisited((previous) => new Set(previous).add(index));
    if (isGraphTaskStep) onSelectNode?.(ADDRESSING_MODES[index]!.id);
  };

  return (
    <div id="addressing-compare" className="scroll-mt-20 border-b border-white/[0.08] bg-cyan-300/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200">
            {isGraphTaskStep ? 'Hierarchy Check · 7 nodes' : 'Interactive Compare · 7 modes'}
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-50">
            {isGraphTaskStep ? '3.1 寻址方式：层级核对' : '七种寻址方式：地址形成过程'}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{taskGuidance}</p>
        </div>
        {!isGraphTaskStep && (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-3 text-xs text-cyan-100 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            aria-pressed={playing}
          >
            <PlayCircle className={cn('h-4 w-4', playing && 'animate-pulse')} />
            {playing ? '暂停演示' : '自动演示'}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ADDRESSING_MODES.map((mode, index) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => selectMode(index)}
            className={cn(
              'min-h-11 rounded-md border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
              (isGraphTaskStep ? currentPointId === mode.id : index === activeIndex)
                ? 'border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-50'
                : 'border-white/[0.08] bg-black/20 text-slate-300 hover:bg-white/[0.05]',
            )}
          >
            <span className="block font-mono text-[9px] text-slate-500">{mode.id}</span>
            <span className="mt-0.5 block text-[11px] font-medium">{mode.name}</span>
            {visited.has(index) && <CheckCircle2 className="mt-1 h-3 w-3 text-emerald-300" aria-label="已查看" />}
          </button>
        ))}
      </div>

      {(taskStepId === 'addressing-graph' || visited.size === ADDRESSING_MODES.length) && (
        <div
          className={cn(
            'mt-3 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs',
            syncStatus === 'error'
              ? 'border-red-300/25 bg-red-300/[0.07] text-red-100'
              : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100',
          )}
          role="status"
          aria-live="polite"
        >
          <span>
            {syncStatus === 'saving'
              ? taskStepId === 'addressing-graph' ? '正在同步图谱定位记录…' : '七种方式已查看，正在同步学习记录…'
              : syncStatus === 'saved'
                ? taskStepId === 'addressing-graph' ? '图谱定位记录已同步，可返回任务页确认本步骤。' : '学习记录已同步，可返回任务页确认本步骤。'
                : syncStatus === 'already-complete'
                  ? '该任务已经完成；当前页面仅供回看，不会重复写入学习记录。'
                : syncStatus === 'error'
                  ? taskStepId === 'addressing-graph' ? '图谱定位记录尚未同步。' : '七种方式已查看，但学习记录尚未同步。'
                  : taskStepId === 'addressing-graph'
                    ? '请先核对“3.1 寻址方式”及 3.1.1—3.1.7 七个子节点，再明确确认。'
                    : '七种方式均已查看。'}
          </span>
          {taskStepId === 'addressing-graph' && syncStatus === 'idle' && (
            <button
              type="button"
              onClick={() => { void syncTaskEvidence(); }}
              disabled={visited.size < ADDRESSING_MODES.length}
              className="inline-flex min-h-11 items-center rounded-md border border-emerald-200/25 bg-emerald-200/[0.08] px-3 font-medium text-emerald-50 hover:bg-emerald-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.03] disabled:text-slate-500 disabled:hover:bg-white/[0.03]"
            >
              {visited.size < ADDRESSING_MODES.length
                ? `还需核对 ${ADDRESSING_MODES.length - visited.size} 个节点`
                : '确认已核对 3.1 与七个子节点'}
            </button>
          )}
          {syncStatus === 'error' && (
            <button
              type="button"
              onClick={() => { void syncTaskEvidence(); }}
              className="inline-flex min-h-11 items-center rounded-md border border-red-200/25 bg-red-200/[0.08] px-3 font-medium text-red-50 hover:bg-red-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
              重新同步
            </button>
          )}
          {(syncStatus === 'saved' || syncStatus === 'already-complete') && taskPathId && (
            <Link
              href="/tasks"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-emerald-200/25 bg-emerald-200/[0.08] px-3 py-2 font-medium text-emerald-50 hover:bg-emerald-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
            >
              {syncStatus === 'saved' ? '返回任务确认' : '返回任务记录'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {isGraphTaskStep ? (
        <div className="mt-4 rounded-md border border-cyan-300/20 bg-[#071014] p-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] font-mono text-[10px] text-cyan-100">
              {visited.size}/7
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-50">
                {currentPointId && currentPointId.startsWith('3.1.')
                  ? `当前定位：3.1 → ${currentPointId}`
                  : '根节点已定位：3.1 寻址方式'}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                每次点击都会选中对应图谱节点并加入核对清单；未达到 7/7 时不能提交本步骤。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-cyan-300/20 bg-[#071014] p-4" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] text-cyan-300">{active.id} · {active.syntax}</div>
            <div className="mt-1 text-sm font-semibold text-slate-50">{active.name}</div>
          </div>
          <code className="rounded border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[11px] text-amber-200">{active.example}</code>
        </div>
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded border border-white/[0.08] bg-white/[0.035] p-3">
            <div className="font-mono text-[9px] text-slate-600">INSTRUCTION FIELD</div>
            <div className="mt-1 text-xs text-slate-200">{active.syntax}</div>
          </div>
          <ChevronRight className="mx-auto h-4 w-4 self-center rotate-90 text-cyan-300 sm:rotate-0" />
          <div className="rounded border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
            <div className="font-mono text-[9px] text-cyan-300/70">ADDRESS FORMATION</div>
            <div className="mt-1 text-xs text-cyan-50">{active.formation}</div>
          </div>
          <ChevronRight className="mx-auto h-4 w-4 self-center rotate-90 text-cyan-300 sm:rotate-0" />
          <div className="rounded border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
            <div className="font-mono text-[9px] text-emerald-300/70">OPERAND / TARGET</div>
            <div className="mt-1 text-xs text-emerald-50">{active.operand}</div>
          </div>
        </div>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>已查看 {visited.size}/{ADDRESSING_MODES.length}</span>
        <span>
          {isGraphTaskStep
            ? '本步核对层级与七个子节点'
            : visited.size === ADDRESSING_MODES.length
              ? isAnimationTaskStep ? '已满足动画学习条件' : '七种方式均已查看'
              : '请继续查看未标记的方式'}
        </span>
      </div>
    </div>
  );
}

function DetailPanel({
  point,
  childPoints,
  pointById,
  experimentTitleByRefId,
  onSelectId,
  onOpenProblemNode,
  onOpenIdeologicalNode,
  allPoints,
}: {
  point: KnowledgePoint | null;
  childPoints: KnowledgePoint[];
  pointById: Record<string, KnowledgePoint>;
  experimentTitleByRefId: Record<string, string>;
  onSelectId: (id: string) => void;
  onOpenProblemNode: (id: string) => void;
  onOpenIdeologicalNode: (id: string) => void;
  allPoints: KnowledgePoint[];
}) {
  const searchParams = useSearchParams();
  const taskStepId = searchParams?.get('taskStepId') ?? null;
  const isGraphTaskActive = taskStepId === 'addressing-graph';
  const isAnimationTaskActive = taskStepId === 'addressing-animation';
  const isAddressingTaskActive = isGraphTaskActive || isAnimationTaskActive;
  const isAddressingGraphNode = Boolean(point && (point.id === '3.1' || point.id.startsWith('3.1.')));
  const [quizQuestions, setQuizQuestions] = useState<PublicQuestion[]>([]);

  // Fetch quiz questions from API (DB-first) with static fallback
  useEffect(() => {
    let active = true;
    async function loadQuestions(): Promise<void> {
      if (isAddressingTaskActive) {
        setQuizQuestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/quiz/questions?chapter=${point?.chapter ?? ''}`, { cache: 'no-store' });
        if (res.ok) {
          const raw: unknown = await res.json();
          const parsed = questionResponseSchema.safeParse(raw);
          if (active && parsed.success && parsed.data.data.length > 0) {
            setQuizQuestions(parsed.data.data);
            return;
          }
        }
      } catch { /* 题目预览失败不影响图谱主内容 */ }
    }
    void loadQuestions();
    return (): void => { active = false; };
  }, [isAddressingTaskActive, point?.chapter]);

  if (!point) {
    return (
      <aside className="rounded-lg border border-white/[0.09] bg-[#0b1118]/95 p-6 text-sm leading-6 text-slate-400 shadow-xl">
        <MousePointer2 className="mb-4 h-5 w-5 text-cyan-200" />
        选择画布节点或左侧目录条目，这里会按“理解—关系—资源—实践”组织节点内容。
      </aside>
    );
  }

  const resources = point.resources ?? [];
  const inlineImages = resources.filter(isInlineImage);
  const mediaResources = resources.filter(isMediaResource);
  const otherResources = resources.filter((r) => !inlineImages.includes(r) && !mediaResources.includes(r));
  const prereqs = (point.prerequisites ?? [])
    .map((id) => pointById[id])
    .filter((p): p is KnowledgePoint => Boolean(p));
  // 后继知识点：谁把当前节点列为前置（反向一跳），
  // 与前置知识一起构成"先学什么 → 本节点 → 支撑什么"的链路叙述
  const dependents = allPoints.filter((p) => p.prerequisites?.includes(point.id));
  const appliedExperiments = (point.appliedIn ?? []).map((refId) => ({
    refId,
    title: experimentTitleByRefId[refId] ?? refId,
  }));
  const parent = point.parentId ? pointById[point.parentId] : null;
  const nextPoint = getNextPoint(point, allPoints);
  const matchingQuestions = quizQuestions.filter((q) => q.ka === point.id).slice(0, 4);
  const isRelatedKnowledgeId = (candidate: string): boolean => (
    candidate === point.id
    || candidate.startsWith(`${point.id}.`)
    || point.id.startsWith(`${candidate}.`)
  );
  const relatedProblems = problemGraph
    .filter((node) => node.level === 3 && node.relatedKnowledgePoints.some(isRelatedKnowledgeId))
    .slice(0, 4);
  const explicitSipMappings = getExplicitSipMappingsForKnowledgePoint(point.id);
  const explicitIdeologicalNodeIds = new Set(
    explicitSipMappings.flatMap((mapping) => mapping.ideologicalNodeIds),
  );
  const explicitIdeologicalNodes = ideologicalNodes.filter((node) => (
    node.level === 2 && explicitIdeologicalNodeIds.has(node.id)
  ));
  const inferredIdeologicalNodes = ideologicalNodes
    .filter((node) => node.level === 2 && (
      node.relatedKnowledgePoints.some(isRelatedKnowledgeId)
      || node.relatedChapters.includes(point.chapter)
    ))
    .slice(0, 4);
  const relatedIdeologicalNodes = explicitIdeologicalNodes.length > 0
    ? explicitIdeologicalNodes
    : inferredIdeologicalNodes;
  const ideologicalRelationLabel = explicitIdeologicalNodes.length > 0
    ? `${explicitSipMappings.map((mapping) => mapping.weekRange).join(' / ')}明确映射`
    : '内容关联（非周次安排）';

  return (
    <aside
      aria-label={`节点详情：${point.name}`}
      className="kg-inspector max-h-[min(760px,calc(100vh-218px))] overflow-y-auto rounded-lg border border-white/[0.09] bg-[#0b1118]/95 shadow-xl"
    >
      <div className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0b1118]/95 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-200">
          <span>NODE INSPECTOR · CH{point.chapter}</span>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">L{point.level}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">#{point.id}</span>
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">{point.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{point.description || '该节点暂无详细说明。'}</p>
        {parent && (!isAddressingTaskActive || parent.id === '3.1' || parent.id.startsWith('3.1.')) && (
          <button
            type="button"
            onClick={() => onSelectId(parent.id)}
            className="group mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            <Layers className="h-3 w-3" />
            <span>上级</span>
            <span className="text-slate-500 group-hover:text-cyan-200/80">/</span>
            <span className="font-medium">{parent.name}</span>
          </button>
        )}
      </div>

      {isAddressingTaskActive && (
        <div className="border-b border-cyan-300/15 bg-cyan-300/[0.035] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-cyan-100">
                {isGraphTaskActive ? '步骤 1 操作范围' : '步骤 2 操作范围'}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                {isGraphTaskActive
                  ? '本步骤只核对 3.1 与 3.1.1—3.1.7 的层级。动画、专项测评和 exp02 将在后续任务步骤开放。'
                  : '本步骤只完成七种寻址方式动态对比。专项测评和 exp02 将按后续任务步骤开放。'}
              </p>
            </div>
            {!isAddressingGraphNode && (
              <button
                type="button"
                onClick={() => onSelectId('3.1')}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-cyan-200/25 bg-cyan-200/[0.08] px-3 text-xs font-medium text-cyan-50 hover:bg-cyan-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                返回 3.1
              </button>
            )}
          </div>
        </div>
      )}

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

      {isAddressingTaskActive && isAddressingGraphNode ? (
        <AddressingModeCompare currentPointId={point.id} onSelectNode={onSelectId} />
      ) : !isAddressingTaskActive && point.id === '3.1' ? (
        <AddressingModeCompare currentPointId={point.id} />
      ) : null}

      {!isAddressingTaskActive && prereqs.length > 0 && (
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
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
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

      {!isAddressingTaskActive && dependents.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-200/80">
            <GitBranch className="h-3.5 w-3.5" />
            支撑后续 · 学完能干什么
          </div>
          <div className="space-y-1.5">
            {dependents.map((p) => {
              const reason = getPrerequisiteReason(p.id, point.id);
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelectId(p.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-left text-xs text-slate-200 hover:border-amber-300/40 hover:bg-amber-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
          </div>
        </div>
      )}

      {!isAddressingTaskActive && (relatedProblems.length > 0 || relatedIdeologicalNodes.length > 0) && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <Network className="h-3.5 w-3.5" />
            跨图谱关联 · 从知识走向诊断与育人
          </div>
          <div className="space-y-3">
            {relatedProblems.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-amber-200/80">可能出现的问题</div>
                <div className="space-y-1.5">
                  {relatedProblems.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onOpenProblemNode(node.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-left text-xs text-slate-200 transition hover:border-amber-300/35 hover:bg-amber-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                    >
                      <span className="line-clamp-1">{node.name}</span>
                      <span className="shrink-0 text-[9px] text-amber-200/70">{difficultyLabel[node.difficulty]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {relatedIdeologicalNodes.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-cyan-200/80">
                  <span>{ideologicalRelationLabel}</span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {explicitIdeologicalNodes.length > 0 ? 'EXPLICIT' : 'RELATED'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {relatedIdeologicalNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onOpenIdeologicalNode(node.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-left text-xs text-slate-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    >
                      <span className="line-clamp-1">{node.name}</span>
                      <span className="shrink-0 font-mono text-[9px] text-cyan-200/60">SIP · {node.id}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  {explicitIdeologicalNodes.length > 0
                    ? '来自教学周映射表；同章或共享知识点不会自动算作本周安排。'
                    : '用于拓展检索，不代表已写入某一教学周的实施安排。'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isAddressingTaskActive && inlineImages.length > 0 && (
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

      {!isAddressingTaskActive && mediaResources.length > 0 && (
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
                  <a href={resource.url} target="_blank" rel="noreferrer" aria-label={`在新窗口打开：${resource.title}`} className="ml-2 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
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

      {!isAddressingTaskActive && otherResources.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <BookOpen className="h-3.5 w-3.5" />
            配套资源
          </div>
          <div className="space-y-1.5">
            {otherResources.map((resource) => {
              const meta = RESOURCE_META[resource.type];
              const Icon = meta.icon;
              const href = resolveKnowledgeResourceHref(resource, point.chapter);
              const sectionQuizFallback = isSectionQuizFallback(resource);
              const inner = (
                <>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                  <span className="min-w-0 flex-1 truncate text-slate-200 group-hover:text-cyan-100">{resource.title}</span>
                  <span className="shrink-0 rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {sectionQuizFallback ? '本章练习' : meta.label}
                  </span>
                </>
              );
              const baseCls = 'group flex min-h-11 w-full items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-xs hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]';
              if (!href) {
                return (
                  <div
                    key={`${resource.type}-${resource.title}`}
                    className={cn(baseCls, 'cursor-not-allowed opacity-70')}
                    aria-disabled="true"
                    title="该资源尚未接入平台，当前不可打开"
                  >
                    {inner}
                    <span className="sr-only">暂未接入</span>
                  </div>
                );
              }
              if (href.startsWith('http')) {
                return (
                  <a key={`${resource.type}-${resource.title}`} href={href} target="_blank" rel="noreferrer" className={baseCls}>
                    {inner}
                  </a>
                );
              }
              return (
                <Link
                  key={`${resource.type}-${resource.title}`}
                  href={href}
                  className={baseCls}
                  title={sectionQuizFallback ? '该小节暂无独立题集，进入同口径本章测验' : undefined}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!isAddressingTaskActive && appliedExperiments.length > 0 && (
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
                className="group flex min-h-11 items-center justify-between gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-2 text-xs text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
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

      {!isAddressingTaskActive && matchingQuestions.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              本节测验题 · {matchingQuestions.length}
            </div>
            <Link
              href={point.id === '3.1' || point.id.startsWith('3.1.') ? '/quiz?topic=addressing-modes' : `/quiz?chapter=${point.chapter}`}
              className="inline-flex min-h-11 items-center px-2 font-mono text-[10px] text-cyan-300 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
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

      {!isAddressingTaskActive && childPoints.length > 0 && (
        <div className="border-b border-white/[0.08] p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <ListTree className="h-3.5 w-3.5" />
            下级节点 · {childPoints.length}
          </div>
          <div className="space-y-1">
            {childPoints.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectId(c.id)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <span className="line-clamp-1">{c.name}</span>
                <span className="font-mono text-[10px] text-slate-600">L{c.level}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!isAddressingTaskActive && nextPoint && (
        <div className="p-5">
          <button
            type="button"
            onClick={() => onSelectId(nextPoint.id)}
            className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-3 text-left hover:border-cyan-300/45 hover:bg-cyan-300/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
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
type GraphNodeSize = 'core' | 'root' | 'branch' | 'leaf' | 'diagnosticUnit' | 'compactDiagnosticUnit' | 'thematicUnit' | 'compactThematicUnit' | 'learningUnit' | 'compactLearningUnit' | 'chapter' | 'hub' | 'net' | 'chapterCard' | 'compactChapterCard' | 'topicCard' | 'compactTopicCard';

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

// Dark analytical canvas: edges remain muted until selected, but must stay
// visible enough to read direction and grouping without decorative glow.
const graphEdgeTone: Record<GraphTone, string> = {
  cyan: '#69b9cb', emerald: '#67bc91', amber: '#c4a15f', red: '#c7736d',
  violet: '#9b7bc4', slate: '#75869a', sky: '#729fc4', teal: '#68b7ad',
  lime: '#8fb76d', orange: '#c28f69', fuchsia: '#bd79bd', rose: '#bd7185',
};

// 圆形节点：宽高相等=直径，半径按层级分档（L1 最大 → L3 最小），
// 用大小直接编码重要性层级，替代此前"统一大小圆角矩形"的卡片感。
// 直径口径：core/hub(L1 章枢纽) 68-72px，root(单章 L1) 64px，
// branch/net(L2 节) 44-52px，leaf(L3 点) 30-34px，chapter(思政章节脚注) 40px。
const graphNodeSize: Record<GraphNodeSize, { width: number; height: number }> = {
  core: { width: 82, height: 82 },
  root: { width: 76, height: 76 },
  branch: { width: 58, height: 58 },
  // L3 carries the concrete, judge-readable learning object. A tiny dot made
  // the most important wording disappear, so leaves are deliberate capsules
  // while hierarchy hubs remain circular beacons.
  leaf: { width: 118, height: 40 },
  // The diagnostic labels are the evidence itself, not decorative tags. Keep
  // enough horizontal room for the longest current category name at the
  // 1280×720 judging viewport instead of hiding it behind an ellipsis.
  diagnosticUnit: { width: 210, height: 48 },
  // Focused mobile problem nodes are displayed at no less than 0.72 zoom.
  // A 62px source height therefore preserves a real 44px touch target after
  // camera fitting, while keeping the same label width and two-column rhythm.
  compactDiagnosticUnit: { width: 210, height: 62 },
  thematicUnit: { width: 218, height: 48 },
  // Mobile value elements share the same visual language as desktop, but the
  // taller source box remains at least 44px after the focused camera floor.
  compactThematicUnit: { width: 190, height: 62 },
  learningUnit: { width: 236, height: 62 },
  compactLearningUnit: { width: 180, height: 54 },
  chapter: { width: 44, height: 44 },
  // 全景网络视图专用：hub=章节枢纽，net=环绕 hub 的 L2 紧凑节点
  hub: { width: 80, height: 80 },
  net: { width: 52, height: 52 },
  // 单章聚焦态不用微缩的网络圆点，而采用具有阅读层级的教学卡片。
  // 评委在 1280×720 首屏即可读清“章—节—知识单元”，无需先缩放。
  chapterCard: { width: 212, height: 126 },
  compactChapterCard: { width: 180, height: 88 },
  topicCard: { width: 266, height: 154 },
  compactTopicCard: { width: 210, height: 104 },
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
  /**
   * A node gets one primary label, never the same label both inside and below
   * the shape. Compact chapter indexes use `below`; diagnostic/value nodes use
   * `inside` so the focused cluster reads like an atlas instead of a tag cloud.
   */
  labelPlacement?: 'inside' | 'below';
  sequence?: number;
  [key: string]: unknown;
};

export function getGraphNodeSize(size: GraphNodeSize) {
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
  const cardSizes: GraphNodeSize[] = [
    'leaf', 'diagnosticUnit', 'compactDiagnosticUnit', 'thematicUnit',
    'compactThematicUnit', 'learningUnit', 'compactLearningUnit',
    'chapterCard', 'compactChapterCard', 'topicCard', 'compactTopicCard',
  ];
  const ariaDetails = [
    data.levelLabel,
    data.subtitle,
    typeof data.mastery === 'number' ? `最近掌握度 ${Math.round(data.mastery)}%` : null,
  ].filter((value): value is string => Boolean(value));
  return {
    id,
    type: 'mapNode',
    position: { x: centerX - size.width / 2, y: centerY - size.height / 2 },
    data,
    draggable: false,
    focusable: data.clickable !== false && data.visible,
    ariaRole: data.clickable === false || !data.visible ? 'group' : 'button',
    ariaLabel: [data.label, ...ariaDetails].join('，'),
    className: cardSizes.includes(data.size) ? 'kg-map-node-card' : 'kg-map-node-round',
    style: { zIndex },
  };
}

// 圆形节点：半径按层级分档（L1 最大 → L3 最小），配色是"填色圆盘"而不是
// 卡片边框，标签常态显示在圆外正下方（而不是塞进圆内截断成 6-8px）。
// L3 默认只显示极短的省略标签，完整名称走 hover 卡片（GraphMapStage 已有）。
function MapNode({ data }: NodeProps<RFNode<MapNodeData>>) {
  const tone = graphTone[data.tone];
  const size = getGraphNodeSize(data.size);
  const isLearningUnit = data.size === 'learningUnit' || data.size === 'compactLearningUnit';
  const isDiagnosticUnit = data.size === 'diagnosticUnit' || data.size === 'compactDiagnosticUnit';
  const isThematicUnit = data.size === 'thematicUnit' || data.size === 'compactThematicUnit';
  const isLeaf = data.size === 'leaf' || isDiagnosticUnit || isThematicUnit || isLearningUnit;
  const isNet = data.size === 'net';
  const isRoot = data.size === 'root' || data.size === 'core' || data.size === 'hub';
  const isChapterCard = data.size === 'chapterCard' || data.size === 'compactChapterCard';
  const isTopicCard = data.size === 'topicCard' || data.size === 'compactTopicCard';
  const isCompactChapterCard = data.size === 'compactChapterCard';
  const isCompactTopicCard = data.size === 'compactTopicCard';
  const isCompactLearningUnit = data.size === 'compactLearningUnit';
  const isEditorialCard = isChapterCard || isTopicCard;
  const isChapterFoot = data.size === 'chapter';
  const labelPlacement = data.labelPlacement ?? (isRoot || isNet ? 'below' : 'inside');
  // Focus mode: a non-selected node outside the kinship set fades to the
  // background. Visible-but-out-of-search filter still trumps focus dimming.
  const baseOpacity = data.visible || data.selected ? 1 : 0.18;
  const focusFactor = data.dimmed && !data.selected ? 0.38 : 1;
  const opacity = baseOpacity * focusFactor;
  // 常态标签长度：层级越低越短，L3/网状节点默认只留意到"这里有个点"，
  // 完整名称交给 hover 卡片（NodeHoverCard）
  const labelMax = isEditorialCard ? 20 : isRoot ? 12 : data.size === 'branch' ? 9 : isNet ? 7 : 16;
  // 标签外框宽度（圆外正下方那一行文字的最大宽度）：这才是相邻簇标签会不会
  // physically 撞在一起的决定量。isNet(L2) 当前全景视图 53 个同屏，是密度主因，
  // 原来统一 104px 与节点自身实际横向间距（改完 ringGeometry 后中心距约
  // 70-95px）严重不成比例；收紧到 72px 后单个标签横向占用打对折，配合
  // ringGeometry 的纵向椭圆化，两者相加才是真正把"标签重叠"压下去的组合，
  // 而不是单靠某一项。root/branch 维持原宽度，因为它们数量少、间距天然大。
  const labelBoxW = isRoot ? 132 : isNet ? 86 : data.size === 'branch' ? 118 : 104;
  const ChapterIcon = isRoot || isChapterCard ? getChapterIcon(data.chapter) : null;
  const showMastery = typeof data.mastery === 'number' && !isLeaf && !isChapterFoot && !isEditorialCard;
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
  const fontSize = isEditorialCard ? 14 : isRoot ? 13 : data.size === 'branch' || isNet ? 11.5 : isLeaf ? 12.5 : 11;
  const mastery = typeof data.mastery === 'number' ? Math.max(0, Math.min(100, data.mastery)) : null;
  const masteryColor = mastery === null ? '#7bcce0' : mastery >= 80 ? '#6ee7b7' : mastery >= 60 ? '#f5c76b' : '#fb8f86';
  // 掌握度进度环：半径略小于节点半径的圆弧，stroke-dasharray 走百分比
  const ringR = size.width / 2 - 2.5;
  const ringCirc = 2 * Math.PI * ringR;

  return (
    <>
      <Handle type="target" position={Position.Top} className={handleCls} />
      <Handle id="bt" type="target" position={Position.Bottom} className={handleCls} />
      <Handle id="lt" type="target" position={Position.Left} className={handleCls} />
      <Handle id="rt" type="target" position={Position.Right} className={handleCls} />
      <Handle id="ct" type="target" position={Position.Top} className={handleCls} style={centerHandleStyle} />
      <div
        className={cn(
          'relative flex items-center justify-center',
          isLearningUnit && 'kg-learning-unit-enter',
        )}
        style={{
          width: size.width,
          height: size.height,
          opacity,
          ...(isLearningUnit && typeof data.sequence === 'number'
            ? { animationDelay: `${Math.min(data.sequence - 1, 8) * 55}ms` }
            : {}),
        }}
      >
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
              stroke={masteryColor}
              strokeWidth={2}
              strokeOpacity={0.9}
              strokeLinecap="round"
              strokeDasharray={`${(mastery / 100) * ringCirc} ${ringCirc}`}
            />
          </svg>
        )}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden border text-center transition duration-200',
            isTopicCard || isChapterCard ? 'rounded-[10px]' : isLearningUnit ? 'rounded-[8px]' : isLeaf ? 'rounded-[6px]' : 'rounded-full',
            data.clickable === false ? 'cursor-default' : 'cursor-pointer hover:brightness-105',
            data.selected && (isEditorialCard ? 'scale-[1.01]' : isLearningUnit ? 'scale-[1.015]' : 'scale-[1.035]'),
          )}
          style={{
            width: size.width - 6,
            height: size.height - 6,
            color: tone.text,
            borderColor: data.selected ? tone.color : isEditorialCard || isLearningUnit ? 'rgba(148,163,184,.26)' : tone.border,
            borderWidth: data.selected ? 1.5 : 1,
            background: data.selected
              ? isTopicCard
                ? `linear-gradient(135deg, rgba(21,43,53,.98), rgba(14,22,30,.99))`
                : isChapterCard
                  ? `linear-gradient(135deg, rgba(25,33,42,.99), rgba(13,19,26,.99))`
                  : isLearningUnit
                    ? `linear-gradient(100deg, rgba(19,39,48,.99), rgba(10,16,23,.99))`
                : `linear-gradient(145deg, ${tone.bg}, rgba(14,21,29,.98) 74%)`
              : data.visible
                ? isTopicCard
                  ? `linear-gradient(135deg, rgba(18,31,40,.99), rgba(12,19,27,.99))`
                  : isChapterCard
                    ? `linear-gradient(135deg, rgba(22,29,38,.99), rgba(12,18,25,.99))`
                    : isLearningUnit
                      ? `linear-gradient(100deg, rgba(17,31,39,.99), rgba(9,15,22,.99))`
                      : isLeaf
                        ? `linear-gradient(110deg, ${tone.bg}, rgba(13,19,27,.98) 76%)`
                  : `linear-gradient(145deg, ${tone.bg}, rgba(13,20,28,.96) 78%)`
                : 'rgba(15, 23, 42, 0.65)',
            boxShadow: data.selected
              ? `0 0 0 1px ${tone.color}44, 0 12px 28px rgba(0,0,0,.38)`
              : `0 8px 22px rgba(0,0,0,.26)`,
          }}
        >
          {isChapterCard && ChapterIcon ? (
            <div className={cn('relative flex h-full w-full items-center overflow-hidden text-left', isCompactChapterCard ? 'gap-2.5 px-3' : 'gap-4 px-5')}>
              <span className={cn('pointer-events-none absolute -right-1 font-mono font-bold leading-none text-white/[0.025]', isCompactChapterCard ? '-top-3 text-[58px]' : '-top-5 text-[88px]')} aria-hidden>
                {String(data.chapter || '').padStart(2, '0')}
              </span>
              <span className={cn('relative grid shrink-0 place-items-center rounded-[8px] border', isCompactChapterCard ? 'h-10 w-10' : 'h-14 w-14')} style={{ borderColor: tone.border, background: 'rgba(15,23,32,.92)' }}>
                <ChapterIcon className={isCompactChapterCard ? 'h-5 w-5' : 'h-7 w-7'} style={{ color: tone.color }} />
              </span>
              <span className="relative min-w-0">
                <span className={cn('block font-mono uppercase', isCompactChapterCard ? 'text-[8px] tracking-[0.14em]' : 'text-[9px] tracking-[0.22em]')} style={{ color: tone.color }}>Chapter {String(data.chapter || '').padStart(2, '0')}</span>
                <span className={cn('kg-display block truncate font-bold text-slate-50', isCompactChapterCard ? 'mt-1 text-[16px]' : 'mt-2 text-[21px]')}>{data.label}</span>
                {data.subtitle && <span className={cn('block truncate tracking-wide text-slate-400', isCompactChapterCard ? 'mt-1 text-[8px]' : 'mt-2 text-[10px]')}>{data.subtitle}</span>}
              </span>
            </div>
          ) : isTopicCard ? (
            <div className={cn('relative flex h-full w-full flex-col justify-center overflow-hidden text-left', isCompactTopicCard ? 'px-4' : 'px-6')}>
              <span className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full border border-cyan-200/[0.08]" aria-hidden />
              <span className="pointer-events-none absolute -right-2 -top-2 h-20 w-20 rounded-full border border-cyan-200/[0.07]" aria-hidden />
              <span className={cn('relative flex items-center gap-2 font-mono uppercase', isCompactTopicCard ? 'text-[8px] tracking-[0.12em]' : 'text-[9px] tracking-[0.20em]')} style={{ color: tone.color }}>
                <Target className="h-3.5 w-3.5" /> Current focus · {data.levelLabel || 'L2'}
              </span>
              <span className={cn('kg-display relative block font-bold leading-none text-slate-50', isCompactTopicCard ? 'mt-2 text-[20px]' : 'mt-3 text-[29px]')}>{data.label}</span>
              {data.subtitle && <span className={cn('relative block tracking-wide text-slate-300/75', isCompactTopicCard ? 'mt-2 text-[9px]' : 'mt-3 text-[11px]')}>{data.subtitle}</span>}
              <span className={cn('relative h-px w-full overflow-hidden bg-white/[0.08]', isCompactTopicCard ? 'mt-2' : 'mt-4')} aria-hidden>
                <span className="block h-full w-[72%] bg-gradient-to-r from-amber-300 via-cyan-300 to-transparent" />
              </span>
            </div>
          ) : isLeaf && typeof data.sequence === 'number' ? (
            <span className={cn('flex w-full items-center text-left', isCompactLearningUnit ? 'gap-2 px-2.5' : 'gap-3 px-3.5')}>
              <span className={cn('grid shrink-0 place-items-center rounded-[10px] border border-cyan-200/20 bg-cyan-200/[0.08] font-mono text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]', isCompactLearningUnit ? 'h-8 w-8' : 'h-9 w-9')} style={{ color: tone.color }}>
                {String(data.sequence).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-wide text-slate-50">
                {data.label}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_11px_currentColor]" style={{ backgroundColor: masteryColor, color: masteryColor }} aria-hidden />
              <span className="sr-only">{mastery === null ? '待学习' : `最近掌握度 ${Math.round(mastery)}%`}</span>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" style={{ color: tone.color }} />
            </span>
          ) : isLeaf ? (
            <span className="flex w-full items-center gap-2 px-3 text-left">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_9px_currentColor]" style={{ backgroundColor: tone.color, color: tone.color }} />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-medium text-slate-100',
                )}
                style={{ fontSize }}
              >
                {isDiagnosticUnit || isThematicUnit
                  ? data.label
                  : truncateLabel(data.label, labelMax)}
              </span>
              {(isDiagnosticUnit || isThematicUnit) && data.subtitle && (
                <span className="shrink-0 rounded border border-white/[0.08] bg-black/20 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                  {data.subtitle}
                </span>
              )}
              {isDiagnosticUnit && data.clickable !== false && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-55" aria-hidden />
              )}
            </span>
          ) : ChapterIcon ? (
            <ChapterIcon className="h-[38%] w-[38%]" style={{ color: tone.color }} />
          ) : isChapterFoot ? (
            <span className="font-mono text-[10px] font-semibold tracking-wide">{data.label}</span>
          ) : labelPlacement === 'below' ? (
            <span className="font-mono text-[11px] font-semibold" style={{ color: tone.color }}>
              {data.subtitle || data.levelLabel?.replace('L', '') || '·'}
            </span>
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
        {!isRoot && !isChapterFoot && !isEditorialCard && data.levelLabel && typeof data.sequence !== 'number' && (
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
            L3 叶子节点数量最多（当前课程目录为216个）、间距最密，即使标签本身
            独立渲染在圆下方，密集区域仍会互相重叠糊成一团——默认干脆不显示
            文字，只留一个可辨色的圆点勾勒整体分布形态，选中态才现出标签；
            完整名称随时可从 hover 卡片（NodeHoverCard）查看，不丢信息。 */}
        {!isChapterFoot && !isLeaf && !isEditorialCard && labelPlacement === 'below' && (
          <div
            className="pointer-events-none absolute left-1/2 top-full mt-1 w-max -translate-x-1/2 text-center leading-tight"
            style={{ opacity: Math.max(opacity, data.selected ? 1 : opacity), maxWidth: labelBoxW }}
          >
            <span
              className={cn(
                'inline-block truncate rounded px-1 py-[1px]',
                isRoot ? 'text-[12.5px] font-semibold' : isNet || data.size === 'branch' ? 'text-[11px] font-medium' : 'text-[9.5px]',
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
              <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: tone.color }}>
                {data.subtitle}
              </div>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="ts" type="source" position={Position.Top} className={handleCls} />
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
  stageWidth: number;
  stageHeight: number;
  data: MapNodeData;
};

export function getGraphHoverCardPosition({
  x,
  y,
  stageWidth,
  stageHeight,
  cardWidth = 260,
  cardHeight = 176,
}: {
  x: number;
  y: number;
  stageWidth: number;
  stageHeight: number;
  cardWidth?: number;
  cardHeight?: number;
}): { left: number; top: number; width: number } {
  const safeWidth = Math.max(0, Math.min(cardWidth, stageWidth - 16));
  const preferredRight = x + 14;
  const left = preferredRight + safeWidth <= stageWidth - 8
    ? preferredRight
    : Math.max(8, Math.min(x - safeWidth - 14, stageWidth - safeWidth - 8));
  const top = Math.max(8, Math.min(y - 88, Math.max(8, stageHeight - cardHeight - 8)));
  return { left, top, width: safeWidth };
}

// 命令式相机控制：点击章节 hub 从全景切到单章视图前，父组件（FullKnowledgeMap）
// 先调用 flyToNode 让镜头真正"飞"过去，播完动画再切换数据（remount）。此前只靠
// remount 时的 animate-fade-in 做透明度过渡，但全景→单章是完全不同的节点集合，
// 位置、大小都变了，单纯淡入盖不住"瞬间换了一张图"的生硬感——要有真正的镜头
// 运动，才能让人感觉是"点这里→镜头拉近→看到这一章"的连贯过程。
export type GraphMapStageHandle = {
  flyToNode: (nodeId: string, opts?: { duration?: number }) => void;
};

export const MIN_FOCUSED_GRAPH_ZOOM = 0.72;

const GRAPH_ARIA_LABEL_CONFIG = {
  'node.a11yDescription.default': '按回车键或空格键选择节点。',
  'edge.a11yDescription.default': '按回车键或空格键查看依赖关系。',
  'controls.ariaLabel': '图谱缩放与视图控制',
  'controls.zoomIn.ariaLabel': '放大图谱',
  'controls.zoomOut.ariaLabel': '缩小图谱',
  'controls.fitView.ariaLabel': '重置为适合画布的视图',
} as const;

export function getGraphMotionDuration(duration: number, prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : duration;
}

function currentGraphMotionDuration(duration: number): number {
  return getGraphMotionDuration(
    duration,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}

export function isGraphActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

type DependencyEdgeAccessibility = Pick<
  RFEdge,
  'ariaLabel' | 'ariaRole' | 'className' | 'domAttributes' | 'focusable' | 'selectable'
>;

const DEPENDENCY_EDGE_DETAIL_ID = 'kg-dependency-edge-detail';

export function getDependencyEdgeAccessibility(
  sourceLabel: string,
  targetLabel: string,
  relationshipCount: number,
  expanded = false,
): DependencyEdgeAccessibility {
  const count = Math.max(1, Math.round(relationshipCount));
  return {
    focusable: true,
    selectable: false,
    ariaRole: 'button',
    className: 'kg-dependency-edge',
    domAttributes: {
      'aria-controls': DEPENDENCY_EDGE_DETAIL_ID,
      'aria-expanded': expanded,
    },
    ariaLabel: count > 1
      ? `先修依赖：${sourceLabel} 到 ${targetLabel}，聚合 ${count} 条具体依赖。按回车或空格查看详情。`
      : `先修依赖：${sourceLabel} 到 ${targetLabel}。按回车或空格查看详情。`,
  };
}

type GraphCanvasEmptyState = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

function GraphOperationHints({ dependencyEdges = false }: { dependencyEdges?: boolean }) {
  return (
    <span className="ml-auto inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
        <MousePointer2 className="h-3.5 w-3.5 text-cyan-200" />操作
      </span>
      <span>点击节点查看详情</span>
      <span>拖动画布</span>
      <span>滚轮／双指缩放</span>
      <span>Tab 定位节点</span>
      {dependencyEdges && <span>依赖边可按回车展开</span>}
    </span>
  );
}

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
  focusFitPadding?: number;
  focusFitMaxZoom?: number;
  controlsPosition?: 'top-left' | 'top-center' | 'top-right';
  // 聚合依赖边（data.kind === 'dep'）被点击时触发，用于展开"具体节点对+理由"面板
  onEdgeSelect?: (edgeId: string, keyboardTrigger?: Element) => void;
  emptyState?: GraphCanvasEmptyState;
}>(function GraphMapStage({
  nodes,
  edges,
  onSelect,
  selectedId,
  focusIds,
  heightClassName = 'h-[660px] md:h-[760px]',
  fitPadding = 0.18,
  fitMaxZoom = 1.1,
  focusFitPadding = 0.24,
  focusFitMaxZoom = 1.55,
  controlsPosition = 'top-right',
  onEdgeSelect,
  emptyState,
}, forwardedRef) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const [instanceReady, setInstanceReady] = useState(false);
  const [hover, setHover] = useState<HoverPayload | null>(null);
  const [edgeHover, setEdgeHover] = useState<{
    x: number;
    y: number;
    stageWidth: number;
    stageHeight: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    setHover(null);
    setEdgeHover(null);
  }, [selectedId]);

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
        { zoom: 1.35, duration: currentGraphMotionDuration(opts?.duration ?? 420) },
      );
    },
  }), [nodes]);

  // ReactFlow's declarative fitView runs after the first node measurement.
  // A synchronous selection fit in onInit is therefore overwritten by the
  // whole-graph fit a moment later (deep links such as ?node=3.1 looked tiny
  // even though the node was selected). Defer the focused fit until measured
  // nodes have settled, then let the local teaching context fill the stage.
  useEffect(() => {
    if (!selectedId || !focusIds || focusIds.size === 0) return;
    const instance = instanceRef.current;
    if (!instance) return;
    const targets = nodes.filter((n) => n.type === 'mapNode' && focusIds.has(n.id));
    if (targets.length === 0) return;
    const timer = window.setTimeout(() => {
      instance.fitView({
        nodes: targets.map((n) => ({ id: n.id })),
        padding: focusFitPadding,
        duration: currentGraphMotionDuration(560),
        maxZoom: focusFitMaxZoom,
        minZoom: MIN_FOCUSED_GRAPH_ZOOM,
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusFitMaxZoom, focusFitPadding, focusIds, instanceReady, nodes, selectedId]);

  // Returning to an overview changes the rendered node set but React Flow's
  // one-time `fitView` does not run again. Without an explicit refit, the
  // camera stays parked on the previously focused domain and the user sees a
  // misleading “overview” containing only one cluster. Refit visible map
  // nodes whenever selection is cleared (initial overview and reset).
  useEffect(() => {
    if (selectedId) return;
    const instance = instanceRef.current;
    if (!instance) return;
    const targets = nodes.filter((node) => (
      node.type === 'mapNode' && (node.data as MapNodeData).visible
    ));
    if (targets.length === 0) return;
    const timer = window.setTimeout(() => {
      instance.fitView({
        nodes: targets.map((node) => ({ id: node.id })),
        padding: fitPadding,
        duration: currentGraphMotionDuration(520),
        maxZoom: fitMaxZoom,
        minZoom: 0.18,
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [fitMaxZoom, fitPadding, instanceReady, nodes, selectedId]);

  return (
    <div
      ref={stageRef}
      className={cn(
        'kg-map-stage relative isolate overflow-hidden bg-[#0b1118]',
        heightClassName,
      )}
    >
      {/* ReactFlow Controls 按钮默认白底，在深色画布上很扎眼；
          Tailwind 任意变体写不进带双下划线的类名，这里用作用域样式压成暗色，
          三个图谱视图共享同一观感 */}
      <style>{`
        .kg-map-stage {
          background:
            linear-gradient(180deg, rgba(255,255,255,.018), transparent 28%),
            #0b1118;
        }
        .kg-map-stage::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 1;
          background-image:
            linear-gradient(rgba(148,163,184,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.045) 1px, transparent 1px),
            linear-gradient(rgba(148,163,184,.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.028) 1px, transparent 1px);
          background-size: 40px 40px, 40px 40px, 200px 200px, 200px 200px;
        }
        .kg-map-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(ellipse 70% 64% at 58% 46%, rgb(var(--kg-accent) / .055), transparent 72%),
            linear-gradient(180deg, transparent 66%, rgba(0,0,0,.10));
          box-shadow: inset 0 0 80px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.035);
        }
        .kg-map-stage .react-flow { z-index: 2; }
        .kg-map-stage .react-flow__controls-button {
          width: 44px;
          height: 44px;
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
        .kg-map-stage .react-flow__node:focus-visible {
          outline: 2px solid rgb(var(--kg-accent));
          outline-offset: 5px;
        }
        .kg-map-stage .react-flow__node.kg-map-node-round:focus-visible {
          border-radius: 999px;
        }
        .kg-map-stage .react-flow__node.kg-map-node-card:focus-visible {
          border-radius: 14px;
        }
        .kg-map-stage .react-flow__edge.kg-dependency-edge:focus-visible {
          outline: none;
        }
        .kg-map-stage .react-flow__edge.kg-dependency-edge:focus-visible .react-flow__edge-path {
          opacity: 1 !important;
          stroke-width: 3.2px !important;
          filter: drop-shadow(0 0 4px rgb(var(--kg-accent) / .72));
        }
        .kg-map-stage .react-flow__controls {
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }
        .kg-map-stage .react-flow__controls-button {
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 0;
        }
        .kg-map-stage .react-flow__controls-button:last-child { border-right: 0; }
        @media (max-height: 760px) {
          .kg-map-stage .kg-stage-help { display: none; }
        }
        .kg-stage-watermark { display: none; }
        @keyframes kg-learning-unit-enter {
          from { opacity: 0; transform: translateX(18px) scale(.97); filter: blur(5px); }
          to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        .kg-learning-unit-enter { animation: kg-learning-unit-enter .58s cubic-bezier(.2,.75,.18,1) both; }
        /* clusterHalo 内层 div 已 pointer-events-none，但 ReactFlow 给节点外层
           wrapper 内联了 pointer-events:all（style 属性，优先级高于普通 class 规则），
           实测该内联样式确实盖住了下方的依赖边(kg-dep-*)，点击展开面板永远弹不出来。
           光晕纯装饰、无任何交互语义，用 !important 压过内联样式让整个节点穿透点击。 */
        .kg-map-stage .react-flow__node-clusterHalo {
          pointer-events: none !important;
        }
      `}</style>
      <div className="kg-stage-watermark" aria-hidden />
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
        onKeyDownCapture={(event) => {
          if (!isGraphActivationKey(event.key)) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const edgeElement = target.closest<SVGElement>('.react-flow__edge[data-id]');
          const edgeId = edgeElement?.dataset.id;
          if (edgeId) {
            const edge = edges.find((item) => item.id === edgeId);
            const kind = (edge?.data as { kind?: string } | undefined)?.kind;
            if (kind === 'dep' && onEdgeSelect) {
              event.preventDefault();
              event.stopPropagation();
              setHover(null);
              setEdgeHover(null);
              onEdgeSelect(edgeId, edgeElement);
            }
            return;
          }
          const nodeElement = target.closest<HTMLElement>('.react-flow__node[data-id]');
          const nodeId = nodeElement?.dataset.id;
          if (!nodeId) return;
          const node = nodes.find((item) => item.id === nodeId);
          if (node?.type !== 'mapNode') return;
          const data = node.data as MapNodeData;
          if (data.clickable === false || !data.visible) return;
          event.preventDefault();
          event.stopPropagation();
          setHover(null);
          setEdgeHover(null);
          onSelect(nodeId);
        }}
        onInit={(instance) => {
          instanceRef.current = instance;
          setInstanceReady(true);
        }}
        onNodeClick={(_, node) => {
          if (node.type !== 'mapNode') return;
          const data = node.data as MapNodeData;
          if (data.clickable === false || !data.visible) return;
          // 点击已进入“选中”语义，悬停卡继续盖在节点上会遮住新出现的
          // 依赖关系与高亮反馈；选择动作发生时立即收起临时提示。
          setHover(null);
          setEdgeHover(null);
          onSelect(node.id);
        }}
        onNodeMouseEnter={(event, node) => {
          if (node.type !== 'mapNode') return;
          if (node.id === selectedId) return;
          if (!(node.data as MapNodeData).visible) return;
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (!stageRect) return;
          setHover({
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
            stageWidth: stageRect.width,
            stageHeight: stageRect.height,
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
          const count = data.pairs?.length || 0;
          // 单条依赖已经由虚线与箭头完整表达，额外提示会在节点点击后
          // 恰好出现在鼠标下方，反而遮挡聚焦态；仅聚合边需要提示数量。
          if (count <= 1) return;
          const stageRect = stageRef.current?.getBoundingClientRect();
          if (!stageRect) return;
          setEdgeHover({
            x: event.clientX - stageRect.left,
            y: event.clientY - stageRect.top,
            stageWidth: stageRect.width,
            stageHeight: stageRect.height,
            count,
          });
        }}
        onEdgeMouseLeave={() => setEdgeHover(null)}
        onPaneClick={() => { setHover(null); setEdgeHover(null); }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: fitPadding, maxZoom: fitMaxZoom }}
        minZoom={0.32}
        maxZoom={2.4}
        autoPanOnNodeFocus
        ariaLabelConfig={GRAPH_ARIA_LABEL_CONFIG}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          position={controlsPosition}
          aria-label="图谱缩放与视图控制"
          className="!rounded-md !border !border-white/[0.1] !bg-[#0c1117]/95 !shadow-lg"
        />
      </ReactFlow>
      {emptyState && (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_50%_48%,rgba(15,23,32,.90),rgba(7,11,16,.84)_58%,rgba(7,11,16,.70))] px-5 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-sm rounded-xl border border-white/[0.10] bg-[#0c131b]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.42)]">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg border border-white/[0.10] bg-white/[0.04] text-[rgb(var(--kg-accent))]">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-100">{emptyState.title}</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">{emptyState.description}</p>
            <button
              type="button"
              onClick={emptyState.onAction}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 text-xs font-semibold text-slate-100 transition hover:border-[rgb(var(--kg-accent)/.35)] hover:bg-[rgb(var(--kg-accent)/.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--kg-accent))]"
            >
              {emptyState.actionLabel}
            </button>
          </div>
        </div>
      )}
      <div className="kg-stage-help pointer-events-none absolute bottom-3 left-3 z-20 hidden items-center gap-3 rounded-lg border border-white/[0.12] bg-[#101821]/95 px-3 py-2 text-[11px] text-slate-300 shadow-[0_10px_28px_rgba(0,0,0,.24)] backdrop-blur-xl sm:flex" role="note">
        <span className="inline-flex items-center gap-1.5"><MousePointer2 className="h-3 w-3 text-cyan-300" />点击选择</span>
        <span className="h-3 w-px bg-white/10" />
        <span>拖动画布</span>
        <span className="h-3 w-px bg-white/10" />
        <span>滚轮缩放</span>
        <span className="h-3 w-px bg-white/10" />
        <span>Tab 聚焦节点{onEdgeSelect ? '／依赖边' : ''}</span>
      </div>
      {hover && <NodeHoverCard hover={hover} />}
      {edgeHover && (
        <div
          className="pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-amber-300/30 bg-[#0b1117] px-2.5 py-1.5 text-[11px] text-amber-100 shadow-2xl"
          style={getGraphHoverCardPosition({ ...edgeHover, cardWidth: 164, cardHeight: 42 })}
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
  const position = getGraphHoverCardPosition(hover);
  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border bg-[#0b1117] p-3 shadow-2xl backdrop-blur"
      style={{ ...position, borderColor: tone.border }}
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

function graphAssociationEdge(
  from: string,
  to: string,
  tone: GraphTone,
  active = true,
  width = 1.2,
  dashed = false,
): RFEdge {
  const color = graphEdgeTone[tone];
  return {
    id: `${from}-${to}`,
    source: from,
    target: to,
    // Bezier curves give the canvas a softer, more organic look than the
    // right-angled smoothstep paths.
    type: dashed ? 'default' : 'default',
    animated: false,
    style: {
      stroke: color,
      strokeWidth: active ? width + 0.2 : 0.7,
      opacity: active ? (dashed ? 0.76 : 0.70) : 0.08,
      strokeDasharray: dashed ? '5 6' : undefined,
      strokeLinecap: 'round',
    },
    data: { kind: dashed ? 'mapping' : 'hier' },
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
  if (category === 'ethics') return 'emerald';
  if (category === 'innovation') return 'sky';
  if (category === 'teamwork') return 'violet';
  if (category === 'aerospace') return 'teal';
  return 'rose';
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

export function FullKnowledgeMap({
  points,
  selectedId,
  visibleIds,
  progress,
  onSelect,
  onFocusChapter,
  chapterFilter,
  masteryByKa,
  experimentTitleByRefId,
  onClearVisibility,
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
  onClearVisibility: () => void;
}) {
  const isMobile = useIsMobile();
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
  const edgeDetailPanelRef = useRef<HTMLDivElement>(null);
  const edgeFocusReturnRef = useRef<(Element & { focus: (options?: FocusOptions) => void }) | null>(null);
  const shouldFocusEdgeDetailRef = useRef(false);
  useEffect(() => {
    setSelectedEdgeKey(null);
    edgeFocusReturnRef.current = null;
    shouldFocusEdgeDetailRef.current = false;
  }, [chapterFilter]);

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

  // The visual emphasis may span the complete prerequisite closure, but the
  // camera must tell a smaller story: current point, its hierarchy and the
  // immediately adjacent learning steps. Fitting the full closure made a
  // selected node only a few pixels wide on a 1280×720 judging screen.
  const cameraFocusIds = useMemo(() => {
    const selectedPoint = relationIndex.byId[selectedId];
    if (!selectedPoint) return new Set<string>();
    const raw = new Set<string>([selectedPoint.id]);

    let cursor: KnowledgePoint | undefined = selectedPoint;
    while (cursor?.parentId) {
      raw.add(cursor.parentId);
      cursor = relationIndex.byId[cursor.parentId];
    }

    if (selectedPoint.level === 1) {
      points.forEach((point) => {
        if (point.parentId === selectedPoint.id && point.level === 2) raw.add(point.id);
      });
    } else if (selectedPoint.level === 2) {
      points.forEach((point) => {
        if (point.parentId === selectedPoint.id) raw.add(point.id);
      });
    } else if (selectedPoint.parentId) {
      points.forEach((point) => {
        if (point.parentId === selectedPoint.parentId) raw.add(point.id);
      });
    }

    (selectedPoint.prerequisites || []).forEach((id) => raw.add(id));
    (relationIndex.dependents[selectedPoint.id] || []).forEach((id) => raw.add(id));

    if (chapterFilter !== 'all') return raw;
    const presented = new Set<string>();
    raw.forEach((id) => {
      const representative = repOf(id);
      if (representative) presented.add(representative);
    });
    return presented;
  }, [chapterFilter, points, relationIndex, repOf, selectedId]);

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
      // —— 十章课程总览 ——
      // 首屏只显示 10 个章节入口，保证 1280×720 下章节名称可读；点击章节
      // 进入单章树后再展示 L2/L3。搜索或知识点深链会临时恢复关系网络，
      // 以便定位具体节点，而不是把 63 个节点永久压进首屏。
      const isCourseOverview = !selectedId;
      // 三类边分层渲染：层级辐条（极淡）、前置依赖（主角：青→琥珀渐变
      // 曲线，跨章微流动）、学习主线（章序粗线）。实验关联以烧瓶角标呈现。
      const COLS = 5;
      const CELL_W = isCourseOverview ? 210 : 352;
      const X0 = isCourseOverview ? 150 : 220;
      const ROW_Y = isCourseOverview ? [180, 430] : [225, 700];
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
        if (isCourseOverview && isMobile) {
          // A 5×2 desktop strip is technically complete on a phone, but fitView
          // shrinks every 80px chapter hub to an unreadable dot. Use a compact
          // 1–3–3–3 teaching path instead: four short rows preserve the same
          // course order, keep the top-right camera controls clear, and leave
          // enough rendered diameter for the chapter name to be read/tapped.
          const mobileRows = [1, 3, 3, 3];
          let row = 0;
          let offset = index;
          while (row < mobileRows.length - 1 && offset >= mobileRows[row]) {
            offset -= mobileRows[row];
            row += 1;
          }
          const rowCount = mobileRows[row] || 1;
          const left = rowCount <= 2 ? 80 : 56;
          const col = row === 2 ? rowCount - 1 - offset : offset;
          hubPos.set(chapter, { x: left + col * 112, y: 78 + row * 108 });
          return;
        }
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

        if (!isCourseOverview) {
          // 关系网络才需要簇光晕；总览只保留章节入口与课程顺序。
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
        }

        if (root) {
          onScreen.add(root.id);
          nodes.push(createMapNode(root.id, center.x, center.y, {
            label: root.name,
            subtitle: `CH${chapter} · ${levelTwo.length}节 · ${levelThreeCount}点${chapterProgress === null ? '' : ` · ${chapterProgress}%`}`,
            // 章节色只表达知识分区；掌握度由节点外环单独编码，避免一色多义。
            tone,
            size: 'hub',
            selected: root.id === selectedId,
            visible: chapterPoints.some((point) => visibleIds.has(point.id)),
            chapter,
            mastery: masteryByKa?.[root.id],
            experiments: expTitlesOf(root, false),
          }));
        }

        if (!isCourseOverview) levelTwo.forEach((parent, parentIndex) => {
          const angle = geo.start + (parentIndex / Math.max(levelTwo.length, 1)) * Math.PI * 2;
          const x = center.x + Math.cos(angle) * geo.rx;
          const y = center.y + Math.sin(angle) * geo.ry;
          const childCount = points.filter((c) => c.parentId === parent.id).length;
          l2Angle.set(parent.id, angle);
          l2Pos.set(parent.id, { x, y });
          onScreen.add(parent.id);
          nodes.push(createMapNode(parent.id, x, y, {
            label: parent.name,
            tone,
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
              style: { stroke: graphEdgeTone[tone], strokeWidth: 1.1, opacity: 0.38, strokeLinecap: 'round' },
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
            tone,
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
            style: { stroke: graphEdgeTone[tone], strokeWidth: 1.3, opacity: 0.58, strokeLinecap: 'round' },
            data: { kind: 'expand' },
          });
        });
      }

      // 课程章序：章节 hub 按课程目录顺序首尾相接。它只帮助学生看清
      // 章节位置，不声称相邻两章必然构成先修关系；真正的先修语义仅由
      // prerequisites 边承担。同行走左右桩的直线，
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
          animated: false,
          style: { stroke: mainColor, strokeWidth: 1.8, opacity: 0.56, strokeLinecap: 'round', strokeDasharray: '4 5' },
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
          animated: false,
          style: {
            stroke: 'url(#kg-dep-gradient)',
            strokeWidth: Math.min(1.1 + dep.count * 0.2, 2),
            opacity: dep.cross ? 0.54 : 0.46,
            strokeLinecap: 'round',
            cursor: 'pointer',
            ...(dep.cross ? { strokeDasharray: '7 5' } : {}),
          },
          // 内含N条依赖的小徽标：让聚合边一眼看出不是装饰线，点击可展开明细
          label: dep.count > 1 ? `${dep.count}` : undefined,
          labelStyle: { fill: '#fff7ed', fontSize: 10.5, fontWeight: 700, fontFamily: 'monospace' },
          labelBgStyle: { fill: 'rgba(120, 53, 15, 0.92)' },
          labelBgPadding: [3, 2],
          labelBgBorderRadius: 5,
          interactionWidth: 16,
          markerEnd: { type: MarkerType.ArrowClosed, color: graphEdgeTone.amber, width: 9, height: 9 },
          ...getDependencyEdgeAccessibility(
            pointById[dep.from]?.name || dep.from,
            pointById[dep.to]?.name || dep.to,
            dep.count,
          ),
          data: { kind: 'dep', pairs: dep.pairs },
        });
      });
    } else {
      // Single chapter = a left-to-right teaching narrative, not another
      // radial constellation. Judges read "chapter → section → concrete point"
      // in one glance; the active L2 family owns the visual stage while the
      // remaining L2 entrances stay available as a quiet chapter index.
      const chapter = chapterFilter;
      const chapterPoints = points.filter((point) => point.chapter === chapter);
      const root = chapterPoints.find((point) => point.level === 1);
      const levelTwo = chapterPoints.filter((point) => point.level === 2);
      const tone = knowledgeTone(chapter);
      const chapterProgress = progressForChapter(progress, chapter);
      const selectedPoint = pointById[selectedId];
      const activeParent = selectedPoint?.level === 2
        ? selectedPoint
        : selectedPoint?.level === 3
          ? pointById[selectedPoint.parentId || '']
          : undefined;
      const renderedPointIds = new Set<string>();

      const activeChildren = activeParent
        ? chapterPoints.filter((point) => point.parentId === activeParent.id)
        : [];
      if (root) {
        renderedPointIds.add(root.id);
        nodes.push(createMapNode(
          root.id,
          isMobile ? 400 : activeParent ? 155 : 180,
          isMobile ? 70 : 310,
          {
          label: root.name,
          subtitle: `${levelTwo.length} 个主题${chapterProgress === null ? '' : ` · ${chapterProgress}%`}`,
          levelLabel: 'L1',
          tone,
          size: isMobile ? 'compactChapterCard' : 'chapterCard',
          selected: root.id === selectedId,
          visible: visibleIds.has(root.id),
          chapter,
          mastery: masteryByKa?.[root.id],
          experiments: expTitlesOf(root, false),
        }));
      }

      if (activeParent) {
        renderedPointIds.add(activeParent.id);
        nodes.push(createMapNode(activeParent.id, isMobile ? 400 : 470, isMobile ? 205 : 310, {
          label: activeParent.name,
          subtitle: `${activeChildren.length} 个知识单元 · 逐项完成`,
          levelLabel: activeParent.id,
          tone,
          size: isMobile ? 'compactTopicCard' : 'topicCard',
          selected: activeParent.id === selectedId,
          visible: visibleIds.has(activeParent.id),
          chapter,
          mastery: masteryByKa?.[activeParent.id],
          experiments: expTitlesOf(activeParent, false),
        }));
        if (root) {
          edges.push({
            id: `kg-hier-${root.id}-${activeParent.id}`,
            source: root.id,
            target: activeParent.id,
            sourceHandle: isMobile ? undefined : 'rs',
            targetHandle: isMobile ? undefined : 'lt',
            type: 'default',
            animated: false,
            style: { stroke: graphEdgeTone[tone], strokeWidth: 2.4, opacity: 0.78, strokeLinecap: 'round' },
            markerEnd: { type: MarkerType.ArrowClosed, color: graphEdgeTone[tone], width: 9, height: 9 },
            data: { kind: 'hier' },
          });
        }

        const columns = 2;
        const rows = Math.max(1, Math.ceil(activeChildren.length / columns));
        const startY = isMobile ? 350 : 145;
        activeChildren.forEach((child, childIndex) => {
          const row = Math.floor(childIndex / columns);
          const rowStart = row * columns;
          const rowCount = Math.min(columns, activeChildren.length - rowStart);
          const column = childIndex - rowStart;
          const columnGap = isMobile ? 220 : 270;
          const rowWidth = (rowCount - 1) * columnGap;
          const childX = (isMobile ? 400 : 925) - rowWidth / 2 + column * columnGap;
          const childY = startY + row * (isMobile ? 105 : 108);
          renderedPointIds.add(child.id);
          nodes.push(createMapNode(child.id, childX, childY, {
            label: child.name,
            levelLabel: 'L3',
            sequence: childIndex + 1,
            // 学习单元用稳定的冷青色建立同组识别；掌握度仅由卡片右侧
            // 状态点编码，避免“章节色”和“成绩色”争夺整张卡片。
            tone: 'cyan',
            size: isMobile ? 'compactLearningUnit' : 'learningUnit',
            selected: child.id === selectedId,
            visible: visibleIds.has(child.id),
            chapter,
            mastery: masteryByKa?.[child.id],
            experiments: expTitlesOf(child, false),
          }));
          edges.push({
            id: `kg-hier-${activeParent.id}-${child.id}`,
            source: activeParent.id,
            target: child.id,
            sourceHandle: isMobile ? undefined : 'rs',
            targetHandle: isMobile ? undefined : 'lt',
            type: 'default',
            animated: false,
            style: {
              stroke: child.id === selectedId ? graphEdgeTone.cyan : graphEdgeTone[tone],
              strokeWidth: child.id === selectedId ? 2.2 : 1.35,
              opacity: child.id === selectedId ? 0.95 : 0.52,
              strokeLinecap: 'round',
            },
            data: { kind: 'hier' },
          });
        });
      } else {
        // 章根视图只展示六个可进入主题；进入任一主题后，主舞台立即收敛为
        // “章—当前主题—知识单元”。不再把未选主题塞进聚焦画布制造噪声。
        const columns = isMobile ? 2 : 3;
        levelTwo.forEach((parent, parentIndex) => {
          const row = Math.floor(parentIndex / columns);
          const column = parentIndex % columns;
          const parentX = isMobile ? 300 + column * 200 : 620 + column * 205;
          const parentY = isMobile ? 240 + row * 145 : 225 + row * 170;
          const childPoints = chapterPoints.filter((point) => point.parentId === parent.id);
          renderedPointIds.add(parent.id);
          nodes.push(createMapNode(parent.id, parentX, parentY, {
            label: parent.name,
            levelLabel: 'L2',
            tone,
            size: 'leaf',
            selected: parent.id === selectedId,
            visible: visibleIds.has(parent.id),
            chapter,
            mastery: masteryByKa?.[parent.id],
            childCount: childPoints.length,
            experiments: expTitlesOf(parent, true),
          }));
          if (root) {
            edges.push({
              id: `kg-hier-${root.id}-${parent.id}`,
              source: root.id,
              target: parent.id,
              sourceHandle: isMobile ? undefined : 'rs',
              targetHandle: isMobile ? undefined : 'lt',
              type: 'default',
              animated: false,
              style: { stroke: graphEdgeTone[tone], strokeWidth: 1.2, opacity: 0.48, strokeLinecap: 'round' },
              data: { kind: 'hier' },
            });
          }
        });
      }

      // Prerequisite arrows stay semantically distinct from containment and
      // are emitted only when both endpoints are on this editorial stage.
      if (selectedPoint && selectedPoint.chapter === chapter && selectedPoint.level === 3) {
        chapterPoints.forEach((point) => {
          (point.prerequisites || []).forEach((prerequisiteId) => {
            const prerequisite = pointById[prerequisiteId];
            if (!prerequisite || prerequisite.chapter !== chapter) return;
            if (!renderedPointIds.has(point.id) || !renderedPointIds.has(prerequisite.id)) return;
            if (!focusIds.has(point.id) || !focusIds.has(prerequisite.id)) return;
            const prerequisiteNode = nodes.find((node) => node.id === prerequisite.id);
            const targetNode = nodes.find((node) => node.id === point.id);
            if (!prerequisiteNode || !targetNode) return;
            const deltaX = targetNode.position.x - prerequisiteNode.position.x;
            const deltaY = targetNode.position.y - prerequisiteNode.position.y;
            const prefersHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 0.8;
            const sourceHandle = prefersHorizontal
              ? (deltaX >= 0 ? 'rs' : 'ls')
              : (deltaY >= 0 ? undefined : 'ts');
            const targetHandle = prefersHorizontal
              ? (deltaX >= 0 ? 'lt' : 'rt')
              : (deltaY >= 0 ? undefined : 'bt');
            edges.push({
              id: `kg-dep-local-${prerequisite.id}-${point.id}`,
              source: prerequisite.id,
              target: point.id,
              sourceHandle,
              targetHandle,
              type: 'default',
              animated: point.id === selectedId || prerequisite.id === selectedId,
              style: {
                stroke: 'url(#kg-dep-gradient)',
                strokeWidth: point.id === selectedId || prerequisite.id === selectedId ? 2.2 : 1.3,
                opacity: point.id === selectedId || prerequisite.id === selectedId ? 0.92 : 0.52,
                strokeDasharray: '7 5',
                strokeLinecap: 'round',
                cursor: 'pointer',
              },
              interactionWidth: 16,
              markerEnd: { type: MarkerType.ArrowClosed, color: graphEdgeTone.amber, width: 9, height: 9 },
              ...getDependencyEdgeAccessibility(prerequisite.name, point.name, 1),
              data: { kind: 'dep', pairs: [[prerequisite.id, point.id]] },
            });
          });
        });
      }
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
            edge.style = { ...edge.style, opacity: active ? 0.62 : 0.05 };
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
  }, [points, progress, selectedId, visibleIds, chapterFilter, masteryByKa, focusIds, chain, repOf, experimentTitleByRefId, isMobile]);

  // 选中的聚合依赖边：从当前布局的边集里按 id 找回它折算前的具体节点对
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) return null;
    const edge = layout.edges.find((e) => e.id === selectedEdgeKey);
    if (!edge) return null;
    const pairs = (edge.data as { pairs?: Array<[string, string]> } | undefined)?.pairs || [];
    return { id: edge.id, pairs };
  }, [layout.edges, selectedEdgeKey]);

  const stageEdges = useMemo(() => layout.edges.map((edge) => {
    const kind = (edge.data as { kind?: string } | undefined)?.kind;
    if (kind !== 'dep') return edge;
    return {
      ...edge,
      domAttributes: {
        ...edge.domAttributes,
        'aria-controls': DEPENDENCY_EDGE_DETAIL_ID,
        'aria-expanded': edge.id === selectedEdgeKey,
      },
    };
  }), [layout.edges, selectedEdgeKey]);

  useEffect(() => {
    if (!selectedEdge || !shouldFocusEdgeDetailRef.current) return;
    shouldFocusEdgeDetailRef.current = false;
    edgeDetailPanelRef.current?.focus({ preventScroll: true });
  }, [selectedEdge]);

  const closeEdgeDetail = (): void => {
    const returnTarget = edgeFocusReturnRef.current;
    edgeFocusReturnRef.current = null;
    shouldFocusEdgeDetailRef.current = false;
    setSelectedEdgeKey(null);
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  };

  const selectDependencyEdge = (edgeId: string, keyboardTrigger?: Element): void => {
    if (selectedEdgeKey === edgeId) {
      closeEdgeDetail();
      return;
    }
    const focusableTrigger = keyboardTrigger
      && 'focus' in keyboardTrigger
      && typeof keyboardTrigger.focus === 'function'
      ? keyboardTrigger as Element & { focus: (options?: FocusOptions) => void }
      : null;
    edgeFocusReturnRef.current = focusableTrigger;
    shouldFocusEdgeDetailRef.current = Boolean(focusableTrigger);
    setSelectedEdgeKey(edgeId);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* relative 定位容器：DepEdgeDetailPanel 以 absolute 浮层叠加在画布内部，
          不再作为文档流的兄弟块参与高度计算。此前面板是画布下方的普通块级元素，
          若外层容器高度（继承自更外层 main/body）超出视口，画布会把面板推到
          document 里很靠下的位置——1280×720 录制分辨率下实测面板 top ≈ 981px，
          而视口只有 720px 高，评委点击后完全看不到展开内容。浮层化后面板永远
          锚定在画布可视区域内，不受外层容器实际高度影响。 */}
      <div className="relative min-h-0 flex-1">
        {chapterFilter !== 'all' && (
          <div className="pointer-events-none absolute inset-x-7 top-4 z-10 hidden grid-cols-[25%_28%_1fr] gap-5 md:grid" aria-hidden>
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              <b className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.09] bg-white/[0.035] text-[8px] text-slate-300">01</b>
              章节定位 <i className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </span>
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              <b className="grid h-6 w-6 place-items-center rounded-md border border-amber-300/20 bg-amber-300/[0.06] text-[8px] text-amber-200">02</b>
              当前主题 <i className="h-px flex-1 bg-gradient-to-r from-amber-300/15 to-transparent" />
            </span>
            <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              <b className="grid h-6 w-6 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] text-[8px] text-cyan-200">03</b>
              学习单元 <i className="h-px flex-1 bg-gradient-to-r from-cyan-300/15 to-transparent" />
            </span>
          </div>
        )}
        <GraphMapStage
          key={`knowledge-stage-${isMobile ? 'compact' : 'wide'}`}
          ref={stageHandleRef}
          nodes={layout.nodes}
          edges={stageEdges}
          onSelect={(id) => {
            const point = points.find((item) => item.id === id);
            if (!point) return;
            // 全景视图点击章节 hub：进入该章的单章放射树（既有视图），
            // 在那里整簇 L3 全部展开。先让镜头飞到该 hub（420ms），
            // 播完再真正切数据——避免"瞬间跳变"的生硬感。
            if (chapterFilter === 'all' && point.level === 1) {
              if (pendingFocusTimer.current) clearTimeout(pendingFocusTimer.current);
              const transitionDuration = currentGraphMotionDuration(420);
              if (transitionDuration === 0) {
                onFocusChapter?.(point.chapter);
                return;
              }
              stageHandleRef.current?.flyToNode(point.id, { duration: transitionDuration });
              pendingFocusTimer.current = setTimeout(() => {
                onFocusChapter?.(point.chapter);
                pendingFocusTimer.current = null;
              }, transitionDuration);
              return;
            }
            edgeFocusReturnRef.current = null;
            shouldFocusEdgeDetailRef.current = false;
            setSelectedEdgeKey(null);
            onSelect(point);
          }}
          selectedId={selectedId}
          // 未进入聚焦态（如初始化兜底选中章根）时不传 focus 集，镜头保持全景
          // 单章教学视图保持镜头稳定：选中只改变关系和高亮，不突然缩放。
          // 全景网络仍保留聚焦镜头，便于在 279 个节点中追踪关系。
          focusIds={chapterFilter === 'all' && layout.hasFocus ? cameraFocusIds : undefined}
          // 跟随外层容器高度，避免内层画布高于容器把 MiniMap/Controls 裁掉
          heightClassName="h-full"
          fitPadding={chapterFilter === 'all' ? 0.05 : 0.035}
          onEdgeSelect={selectDependencyEdge}
          emptyState={visibleIds.size === 0 ? {
            title: '没有匹配的知识点',
            description: '当前章节与关键词组合没有结果。清除搜索后可恢复完整课程位置。',
            actionLabel: '清除搜索',
            onAction: onClearVisibility,
          } : undefined}
        />
        {selectedEdge && selectedEdge.pairs.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
            <div className="pointer-events-auto w-full max-w-2xl">
              <DepEdgeDetailPanel
                ref={edgeDetailPanelRef}
                pairs={selectedEdge.pairs}
                pointById={relationIndex.byId}
                onClose={closeEdgeDetail}
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
const DepEdgeDetailPanel = forwardRef<HTMLDivElement, {
  pairs: Array<[string, string]>;
  pointById: Record<string, KnowledgePoint>;
  onClose: () => void;
  onSelectPoint: (id: string) => void;
}>(function DepEdgeDetailPanel({
  pairs,
  pointById,
  onClose,
  onSelectPoint,
}, forwardedRef) {
  return (
    <div
      ref={forwardedRef}
      id={DEPENDENCY_EDGE_DETAIL_ID}
      role="region"
      aria-live="polite"
      aria-labelledby={`${DEPENDENCY_EDGE_DETAIL_ID}-title`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      className="glass-hover max-h-[280px] shrink-0 overflow-y-auto rounded-md border border-amber-300/25 bg-[#0b1117]/95 p-4 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
    >
      <div className="mb-3 flex items-center justify-between">
        <div id={`${DEPENDENCY_EDGE_DETAIL_ID}-title`} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-200">
          <GitBranch className="h-3.5 w-3.5" />
          聚合边展开 · 内含 {pairs.length} 条具体依赖
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭依赖关系详情"
          className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
                  className="inline-flex min-h-11 items-center rounded px-2 text-cyan-200 hover:bg-cyan-300/[0.08] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  {from?.name || fromId}
                </button>
                <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" />
                <button
                  type="button"
                  onClick={() => onSelectPoint(toId)}
                  className="inline-flex min-h-11 items-center rounded px-2 text-amber-200 hover:bg-amber-300/[0.08] hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
});

type ProblemVisualNode = {
  id: string;
  label: string;
  category: ProblemNode['category'];
  level: ProblemNode['level'];
  x: number;
  y: number;
  r: number;
};

/**
 * Canvas focus is a teaching view, not a miniature of the full problem domain.
 * Keep one complete diagnostic branch so labels remain readable at 1280x720:
 * the L1 domain, the selected/parent L2 type and all of that type's L3 signs.
 */
export function getFocusedProblemNodeIds(selectedId: string, fallbackIds: Set<string>): Set<string> {
  const selected = problemGraph.find((node) => node.id === selectedId);
  if (!selected) {
    return new Set(problemGraph
      .filter((node) => node.level === 1 && fallbackIds.has(node.id))
      .map((node) => node.id));
  }

  if (selected.level === 1) {
    return new Set([
      selected.id,
      ...problemGraph.filter((node) => node.parentId === selected.id).map((node) => node.id),
    ]);
  }

  const domain = selected.level === 2
    ? selected
    : problemGraph.find((node) => node.id === selected.parentId);
  const root = domain?.parentId
    ? problemGraph.find((node) => node.id === domain.parentId)
    : undefined;
  if (!domain || !root) return new Set([selected.id]);

  return new Set([
    root.id,
    domain.id,
    ...problemGraph.filter((node) => node.parentId === domain.id).map((node) => node.id),
  ]);
}

export function getProblemOverviewCenters(
  compactViewport: boolean,
  teachingFocus: boolean,
): Array<{ x: number; y: number }> {
  if (compactViewport) {
    return [
      { x: 285, y: 250 },
      { x: 515, y: 250 },
      { x: 285, y: 470 },
      { x: 515, y: 470 },
    ];
  }
  if (teachingFocus) {
    return [
      { x: 260, y: 400 },
      { x: 600, y: 400 },
      { x: 940, y: 400 },
      { x: 1280, y: 400 },
    ];
  }
  // Default judging view: a centered 2×2 composition. The four domains have
  // no causal relationship, so proximity and reading order provide grouping
  // without adding a synthetic hub or misleading edges.
  return [
    { x: 660, y: 390 },
    { x: 980, y: 390 },
    { x: 660, y: 610 },
    { x: 980, y: 610 },
  ];
}

function useCompactGraphLayout(active: boolean): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!active || typeof window === 'undefined') {
      setCompact(false);
      return;
    }
    const query = window.matchMedia('(max-width: 640px)');
    const update = (): void => setCompact(query.matches);
    update();
    query.addEventListener?.('change', update);
    return (): void => query.removeEventListener?.('change', update);
  }, [active]);
  return compact;
}

export function shouldKeepGraphRootFocus(disableRootFocus: boolean, compactViewport: boolean): boolean {
  return !disableRootFocus || compactViewport;
}

function ProblemGraphCanvas({
  selectedId,
  visibleIds,
  onSelect,
  disableRootFocus = false,
  teachingFocus = false,
  heightClassName = 'h-[clamp(420px,calc(100vh-292px),720px)]',
  emptyState,
}: {
  selectedId: string;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
  disableRootFocus?: boolean;
  teachingFocus?: boolean;
  heightClassName?: string;
  emptyState?: GraphCanvasEmptyState;
}) {
  const compactGraphViewport = useCompactGraphLayout(true);
  const useTeachingLayout = teachingFocus || compactGraphViewport;
  const layout = useMemo(() => {
    const roots = problemGraph.filter((node) => node.level === 1);
    const selectedProblem = problemGraph.find((node) => node.id === selectedId);
    const selectedParent = selectedProblem?.parentId
      ? problemGraph.find((node) => node.id === selectedProblem.parentId)
      : null;
    const selectedDomainId = selectedProblem?.level === 2
      ? selectedProblem.id
      : selectedProblem?.level === 3
        ? selectedProblem.parentId || null
        : null;
    const selectedRootId = selectedProblem?.level === 1
      ? selectedProblem.id
      : selectedParent?.level === 1
        ? selectedParent.id
        : selectedParent?.parentId || null;
    // Desktop cross-filter mode may compare several branches at once. On a
    // phone, the result chips below remain the comparison surface while the
    // canvas keeps the currently selected branch readable and tappable.
    const activeRootId = shouldKeepGraphRootFocus(disableRootFocus, compactGraphViewport)
      ? selectedRootId
      : null;
    // 四个问题域按“概念理解→编程实现→实验操作→项目设计”的教学环节顺序
    // 摆成中央 2×2。桌面中心距 320×220，卡片净距 110×172；画布四周留白
    // 对称而不把入口推到角落。四域没有真实依赖关系，因此不添加中心锚点或
    // 连线，只用阅读顺序、统一卡片与数量徽标表达同级分组。≤640px 使用独立
    // 的 230×220 紧凑坐标和 62px 高触达卡片，不把桌面布局机械缩小。
    const isDomainOverview = !activeRootId
      && visibleIds.size === roots.length
      && roots.every((root) => visibleIds.has(root.id));
    const centers = isDomainOverview
      ? getProblemOverviewCenters(compactGraphViewport, teachingFocus)
      : [
          { x: 480, y: 330 },
          { x: 1180, y: 330 },
          { x: 480, y: 850 },
          { x: 1180, y: 850 },
        ];
    // 每域固定 10 个二级问题类（数据口径），ellipse 半径按"横向空间比纵向
    // 紧张"原则收成竖向椭圆——呼应专业图谱 ringGeometry 的同一条经验，
    // 具体数值按问题图谱自身间距(500×400)重新标定，不是照抄专业图谱的值。
    const domainRx = 300;
    const domainRy = 205;
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];

    roots.forEach((root, rootIndex) => {
      if (!visibleIds.has(root.id)) return;
      // 一旦进入某个问题域，主画布只保留该域。其他问题域仍可从“筛选”
      // 进入，不再以半透明残影占据边缘、干扰当前诊断阅读。
      if (activeRootId && root.id !== activeRootId) return;
      const visibleDomains = problemGraph.filter((node) => node.parentId === root.id && visibleIds.has(node.id));
      const domains = compactGraphViewport && selectedDomainId
        ? visibleDomains.filter((domain) => domain.id === selectedDomainId)
        : visibleDomains;
      const isFocusedRootMap = useTeachingLayout && selectedProblem?.level === 1 && selectedProblem.id === root.id;
      const isFocusedBranch = useTeachingLayout
        && Boolean(selectedDomainId && domains.some((domain) => domain.id === selectedDomainId));
      const center = isFocusedRootMap || isFocusedBranch
        ? compactGraphViewport ? { x: 400, y: 90 } : { x: 250, y: 400 }
        : centers[rootIndex] || centers[0];
      const tone = problemTone(root.category);
      const leafTotal = problemGraph.filter((node) => node.category === root.category && node.level === 3).length;

      // 无边框径向光晕只用于已展开的问题域分组。总览态只有四个入口，
      // 若仍按完整子树尺寸绘制 780×540 光晕，React Flow 会为装饰层缩小
      // 真正节点，在 1280×720 首屏形成“大片留白+小字入口”。
      if (!isDomainOverview) {
        const haloW = isFocusedRootMap || isFocusedBranch
          ? compactGraphViewport ? 460 : 1300
          : domainRx * 2 + 180;
        const haloH = isFocusedRootMap || isFocusedBranch
          ? compactGraphViewport ? 720 : 500
          : domainRy * 2 + 130;
        nodes.push({
          id: `problem-halo-${root.id}`,
          type: 'clusterHalo',
          position: isFocusedRootMap || isFocusedBranch
            ? compactGraphViewport ? { x: 170, y: 20 } : { x: 140, y: 150 }
            : { x: center.x - haloW / 2, y: center.y - haloH / 2 },
          draggable: false,
          selectable: false,
          style: { zIndex: 0 },
          data: { color: graphTone[tone].color, width: haloW, height: haloH },
        });
      }

      nodes.push(createMapNode(root.id, center.x, center.y, {
        label: root.name,
        subtitle: `${leafTotal}项`,
        levelLabel: 'L1',
        tone,
        // 总览的四个问题域是导航入口，使用完整文字卡而非微缩圆点；
        // 进入某域后恢复根节点圆盘，保留层级对比。
        size: isDomainOverview
          ? compactGraphViewport ? 'compactDiagnosticUnit' : 'diagnosticUnit'
          : 'root',
        selected: root.id === selectedId,
        visible: visibleIds.has(root.id),
        dimmed: Boolean(activeRootId && root.id !== activeRootId),
      }));

      domains.forEach((domain, domainIndex) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * domainIndex) / Math.max(domains.length, 1);
        const domainX = isFocusedBranch
          ? compactGraphViewport ? 400 : 610
          : isFocusedRootMap
            ? compactGraphViewport ? 285 + (domainIndex % 2) * 230 : 560 + (domainIndex % 5) * 205
            : center.x + Math.cos(angle) * domainRx;
        const domainY = isFocusedBranch
          ? compactGraphViewport ? 255 : 400
          : isFocusedRootMap
            ? compactGraphViewport ? 210 + Math.floor(domainIndex / 2) * 125 : 280 + Math.floor(domainIndex / 5) * 240
            : center.y + Math.sin(angle) * domainRy;
        const allLeaves = problemGraph.filter((node) => node.parentId === domain.id);
        const leaves = allLeaves.filter((node) => visibleIds.has(node.id));
        nodes.push(createMapNode(domain.id, domainX, domainY, {
          label: domain.name,
          subtitle: `${allLeaves.length}`,
          levelLabel: 'L2',
          tone,
          size: compactGraphViewport ? 'compactDiagnosticUnit' : 'diagnosticUnit',
          selected: domain.id === selectedId,
          visible: visibleIds.has(domain.id),
          dimmed: Boolean(activeRootId && root.id !== activeRootId),
        }));
        edges.push(graphAssociationEdge(
          root.id,
          domain.id,
          tone,
          visibleIds.has(root.id) && visibleIds.has(domain.id) && (!activeRootId || root.id === activeRootId),
          1.5,
        ));

        leaves.forEach((leaf, leafIndex) => {
          const leafSpread = Math.PI / 1.35;
          const leafAngle = angle - leafSpread / 2 + (leafSpread * (leafIndex + 0.5)) / Math.max(leaves.length, 1);
          const leafRadius = 168 + Math.min(leaves.length, 10) * 3;
          const leafX = isFocusedBranch
            ? compactGraphViewport ? 285 + (leafIndex % 2) * 230 : 950 + (leafIndex % 2) * 285
            : domainX + Math.cos(leafAngle) * leafRadius;
          const leafY = isFocusedBranch
            ? compactGraphViewport ? 455 + Math.floor(leafIndex / 2) * 155 : 280 + Math.floor(leafIndex / 2) * 240
            : domainY + Math.sin(leafAngle) * leafRadius;
          nodes.push(createMapNode(leaf.id, leafX, leafY, {
            label: leaf.name,
            levelLabel: 'L3',
            tone: problemTone(leaf.category),
            size: compactGraphViewport ? 'compactDiagnosticUnit' : 'diagnosticUnit',
            selected: leaf.id === selectedId,
            visible: true,
            dimmed: Boolean(activeRootId && root.id !== activeRootId),
          }));
          edges.push(graphAssociationEdge(domain.id, leaf.id, tone, !activeRootId || root.id === activeRootId, 0.85));
        });
      });
    });

    return { nodes, edges };
  }, [compactGraphViewport, disableRootFocus, selectedId, useTeachingLayout, visibleIds]);

  const cameraFocusIds = useMemo(() => {
    const selected = problemGraph.find((node) => node.id === selectedId);
    if (!selected) return new Set<string>();
    const ids = new Set<string>([selected.id]);
    const parent = selected.parentId ? problemGraph.find((node) => node.id === selected.parentId) : null;
    const root = selected.level === 1
      ? selected
      : parent?.level === 1
        ? parent
        : parent?.parentId
          ? problemGraph.find((node) => node.id === parent.parentId) || null
          : null;
    if (root) ids.add(root.id);
    if (parent) ids.add(parent.id);
    if (selected.level === 1) {
      problemGraph.filter((node) => node.parentId === selected.id).forEach((node) => ids.add(node.id));
    } else if (selected.level === 2) {
      problemGraph.filter((node) => node.parentId === selected.id).forEach((node) => ids.add(node.id));
    } else if (parent) {
      problemGraph.filter((node) => node.parentId === parent.id).forEach((node) => ids.add(node.id));
    }
    return ids;
  }, [selectedId]);

  return (
    <GraphMapStage
      nodes={layout.nodes}
      edges={layout.edges}
      onSelect={onSelect}
      selectedId={selectedId}
      focusIds={cameraFocusIds}
      controlsPosition="top-right"
      heightClassName={heightClassName}
      fitPadding={selectedId ? 0.12 : 0.08}
      fitMaxZoom={selectedId ? 1.08 : 1.18}
      focusFitPadding={compactGraphViewport ? 0.08 : teachingFocus ? 0.2 : 0.25}
      focusFitMaxZoom={compactGraphViewport ? 1 : teachingFocus ? 1.25 : 1.35}
      emptyState={emptyState}
    />
  );
}

function ProblemGraphView({
  query,
  onQueryChange,
  selectedId,
  onSelect,
  searchInputRef,
  categoryFilter,
  difficultyFilter,
  onCategoryFilterChange,
  onDifficultyFilterChange,
  showLegend,
  isDrawerViewport,
  isCanvasFocus,
  isInspectorOpen,
  onToggleLegend,
  onToggleCanvasFocus,
  onToggleInspector,
  onOpenKnowledgePoint,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  categoryFilter: 'all' | ProblemNode['category'];
  difficultyFilter: 'all' | ProblemNode['difficulty'];
  onCategoryFilterChange: (value: 'all' | ProblemNode['category']) => void;
  onDifficultyFilterChange: (value: 'all' | ProblemNode['difficulty']) => void;
  showLegend: boolean;
  isDrawerViewport: boolean;
  isCanvasFocus: boolean;
  isInspectorOpen: boolean;
  onToggleLegend: () => void;
  onToggleCanvasFocus: () => void;
  onToggleInspector: () => void;
  onOpenKnowledgePoint: (id: string) => void;
}) {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileFilter = useCallback(() => setIsMobileFilterOpen(false), []);
  const deferredQuery = useDeferredValue(query);
  const isSearchPending = query !== deferredQuery;
  const q = deferredQuery.trim().toLowerCase();
  const roots = useMemo(() => problemGraph.filter((node) => node.level === 1), []);
  const selected = problemGraph.find((node) => node.id === selectedId) || null;
  const selectedChildren = selected ? problemGraph.filter((node) => node.parentId === selected.id) : [];
  const remediationPlan = selected ? getProblemRemediationPlan(selected) : null;
  const filteredProblems = useMemo(() => problemGraph.filter((node) => {
    const parent = node.parentId ? problemGraph.find((item) => item.id === node.parentId) : undefined;
    const root = parent?.parentId ? problemGraph.find((item) => item.id === parent.parentId) : undefined;
    const relatedKnowledgeNames = node.relatedKnowledgePoints
      .map((id) => staticKnowledgePoints.find((point) => point.id === id)?.name || '')
      .join(' ');
    const queryMatch = !q || `${node.id} ${node.name} ${parent?.name || ''} ${root?.name || ''} ${node.description || ''} ${node.solution || ''} ${(node.commonMistakes || []).join(' ')} ${relatedKnowledgeNames}`.toLowerCase().includes(q);
    const categoryMatch = categoryFilter === 'all' || node.category === categoryFilter;
    const difficultyMatch = difficultyFilter === 'all' || node.difficulty === difficultyFilter;
    return queryMatch && categoryMatch && difficultyMatch;
  }), [categoryFilter, difficultyFilter, q]);
  const activeProblemDomainId = selected?.level === 2
    ? selected.id
    : selected?.level === 3
      ? selected.parentId || null
      : null;
  const selectedProblemParent = selected?.parentId
    ? problemGraph.find((node) => node.id === selected.parentId)
    : null;
  const activeProblemRootId = selected?.level === 1
    ? selected.id
    : selected?.level === 2
      ? selected.parentId || null
      : selectedProblemParent?.parentId || null;
  const usesConcreteProblemFilter = Boolean(q) || difficultyFilter !== 'all';
  const visibleProblemIds = useMemo(() => {
    const ids = new Set<string>();
    if (usesConcreteProblemFilter) {
      filteredProblems.forEach((node) => {
        ids.add(node.id);
        let parentId = node.parentId;
        while (parentId) {
          ids.add(parentId);
          parentId = problemGraph.find((item) => item.id === parentId)?.parentId;
        }
      });
      return ids;
    }

    // Two-stage diagnosis: the first screen is four readable domains, not 44
    // miniature labels. An explicit root/category choice reveals its ten L2
    // types; choosing a type then reveals the concrete L3 symptoms.
    const candidateRoots = roots.filter((root) => (
      (categoryFilter === 'all' || root.category === categoryFilter)
      && (!activeProblemRootId || root.id === activeProblemRootId)
    ));
    candidateRoots.forEach((root) => ids.add(root.id));
    if (activeProblemRootId || categoryFilter !== 'all') {
      candidateRoots.forEach((root) => {
        problemGraph
          .filter((node) => node.parentId === root.id)
          .forEach((node) => ids.add(node.id));
      });
    }
    if (activeProblemDomainId && ids.has(activeProblemDomainId)) {
      problemGraph
        .filter((node) => node.parentId === activeProblemDomainId)
        .forEach((node) => ids.add(node.id));
    }
    return ids;
  }, [activeProblemDomainId, activeProblemRootId, categoryFilter, filteredProblems, roots, usesConcreteProblemFilter]);
  const canvasVisibleProblemIds = useMemo(
    () => isCanvasFocus ? getFocusedProblemNodeIds(selected?.id || '', visibleProblemIds) : visibleProblemIds,
    [isCanvasFocus, selected?.id, visibleProblemIds],
  );
  const canvasProblemNodeCount = canvasVisibleProblemIds.size;

  const contextualProblemNodes = useMemo(() => {
    if (usesConcreteProblemFilter) return filteredProblems;
    if (activeProblemDomainId) {
      return problemGraph.filter((node) => node.parentId === activeProblemDomainId);
    }
    if (activeProblemRootId) {
      return problemGraph.filter((node) => node.level === 2 && node.parentId === activeProblemRootId);
    }
    const visibleRootIds = new Set(
      roots
        .filter((root) => categoryFilter === 'all' || root.category === categoryFilter)
        .map((root) => root.id),
    );
    return problemGraph.filter((node) => node.level === 2 && Boolean(node.parentId && visibleRootIds.has(node.parentId)));
  }, [activeProblemDomainId, activeProblemRootId, categoryFilter, filteredProblems, roots, usesConcreteProblemFilter]);

  const hasActiveFilter = Boolean(q) || categoryFilter !== 'all' || difficultyFilter !== 'all';
  useEffect(() => {
    if (selected && visibleProblemIds.has(selected.id)) return;
    if (!selectedId && !hasActiveFilter) return;
    const firstDiagnostic = filteredProblems.find((node) => node.level === 3)
      ?? filteredProblems.find((node) => node.level === 2)
      ?? filteredProblems[0];
    const nextId = hasActiveFilter ? (firstDiagnostic?.id || '') : '';
    if (nextId !== selectedId) onSelect(nextId);
  }, [filteredProblems, hasActiveFilter, onSelect, selected, selectedId, visibleProblemIds]);

  const resetFilters = (): void => {
    onQueryChange('');
    onCategoryFilterChange('all');
    onDifficultyFilterChange('all');
    onSelect('');
  };

  useEffect(() => {
    if (isCanvasFocus) closeMobileFilter();
  }, [closeMobileFilter, isCanvasFocus]);

  return (
    <section
      id="graph-panel-problem"
      role="tabpanel"
      aria-labelledby="graph-tab-problem"
      data-graph-workspace="problem"
      data-canvas-focus={isCanvasFocus ? 'true' : 'false'}
      className={getGraphWorkspaceClassName(isCanvasFocus, isMobileFilterOpen)}
    >
      {!isCanvasFocus && <MobileDrawerDialog
        open={isMobileFilterOpen}
        onClose={closeMobileFilter}
        triggerRef={mobileFilterTriggerRef}
        panelRef={mobileFilterPanelRef}
        id="problem-graph-filter"
        label="问题类型与难度筛选"
        labelId="problem-graph-filter-title"
        backdropLabel="关闭问题筛选遮罩"
        className={cn(
          'fixed inset-y-3 left-3 z-[80] w-[min(350px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-white/[0.10] bg-[#0a1017]/98 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl transition-[transform,visibility] duration-300 lg:visible lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:rounded-lg lg:border-border lg:bg-card/70 lg:p-3 lg:shadow-none lg:backdrop-blur-none',
          isMobileFilterOpen ? 'visible translate-x-0' : 'invisible -translate-x-[115%]',
        )}
      >
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200/65">Diagnostic filter</div>
            <div id="problem-graph-filter-title" className="mt-0.5 text-xs font-semibold text-slate-100">问题类型与难度</div>
          </div>
          <button
            type="button"
            aria-label="收起问题筛选"
            data-drawer-initial-focus="true"
            onClick={closeMobileFilter}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索问题、原因、解法..."
            aria-label="搜索问题节点"
            className="h-11 rounded-xl border-white/[0.09] bg-black/25 pl-10 pr-12 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除问题搜索"
              onClick={() => onQueryChange('')}
              className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">/</kbd>
          )}
        </div>
        <div className="mb-2 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <span>问题类型 · 4类问题域</span>
          {hasActiveFilter && (
            <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center rounded-md px-2 text-cyan-200 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
              清除
            </button>
          )}
        </div>
        <div className="space-y-2">
          {roots.map((root) => {
            const meta = problemCategoryMeta[root.category];
            const Icon = meta.icon;
            const count = problemGraph.filter((node) => node.category === root.category && node.level === 3).length;
            return (
              <button
                key={root.id}
                type="button"
                aria-pressed={categoryFilter === root.category}
                onClick={() => {
                  const nextCategory = categoryFilter === root.category ? 'all' : root.category;
                  onCategoryFilterChange(nextCategory);
                  onSelect(nextCategory === 'all' ? '' : root.id);
                  setIsMobileFilterOpen(false);
                }}
                className={cn(
                  'min-h-11 w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  categoryFilter === root.category || selected?.id === root.id ? meta.tone : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
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
        <div className="mt-4 grid grid-cols-3 gap-2" aria-label="难度筛选">
          {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              aria-pressed={difficultyFilter === difficulty}
              onClick={() => {
                onDifficultyFilterChange(difficultyFilter === difficulty ? 'all' : difficulty);
                setIsMobileFilterOpen(false);
              }}
              className={cn(
                'min-h-11 rounded-xl border p-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                difficultyTone[difficulty],
                difficultyFilter !== 'all' && difficultyFilter !== difficulty && 'opacity-35 grayscale',
              )}
            >
              <div className="font-mono text-lg">{problemGraphStats.byDifficulty[difficulty]}</div>
              <div className="text-[10px] opacity-75">{difficultyLabel[difficulty]}</div>
            </button>
          ))}
        </div>
      </MobileDrawerDialog>}

      <section className="min-w-0 space-y-3">
        <div className="glass-hover overflow-hidden rounded-lg border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)] transition-all">
          <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200/70">
                <span>
                  Diagnostic topology · {usesConcreteProblemFilter
                    ? `${filteredProblems.length} matched`
                    : `${canvasProblemNodeCount} nodes`}
                </span>
                {isSearchPending && <span role="status" className="text-cyan-200/80">搜索中…</span>}
                {selected && (
                  <span className="max-w-[260px] truncate rounded-full border border-amber-200/15 bg-amber-200/[0.06] px-2 py-0.5 text-amber-100/85" aria-live="polite">
                    当前 · {selected.name}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">问题诊断图谱</h2>
              <p className="mt-1 text-xs text-slate-400">先定位问题域与问题类型，再展开具体症状；连线仅表示分类归属，不表示因果关系。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={mobileFilterTriggerRef}
                type="button"
                aria-expanded={isMobileFilterOpen}
                aria-controls="problem-graph-filter"
                aria-haspopup={isDrawerViewport ? 'dialog' : undefined}
                aria-label="展开问题筛选"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-amber-200/25 hover:bg-amber-200/[0.06] hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 lg:hidden"
              >
                <Menu className="h-3.5 w-3.5" />筛选
              </button>
              <button
                type="button"
                aria-expanded={showLegend}
                aria-controls="problem-graph-legend"
                onClick={onToggleLegend}
                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', showLegend ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}
              >
                <ListTree className="h-3.5 w-3.5" />图例与操作
              </button>
              <button
                type="button"
                data-kg-focus-exit="true"
                aria-pressed={isCanvasFocus}
                aria-label={isCanvasFocus ? '退出问题图谱专注画布' : '进入问题图谱专注画布，扩大节点阅读区域'}
                title={isCanvasFocus ? '恢复筛选与详情面板' : '隐藏筛选与详情，扩大图谱画布'}
                onClick={onToggleCanvasFocus}
                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200', isCanvasFocus ? 'border-amber-200/40 bg-amber-200/[0.14] text-amber-50' : 'border-amber-200/22 bg-amber-200/[0.07] text-amber-100 hover:border-amber-200/35 hover:bg-amber-200/[0.11]')}
              >
                {isCanvasFocus ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isCanvasFocus ? '退出专注' : '专注画布'}
              </button>
              <button
                ref={mobileInspectorTriggerRef}
                type="button"
                aria-expanded={isInspectorOpen && !isCanvasFocus}
                aria-controls="problem-graph-inspector"
                aria-haspopup={isDrawerViewport ? 'dialog' : undefined}
                onClick={onToggleInspector}
                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', isInspectorOpen && !isCanvasFocus ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}
              >
                {isInspectorOpen && !isCanvasFocus ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                问题详情
              </button>
            </div>
          </div>
          {showLegend && (
            <div id="problem-graph-legend" className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-black/15 px-4 py-2 font-mono text-[11px] text-slate-300" role="note">
              <span className="text-slate-500">阅读顺序</span>
              <span className="rounded border border-white/[0.08] px-2 py-1">L1 问题域</span>
              <ChevronRight className="h-3 w-3" />
              <span className="rounded border border-white/[0.08] px-2 py-1">L2 问题类型</span>
              <ChevronRight className="h-3 w-3" />
              <span className="rounded border border-white/[0.08] px-2 py-1">L3 具体问题</span>
              <span className="text-amber-100/90">连线仅表示分类归属；难度不等同于学生水平。</span>
              <GraphOperationHints />
            </div>
          )}
          <ProblemGraphCanvas
            key={`problem-canvas-${isCanvasFocus ? 'focus' : 'standard'}`}
            selectedId={selected?.id || ''}
            visibleIds={canvasVisibleProblemIds}
            disableRootFocus={usesConcreteProblemFilter}
            teachingFocus={isCanvasFocus}
            onSelect={(id) => {
              onSelect(id);
              if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) onToggleInspector();
            }}
            heightClassName={isCanvasFocus
              ? showLegend
                ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                : 'h-[clamp(420px,calc(100dvh-208px),780px)]'
              : selected
                ? 'h-[600px] sm:h-[clamp(380px,calc(100dvh-320px),680px)]'
                : 'h-[360px] sm:h-[clamp(380px,calc(100dvh-320px),680px)]'}
            emptyState={contextualProblemNodes.length === 0 ? {
              title: '没有匹配的问题节点',
              description: '请调整错误现象、原因、解法关键词，或清除当前类型与难度筛选。',
              actionLabel: '清除筛选',
              onAction: resetFilters,
            } : undefined}
          />
        </div>

        <div className="glass-hover rounded-lg border border-white/[0.08] bg-[#0b1118]/94 p-4 transition-all">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Target className="h-4 w-4 text-cyan-200" />
              {usesConcreteProblemFilter
                ? '搜索命中'
                : activeProblemDomainId
                  ? '当前类型的具体问题'
                  : activeProblemRootId
                    ? '当前问题域下的类型'
                    : '全部问题类型'}
            </div>
            <span className="font-mono text-[11px] text-slate-400">共 {contextualProblemNodes.length} 项</span>
          </div>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {contextualProblemNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  onSelect(node.id);
                  if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) onToggleInspector();
                }}
                className={cn(
                  'min-h-11 rounded-md border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  selected?.id === node.id ? problemCategoryMeta[node.category].tone : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
              >
                <span>{node.name}</span>
                <span className="ml-1.5 font-mono text-[9px] opacity-55">L{node.level}</span>
              </button>
            ))}
            {contextualProblemNodes.length === 0 && (
              <div className="w-full rounded-xl border border-dashed border-white/[0.1] px-3 py-5 text-center text-xs text-slate-500">
                <p>未找到匹配问题。请尝试错误现象、原因或解法关键词。</p>
                <button type="button" onClick={resetFilters} className="mt-2 min-h-11 font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  清除筛选
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {isInspectorOpen && !isCanvasFocus && <MobileDrawerDialog
        open={isDrawerViewport}
        onClose={onToggleInspector}
        triggerRef={mobileInspectorTriggerRef}
        panelRef={mobileInspectorPanelRef}
        id="problem-graph-inspector"
        label="问题详情"
        labelId="problem-graph-inspector-title"
        backdropLabel="关闭问题详情遮罩"
        closeOnDesktop={false}
        className="kg-inspector fixed inset-x-3 bottom-3 z-[80] max-h-[76dvh] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/98 p-3 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:top-20 lg:z-[60] lg:w-[min(390px,calc(100vw-32px))]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <span id="problem-graph-inspector-title" className="text-xs font-semibold text-slate-100">问题详情</span>
          <button type="button" data-drawer-initial-focus="true" onClick={onToggleInspector} aria-label="关闭问题详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="glass-hover rounded-lg border border-white/[0.08] bg-[#0b1118]/95 transition-all">
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
                  <div className="text-base font-semibold">{difficultyLabel[selected.difficulty]}</div>
                  <div className="text-xs opacity-70">问题复杂度</div>
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
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-100">
                    <span>关联知识点</span>
                    <span className="text-[10px] font-normal text-slate-500">点击回到专业知识图谱</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenKnowledgePoint(id)}
                        className="min-h-11 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        KP {id} <ArrowRight className="ml-1 inline h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {remediationPlan && (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.045] p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-emerald-50">建议补弱闭环</div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">按顺序完成，每一步都在正式学习页面形成对应结果。</p>
                    </div>
                  </div>

                  <ol className="mt-4 space-y-2">
                    {remediationPlan.actions.map((action, index) => (
                      <li key={action.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-lg border border-white/[0.07] bg-black/20 p-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] font-mono text-[10px] text-emerald-100">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100">{action.title}</div>
                          <p className="mt-1 text-[10px] leading-4 text-slate-400">{action.purpose}</p>
                          {action.id === 'review' && action.knowledgePointId ? (
                            <button
                              type="button"
                              onClick={() => onOpenKnowledgePoint(action.knowledgePointId!)}
                              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                            >
                              开始补学 <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <Link
                              href={action.href}
                              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-3 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                            >
                              进入该步骤 <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/20 p-3">
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-200/80">完成判定</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{remediationPlan.completionRule}</p>
                  </div>
                  <div role="note" className="mt-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-4 text-amber-50/75">
                    {remediationPlan.stateBoundary}
                    <Link href={remediationPlan.taskHref} className="ml-1 inline-flex min-h-8 items-center font-semibold text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
                      查看我的任务 <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
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
                        className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
      </MobileDrawerDialog>}
    </section>
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
  chapterFilter,
  disableRootFocus = false,
  teachingFocus = false,
  heightClassName = 'h-[clamp(420px,calc(100vh-292px),720px)]',
  emptyState,
}: {
  selectedId: string;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
  chapterFilter: number | 'all';
  disableRootFocus?: boolean;
  teachingFocus?: boolean;
  heightClassName?: string;
  emptyState?: GraphCanvasEmptyState;
}) {
  // Standard mobile pages need their own coordinates just as much as the
  // full-screen focus mode. Reusing the desktop constellation here made the
  // browser fit a 700px-wide graph into 390px and reduced nodes below 44px.
  const compactGraphViewport = useCompactGraphLayout(true);
  const layout = useMemo(() => {
    const roots = ideologicalNodes.filter((node) => node.level === 1);
    const selectedIdeological = ideologicalNodes.find((node) => node.id === selectedId);
    const selectedRootId = selectedIdeological?.level === 1
      ? selectedIdeological.id
      : selectedIdeological?.parentId || null;
    // Cross-theme filters can stay comparative on desktop. Mobile retains the
    // full result trail below the canvas and presents one selected theme here,
    // preventing several desktop constellations from being miniaturised.
    const activeRootId = shouldKeepGraphRootFocus(disableRootFocus, compactGraphViewport)
      ? selectedRootId
      : null;
    const cx = compactGraphViewport ? 195 : activeRootId ? 235 : 750;
    const cy = compactGraphViewport ? 55 : activeRootId ? 390 : 400;
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
    const elementRx = 225;
    const elementRy = 135;

    roots.forEach((root, index) => {
      if (!visibleIds.has(root.id)) return;
      if (activeRootId && root.id !== activeRootId) return;
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(roots.length, 1);
      const rootX = compactGraphViewport
        ? activeRootId
          ? 195
          : 100 + (index % 2) * 190
        : activeRootId
          ? 555
          : cx + Math.cos(angle) * rootRx;
      const rootY = compactGraphViewport
        ? activeRootId
          ? 150
          : 185 + Math.floor(index / 2) * 140
        : activeRootId
          ? 390
          : cy + Math.sin(angle) * rootRy;
      const tone = ideologicalTone(root.category);
      const allElements = ideologicalNodes.filter((node) => node.parentId === root.id);
      const elements = allElements.filter((node) => visibleIds.has(node.id));
      nodes.push(createMapNode(root.id, rootX, rootY, {
        label: root.name,
        subtitle: `${allElements.length}`,
        levelLabel: 'L1',
        tone,
        size: 'root',
        selected: root.id === selectedId,
        visible: visibleIds.has(root.id),
        dimmed: Boolean(activeRootId && root.id !== activeRootId),
      }));
      edges.push(graphAssociationEdge(
        'sip-core',
        root.id,
        tone,
        visibleIds.has(root.id) && (!activeRootId || root.id === activeRootId),
        1.7,
      ));

      elements.forEach((element, elementIndex) => {
        // 扇面从 π/1.25 拉宽到 π：4 元素域(S1/S3/S6)顶点朝上/朝下时，中间两个
        // 元素此前几乎水平并排(仅82px)，标签(104px宽)必然相撞——拉宽扇面后
        // 同一根上相邻元素间距全部拉开到 88px+ 中心距，DOM 实测验证零重叠。
        const spread = Math.PI;
        const elementAngle = angle - spread / 2 + (spread * (elementIndex + 0.5)) / Math.max(elements.length, 1);
        const columns = 2;
        const row = Math.floor(elementIndex / columns);
        const rowStart = row * columns;
        const rowCount = Math.min(columns, elements.length - rowStart);
        const column = elementIndex - rowStart;
        const focusedRowWidth = (rowCount - 1) * 250;
        const focusedRows = Math.max(1, Math.ceil(elements.length / columns));
        const focusedStartY = 390 - ((focusedRows - 1) * 125) / 2;
        const elementX = compactGraphViewport && activeRootId
          ? elementIndex % 2 === 0 ? 155 : 235
          : activeRootId
            ? 965 - focusedRowWidth / 2 + column * 250
            : rootX + Math.cos(elementAngle) * elementRx;
        const elementY = compactGraphViewport && activeRootId
          ? 260 + elementIndex * 70
          : activeRootId
            ? focusedStartY + row * 125
            : rootY + Math.sin(elementAngle) * elementRy;
        const explicitWeekCount = sipMappings.filter((mapping) => mapping.ideologicalNodeIds.includes(element.id)).length;
        nodes.push(createMapNode(element.id, elementX, elementY, {
          label: element.name,
          subtitle: explicitWeekCount > 0 ? `${explicitWeekCount}次` : '关联',
          levelLabel: 'L2',
          tone,
          size: compactGraphViewport ? 'compactThematicUnit' : 'thematicUnit',
          selected: element.id === selectedId,
          visible: visibleIds.has(element.id),
          dimmed: Boolean(activeRootId && root.id !== activeRootId),
        }));
        edges.push(graphAssociationEdge(
          root.id,
          element.id,
          tone,
          visibleIds.has(root.id) && visibleIds.has(element.id) && (!activeRootId || root.id === activeRootId),
          1.1,
        ));
      });
    });

    // 章节与周次映射已经在画布下方的“周次映射轨迹”逐项呈现。
    // 过去再次塞进十个 CH 节点，会迫使镜头缩小并制造交叉虚线；
    // 主画布现在只承担“课程思政→当前主题→教学元素”的清晰关系。

    return { nodes, edges };
  }, [chapterFilter, compactGraphViewport, disableRootFocus, selectedId, visibleIds]);

  const cameraFocusIds = useMemo(() => {
    const selected = ideologicalNodes.find((node) => node.id === selectedId);
    const ids = new Set<string>(['sip-core']);
    if (!selected) return ids;
    ids.add(selected.id);
    const rootId = selected.level === 1 ? selected.id : selected.parentId;
    if (rootId) {
      ids.add(rootId);
      ideologicalNodes
        .filter((node) => node.parentId === rootId)
        .forEach((node) => ids.add(node.id));
    }
    return ids;
  }, [selectedId]);

  return (
    <GraphMapStage
      key={`ideological-stage-${compactGraphViewport ? 'compact' : 'wide'}-${teachingFocus ? 'focus' : 'standard'}`}
      nodes={layout.nodes}
      edges={layout.edges}
      onSelect={onSelect}
      selectedId={selectedId}
      controlsPosition="top-right"
      focusIds={cameraFocusIds}
      heightClassName={heightClassName}
      fitPadding={compactGraphViewport ? 0.08 : 0.18}
      fitMaxZoom={compactGraphViewport ? 1.05 : 1.1}
      focusFitPadding={compactGraphViewport ? 0.04 : 0.3}
      focusFitMaxZoom={compactGraphViewport ? 1.05 : 1.35}
      emptyState={emptyState}
    />
  );
}

function IdeologicalGraphView({
  query,
  onQueryChange,
  selectedId,
  onSelect,
  searchInputRef,
  categoryFilter,
  chapterFilter,
  onCategoryFilterChange,
  onChapterFilterChange,
  showLegend,
  isDrawerViewport,
  isCanvasFocus,
  isInspectorOpen,
  onToggleLegend,
  onToggleCanvasFocus,
  onToggleInspector,
  onOpenKnowledgePoint,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  categoryFilter: 'all' | IdeologicalCategory;
  chapterFilter: number | 'all';
  onCategoryFilterChange: (value: 'all' | IdeologicalCategory) => void;
  onChapterFilterChange: (value: number | 'all') => void;
  showLegend: boolean;
  isDrawerViewport: boolean;
  isCanvasFocus: boolean;
  isInspectorOpen: boolean;
  onToggleLegend: () => void;
  onToggleCanvasFocus: () => void;
  onToggleInspector: () => void;
  onOpenKnowledgePoint: (id: string) => void;
}) {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileFilter = useCallback(() => setIsMobileFilterOpen(false), []);
  const [activeMappingWeek, setActiveMappingWeek] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const isSearchPending = query !== deferredQuery;
  const q = deferredQuery.trim().toLowerCase();
  const roots = ideologicalNodes.filter((node) => node.level === 1);
  const selected = ideologicalNodes.find((node) => node.id === selectedId) || null;
  const activeMapping = activeMappingWeek
    ? sipMappings.find((mapping) => (
      mapping.weekRange === activeMappingWeek
      && Boolean(selected && mapping.ideologicalNodeIds.includes(selected.id))
    )) || null
    : null;
  const selectedChildren = selected ? ideologicalNodes.filter((node) => node.parentId === selected.id) : [];
  const explicitlyMappedNodeIdsByChapter = useMemo(() => {
    const result = new Map<number, Set<string>>();
    sipMappings.forEach((mapping) => {
      const ids = result.get(mapping.chapter) || new Set<string>();
      mapping.ideologicalNodeIds.forEach((id) => ids.add(id));
      result.set(mapping.chapter, ids);
    });
    return result;
  }, []);
  const filteredNodes = useMemo(() => ideologicalNodes.filter((node) => {
    const parentName = node.parentId
      ? ideologicalNodes.find((item) => item.id === node.parentId)?.name || ''
      : '';
    const queryMatch = !q || `${node.id} ${node.name} ${parentName} ${node.description} ${node.teachingMethod} ${node.caseStudy || ''}`.toLowerCase().includes(q);
    const categoryMatch = categoryFilter === 'all' || node.category === categoryFilter;
    const chapterMatch = chapterFilter === 'all' || Boolean(explicitlyMappedNodeIdsByChapter.get(chapterFilter)?.has(node.id));
    return queryMatch && categoryMatch && chapterMatch;
  }), [categoryFilter, chapterFilter, explicitlyMappedNodeIdsByChapter, q]);
  const filteredMappings = useMemo(() => sipMappings.filter((mapping) => {
    const queryMatch = !q || `${mapping.weekRange} ${mapping.knowledgePointName} ${mapping.ideologicalTheme} ${mapping.ideologicalContent}`.toLowerCase().includes(q);
    const chapterMatch = chapterFilter === 'all' || mapping.chapter === chapterFilter;
    const categoryMatch = categoryFilter === 'all' || mapping.ideologicalNodeIds.some((id) => (
      ideologicalNodes.find((node) => node.id === id)?.category === categoryFilter
    ));
    return queryMatch && chapterMatch && categoryMatch;
  }), [categoryFilter, chapterFilter, q]);
  const selectedScheduledMappings = useMemo(() => {
    if (!selected) return [];
    const selectedNodeIds = selected.level === 1
      ? ideologicalNodes.filter((node) => node.parentId === selected.id).map((node) => node.id)
      : [selected.id];
    return sipMappings.filter((mapping) => mapping.ideologicalNodeIds.some((id) => selectedNodeIds.includes(id)));
  }, [selected]);
  const visibleIdeologicalIds = useMemo(() => {
    if (!q && categoryFilter === 'all' && chapterFilter === 'all') {
      if (!selected) {
        return new Set(ideologicalNodes.filter((node) => node.level === 1).map((node) => node.id));
      }
      const focusedRootId = selected.level === 1 ? selected.id : selected.parentId;
      return new Set(ideologicalNodes
        .filter((node) => node.id === focusedRootId || node.parentId === focusedRootId)
        .map((node) => node.id));
    }
    const ids = new Set<string>();
    filteredNodes.forEach((node) => {
      ids.add(node.id);
      if (node.parentId) ids.add(node.parentId);
    });
    filteredMappings.forEach((mapping) => {
      mapping.ideologicalNodeIds.forEach((id) => {
        const node = ideologicalNodes.find((item) => item.id === id);
        if (!node) return;
        ids.add(node.id);
        if (node.parentId) ids.add(node.parentId);
      });
    });
    return ids;
  }, [filteredMappings, filteredNodes, q, categoryFilter, chapterFilter, selected]);
  const usesCrossThemeFilter = Boolean(q) || chapterFilter !== 'all';
  const activeIdeologicalRootId = usesCrossThemeFilter
    ? undefined
    : selected?.level === 1 ? selected.id : selected?.parentId;
  const canvasIdeologicalNodeCount = activeIdeologicalRootId
    ? ideologicalNodes.filter((node) => (
        (node.id === activeIdeologicalRootId || node.parentId === activeIdeologicalRootId)
        && visibleIdeologicalIds.has(node.id)
      )).length
    : visibleIdeologicalIds.size;

  const hasActiveFilter = Boolean(q) || categoryFilter !== 'all' || chapterFilter !== 'all';
  useEffect(() => {
    if (selected && visibleIdeologicalIds.has(selected.id)) return;
    if (!selectedId && !hasActiveFilter) return;
    const firstMappedNode = filteredMappings[0]?.ideologicalNodeIds
      .map((id) => ideologicalNodes.find((node) => node.id === id))
      .find((node): node is IdeologicalNode => Boolean(node));
    const firstVisibleElement = filteredNodes.find((node) => node.level === 2)
      ?? firstMappedNode
      ?? filteredNodes[0]
      ?? ideologicalNodes.find((node) => visibleIdeologicalIds.has(node.id));
    const nextId = hasActiveFilter ? (firstVisibleElement?.id || '') : '';
    if (nextId !== selectedId) onSelect(nextId);
  }, [filteredMappings, filteredNodes, hasActiveFilter, onSelect, selected, selectedId, visibleIdeologicalIds]);

  const resetFilters = (): void => {
    onQueryChange('');
    onCategoryFilterChange('all');
    onChapterFilterChange('all');
    onSelect('');
  };
  const selectMappingNode = (mapping: (typeof sipMappings)[number]): void => {
    const candidates = mapping.ideologicalNodeIds
      .map((id) => ideologicalNodes.find((node) => node.id === id))
      .filter((node): node is IdeologicalNode => Boolean(node));
    const target = candidates.find((node) => (
      (categoryFilter === 'all' || node.category === categoryFilter)
      && (chapterFilter === 'all' || Boolean(explicitlyMappedNodeIdsByChapter.get(chapterFilter)?.has(node.id)))
    )) || candidates[0];
    if (!target) return;
    setActiveMappingWeek(mapping.weekRange);
    onSelect(target.id);
    if (isCanvasFocus) onToggleCanvasFocus();
    if (!isInspectorOpen) onToggleInspector();
  };

  useEffect(() => {
    if (!activeMappingWeek || !selected) return;
    const mapping = sipMappings.find((item) => item.weekRange === activeMappingWeek);
    if (mapping && !mapping.ideologicalNodeIds.includes(selected.id)) setActiveMappingWeek(null);
  }, [activeMappingWeek, selected]);

  useEffect(() => {
    if (isCanvasFocus) closeMobileFilter();
  }, [closeMobileFilter, isCanvasFocus]);

  return (
    <section
      id="graph-panel-ideological"
      role="tabpanel"
      aria-labelledby="graph-tab-ideological"
      data-graph-workspace="ideological"
      data-canvas-focus={isCanvasFocus ? 'true' : 'false'}
      className={getGraphWorkspaceClassName(isCanvasFocus, isMobileFilterOpen)}
    >
      {!isCanvasFocus && <MobileDrawerDialog
        open={isMobileFilterOpen}
        onClose={closeMobileFilter}
        triggerRef={mobileFilterTriggerRef}
        panelRef={mobileFilterPanelRef}
        id="ideological-graph-filter"
        label="育人主题与章节筛选"
        labelId="ideological-graph-filter-title"
        backdropLabel="关闭育人主题筛选遮罩"
        className={cn(
          'fixed inset-y-3 left-3 z-[80] w-[min(350px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-white/[0.10] bg-[#0a1017]/98 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl transition-[transform,visibility] duration-300 lg:visible lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:rounded-lg lg:border-border lg:bg-card/70 lg:p-3 lg:shadow-none lg:backdrop-blur-none',
          isMobileFilterOpen ? 'visible translate-x-0' : 'invisible -translate-x-[115%]',
        )}
      >
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200/65">Value filter</div>
            <div id="ideological-graph-filter-title" className="mt-0.5 text-xs font-semibold text-slate-100">育人主题与章节</div>
          </div>
          <button
            type="button"
            aria-label="收起育人主题筛选"
            data-drawer-initial-focus="true"
            onClick={closeMobileFilter}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索思政主题、周次..."
            aria-label="搜索思政主题"
            className="h-11 rounded-xl border-white/[0.09] bg-black/25 pl-10 pr-12 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除思政搜索"
              onClick={() => onQueryChange('')}
              className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">/</kbd>
          )}
        </div>
        <div className="mb-2 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <span>一级主题 · 6类</span>
          {hasActiveFilter && (
            <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center rounded-md px-2 text-cyan-200 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
              清除
            </button>
          )}
        </div>
        <div className="space-y-2">
          {roots.map((root) => {
            const Icon = ideologicalIconMap[root.category];
            const meta = categoryMeta[root.category];
            const count = ideologicalNodes.filter((node) => node.parentId === root.id).length;
            return (
              <button
                key={root.id}
                type="button"
                aria-pressed={categoryFilter === root.category}
                onClick={() => {
                  const nextCategory = categoryFilter === root.category ? 'all' : root.category;
                  onCategoryFilterChange(nextCategory);
                  onSelect(nextCategory === 'all' ? '' : root.id);
                  setIsMobileFilterOpen(false);
                }}
                className={cn(
                  'min-h-11 w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  categoryFilter === root.category || selected?.id === root.id ? 'text-slate-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
                style={categoryFilter === root.category || selected?.id === root.id ? { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}18` } : undefined}
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
        <div className="mt-4 px-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">按明确周次定位</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          <button
            type="button"
            aria-pressed={chapterFilter === 'all'}
            onClick={() => {
              onChapterFilterChange('all');
              setIsMobileFilterOpen(false);
            }}
            className={cn('col-span-2 min-h-11 rounded-lg border px-2 font-mono text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', chapterFilter === 'all' ? 'border-cyan-200/30 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:text-slate-200')}
          >
            全部
          </button>
          {ideologicalGraphStats.chaptersWithSip.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={chapterFilter === value}
              onClick={() => {
                onChapterFilterChange(chapterFilter === value ? 'all' : value);
                setIsMobileFilterOpen(false);
              }}
              className={cn('min-h-11 rounded-lg border font-mono text-[10px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', chapterFilter === value ? 'border-cyan-200/30 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:text-slate-200')}
            >
              CH{value}
            </button>
          ))}
        </div>
      </MobileDrawerDialog>}

      <section className="min-w-0 space-y-3">
        <div className="glass-hover overflow-hidden rounded-lg border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)] transition-all">
          <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-rose-200/75">
                <span>
                  Value mapping · {usesCrossThemeFilter
                    ? `${filteredNodes.length} matched`
                    : `${canvasIdeologicalNodeCount} nodes`} · {filteredMappings.length} mappings
                </span>
                {isSearchPending && <span role="status" className="text-cyan-200/80">搜索中…</span>}
                {selected && (
                  <span className="max-w-[260px] truncate rounded-full border border-rose-200/15 bg-rose-200/[0.06] px-2 py-0.5 text-rose-100/85" aria-live="polite">
                    当前 · {selected.name}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">育人主题图谱</h2>
              <p className="mt-1 text-xs text-slate-400">
                {ideologicalGraphStats.totalCategories}个一级主题、{ideologicalGraphStats.totalElements}个二级元素；
                {ideologicalGraphStats.totalWeeklyMappings}条周次安排在下方逐项核验，内容关联不自动视为已实施。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={mobileFilterTriggerRef}
                type="button"
                aria-expanded={isMobileFilterOpen}
                aria-controls="ideological-graph-filter"
                aria-haspopup="dialog"
                aria-label="展开育人主题筛选"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-rose-200/25 hover:bg-rose-200/[0.06] hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 lg:hidden"
              >
                <Menu className="h-3.5 w-3.5" />筛选
              </button>
              <button type="button" aria-expanded={showLegend} aria-controls="ideological-graph-legend" onClick={onToggleLegend} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', showLegend ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
                <ListTree className="h-3.5 w-3.5" />图例与操作
              </button>
              <button
                type="button"
                data-kg-focus-exit="true"
                aria-pressed={isCanvasFocus}
                aria-label={isCanvasFocus ? '退出育人图谱专注画布' : '进入育人图谱专注画布，扩大节点阅读区域'}
                title={isCanvasFocus ? '恢复筛选与详情面板' : '隐藏筛选与详情，扩大图谱画布'}
                onClick={onToggleCanvasFocus}
                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200', isCanvasFocus ? 'border-rose-200/40 bg-rose-200/[0.14] text-rose-50' : 'border-rose-200/22 bg-rose-200/[0.07] text-rose-100 hover:border-rose-200/35 hover:bg-rose-200/[0.11]')}
              >
                {isCanvasFocus ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isCanvasFocus ? '退出专注' : '专注画布'}
              </button>
              <button ref={mobileInspectorTriggerRef} type="button" aria-expanded={isInspectorOpen && !isCanvasFocus} aria-controls="ideological-graph-inspector" aria-haspopup={isDrawerViewport ? 'dialog' : undefined} onClick={onToggleInspector} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', isInspectorOpen && !isCanvasFocus ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
                {isInspectorOpen && !isCanvasFocus ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                主题详情
              </button>
            </div>
          </div>
          {showLegend && (
            <div id="ideological-graph-legend" className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] bg-black/15 px-4 py-2 font-mono text-[11px] text-slate-300" role="note">
              <span className="rounded border border-white/[0.08] px-2 py-1">SIP 中心主题</span>
              <ChevronRight className="h-3 w-3" />
              <span className="rounded border border-white/[0.08] px-2 py-1">L1 育人主题</span>
              <ChevronRight className="h-3 w-3" />
              <span className="rounded border border-white/[0.08] px-2 py-1">L2 教学元素</span>
              <span className="text-cyan-100/90">连线仅表示主题归属；明确安排以下方周次轨迹为准。</span>
              <GraphOperationHints />
            </div>
          )}
          <IdeologicalGraphCanvas
            key={`ideological-canvas-${isCanvasFocus ? 'focus' : 'standard'}`}
            selectedId={selected?.id || ''}
            visibleIds={visibleIdeologicalIds}
            disableRootFocus={usesCrossThemeFilter}
            teachingFocus={isCanvasFocus}
            onSelect={(id) => {
              onSelect(id);
              if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) onToggleInspector();
            }}
            chapterFilter={chapterFilter}
            heightClassName={isCanvasFocus
              ? showLegend
                ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                : 'h-[clamp(420px,calc(100dvh-208px),780px)]'
              : selected
                ? 'h-[480px] sm:h-[clamp(380px,calc(100dvh-320px),680px)]'
                : 'h-[360px] sm:h-[clamp(380px,calc(100dvh-320px),680px)]'}
            emptyState={filteredNodes.length === 0 && filteredMappings.length === 0 ? {
              title: '没有匹配的育人主题',
              description: '请调整周次、案例或价值主题关键词，或清除当前主题与章节筛选。',
              actionLabel: '清除筛选',
              onAction: resetFilters,
            } : undefined}
          />
        </div>

        <div className="glass-hover rounded-lg border border-white/[0.08] bg-[#0b1118]/94 p-4 transition-all">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <BookOpen className="h-4 w-4 text-cyan-200" />
              周次映射轨迹
            </div>
            <span className="font-mono text-[10px] text-slate-500">{filteredMappings.length}/{sipMappings.length}</span>
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-400">点击周次可查看本周知识点、课堂判断、教学动作与完成证据。</p>
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {filteredMappings.map((mapping) => (
              <button
                key={`${mapping.weekRange}-${mapping.knowledgePointName}`}
                type="button"
                aria-pressed={activeMappingWeek === mapping.weekRange}
                aria-controls="ideological-week-detail"
                onClick={() => selectMappingNode(mapping)}
                className={cn(
                  'min-h-11 rounded-md border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  activeMappingWeek === mapping.weekRange
                    ? 'border-cyan-300/30 bg-cyan-300/[0.08] text-slate-100'
                    : 'border-white/[0.08] bg-black/20 text-slate-400 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] hover:text-slate-100',
                )}
              >
                <span className="font-mono text-cyan-200">{mapping.weekRange}</span>
                <span className="mx-2 text-slate-600">·</span>
                <span className="text-slate-200">KP {mapping.knowledgePointId} {mapping.knowledgePointName}</span>
                <ArrowRight className="mx-1.5 inline h-3 w-3 text-slate-600" />
                <span>{mapping.ideologicalTheme}</span>
              </button>
            ))}
            {filteredMappings.length === 0 && (
              <div className="w-full rounded-xl border border-dashed border-white/[0.1] px-3 py-5 text-center text-xs text-slate-500">
                <p>未找到匹配主题。请尝试周次、案例或价值主题关键词。</p>
                <button type="button" onClick={resetFilters} className="mt-2 min-h-11 font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  清除筛选
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {isInspectorOpen && !isCanvasFocus && <MobileDrawerDialog
        open={isDrawerViewport}
        onClose={onToggleInspector}
        triggerRef={mobileInspectorTriggerRef}
        panelRef={mobileInspectorPanelRef}
        id="ideological-graph-inspector"
        label="育人主题详情"
        labelId="ideological-graph-inspector-title"
        backdropLabel="关闭育人主题详情遮罩"
        closeOnDesktop={false}
        className="kg-inspector fixed inset-x-3 bottom-3 z-[80] max-h-[76dvh] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/98 p-3 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:top-20 lg:z-[60] lg:w-[min(390px,calc(100vw-32px))]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <span id="ideological-graph-inspector-title" className="text-xs font-semibold text-slate-100">育人主题详情</span>
          <button type="button" data-drawer-initial-focus="true" onClick={onToggleInspector} aria-label="关闭育人主题详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        {activeMapping && (
          <div id="ideological-week-detail" className="glass-hover rounded-lg border border-cyan-300/20 bg-[#0b1118]/95 p-4 transition-all">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[10px] text-cyan-100">{activeMapping.weekRange}</span>
              <span className="font-mono text-[10px] text-slate-500">KP {activeMapping.knowledgePointId}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-50">{activeMapping.knowledgePointName} · {activeMapping.ideologicalTheme}</h2>
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <div className="text-xs font-semibold text-cyan-100">本周课堂判断</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-300">{activeMapping.ideologicalContent}</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <div className="text-xs font-semibold text-slate-100">教学动作</div>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{activeMapping.teachingMethod}</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <div className="text-xs font-semibold text-slate-100">完成证据</div>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{activeMapping.expectedOutcome}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-2 text-xs font-semibold text-slate-100">明确映射节点</div>
              <div className="flex flex-wrap gap-2">
                {activeMapping.ideologicalNodeIds.map((id) => {
                  const node = ideologicalNodes.find((item) => item.id === id);
                  if (!node) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected?.id === id}
                      onClick={() => onSelect(id)}
                      className={cn(
                        'min-h-11 rounded-lg border px-2.5 py-1 text-left text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                        selected?.id === id
                          ? 'border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-50'
                          : 'border-white/[0.08] bg-black/20 text-slate-400 hover:border-cyan-300/25 hover:text-slate-100',
                      )}
                    >
                      <span className="font-mono">{id}</span>
                      <span className="ml-1.5">{node.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <div className="glass-hover rounded-lg border border-white/[0.08] bg-[#0b1118]/95 transition-all">
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
                  <div className="text-xs text-slate-500">内容关联章节</div>
                </div>
              </div>
              <div className={cn(
                'rounded-md border p-4',
                selectedScheduledMappings.length > 0
                  ? 'border-cyan-300/20 bg-cyan-300/[0.045]'
                  : 'border-amber-300/15 bg-amber-300/[0.04]',
              )}>
                <div className={cn('text-sm font-semibold', selectedScheduledMappings.length > 0 ? 'text-cyan-100' : 'text-amber-100')}>明确周次安排</div>
                {selectedScheduledMappings.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedScheduledMappings.map((mapping) => (
                      <span key={`${mapping.weekRange}-${mapping.knowledgePointId}`} className="rounded-lg border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-300">
                        {mapping.weekRange} · KP {mapping.knowledgePointId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">该元素目前属于课程内容关联，尚未列入17周明确教学安排。</p>
                )}
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
                  <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-100">
                    <span>关联知识点</span>
                    <span className="text-[10px] font-normal text-slate-500">点击回到专业知识图谱</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenKnowledgePoint(id)}
                        className="min-h-11 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        KP {id} <ArrowRight className="ml-1 inline h-3 w-3" />
                      </button>
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
                        className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
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
        <div className="glass-hover rounded-lg border border-white/[0.08] bg-[#0b1118]/95 p-4 transition-all">
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
      </MobileDrawerDialog>}
    </section>
  );
}

export function HyperKnowledgeGraphPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const activeTaskPathId = searchParams?.get('taskPathId') ?? null;
  const activeTaskStepId = searchParams?.get('taskStepId') ?? null;
  const isAddressingTaskContext = Boolean(
    activeTaskPathId
      && (activeTaskStepId === 'addressing-graph' || activeTaskStepId === 'addressing-animation'),
  );
  const [view, setView] = useState<GraphView>('knowledge');
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([]);
  const [kgLoading, setKgLoading] = useState(true);
  const [kgDataSource, setKgDataSource] = useState<'loading' | 'db' | 'server-static' | 'client-fallback'>('loading');
  const [kgDataNote, setKgDataNote] = useState('正在读取课程图谱');
  const [selectedId, setSelectedId] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [selectedIdeologicalId, setSelectedIdeologicalId] = useState('');
  const [query, setQuery] = useState('');
  const [urlQuery, setUrlQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isSearchPending = query !== deferredQuery;
  const [chapter, setChapter] = useState<number | 'all'>('all');
  const [problemCategoryFilter, setProblemCategoryFilter] = useState<'all' | ProblemNode['category']>('all');
  const [problemDifficultyFilter, setProblemDifficultyFilter] = useState<'all' | ProblemNode['difficulty']>('all');
  const [ideologicalCategoryFilter, setIdeologicalCategoryFilter] = useState<'all' | IdeologicalCategory>('all');
  const [ideologicalChapterFilter, setIdeologicalChapterFilter] = useState<number | 'all'>('all');
  const [progress, setProgress] = useState<HyperLearningProgressRecord[]>([]);
  const [kaScores, setKaScores] = useState<Record<string, number>>({});
  const [latestAssessmentSnapshot, setLatestAssessmentSnapshot] = useState<NextStepSnapshot | null | undefined>(undefined);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const isDrawerViewport = useGraphDrawerViewport();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mobileSidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), []);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [isCanvasFocus, setIsCanvasFocus] = useState(false);
  const closeCanvasFocus = useCallback(() => setIsCanvasFocus(false), []);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  useGraphSearchShortcut(headerSearchInputRef, isAddressingTaskContext);
  useGraphCanvasFocusDialog(isCanvasFocus, workbenchRef, closeCanvasFocus);
  // 记录"上一次已处理/已自写"的 query string，而非一次性布尔量：纯 boolean
  // 在 Next App Router 客户端路由缓存复用同一组件实例时会永久锁死——从
  // 薄弱节点/课程内容等页面二次带参跳回本页（组件未重新 mount）时，深链
  // 参数被当成"已处理过"直接忽略，落到上次遗留的节点而不是目标节点。
  // 按 query string 比对：只要传入的 searchParams 不同于"我们自己刚写回
  // 的值"，就当作外部新深链来处理；自己 state→URL 回写的那次视为已处理，
  // 避免下面第二个 effect 的回写触发这里重新纠正 chapter 的死循环。
  const appliedSearchRef = useRef<string | null>(null);
  // URL→state 与 state→URL 两个 effect 在首次挂载时会按声明顺序执行。
  // 仅依赖 appliedSearchRef 会让后一个 effect 在同一轮里读到“已处理”，
  // 却仍携带初始 state，进而把刚从深链解析出的筛选参数覆盖掉。
  // 用 ref + state 双版本门禁：只有解析后的新 state 已完成一次渲染，
  // 才允许反向写回 URL；外部深链、硬刷新和浏览器前进后退均适用。
  const appliedUrlVersionRef = useRef(0);
  const [appliedUrlVersion, setAppliedUrlVersion] = useState(0);
  // 学习任务上下文不属于图谱筛选状态，但必须随图谱内部切换保留；
  // 否则 URL 同步会丢失 path/step，完成事件无法归属到教师布置的步骤。
  const taskContextRef = useRef<{ pathId: string | null; stepId: string | null }>({
    pathId: null,
    stepId: null,
  });
  // Read this during render, before any effects mutate appliedSearchRef. The
  // default-selection and filter-repair effects run in the same commit as the
  // URL hydration effect; without this render-time gate they can overwrite a
  // valid deep-linked child node with the chapter root.
  const incomingSearchString = searchParams?.toString() ?? '';
  const isExternalSearchPending = appliedSearchRef.current !== incomingSearchString;

  useEffect(() => {
    const timer = window.setTimeout(() => setUrlQuery(query), 250);
    return (): void => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    async function loadProgress(): Promise<void> {
      const token = getStoredAccessToken();
      if (!token) return;
      const result = await fetchHyperJson<unknown>('/api/learning-progress', token);
      if (!active) return;
      setProgress(normalizeLearningProgress(result.data));
    }
    void loadProgress();
    return (): void => {
      active = false;
    };
  }, []);

  // Fetch knowledge points from API (DB-first) with static fallback
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
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
    async function loadKnowledgePoints(): Promise<void> {
      try {
        const token = getStoredAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetchClientRequest('/api/knowledge-graph?type=raw', { headers, signal: controller.signal }, 8_000);
        if (res.ok) {
          const raw: unknown = await res.json();
          const parsed = knowledgePointResponseSchema.safeParse(raw);
          if (active && parsed.success && parsed.data.data.length > 0) {
            setKnowledgePoints(withStaticRelations(parsed.data.data));
            if (parsed.data.source === 'db') {
              setKgDataSource('db');
              setKgDataNote('课程图谱由服务端数据库与内置课程目录合并提供');
            } else {
              setKgDataSource('server-static');
              setKgDataNote('服务端已采用版本内置的完整课程目录');
            }
            return;
          }
        }
        if (active) setKgDataNote(res.ok ? '服务端图谱格式异常，已切换内置课程目录' : `服务端返回 ${res.status}，已切换内置课程目录`);
      } catch (error) {
        if (active) {
          setKgDataNote(error instanceof ClientRequestTimeoutError
            ? '服务端响应超过 8 秒，已切换内置课程目录'
            : '服务端暂不可用，已切换内置课程目录');
        }
      }
      if (active) {
        setKnowledgePoints(staticKnowledgePoints);
        setKgDataSource('client-fallback');
      }
    }
    void loadKnowledgePoints().finally(() => { if (active) setKgLoading(false); });
    return (): void => {
      active = false;
      controller.abort();
    };
  }, []);

  // Load latest quiz scores from localStorage so the canvas can re-tint the
  // nodes the student is weak / strong on. Re-runs when the user identity
  // changes (storage key is namespaced by user id).
  useEffect(() => {
    if (knowledgePoints.length === 0) return;
    let active = true;
    const controller = new AbortController();
    async function loadScores(): Promise<void> {
      if (typeof window === 'undefined') return;
      let scores: z.infer<typeof scoreMapSchema> | null = null;
      let resolvedAssessment: NextStepSnapshot | null = null;
      const token = getStoredAccessToken();
      if (user && token) {
        try {
          const response = await fetchClientRequest('/api/user/activities?action=COMPLETE_QUIZ&limit=1', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }, 6_000);
          if (response.ok) {
            const rawResponse: unknown = await response.json();
            const parsedResponse = activityResponseSchema.safeParse(rawResponse);
            if (parsedResponse.success) {
              const activity = (parsedResponse.data.activities ?? parsedResponse.data.data ?? [])[0];
              if (activity?.details) {
                const rawDetails: unknown = JSON.parse(activity.details);
                const parsedDetails = serverAssessmentDetailsSchema.safeParse(rawDetails);
                if (parsedDetails.success) {
                  scores = parsedDetails.data.scoresByKA;
                  resolvedAssessment = {
                    weakKAs: parsedDetails.data.weakAreas
                      ?? Object.entries(parsedDetails.data.scoresByKA)
                        .filter(([, value]) => value.score < 60)
                        .map(([ka]) => ka),
                    ...(parsedDetails.data.score !== undefined ? { totalScore: parsedDetails.data.score } : {}),
                    scores: parsedDetails.data.scoresByKA,
                  };
                }
              }
            }
          }
        } catch {
          // The local receipt below remains a fallback when the service is unavailable.
        }
      }

      if (!scores) {
        try {
          const key = user ? `assessment-results-${user.id}` : 'assessment-results';
          const stored = localStorage.getItem(key);
          if (stored) {
            const rawStored: unknown = JSON.parse(stored);
            const parsedStored = localAssessmentSchema.safeParse(rawStored);
            if (parsedStored.success) {
              scores = parsedStored.data.scores;
              resolvedAssessment = {
                weakKAs: parsedStored.data.weakKAs
                  ?? Object.entries(parsedStored.data.scores)
                    .filter(([, value]) => value.score < 60)
                    .map(([ka]) => ka),
                ...(parsedStored.data.totalScore !== undefined ? { totalScore: parsedStored.data.totalScore } : {}),
                scores: parsedStored.data.scores,
              };
            }
          }
        } catch {
          scores = null;
        }
      }

      const direct: Record<string, number> = {};
      Object.entries(scores ?? {}).forEach(([ka, value]) => {
        if (/^\d+(\.\d+)*$/.test(ka)) {
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
      if (active) {
        setKaScores(out);
        setLatestAssessmentSnapshot(resolvedAssessment);
      }
    }

    void loadScores();
    return (): void => {
      active = false;
      controller.abort();
    };
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
    Object.entries(LEGACY_GRAPH_NODE_TARGETS).forEach(([alias, pointId]) => {
      const target = knowledgePoints.find((point) => point.id === pointId);
      if (target) map[alias] = target;
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
    ? knowledgePoints.filter((point) => (
        point.chapter === selected.chapter
        && point.id !== selected.id
        && (!isAddressingTaskContext || point.id === '3.1' || point.parentId === '3.1')
      )).slice(0, 8)
    : [];

  const replaceSelectedNodeInUrl = useCallback((
    targetView: GraphView,
    nodeId: string,
    targetChapter?: number,
  ): void => {
    if (typeof window === 'undefined') return;
    const nextUrl = buildGraphNodeSelectionUrl({
      pathname: pathname || '/knowledge-graph',
      currentSearch: window.location.search,
      currentHash: window.location.hash,
      view: targetView,
      nodeId,
      chapter: targetChapter,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl === nextUrl) return;
    const nextSearch = nextUrl.includes('?')
      ? nextUrl.slice(nextUrl.indexOf('?') + 1).split('#')[0]
      : '';
    appliedSearchRef.current = nextSearch;
    // Native replaceState is immediate and is integrated with the Next App
    // Router. It preserves the current page/focus mode and avoids adding one
    // browser-history entry for every node inspected.
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [pathname]);

  const goToPoint = (id: string) => {
    const target = pointById[id];
    if (!target) return;
    if (isAddressingTaskContext && id !== '3.1' && !id.startsWith('3.1.')) return;
    setSelectedId(id);
    replaceSelectedNodeInUrl('knowledge', id, target.chapter);
    if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) setIsInspectorOpen(true);
  };

  const selectProblemNode = (id: string): void => {
    if (!problemGraph.some((node) => node.id === id)) return;
    setSelectedProblemId(id);
    replaceSelectedNodeInUrl('problem', id);
  };

  const selectIdeologicalNode = (id: string): void => {
    if (!ideologicalNodes.some((node) => node.id === id)) return;
    setSelectedIdeologicalId(id);
    replaceSelectedNodeInUrl('ideological', id);
  };

  const revealInspector = useCallback(() => {
    setIsInspectorOpen(true);
  }, []);

  const focusChapter = (value: number) => {
    if (isAddressingTaskContext && value !== 3) return;
    setChapter(value);
    const nextSelectedId = resolveChapterSelection(knowledgePoints, value, selectedId);
    if (nextSelectedId) setSelectedId(nextSelectedId);
  };

  const openKnowledgePoint = (id: string): void => {
    const target = pointById[id] || knowledgePoints.find((point) => point.id.startsWith(`${id}.`));
    if (!target) return;
    if (isAddressingTaskContext && target.id !== '3.1' && !target.id.startsWith('3.1.')) return;
    setView('knowledge');
    setSelectedId(target.id);
    setChapter(target.chapter);
    setQuery('');
    setIsCanvasFocus(false);
    setIsInspectorOpen(true);
  };

  const openProblemNode = (id: string): void => {
    if (isAddressingTaskContext) return;
    const target = problemGraph.find((node) => node.id === id);
    if (!target) return;
    setView('problem');
    setSelectedProblemId(target.id);
    setProblemCategoryFilter(target.category);
    setProblemDifficultyFilter('all');
    setQuery('');
    setIsCanvasFocus(false);
    setIsInspectorOpen(true);
  };

  const openIdeologicalNode = (id: string): void => {
    if (isAddressingTaskContext) return;
    const target = ideologicalNodes.find((node) => node.id === id);
    if (!target) return;
    setView('ideological');
    setSelectedIdeologicalId(target.id);
    setIdeologicalCategoryFilter(target.category);
    setIdeologicalChapterFilter('all');
    setQuery('');
    setIsCanvasFocus(false);
    setIsInspectorOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (event.key !== 'Escape') return;
      if (isEditing && target instanceof HTMLElement) {
        target.blur();
        return;
      }
      // Any open graph drawer owns Escape through the shared capture handler.
      // Avoid closing a second layer on the same key press.
      if (document.querySelector('[data-kg-mobile-drawer-open="true"]')) return;
      if (isMobileSidebarOpen) closeMobileSidebar();
      else if (isCanvasFocus) setIsCanvasFocus(false);
      else if (isInspectorOpen) setIsInspectorOpen(false);
      else if (showLegend) setShowLegend(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMobileSidebar, isCanvasFocus, isInspectorOpen, isMobileSidebarOpen, showLegend]);

  useEffect(() => {
    document.documentElement.classList.toggle('kg-atlas-active', isCanvasFocus);
    document.documentElement.classList.toggle('kg-focus-active', isCanvasFocus);
    return (): void => {
      document.documentElement.classList.remove('kg-atlas-active');
      document.documentElement.classList.remove('kg-focus-active');
    };
  }, [isCanvasFocus]);

  useEffect(() => {
    if (!searchParams) return;
    // After the initial deep-link is applied, the state→URL effect keeps
    // searchParams in sync with the in-memory state. Re-applying URL→state
    // on every searchParams change would force-override fields that the
    // user just touched (e.g. clicking a node in the "all chapters"
    // overview snaps the canvas to that node's single-chapter view because
    // we re-derive chapter from the node id). Only run when the incoming
    // query string is one we haven't already accounted for (a genuinely new
    // external deep link) — see appliedSearchRef comment above.
    const currentSearch = searchParams.toString();
    if (appliedSearchRef.current === currentSearch) return;

    const viewParam = searchParams.get('view');
    const nodeParam = searchParams.get('node');
    const chapterParam = parseChapterParam(searchParams.get('chapter'));
    const qParam = searchParams.get('q');
    const problemCategoryParam = searchParams.get('problemCategory');
    const problemDifficultyParam = searchParams.get('difficulty');
    const ideologicalCategoryParam = searchParams.get('sipCategory');
    const ideologicalChapterParam = parseChapterParam(searchParams.get('sipChapter'));
    const taskStepParam = searchParams.get('taskStepId');
    const problemTarget = nodeParam ? problemGraph.find((node) => node.id === nodeParam) : undefined;
    const ideologicalTarget = nodeParam ? ideologicalNodes.find((node) => node.id === nodeParam) : undefined;
    taskContextRef.current = {
      pathId: searchParams.get('taskPathId'),
      stepId: taskStepParam,
    };

    // 知识点由接口异步载入。深链首次到达时若节点库尚未就绪，必须等待后再应用，
    // 否则会把该 query 误记为“已处理”，最终停在默认的第一个节点。
    if (nodeParam && knowledgePoints.length === 0
      && !problemGraph.some((node) => node.id === nodeParam)
      && !ideologicalNodes.some((node) => node.id === nodeParam)) {
      return;
    }

    const taskLockedToKnowledge = Boolean(
      searchParams.get('taskPathId')
        && (taskStepParam === 'addressing-graph' || taskStepParam === 'addressing-animation'),
    );
    if (taskLockedToKnowledge) setView('knowledge');
    else if (isGraphView(viewParam)) setView(viewParam);
    setQuery(taskLockedToKnowledge ? '' : qParam ?? '');
    setUrlQuery(taskLockedToKnowledge ? '' : qParam ?? '');
    const requestedProblemCategory = problemCategories.includes(problemCategoryParam as ProblemNode['category'])
      ? problemCategoryParam as ProblemNode['category']
      : 'all';
    const requestedProblemDifficulty = problemDifficulties.includes(problemDifficultyParam as ProblemNode['difficulty'])
      ? problemDifficultyParam as ProblemNode['difficulty']
      : 'all';
    const requestedIdeologicalCategory = ideologicalCategories.includes(ideologicalCategoryParam as IdeologicalCategory)
      ? ideologicalCategoryParam as IdeologicalCategory
      : 'all';
    const requestedIdeologicalChapter = typeof ideologicalChapterParam === 'number' ? ideologicalChapterParam : 'all';

    // A concrete deep link is authoritative. Conflicting URL filters must not
    // produce the misleading state “results exist, canvas empty”. Preserve a
    // compatible difficulty/chapter filter; otherwise reset only that filter.
    setProblemCategoryFilter(problemTarget?.category ?? requestedProblemCategory);
    setProblemDifficultyFilter(problemTarget && requestedProblemDifficulty !== 'all'
      && requestedProblemDifficulty !== problemTarget.difficulty
      ? 'all'
      : requestedProblemDifficulty);
    setIdeologicalCategoryFilter(ideologicalTarget?.category ?? requestedIdeologicalCategory);
    setIdeologicalChapterFilter(ideologicalTarget && requestedIdeologicalChapter !== 'all'
      && !ideologicalTarget.relatedChapters.includes(requestedIdeologicalChapter)
      ? 'all'
      : requestedIdeologicalChapter);

    if (chapterParam !== null) {
      setChapter(chapterParam);
      if (!nodeParam && typeof chapterParam === 'number') {
        const chapterLandingId = resolveChapterSelection(knowledgePoints, chapterParam, selectedId);
        if (chapterLandingId) setSelectedId(chapterLandingId);
      }
      if (!viewParam) setView('knowledge');
    }

    if (nodeParam) {
      const knowledgePoint = knowledgePoints.find((point) => point.id === nodeParam) || knowledgePointByGraphId[nodeParam];
      if (knowledgePoint) {
        setView('knowledge');
        const requestedKnowledgePoint = taskLockedToKnowledge
          && knowledgePoint.id !== '3.1'
          && !knowledgePoint.id.startsWith('3.1.')
          ? knowledgePoints.find((point) => point.id === '3.1') || knowledgePoint
          : knowledgePoint;
        const selectedKnowledgeId = taskLockedToKnowledge
          ? requestedKnowledgePoint.id
          : typeof chapterParam === 'number'
            ? resolveChapterSelection(knowledgePoints, chapterParam, requestedKnowledgePoint.id)
            : requestedKnowledgePoint.id;
        if (selectedKnowledgeId) setSelectedId(selectedKnowledgeId);
        if (taskStepParam === 'addressing-graph' || taskStepParam === 'addressing-animation') {
          setIsCanvasFocus(false);
          setIsInspectorOpen(true);
        }
        // Only honour a node-derived chapter switch on the initial deep
        // link — never re-apply it from a state→URL round-trip.
        if (taskLockedToKnowledge || chapterParam === null) setChapter(requestedKnowledgePoint.chapter);
      } else if (problemTarget && !taskLockedToKnowledge) {
        setView('problem');
        setSelectedProblemId(nodeParam);
      } else if (ideologicalTarget && !taskLockedToKnowledge) {
        setView('ideological');
        setSelectedIdeologicalId(nodeParam);
      } else {
        setView('knowledge');
        if (taskLockedToKnowledge) {
          const taskTarget = knowledgePoints.find((point) => point.id === '3.1');
          if (taskTarget) {
            setSelectedId(taskTarget.id);
            setChapter(taskTarget.chapter);
            setIsCanvasFocus(false);
            setIsInspectorOpen(true);
          }
        } else if (typeof chapterParam === 'number') {
          const chapterLandingId = resolveChapterSelection(knowledgePoints, chapterParam, selectedId);
          if (chapterLandingId) setSelectedId(chapterLandingId);
        }
      }
    } else if (taskLockedToKnowledge) {
      const taskTarget = knowledgePoints.find((point) => point.id === '3.1');
      if (taskTarget) {
        setView('knowledge');
        setSelectedId(taskTarget.id);
        setChapter(taskTarget.chapter);
        setIsCanvasFocus(false);
        setIsInspectorOpen(true);
      }
    }

    appliedSearchRef.current = currentSearch;
    const nextAppliedUrlVersion = appliedUrlVersionRef.current + 1;
    appliedUrlVersionRef.current = nextAppliedUrlVersion;
    setAppliedUrlVersion(nextAppliedUrlVersion);
  }, [knowledgePointByGraphId, knowledgePoints, searchParams]);

  // Sync state -> URL (replace, no history pollution). Skipped on the very
  // first render so we don't trample the deep-link applied above.
  useEffect(() => {
    if (appliedUrlVersion === 0 || appliedUrlVersion !== appliedUrlVersionRef.current) return;
    const base = pathname || '/knowledge-graph';
    const next = new URLSearchParams();
    if (view !== 'knowledge') next.set('view', view);
    if (view === 'knowledge' && chapter !== 'all') next.set('chapter', String(chapter));
    if (view === 'problem' && problemCategoryFilter !== 'all') next.set('problemCategory', problemCategoryFilter);
    if (view === 'problem' && problemDifficultyFilter !== 'all') next.set('difficulty', problemDifficultyFilter);
    if (view === 'ideological' && ideologicalCategoryFilter !== 'all') next.set('sipCategory', ideologicalCategoryFilter);
    if (view === 'ideological' && ideologicalChapterFilter !== 'all') next.set('sipChapter', String(ideologicalChapterFilter));
    const trimmedQ = urlQuery.trim();
    if (trimmedQ) next.set('q', trimmedQ);
    let nodeForUrl = '';
    if (view === 'knowledge') nodeForUrl = selectedId;
    else if (view === 'problem') nodeForUrl = selectedProblemId;
    else if (view === 'ideological') nodeForUrl = selectedIdeologicalId;
    if (nodeForUrl) next.set('node', nodeForUrl);
    if (taskContextRef.current.pathId) next.set('taskPathId', taskContextRef.current.pathId);
    if (taskContextRef.current.stepId) next.set('taskStepId', taskContextRef.current.stepId);
    const qs = next.toString();
    const url = qs ? `${base}?${qs}` : base;
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== url) {
      // 标记为"自己刚写回的值"，这样上面那个 effect 因 searchParams 变化
      // 重新触发时会认得这是自己回写的结果而不是新深链，不会又把 chapter
      // 之类的字段按 node 重新纠正一遍。
      appliedSearchRef.current = qs;
      router.replace(url, { scroll: false });
    }
  }, [
    view,
    chapter,
    urlQuery,
    selectedId,
    selectedProblemId,
    selectedIdeologicalId,
    problemCategoryFilter,
    problemDifficultyFilter,
    ideologicalCategoryFilter,
    ideologicalChapterFilter,
    appliedUrlVersion,
    pathname,
    router,
  ]);

  const filteredList = useMemo(() => {
    if (isAddressingTaskContext) {
      return knowledgePoints.filter((point) => point.id === '3.1' || point.parentId === '3.1');
    }
    const q = deferredQuery.trim().toLowerCase();
    return knowledgePoints.filter((point) => {
      const chapterMatch = chapter === 'all' || point.chapter === chapter;
      const parentName = point.parentId ? pointById[point.parentId]?.name || '' : '';
      const chapterName = pointById[String(point.chapter)]?.name || '';
      const queryMatch = !q || `${point.id} ${point.name} ${parentName} ${chapterName} ${point.description || ''}`.toLowerCase().includes(q);
      return chapterMatch && queryMatch;
    });
  }, [chapter, deferredQuery, isAddressingTaskContext, knowledgePoints, pointById]);
  // The navigator is a learning aid, not a raw database dump. In the course
  // overview it therefore exposes only the ten chapter entrances. A chapter
  // click reveals its L1/L2/L3 hierarchy, while search is the only mode that
  // intentionally returns cross-chapter leaf results. The canvas can still
  // retain the full filtered topology independently.
  const navigatorList = useMemo(() => {
    if (deferredQuery.trim()) return filteredList;
    if (chapter === 'all') return filteredList.filter((point) => point.level === 1);
    return filteredList;
  }, [chapter, deferredQuery, filteredList]);
  const navigatorMode = isAddressingTaskContext
    ? 'task'
    : deferredQuery.trim()
      ? 'search'
      : chapter === 'all'
        ? 'overview'
        : 'chapter';
  const childCountsByParent = useMemo(() => {
    const counts: Record<string, { level2: number; level3: number }> = {};
    const rootIdByChapter = new Map(
      knowledgePoints
        .filter((point) => point.level === 1)
        .map((point) => [point.chapter, point.id]),
    );
    knowledgePoints.forEach((point) => {
      const rootId = rootIdByChapter.get(point.chapter);
      if (!rootId) return;
      const entry = counts[rootId] || { level2: 0, level3: 0 };
      if (point.level === 2) entry.level2 += 1;
      if (point.level === 3) entry.level3 += 1;
      counts[rootId] = entry;
    });
    return counts;
  }, [knowledgePoints]);
  useEffect(() => {
    // A URL-selected node is applied by the hydration effect above. Do not
    // repair the still-stale in-memory selection during the same render.
    if (isExternalSearchPending) return;
    if (!deferredQuery.trim() && chapter === 'all' && !selectedId) return;
    if (filteredList.some((point) => point.id === selectedId)) return;
    const nextId = filteredList[0]?.id || '';
    if (nextId !== selectedId) setSelectedId(nextId);
  }, [chapter, deferredQuery, filteredList, isExternalSearchPending, selectedId]);

  const visibleKnowledgeIds = useMemo(() => {
    const ids = new Set(filteredList.map((point) => point.id));
    if (isAddressingTaskContext && pointById['3']) ids.add('3');
    return ids;
  }, [filteredList, isAddressingTaskContext, pointById]);
  const canvasKnowledgeNodeCount = useMemo(() => {
    if (isAddressingTaskContext) return filteredList.length;
    if (chapter !== 'all') return knowledgePoints.filter((point) => point.chapter === chapter).length;
    if (!selectedId && !deferredQuery.trim()) return knowledgePoints.filter((point) => point.level === 1).length;
    const onCanvas = new Set(
      knowledgePoints
        .filter((point) => point.level <= 2)
        .map((point) => point.id),
    );
    const selectedPoint = pointById[selectedId];
    const expandedParentId = selectedPoint?.level === 2
      ? selectedPoint.id
      : selectedPoint?.level === 3
        ? selectedPoint.parentId
        : null;
    if (expandedParentId) {
      knowledgePoints
        .filter((point) => point.parentId === expandedParentId)
        .forEach((point) => onCanvas.add(point.id));
    }
    return onCanvas.size;
  }, [chapter, deferredQuery, filteredList, isAddressingTaskContext, knowledgePoints, pointById, selectedId]);
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
  const graphViewItems = useMemo(() => graphViews.map((item) => (
    item.id === 'knowledge' ? { ...item, count: knowledgePoints.length } : item
  )), [knowledgePoints.length]);
  const activeGraphMeta = graphViewItems.find((item) => item.id === view) || graphViewItems[0];
  const activateGraphView = (nextView: GraphView): void => {
    if (isAddressingTaskContext && nextView !== 'knowledge') return;
    if (nextView === view) return;
    setView(nextView);
    setQuery('');
    setIsMobileSidebarOpen(false);
    setIsCanvasFocus(false);
    setShowLegend(false);
    setIsInspectorOpen(false);
  };
  const activeHeaderStats = view === 'problem'
    ? [
        { value: problemGraphStats.total, label: '问题节点' },
        { value: problemGraphStats.level3, label: '具体问题' },
        { value: problemGraphStats.level1, label: '问题域' },
      ]
    : view === 'ideological'
      ? [
          { value: ideologicalNodes.length, label: '育人节点' },
          { value: ideologicalGraphStats.totalWeeklyMappings, label: '周次安排' },
          { value: ideologicalGraphStats.chaptersWithSip.length, label: '覆盖章节' },
        ]
      : [
          { value: knowledgePoints.length, label: '知识节点' },
          { value: relationCounts.deps, label: '先修依赖' },
          { value: relationCounts.expLinks, label: '实践关联' },
        ];

  if (kgLoading) {
    return (
      <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center overflow-hidden rounded-lg border border-border bg-background" role="status" aria-live="polite">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(103,232,249,.10),transparent_32%)]" aria-hidden />
        <div className="relative flex flex-col items-center px-6 text-center">
          <div className="absolute h-36 w-36 animate-pulse rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative grid h-14 w-14 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/[0.08] text-cyan-100">
            <Network className="h-6 w-6" />
          </div>
          <div className="mt-5 text-sm font-semibold text-slate-100">正在准备知识图谱</div>
          <div className="mt-1.5 text-xs leading-5 text-slate-400">正在整理节点、依赖关系和学习记录…</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={workbenchRef}
      role={isCanvasFocus ? 'dialog' : undefined}
      aria-modal={isCanvasFocus ? true : undefined}
      aria-label={isCanvasFocus ? `${activeGraphMeta.label}图谱专注画布` : undefined}
      tabIndex={isCanvasFocus ? -1 : undefined}
      className={cn(
        'kg-workbench relative m-0 min-h-[calc(100dvh-8rem)] min-w-0 rounded-lg border border-border bg-background text-foreground',
        isCanvasFocus
          ? 'fixed inset-0 z-[80] h-dvh min-h-0 overflow-y-auto overscroll-contain rounded-none border-0'
          : 'overflow-hidden',
      )}
      data-view={view}
    >
      <style>{`
        .kg-workbench {
          --kg-accent: 103 232 249;
          --kg-accent-soft: 34 211 238;
          --kg-muted: #94a3b8;
          --kg-muted-subtle: #8796aa;
        }
        .kg-workbench[data-view="problem"] { --kg-accent: 253 224 71; --kg-accent-soft: 245 158 11; }
        .kg-workbench[data-view="ideological"] { --kg-accent: 253 164 175; --kg-accent-soft: 244 63 94; }
        .kg-workbench .text-slate-500 { color: var(--kg-muted); }
        .kg-workbench .text-slate-600 { color: var(--kg-muted-subtle); }
        .kg-workbench [class*="placeholder:text-slate-500"]::placeholder {
          color: var(--kg-muted);
          opacity: .9;
        }
        .kg-display {
          font-family: var(--font-inter), "PingFang SC", "Noto Sans CJK SC", sans-serif;
          letter-spacing: .025em;
          text-shadow: none;
        }
        .kg-workbench .glass-hover,
        .kg-workbench .kg-panel { position: relative; isolation: isolate; }
        .kg-workbench .glass-hover::before,
        .kg-workbench .kg-panel::before {
          content: '';
          position: absolute;
          inset: 0 18px auto;
          height: 1px;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgb(var(--kg-accent) / .42), transparent);
          opacity: .7;
          z-index: 2;
        }
        .kg-workbench button:not(:disabled),
        .kg-workbench a { -webkit-tap-highlight-color: transparent; }
        .kg-workbench header button,
        .kg-workbench header a,
        .kg-panel > div:first-child button { border-radius: var(--radius) !important; }
        html.kg-focus-active [data-variant="sidebar"],
        html.kg-focus-active [data-sidebar="sidebar"] {
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .kg-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(103,232,249,.25) transparent; }
        .kg-inspector { scrollbar-width: thin; scrollbar-color: rgba(103,232,249,.25) transparent; }
        @media (prefers-reduced-motion: reduce) { .kg-workbench *, .kg-workbench *::before, .kg-workbench *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgb(var(--kg-accent-soft)/0.045),transparent)]" aria-hidden />

      <header className={cn('relative z-10 border-b border-border bg-background/95 px-3 backdrop-blur-xl sm:px-4', isCanvasFocus ? 'py-2' : 'py-2.5')}>
        <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(180px,.7fr)_minmax(330px,1.15fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-[rgb(var(--kg-accent))]">
                <Network className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-[rgb(var(--kg-accent)/0.75)]">
                  <span>教学分析图谱</span>
                  <span
                    role="status"
                    title={kgDataNote}
                    className={cn(
                      'truncate rounded border px-1.5 py-0.5 text-[10px] tracking-normal',
                      kgDataSource === 'client-fallback'
                        ? 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100'
                        : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100',
                    )}
                  >
                    {kgDataSource === 'db' ? '服务端数据' : kgDataSource === 'server-static' ? '内置基线' : '内置回退'}
                  </span>
                </div>
                <h1 className="kg-display mt-0.5 truncate text-xl font-semibold leading-tight text-slate-50">{activeGraphMeta.label}图谱</h1>
              </div>
            </div>
            <div className="mt-1.5 hidden flex-wrap items-center gap-1 font-mono text-[10px] text-slate-400 sm:flex">
              {activeHeaderStats.map((stat) => (
                <span key={stat.label} className="inline-flex items-center gap-1 rounded-[5px] border border-border bg-card px-1.5 py-0.5">
                  <b className="text-[11px] font-semibold text-slate-50">{stat.value}</b> {stat.label}
                </span>
              ))}
            </div>
          </div>

          <nav className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-black/30 p-1 sm:gap-1" aria-label="图谱类型" role="tablist">
            {graphViewItems.map((item, itemIndex) => {
              const Icon = item.icon;
              const tone = graphViewTone[item.id];
              const isTaskLockedTab = isAddressingTaskContext && item.id !== 'knowledge';
              return (
                <button
                  key={item.id}
                  id={`graph-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  aria-label={`${item.label}图谱，${item.summary}，${item.count}个节点`}
                  aria-controls={`graph-panel-${item.id}`}
                  aria-disabled={isTaskLockedTab || undefined}
                  disabled={isTaskLockedTab}
                  tabIndex={view === item.id ? 0 : -1}
                  title={isTaskLockedTab ? '请先完成当前寻址方式学习步骤' : undefined}
                  data-graph-tab={item.id}
                  onClick={() => activateGraphView(item.id)}
                  onKeyDown={(event) => {
                    if (isAddressingTaskContext) return;
                    const keyDelta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                    const targetIndex = event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? graphViewItems.length - 1
                        : keyDelta
                          ? (itemIndex + keyDelta + graphViewItems.length) % graphViewItems.length
                          : null;
                    if (targetIndex === null) return;
                    event.preventDefault();
                    const targetView = graphViewItems[targetIndex]?.id;
                    if (!targetView) return;
                    activateGraphView(targetView);
                    window.requestAnimationFrame(() => {
                      document.querySelector<HTMLElement>(`[data-graph-tab="${targetView}"]`)?.focus();
                    });
                  }}
                  className={cn(
                    'group flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-2 text-left transition duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:justify-start sm:gap-2 sm:px-3',
                    view === item.id
                      ? tone.active
                      : isTaskLockedTab
                        ? 'cursor-not-allowed border-transparent text-slate-600 opacity-55'
                        : 'border-transparent text-slate-400 hover:border-white/[0.09] hover:bg-white/[0.06] hover:text-slate-100',
                  )}
                >
                  <span className={cn('hidden font-mono text-[8px] tracking-[0.14em] sm:inline', view === item.id ? tone.icon : 'text-slate-600')}>{tone.index}</span>
                  <Icon className={cn('h-[17px] w-[17px] shrink-0', view === item.id ? tone.icon : 'text-slate-500 group-hover:text-slate-300')} />
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-[12px] font-semibold sm:text-[13px]">{item.label} <span className="ml-1 hidden font-mono text-[9px] opacity-60 md:inline">{item.count}</span></span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                ref={headerSearchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={`搜索${activeGraphMeta.label}图谱`}
                disabled={isAddressingTaskContext}
                placeholder={isAddressingTaskContext ? '当前任务固定在 3.1' : `搜索${activeGraphMeta.label}`}
                className="h-11 rounded-md border-border bg-card pl-9 pr-12 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="清除当前图谱搜索"
                  onClick={() => {
                    setQuery('');
                    headerSearchInputRef.current?.focus();
                  }}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : !isAddressingTaskContext ? (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">/</kbd>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(isAddressingTaskContext ? '3.1' : '');
                setSelectedProblemId('');
                setSelectedIdeologicalId('');
                setQuery('');
                setChapter(isAddressingTaskContext ? 3 : 'all');
                setProblemCategoryFilter('all');
                setProblemDifficultyFilter('all');
                setIdeologicalCategoryFilter('all');
                setIdeologicalChapterFilter('all');
                setShowLegend(false);
                setIsCanvasFocus(false);
                setIsInspectorOpen(isAddressingTaskContext);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <RotateCcw className="h-4 w-4" />
              {isAddressingTaskContext ? '返回 3.1' : '重置'}
            </button>
            <Link href={isAddressingTaskContext ? '/tasks' : '/'} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {isAddressingTaskContext ? '返回任务' : '课程内容'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {view === 'knowledge' && activeTaskPathId && !isCanvasFocus && (
        <div className="relative z-10 min-h-[68px] px-4 pt-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200/20 bg-[#0a151b]/88 px-3 py-2.5 text-sm text-cyan-50 shadow-lg backdrop-blur" role="status">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-200/[0.08] font-mono text-xs font-semibold text-cyan-100">
                {activeTaskStepId === 'addressing-animation' ? '02' : '01'}
              </div>
              <div className="min-w-0">
              <div className="font-semibold">
                {activeTaskStepId === 'addressing-animation'
                  ? '当前任务 · 步骤 2 动画学习'
                  : '当前任务 · 步骤 1 图谱定位'}
              </div>
              <p className="mt-0.5 text-xs leading-5 text-slate-400">
                {activeTaskStepId === 'addressing-animation'
                  ? '逐一完成七种寻址方式对比；7/7 后由服务端保存学习回执。'
                  : '逐个核对 3.1 与七个子节点；达到 7/7 后才能确认。动画、测评与实验按后续任务步骤开放。'}
              </p>
              </div>
            </div>
            <Link
              href="/tasks"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              返回我的任务
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {view === 'knowledge' && !activeTaskPathId && !isCanvasFocus && (
        <div className="relative z-10 min-h-[72px] px-4 pt-3 md:px-5">
          <NextStepBanner compact assessmentManaged assessmentSnapshot={latestAssessmentSnapshot} />
        </div>
      )}

      {view === 'problem' ? (
        <ProblemGraphView
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedProblemId}
          onSelect={selectProblemNode}
          searchInputRef={searchInputRef}
          categoryFilter={problemCategoryFilter}
          difficultyFilter={problemDifficultyFilter}
          onCategoryFilterChange={setProblemCategoryFilter}
          onDifficultyFilterChange={setProblemDifficultyFilter}
          showLegend={showLegend}
          isDrawerViewport={isDrawerViewport}
          isCanvasFocus={isCanvasFocus}
          isInspectorOpen={isInspectorOpen}
          onToggleLegend={() => setShowLegend((value) => !value)}
          onToggleCanvasFocus={() => setIsCanvasFocus((value) => !value)}
          onToggleInspector={() => {
            if (isInspectorOpen && !isCanvasFocus) setIsInspectorOpen(false);
            else {
              setIsCanvasFocus(false);
              setIsInspectorOpen(true);
            }
          }}
          onOpenKnowledgePoint={openKnowledgePoint}
        />
      ) : view === 'ideological' ? (
        <IdeologicalGraphView
          query={query}
          onQueryChange={setQuery}
          selectedId={selectedIdeologicalId}
          onSelect={selectIdeologicalNode}
          searchInputRef={searchInputRef}
          categoryFilter={ideologicalCategoryFilter}
          chapterFilter={ideologicalChapterFilter}
          onCategoryFilterChange={setIdeologicalCategoryFilter}
          onChapterFilterChange={setIdeologicalChapterFilter}
          showLegend={showLegend}
          isDrawerViewport={isDrawerViewport}
          isCanvasFocus={isCanvasFocus}
          isInspectorOpen={isInspectorOpen}
          onToggleLegend={() => setShowLegend((value) => !value)}
          onToggleCanvasFocus={() => setIsCanvasFocus((value) => !value)}
          onToggleInspector={() => {
            if (isInspectorOpen && !isCanvasFocus) setIsInspectorOpen(false);
            else {
              setIsCanvasFocus(false);
              setIsInspectorOpen(true);
            }
          }}
          onOpenKnowledgePoint={openKnowledgePoint}
        />
      ) : (
      <section
        id="graph-panel-knowledge"
        role="tabpanel"
        aria-labelledby="graph-tab-knowledge"
        data-graph-workspace="knowledge"
        data-canvas-focus={isCanvasFocus ? 'true' : 'false'}
        className={getGraphWorkspaceClassName(isCanvasFocus, isMobileSidebarOpen)}
      >
        <MobileDrawerDialog
          open={isMobileSidebarOpen}
          onClose={closeMobileSidebar}
          triggerRef={mobileSidebarTriggerRef}
          panelRef={mobileSidebarPanelRef}
          id="knowledge-graph-directory"
          label="知识点目录"
          labelId="knowledge-graph-directory-title"
          backdropLabel="关闭章节目录遮罩"
          className={cn(
            'kg-scrollbar fixed inset-y-3 left-3 z-[80] w-[min(340px,calc(100vw-24px))] transform overflow-y-auto rounded-xl border border-white/[0.11] bg-[#0a1017]/98 p-4 text-slate-100 shadow-[0_30px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl transition-[transform,visibility] duration-300 lg:visible lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:rounded-lg lg:border-border lg:bg-card/70 lg:p-3 lg:shadow-none lg:backdrop-blur-none',
            isCanvasFocus && 'hidden',
            isMobileSidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-[115%]',
          )}
        >
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200/65">Map navigator</div>
              <span id="knowledge-graph-directory-title" className="mt-0.5 block text-xs font-semibold text-slate-100">章节与知识点</span>
            </div>
            <button
              type="button"
              aria-label="收起章节目录"
              data-drawer-initial-focus="true"
              onClick={closeMobileSidebar}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isAddressingTaskContext}
              onClick={() => {
                setChapter('all');
                setSelectedId('');
                setIsInspectorOpen(false);
                setIsMobileSidebarOpen(false);
              }}
              className={cn(
                'min-h-11 rounded-md border px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                isAddressingTaskContext && 'cursor-not-allowed opacity-45',
                chapter === 'all' ? 'border-cyan-200/35 bg-cyan-200/[0.11] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06]',
              )}
            >
              全部章节
            </button>
            <div className="flex min-h-11 items-center justify-center rounded-md border border-white/[0.08] bg-black/20 px-2 py-2 text-center font-mono text-[11px] text-slate-400">
              目录 <span className="mx-1 text-slate-200">{navigatorList.length}</span> / {knowledgePoints.length}
            </div>
          </div>
          <div className="mb-3 grid grid-cols-5 gap-1.5">
            {chapterNumbers.map((value) => (
              <button
                key={value}
                type="button"
                disabled={isAddressingTaskContext && value !== 3}
                onClick={() => focusChapter(value)}
                className={cn(
                  'min-h-11 rounded-md border font-mono text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  isAddressingTaskContext && value !== 3 && 'cursor-not-allowed opacity-35',
                  chapter === value ? 'border-cyan-200/35 bg-cyan-200/[0.11] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200',
                )}
              >
                CH{value}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={isAddressingTaskContext}
              placeholder={isAddressingTaskContext ? '当前任务固定在 3.1' : '搜索知识点...'}
              aria-label="搜索知识点"
              className="h-11 rounded-xl border-white/[0.09] bg-black/25 pl-10 pr-12 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
            {query ? (
              <button
                type="button"
                aria-label="清除知识点搜索"
                onClick={() => setQuery('')}
                className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : !isAddressingTaskContext ? (
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">/</kbd>
            ) : null}
          </div>
          <div className="mb-3 rounded-xl border border-cyan-200/12 bg-cyan-200/[0.035] px-3 py-2.5 text-[11px] leading-5 text-slate-400" role="note">
            {navigatorMode === 'task' && '当前任务仅开放 3.1 与七个子节点；逐项完成后返回任务页进入下一步。'}
            {navigatorMode === 'overview' && '先选章节建立课程位置；全景只展开到“节”，三级知识点在进入章节或搜索后出现。'}
            {navigatorMode === 'chapter' && '当前按 L1 章 → L2 节 → L3 知识点排列；选择节点后核对层级、先修关系与实践入口。'}
            {navigatorMode === 'search' && `正在显示 ${navigatorList.length} 条匹配结果，并保留所属章节与上级位置。`}
          </div>
          <div className="mb-2 flex items-center justify-between px-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
            <span>{navigatorMode === 'task' ? 'Task scope' : navigatorMode === 'overview' ? 'Chapter entrances' : navigatorMode === 'search' ? 'Search results' : 'Chapter hierarchy'}</span>
            <span>{navigatorList.length} ITEMS</span>
          </div>
          <div className="kg-scrollbar max-h-[min(660px,calc(100vh-350px))] space-y-1 overflow-y-auto pr-1">
            {navigatorList.map((point) => {
              const chapterProgress = progressForChapter(progress, point.chapter);
              const parentPoint = point.parentId ? pointById[point.parentId] : null;
              const chapterCounts = childCountsByParent[point.id];
              return (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => {
                    // L1 即章节根：点击列表里的章节直接聚焦到该章单章树，
                    // 而不是只在原地高亮
                    if (point.level === 1) focusChapter(point.chapter);
                    else goToPoint(point.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={cn(
                    'group flex min-h-11 w-full items-start gap-2 rounded-md border py-2 pr-2.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                    navigatorMode === 'chapter' && point.level === 1 ? 'pl-2.5' : navigatorMode === 'chapter' && point.level === 2 ? 'pl-4' : navigatorMode === 'chapter' && point.level === 3 ? 'pl-7' : 'pl-2.5',
                    selectedId === point.id
                      ? 'border-cyan-200/25 bg-cyan-200/[0.11] text-cyan-50 shadow-[inset_3px_0_0_rgba(103,232,249,.7)]'
                      : 'border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-slate-100',
                  )}
                >
                  {point.level === 1 ? <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/80" /> : <ListTree className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-slate-400" />}
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-1">{point.name}</span>
                    {navigatorMode === 'overview' && chapterCounts && (
                      <span className="mt-0.5 block font-mono text-[9px] text-slate-600">CH{point.chapter} · {chapterCounts.level2} 节 · {chapterCounts.level3} 点 · 点击进入</span>
                    )}
                    {navigatorMode === 'search' && (
                      <span className="mt-0.5 block line-clamp-1 font-mono text-[9px] text-slate-600">CH{point.chapter}{parentPoint ? ` / ${parentPoint.name}` : ''}</span>
                    )}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[10px] text-slate-500">
                    {point.level === 1 && chapterProgress !== null && <span>{chapterProgress}%</span>}
                    <span>L{point.level}</span>
                  </span>
                </button>
              );
            })}
            {navigatorList.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/[0.1] bg-black/15 px-3 py-5 text-center">
                <Search className="mx-auto h-4 w-4 text-slate-600" />
                <p className="mt-2 text-xs text-slate-400">没有匹配的知识点</p>
                <button type="button" onClick={() => setQuery('')} className="mt-2 min-h-11 rounded-md px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">清除搜索</button>
              </div>
            )}
          </div>
        </MobileDrawerDialog>

        <section className="kg-panel min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)]">
          <div className="flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 lg:px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <button
                ref={mobileSidebarTriggerRef}
                type="button"
                aria-label="展开章节目录"
                aria-expanded={isMobileSidebarOpen}
                aria-controls="knowledge-graph-directory"
                aria-haspopup={isDrawerViewport ? 'dialog' : undefined}
                onClick={() => setIsMobileSidebarOpen(true)}
                className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.055] text-slate-200 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.10] hover:text-cyan-100 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="grid h-10 w-10 place-items-center rounded-md border border-cyan-200/22 bg-cyan-200/[0.09] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
                <Network className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0" aria-live="polite">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
                  {chapter === 'all' ? 'COURSE ATLAS' : `CHAPTER ${chapter}`} · {canvasKnowledgeNodeCount} NODES
                  {isSearchPending
                    ? <span className="ml-1.5 text-cyan-200/70" role="status">· 搜索中…</span>
                    : deferredQuery.trim() && <span className="ml-1.5 text-cyan-200/70">· {filteredList.length} MATCHED</span>}
                </div>
                <div className="truncate text-base font-semibold text-slate-50">
                  {selected ? selected.name : chapter === 'all' ? '十章课程总览' : `第 ${chapter} 章`}
                  {selected && <span className="ml-2 font-mono text-[9px] font-normal text-cyan-200/70">#{selected.id}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-expanded={showLegend}
                aria-controls="knowledge-graph-legend"
                onClick={() => setShowLegend((value) => !value)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  showLegend ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                )}
              >
                <ListTree className="h-3.5 w-3.5" />
                图例与操作
              </button>
              <button
                type="button"
                data-kg-focus-exit="true"
                aria-pressed={isCanvasFocus}
                aria-label={isCanvasFocus ? '退出专业知识图谱专注画布' : '进入专业知识图谱专注画布，扩大节点阅读区域'}
                title={isCanvasFocus ? '恢复章节目录与详情面板' : '隐藏目录与详情，扩大图谱画布'}
                onClick={() => setIsCanvasFocus((value) => !value)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  isCanvasFocus ? 'border-cyan-200/40 bg-cyan-200/[0.14] text-cyan-50' : 'border-cyan-200/22 bg-cyan-200/[0.07] text-cyan-100 hover:border-cyan-200/35 hover:bg-cyan-200/[0.11]',
                )}
              >
                {isCanvasFocus ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isCanvasFocus ? '退出专注' : '专注画布'}
              </button>
              <button
                ref={mobileInspectorTriggerRef}
                type="button"
                aria-expanded={isInspectorOpen && !isCanvasFocus}
                aria-controls="kg-node-inspector"
                aria-haspopup={isDrawerViewport ? 'dialog' : undefined}
                onClick={() => {
                  if (isInspectorOpen && !isCanvasFocus) setIsInspectorOpen(false);
                  else {
                    setIsCanvasFocus(false);
                    revealInspector();
                  }
                }}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  isInspectorOpen && !isCanvasFocus ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                )}
              >
                {isInspectorOpen && !isCanvasFocus ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                节点详情
              </button>
            </div>
          </div>
          {showLegend && (
            <div id="knowledge-graph-legend" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.08] bg-black/15 px-4 py-2.5 font-mono text-[11px] text-slate-300" role="note">
              <span className="text-slate-500">节点层级</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-cyan-300/65 bg-cyan-300/15" />L1 章 {levelCounts.l1}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-cyan-300/45 bg-cyan-300/10" />L2 节 {levelCounts.l2}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm border border-cyan-300/35 bg-cyan-300/[0.08]" />L3 知识单元 {levelCounts.l3}</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
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
                先修依赖 · 指向后学内容
              </span>
              {chapter === 'all' && (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="24" height="6" aria-hidden><line x1="1" y1="3" x2="23" y2="3" stroke="#67e8f9" strokeWidth="1.6" strokeDasharray="4 4" strokeLinecap="round" opacity="0.6" /></svg>
                  课程章序 · 非先修
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg width="24" height="6" aria-hidden><line x1="1" y1="3" x2="23" y2="3" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.5" /></svg>
                层级归属 · 非先修
              </span>
              <span className="inline-flex items-center gap-1"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-300/60 bg-[#04231a] text-emerald-200"><FlaskConical className="h-2 w-2" /></span>实践入口</span>
              {Object.keys(kaScores).length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="text-slate-500">最近掌握度</span>
                  <span className="text-emerald-200">● ≥80</span>
                  <span className="text-amber-200">● 60–79</span>
                  <span className="text-red-200">● &lt;60</span>
                </span>
              )}
              <GraphOperationHints dependencyEdges />
            </div>
          )}
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
            key={`kg-canvas-${chapter}-${isCanvasFocus ? 'focus' : 'standard'}`}
            className={cn(
              'animate-fade-in',
              isCanvasFocus
                ? showLegend
                  ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                  : 'h-[clamp(420px,calc(100dvh-208px),780px)]'
                : 'h-[360px] sm:h-[clamp(380px,calc(100dvh-320px),680px)]',
            )}
          >
            <FullKnowledgeMap
              points={knowledgePoints}
              selectedId={selectedId}
              visibleIds={visibleKnowledgeIds}
              progress={progress}
              onSelect={(point) => goToPoint(isAddressingTaskContext && point.id === '3' ? '3.1' : point.id)}
              onFocusChapter={(value) => {
                // 点击章节 hub：切到该章单章放射树视图，并选中章根节点
                focusChapter(value);
              }}
              chapterFilter={chapter}
              masteryByKa={kaScores}
              experimentTitleByRefId={experimentTitleByRefId}
              onClearVisibility={() => setQuery('')}
            />
          </div>
        </section>

        {isInspectorOpen && !isCanvasFocus && (
        <MobileDrawerDialog
          open={isDrawerViewport}
          onClose={() => setIsInspectorOpen(false)}
          triggerRef={mobileInspectorTriggerRef}
          panelRef={mobileInspectorPanelRef}
          id="kg-node-inspector"
          label="知识节点详情"
          labelId="kg-node-inspector-title"
          backdropLabel="关闭知识节点详情遮罩"
          closeOnDesktop={false}
          className="kg-inspector fixed inset-x-3 bottom-3 z-[80] max-h-[76dvh] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/98 p-3 shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:top-20 lg:z-[60] lg:w-[min(410px,calc(100vw-32px))]"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
            <span id="kg-node-inspector-title" className="text-xs font-semibold text-slate-100">知识节点详情</span>
            <button type="button" data-drawer-initial-focus="true" onClick={() => setIsInspectorOpen(false)} aria-label="关闭知识节点详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DetailPanel
            point={selected}
            childPoints={childPoints}
            pointById={pointById}
            experimentTitleByRefId={experimentTitleByRefId}
            onSelectId={goToPoint}
            onOpenProblemNode={openProblemNode}
            onOpenIdeologicalNode={openIdeologicalNode}
            allPoints={knowledgePoints}
          />
          <div className="rounded-lg border border-white/[0.09] bg-[#0b1118]/95 p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ListTree className="h-4 w-4 text-cyan-200" />
              {isAddressingTaskContext ? '本任务节点' : '同章知识点'}
            </div>
            <div className="space-y-1">
              {siblings.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => goToPoint(point.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  <span className="line-clamp-1">{point.name}</span>
                  <span className="font-mono text-[10px] text-slate-600">L{point.level}</span>
                </button>
              ))}
              {siblings.length === 0 && <div className="text-xs text-slate-500">暂无同章节点。</div>}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.09] bg-[#0b1118]/95 p-4 shadow-xl">
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
                <div className="text-xs text-slate-500">先修依赖 · 跨章 {relationCounts.cross}</div>
              </div>
              <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] p-3">
                <div className="font-mono text-xl text-emerald-100">{relationCounts.expLinks}</div>
                <div className="text-xs text-slate-500">节点-实践关联</div>
              </div>
            </div>
          </div>
        </MobileDrawerDialog>
        )}
      </section>
      )}
    </div>
  );
}
