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
import { COURSE_UNIT_ALIGNMENT } from '@/lib/course-curriculum';
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
import { useAuth } from '@/contexts/AuthContext';
import { useLearningPresence } from '@/hooks/useLearningPresence';
import { NextStepBanner, type NextStepSnapshot } from '@/components/onboarding/NextStepBanner';
import { diagnosticActivitiesQuery } from '@/lib/diagnostic-attempt';
import {
  diagnosticAttemptFromLocalReceipt,
  graphMasteryLabel,
  graphViewFromAttempt,
  resolveGraphMasteryFromActivities,
  type GraphMasteryBand,
  type GraphNodeMastery,
} from '@/lib/graph-mastery';
import {
  ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_ROOT_NODE_ID,
  ADDRESSING_TASK_PRESET,
  buildTaskResourceEvidence,
} from '@/lib/lesson-tasks';
type GraphView = 'knowledge' | 'problem' | 'ideological';

type GraphWorkspaceMode = 'wide' | 'split' | 'single';
type GraphPanelKind = 'directory' | 'inspector';

export function getGraphWorkspaceMode(width: number): GraphWorkspaceMode {
  return width >= 1280 ? 'wide' : width >= 1024 ? 'split' : 'single';
}

export function resolveGraphPanelVisibility(
  mode: GraphWorkspaceMode,
  directoryOpen: boolean,
  inspectorOpen: boolean,
  lastPanel: GraphPanelKind,
) {
  if (mode === 'wide' || !directoryOpen || !inspectorOpen) return { directoryOpen, inspectorOpen };
  return { directoryOpen: lastPanel === 'directory', inspectorOpen: lastPanel === 'inspector' };
}

export function getGraphWorkspaceClassName(mode: GraphWorkspaceMode, directoryOpen: boolean, inspectorOpen: boolean): string {
  return cn('kg-workspace relative grid items-start gap-3 px-3 py-3 sm:px-4',
    mode === 'single' ? 'grid-cols-1' : directoryOpen && inspectorOpen
      ? 'grid-cols-[220px_minmax(0,1fr)_360px]' : directoryOpen
        ? 'grid-cols-[220px_minmax(0,1fr)]' : inspectorOpen
          ? 'grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1');
}

export function useGraphWorkspace(ref: RefObject<HTMLDivElement>, ready: boolean, presentation: boolean) {
  const [mode, setMode] = useState<GraphWorkspaceMode>('single');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const lastPanel = useRef<GraphPanelKind>('inspector');
  useEffect(() => {
    const element = ref.current;
    if (!ready || !element) return;
    const update = () => setMode(getGraphWorkspaceMode(Math.max(0, element.clientWidth - 32)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, ready, presentation]);
  useEffect(() => {
    const next = resolveGraphPanelVisibility(mode, directoryOpen, inspectorOpen, lastPanel.current);
    if (next.directoryOpen !== directoryOpen) setDirectoryOpen(next.directoryOpen);
    if (next.inspectorOpen !== inspectorOpen) setInspectorOpen(next.inspectorOpen);
  }, [mode, directoryOpen, inspectorOpen]);
  const setDirectory = useCallback((open: boolean) => {
    if (open) { lastPanel.current = 'directory'; if (mode !== 'wide') setInspectorOpen(false); }
    setDirectoryOpen(open);
  }, [mode]);
  const setInspector = useCallback((open: boolean) => {
    if (open) { lastPanel.current = 'inspector'; if (mode !== 'wide') setDirectoryOpen(false); }
    setInspectorOpen(open);
  }, [mode]);
  return { mode, directoryOpen, inspectorOpen, setDirectory, setInspector };
}
type GraphWorkspaceState = ReturnType<typeof useGraphWorkspace>;

/** Inline reading region: the narrow layout replaces the canvas, never covers it. */
export function GraphReadingPanel({ compact, open, onClose, triggerRef, panelRef, id, label, labelId, children, className }: MobileDrawerDialogProps & { compact: boolean }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    if (compact) panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !panel.contains(document.activeElement)) return;
      event.preventDefault(); event.stopImmediatePropagation(); closeRef.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
  }, [open, compact, panelRef, triggerRef]);
  return <aside ref={panelRef} id={id} hidden={!open} tabIndex={-1} aria-label={label}
    data-kg-reading-panel={open ? 'open' : 'closed'}
    className={cn('kg-reading-panel min-w-0 rounded-lg border border-white/10 bg-[#0d151e] p-3 outline-none', className)}>
    {compact && <button type="button" onClick={onClose} className="sticky top-0 z-20 mb-3 flex min-h-11 w-full items-center rounded-md border border-cyan-200/20 bg-[#101e29] px-3 text-sm text-cyan-100">← 返回导图</button>}
    <span id={`${labelId}-reading`} className="sr-only">{label}</span>
    {children}
  </aside>;
}

const DRAWER_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'summary',
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
      if (event.key === 'Escape' && onRequestExit && !root.querySelector('[data-kg-reading-panel="open"]')) {
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
const activityRowSchema = z.object({
  id: z.string().optional(),
  createdAt: z.string().optional(),
  details: z.string().nullish(),
});
const activityResponseSchema = z.object({
  activities: z.array(activityRowSchema).optional(),
  data: z.array(activityRowSchema).optional(),
});

const graphViews: Array<{ id: GraphView; label: string; count: number; summary: string; icon: LucideIcon }> = [
  { id: 'knowledge', label: '专业知识', count: staticKnowledgePoints.length, summary: '概念、先修与实验', icon: Network },
  { id: 'problem', label: '问题诊断', count: problemGraph.length, summary: '错误、症状与排查', icon: AlertTriangle },
  { id: 'ideological', label: '育人主题', count: ideologicalNodes.length, summary: '周次、案例与价值', icon: Flag },
];

export const graphPresentationSteps = [
  { title: '课程总览', detail: '先说明课程的十个单元' },
  { title: '指令系统', detail: '进入第 3 单元建立位置' },
  { title: '寻址方式', detail: '定位 3.1 主题' },
  { title: '七种寻址', detail: '展开七个具体知识点' },
  { title: '直接寻址', detail: '阅读核心解释与实践入口' },
  { title: '典型混淆', detail: '跨图查看诊断问题' },
  { title: '返回知识点', detail: '恢复来源节点与视角' },
] as const;

const graphViewTone: Record<GraphView, { active: string; icon: string; index: string }> = {
  knowledge: {
    active: 'border-cyan-300/35 bg-cyan-300/[0.10] text-cyan-50 shadow-[inset_0_-2px_0_rgba(103,232,249,.68)]',
    icon: 'text-cyan-200',
    index: '01',
  },
  problem: {
    active: 'border-cyan-300/35 bg-cyan-300/[0.10] text-cyan-50 shadow-[inset_0_-2px_0_rgba(103,232,249,.68)]',
    icon: 'text-cyan-200',
    index: '02',
  },
  ideological: {
    active: 'border-cyan-300/35 bg-cyan-300/[0.10] text-cyan-50 shadow-[inset_0_-2px_0_rgba(103,232,249,.68)]',
    icon: 'text-cyan-200',
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
  if (nodeId) next.set('node', nodeId);
  else next.delete('node');
  if (view === 'knowledge') {
    // The default knowledge view intentionally omits `view`; if a caller has
    // an explicit view value, correct it without discarding any task/filter
    // parameters already present in the URL.
    if (!nodeId) {
      next.delete('view');
      next.delete('chapter');
    } else {
      if (next.has('view')) next.set('view', 'knowledge');
      if (typeof chapter === 'number' && next.has('chapter')) next.set('chapter', String(chapter));
    }
  } else {
    next.set('view', view);
  }
  const query = next.toString();
  return `${pathname}${query ? `?${query}` : ''}${currentHash}`;
}

export function shouldAutoOpenGraphInspector(isCanvasFocus: boolean, isInspectorOpen: boolean): boolean {
  return false;
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
        <span className="font-mono text-xs text-slate-500">Q{index + 1} · 单元 {q.chapter}</span>
        <span className="ml-auto rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
          {q.type === 'code-completion' ? '代码补全' : '选择'}
        </span>
      </div>
      <p className="text-[12px] leading-5 text-slate-200">{q.questionText}</p>
      {q.type === 'code-completion' && (
        <pre className="mt-2 max-h-24 overflow-y-auto rounded-sm border border-white/[0.05] bg-black/40 p-2 font-mono text-xs leading-5 text-slate-300">
          {q.code}
        </pre>
      )}
      {q.type === 'multiple-choice' && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
          {q.options.map((opt, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="font-mono text-xs text-slate-600">{String.fromCharCode(65 + i)}.</span>
              <span>{opt}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-xs leading-5 text-slate-500">答案在正式交卷后由服务端反馈。</div>
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
          <div className="font-mono text-xs uppercase tracking-[0.12em] text-cyan-200">
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
            <span className="block font-mono text-[11px] text-slate-500">{mode.id}</span>
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
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] font-mono text-xs text-cyan-100">
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
            <div className="font-mono text-xs text-cyan-300">{active.id} · {active.syntax}</div>
            <div className="mt-1 text-sm font-semibold text-slate-50">{active.name}</div>
          </div>
          <code className="rounded border border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[11px] text-amber-200">{active.example}</code>
        </div>
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded border border-white/[0.08] bg-white/[0.035] p-3">
            <div className="font-mono text-[11px] text-slate-600">INSTRUCTION FIELD</div>
            <div className="mt-1 text-xs text-slate-200">{active.syntax}</div>
          </div>
          <ChevronRight className="mx-auto h-4 w-4 self-center rotate-90 text-cyan-300 sm:rotate-0" />
          <div className="rounded border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
            <div className="font-mono text-[11px] text-cyan-300/70">ADDRESS FORMATION</div>
            <div className="mt-1 text-xs text-cyan-50">{active.formation}</div>
          </div>
          <ChevronRight className="mx-auto h-4 w-4 self-center rotate-90 text-cyan-300 sm:rotate-0" />
          <div className="rounded border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
            <div className="font-mono text-[11px] text-emerald-300/70">OPERAND / TARGET</div>
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

export function DetailPanel({
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
  const [questionLoadState, setQuestionLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [questionReload, setQuestionReload] = useState(0);

  // Keep unavailable question data distinct from a successfully loaded empty set.
  useEffect(() => {
    let active = true;
    async function loadQuestions(): Promise<void> {
      setQuizQuestions([]);
      setQuestionLoadState('loading');
      if (isAddressingTaskActive) {
        return;
      }
      try {
        const res = await fetch(`/api/quiz/questions?chapter=${point?.chapter ?? ''}`, { cache: 'no-store' });
        if (res.ok) {
          const raw: unknown = await res.json();
          const parsed = questionResponseSchema.safeParse(raw);
          if (active && parsed.success) {
            setQuizQuestions(parsed.data.data);
            setQuestionLoadState('ready');
            return;
          }
        }
      } catch { /* Keep the graph usable and offer an explicit retry below. */ }
      if (active) setQuestionLoadState('error');
    }
    void loadQuestions();
    return (): void => { active = false; };
  }, [isAddressingTaskActive, point?.chapter, questionReload]);

  if (!point) {
    return (
      <aside className="rounded-md border border-white/[0.09] bg-[#0b1118]/95 p-6 text-base leading-7 text-slate-400 shadow-xl">
        <MousePointer2 className="mb-4 h-5 w-5 text-cyan-200" />
        选择一个知识点并打开详情，即可阅读核心解释、典型问题和实践入口。
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
  const directQuestions = quizQuestions.filter((q) => q.ka === point.id);
  const matchingQuestions = directQuestions.slice(0, 4);
  const descendantQuestionCount = quizQuestions.filter((q) => q.ka.startsWith(`${point.id}.`)).length;
  const isRelatedKnowledgeId = (candidate: string): boolean => (
    candidate === point.id
    || candidate.startsWith(`${point.id}.`)
    || point.id.startsWith(`${candidate}.`)
  );
  const relatedProblems = problemGraph
    .filter((node) => node.level === 3 && node.relatedKnowledgePoints.some(isRelatedKnowledgeId))
    .sort((a, b) => Number(b.relatedKnowledgePoints.includes(point.id)) - Number(a.relatedKnowledgePoints.includes(point.id)))
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

  const actionClassName = 'flex min-h-11 w-full items-start gap-2 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-3 text-left text-base leading-6 text-slate-200 transition-colors hover:border-cyan-300/35 hover:bg-cyan-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200';
  const summaryClassName = 'cursor-pointer rounded-md py-2 text-base font-medium leading-6 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200';
  const quizHref = isAddressingGraphNode ? '/quiz?topic=addressing-modes' : `/quiz?chapter=${point.chapter}`;

  return (
    <aside
      key={point.id}
      aria-label={`节点详情：${point.name}`}
      className="kg-inspector min-w-0 rounded-lg border border-white/[0.09] bg-[#0b1118]/95 text-base leading-7 text-slate-300"
    >
      <header className="border-b border-white/[0.08] p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>平台单元 {point.chapter} · 知识点</span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5">第 {point.level} 层</span>
          <span className="font-mono">#{point.id}</span>
        </div>
        <h2 className="mt-2 break-words text-xl font-semibold leading-8 tracking-tight text-slate-50">{point.name}</h2>
        {parent && (!isAddressingTaskActive || parent.id === '3.1' || parent.id.startsWith('3.1.')) && (
          <button
            type="button"
            onClick={() => onSelectId(parent.id)}
            className="mt-3 inline-flex min-h-11 max-w-full items-start gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-left text-sm leading-6 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            <Layers className="mt-1 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">返回上级：{parent.name}</span>
          </button>
        )}
      </header>

      {isAddressingTaskActive && (
        <section className="border-b border-cyan-300/15 bg-cyan-300/[0.035] p-5">
          <h3 className="font-semibold text-cyan-100">{isGraphTaskActive ? '步骤 1 操作范围' : '步骤 2 操作范围'}</h3>
          <p className="mt-2">
            {isGraphTaskActive
              ? '本步骤只核对 3.1 与 3.1.1—3.1.7 的层级。动画、专项测评和 exp02 将在后续任务步骤开放。'
              : '本步骤只完成七种寻址方式动态对比。专项测评和 exp02 将按后续任务步骤开放。'}
          </p>
          {!isAddressingGraphNode && (
            <button type="button" onClick={() => onSelectId('3.1')} className={cn(actionClassName, 'mt-3 text-cyan-100')}>
              返回 3.1 寻址方式
            </button>
          )}
        </section>
      )}

      <section aria-label="核心解释" className="border-b border-white/[0.08] p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-cyan-100">
          <Lightbulb className="h-4 w-4 shrink-0" />核心解释
        </h3>
        <p className="break-words text-slate-100">{point.tutor?.core || point.description || '该节点暂无详细说明。'}</p>
        {point.tutor?.whyImportant && <p className="mt-3 break-words">{point.tutor.whyImportant}</p>}
        {point.tutor?.core && point.description && point.description !== point.tutor.core && (
          <details className="mt-3">
            <summary className={summaryClassName}>补充说明</summary>
            <p className="mt-2 break-words">{point.description}</p>
          </details>
        )}
        {isAddressingTaskActive && point.tutor?.commonMistake && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-3">{point.tutor.commonMistake}</p>
        )}
        {point.tutor?.takeaway && (
          <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.04] p-3 text-emerald-50">{point.tutor.takeaway}</p>
        )}
      </section>

      {!isAddressingTaskActive && (
        <section aria-label="典型问题" className="border-b border-white/[0.08] p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />典型问题
          </h3>
          {point.tutor?.commonMistake && (
            <p className="mb-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-3 text-slate-200">{point.tutor.commonMistake}</p>
          )}
          {relatedProblems.length > 0 ? (
            <div className="space-y-2">
              {relatedProblems.map((node) => (
                <button key={node.id} type="button" onClick={() => onOpenProblemNode(node.id)} className={cn(actionClassName, 'border-amber-300/20 hover:border-amber-300/40')}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-amber-50">{node.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-amber-200/75">{node.id} · {difficultyLabel[node.difficulty]} · 查看问题诊断</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-amber-200" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">该节点暂未配置关联的问题诊断。</p>
          )}
        </section>
      )}

      <section aria-label="实践入口" className="border-b border-white/[0.08] p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-100">
          <Sparkles className="h-4 w-4 shrink-0" />实践入口
        </h3>
        {isAddressingTaskActive ? (
          isAddressingGraphNode ? <AddressingModeCompare currentPointId={point.id} onSelectNode={onSelectId} /> : (
            <p className="text-slate-400">请返回 3.1 寻址方式完成当前任务。</p>
          )
        ) : (
          <>
            <div className="space-y-2">
              {appliedExperiments.map((exp) => (
                <Link key={exp.refId} href={`/simulation?experiment=${encodeURIComponent(exp.refId)}`} className={cn(actionClassName, 'border-emerald-300/20 hover:border-emerald-300/40')}>
                  <Cpu className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                  <span className="min-w-0 flex-1 break-words">{exp.title}<span className="mt-1 block text-xs text-emerald-200/75">{exp.refId} · 进入实验</span></span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                </Link>
              ))}
              {appliedExperiments.length === 0 && <p className="text-slate-400">该节点暂未配置关联实验。</p>}
              <Link href={quizHref} className={cn(actionClassName, 'text-cyan-100')}>
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />
                <span>{isAddressingGraphNode ? '寻址方式专项测验' : '本单元测验'} →</span>
              </Link>
            </div>
            <div className="mt-3 text-base leading-7 text-slate-400" role="status">
              {questionLoadState === 'loading' ? '正在读取关联题目…' : questionLoadState === 'error' ? (
                <>
                  题目暂时无法读取，关联数量未知。
                  <button type="button" onClick={() => setQuestionReload((value) => value + 1)} className="mt-1 inline-flex min-h-11 items-center rounded-md px-2 text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">重新读取题目</button>
                </>
              ) : (
                <>
                  {point.level >= 3 && directQuestions.length === 0
                    ? '本知识单元暂无专项题，题量按所属知识点汇总统计；可先学习本单元内容，再到所属知识点的测验中巩固。'
                    : (<>
                        本节点直接关联 {directQuestions.length} 题{descendantQuestionCount > 0 ? `；下级节点另有 ${descendantQuestionCount} 题` : ''}。
                        {directQuestions.length === 0 ? '可先学习本节点内容，再进入单元测验巩固；单元题目不等同于本节点专项题。' : `可展开预览 ${matchingQuestions.length} 题。`}
                      </>)}
                </>
              )}
            </div>
            {matchingQuestions.length > 0 && (
              <details className="mt-3">
                <summary className={summaryClassName}>知识点练习预览 · {matchingQuestions.length} 题</summary>
                <div className="mt-2 space-y-2">{matchingQuestions.map((q, i) => <QuizPreviewItem key={q.id} q={q} index={i} />)}</div>
              </details>
            )}
            {point.id === '3.1' && (
              <details className="mt-3">
                <summary className={summaryClassName}>七种寻址方式动态对比</summary>
                <AddressingModeCompare currentPointId={point.id} />
              </details>
            )}
          </>
        )}
      </section>

      {!isAddressingTaskActive && (
        <div className="divide-y divide-white/[0.08] px-5">
          <details className="py-3">
            <summary className={summaryClassName}>关联资源 · {resources.length}</summary>
            <div className="space-y-3 pb-2 pt-3">
              {resources.length === 0 && <p className="text-slate-400">该节点暂未配置配套资源。</p>}
              {inlineImages.map((resource) => (
                <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  <img src={resource.url} alt={resource.title} className="block w-full bg-white" loading="lazy" />
                  <span className="flex items-start gap-2 p-3"><span className="min-w-0 flex-1 break-words">{resource.title}</span><ExternalLink className="mt-1 h-4 w-4 shrink-0" /></span>
                </a>
              ))}
              {mediaResources.map((resource) => (
                <div key={`${resource.type}-${resource.title}-${resource.url}`} className="overflow-hidden rounded-lg border border-white/[0.09] bg-black/25">
                  <a href={resource.url} target="_blank" rel="noreferrer" aria-label={`在新窗口打开：${resource.title}`} className="flex min-h-11 items-start gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200">
                    <span className="min-w-0 flex-1 break-words">{resource.title}</span><ExternalLink className="mt-1 h-4 w-4 shrink-0" />
                  </a>
                  <iframe src={resource.url} title={resource.title} className="h-44 w-full bg-black" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
                </div>
              ))}
              {otherResources.map((resource) => {
                const meta = RESOURCE_META[resource.type];
                const Icon = meta.icon;
                const href = resolveKnowledgeResourceHref(resource, point.chapter);
                const sectionQuizFallback = isSectionQuizFallback(resource);
                const inner = (
                  <>
                    <Icon className="mt-1 h-4 w-4 shrink-0 text-cyan-200" />
                    <span className="min-w-0 flex-1 break-words">
                      {resource.title}
                      <span className="mt-1 block text-xs text-slate-400">{sectionQuizFallback ? '本单元练习' : meta.label}{!href ? ' · 暂未接入' : ''}</span>
                    </span>
                  </>
                );
                if (!href) return <div key={`${resource.type}-${resource.title}`} className={cn(actionClassName, 'opacity-70')} aria-disabled="true" title="该资源尚未接入平台，当前不可打开">{inner}</div>;
                if (href.startsWith('http') || /\.pdf(?:[?#]|$)/i.test(href)) return <a key={`${resource.type}-${resource.title}`} href={href} target="_blank" rel="noreferrer" className={actionClassName}>{inner}</a>;
                return <Link key={`${resource.type}-${resource.title}`} href={href} className={actionClassName} title={sectionQuizFallback ? '该小节暂无独立题集，进入同口径本单元测验' : undefined}>{inner}</Link>;
              })}
            </div>
          </details>

          <details className="py-3">
            <summary className={summaryClassName}>先修与后续知识 · {prereqs.length + dependents.length}</summary>
            <div className="space-y-4 pb-2 pt-3">
              {([{ title: '前置知识 · 先学什么', points: prereqs, before: true }, { title: '支撑后续 · 学完能干什么', points: dependents, before: false }]).map((group) => (
                <div key={group.title}>
                  <h4 className="mb-2 font-medium text-slate-100">{group.title}</h4>
                  {group.points.length === 0 && <p className="text-slate-400">暂无已配置的{group.before ? '先修' : '后续'}关系。</p>}
                  <div className="space-y-2">
                    {group.points.map((item) => {
                      const reason = getPrerequisiteReason(group.before ? point.id : item.id, group.before ? item.id : point.id);
                      return <div key={item.id}>
                        <button type="button" onClick={() => onSelectId(item.id)} className={actionClassName}>
                          <span className="min-w-0 flex-1 break-words">{item.name}<span className="mt-1 block text-xs text-slate-400">单元 {item.chapter} · #{item.id}</span></span>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0" />
                        </button>
                        {reason && <p className="mt-2 px-1 text-base leading-7 text-slate-400">{reason}</p>}
                      </div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>

          {childPoints.length > 0 && (
            <details className="py-3">
              <summary className={summaryClassName}>下级节点 · {childPoints.length}</summary>
              <div className="space-y-2 pb-2 pt-3">
                {childPoints.map((child) => <button key={child.id} type="button" onClick={() => onSelectId(child.id)} className={actionClassName}><span className="min-w-0 flex-1 break-words">{child.name}</span><span className="shrink-0 text-xs text-slate-400">#{child.id}</span></button>)}
              </div>
            </details>
          )}

          {(COURSE_UNIT_ALIGNMENT[point.chapter] || relatedIdeologicalNodes.length > 0) && (
            <details className="py-3">
              <summary className={summaryClassName}>课程对照与育人关联</summary>
              <div className="space-y-3 pb-2 pt-3">
                {COURSE_UNIT_ALIGNMENT[point.chapter] && <p><span className="font-medium text-slate-100">课程主题对照：</span>{COURSE_UNIT_ALIGNMENT[point.chapter]}</p>}
                {relatedIdeologicalNodes.length > 0 && (
                  <>
                    <h4 className="font-medium text-cyan-100">{ideologicalRelationLabel}</h4>
                    {relatedIdeologicalNodes.map((node) => (
                      <button key={node.id} type="button" onClick={() => onOpenIdeologicalNode(node.id)} className={actionClassName}>
                        <span className="min-w-0 flex-1 break-words">{node.name}<span className="mt-1 block text-xs text-cyan-200/75">育人主题 · {node.id}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0" />
                      </button>
                    ))}
                    <p className="text-base leading-7 text-slate-400">{explicitIdeologicalNodes.length > 0 ? '来自教学周映射表；同单元或共享知识点不会自动算作本周安排。' : '用于拓展检索，不代表已写入某一教学周的实施安排。'}</p>
                  </>
                )}
              </div>
            </details>
          )}

          {nextPoint && (
            <details className="py-3">
              <summary className={summaryClassName}>继续学习</summary>
              <button type="button" onClick={() => onSelectId(nextPoint.id)} className={cn(actionClassName, 'my-3')}>
                <span className="min-w-0 flex-1 break-words"><span className="block text-xs text-cyan-200">下一节点</span>{nextPoint.name}<span className="block text-xs text-slate-400">单元 {nextPoint.chapter} · #{nextPoint.id}</span></span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
              </button>
            </details>
          )}
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

type GraphTone =
  | 'cyan' | 'emerald' | 'amber' | 'red' | 'violet' | 'slate'
  | 'sky' | 'teal' | 'lime' | 'orange' | 'fuchsia' | 'rose';
type GraphNodeSize = 'core' | 'root' | 'branch' | 'leaf' | 'diagnosticUnit' | 'compactDiagnosticUnit' | 'thematicUnit' | 'compactThematicUnit' | 'learningUnit' | 'compactLearningUnit' | 'chapter' | 'hub' | 'net' | 'chapterCard' | 'compactChapterCard' | 'topicCard' | 'compactTopicCard';

// 画布只用三色语义：青=结构，琥珀=先修/预警，青绿=掌握/达成。
// 其余色相保留键名以免旧调用报错，但全部折回青色，避免章节彩虹。
const graphTone: Record<GraphTone, { color: string; bg: string; border: string; text: string; minimap: string }> = {
  cyan: { color: '#5AA6DE', bg: 'rgba(43, 87, 151, 0.16)', border: 'rgba(91, 143, 199, 0.42)', text: '#E6EEF6', minimap: '#2B5797' },
  emerald: { color: '#3A9E88', bg: 'rgba(29, 128, 118, 0.14)', border: 'rgba(29, 128, 118, 0.40)', text: '#D8EFEA', minimap: '#1D8076' },
  amber: { color: '#C4A15F', bg: 'rgba(168, 117, 19, 0.12)', border: 'rgba(168, 117, 19, 0.38)', text: '#F3E6C8', minimap: '#A87513' },
  red: { color: '#C7736D', bg: 'rgba(167, 58, 52, 0.14)', border: 'rgba(167, 58, 52, 0.40)', text: '#F4D9D7', minimap: '#A33B35' },
  violet: { color: '#7BA3C9', bg: 'rgba(43, 87, 151, 0.16)', border: 'rgba(91, 143, 199, 0.42)', text: '#E6EEF6', minimap: '#2B5797' },
  slate: { color: '#8A97A8', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.22)', text: '#D5DCE4', minimap: '#64748b' },
  sky: { color: '#A8CFF0', bg: 'rgba(56, 118, 186, 0.16)', border: 'rgba(91, 160, 214, 0.42)', text: '#E6EEF6', minimap: '#6AA4D4' },
  teal: { color: '#3DBFC4', bg: 'rgba(40, 140, 160, 0.16)', border: 'rgba(70, 160, 176, 0.42)', text: '#D8F0F4', minimap: '#2AA8B0' },
  lime: { color: '#7BA3C9', bg: 'rgba(43, 87, 151, 0.16)', border: 'rgba(91, 143, 199, 0.42)', text: '#E6EEF6', minimap: '#2B5797' },
  orange: { color: '#C4A15F', bg: 'rgba(168, 117, 19, 0.12)', border: 'rgba(168, 117, 19, 0.38)', text: '#F3E6C8', minimap: '#A87513' },
  fuchsia: { color: '#7BA3C9', bg: 'rgba(43, 87, 151, 0.16)', border: 'rgba(91, 143, 199, 0.42)', text: '#E6EEF6', minimap: '#2B5797' },
  rose: { color: '#7BA3C9', bg: 'rgba(43, 87, 151, 0.16)', border: 'rgba(91, 143, 199, 0.42)', text: '#E6EEF6', minimap: '#2B5797' },
};

// Dark analytical canvas: edges remain muted until selected, but must stay
// visible enough to read direction and grouping without decorative glow.
const graphEdgeTone: Record<GraphTone, string> = {
  cyan: '#4A93C8', emerald: '#2E8A78', amber: '#A87513', red: '#A33B35',
  violet: '#4A93C8', slate: '#75869a', sky: '#6AA4D4', teal: '#2AA8B0',
  lime: '#5B8FC7', orange: '#A87513', fuchsia: '#5B8FC7', rose: '#5B8FC7',
};

// Cards reserve room for full labels at a readable, zoom-bounded size.
const graphNodeSize: Record<GraphNodeSize, { width: number; height: number }> = {
  core: { width: 200, height: 84 }, root: { width: 200, height: 84 },
  branch: { width: 200, height: 84 }, leaf: { width: 200, height: 72 },
  diagnosticUnit: { width: 220, height: 84 }, compactDiagnosticUnit: { width: 220, height: 84 },
  thematicUnit: { width: 220, height: 84 }, compactThematicUnit: { width: 220, height: 84 },
  learningUnit: { width: 200, height: 72 }, compactLearningUnit: { width: 200, height: 72 },
  chapter: { width: 200, height: 84 }, hub: { width: 200, height: 84 },
  net: { width: 180, height: 72 }, chapterCard: { width: 220, height: 72 },
  compactChapterCard: { width: 220, height: 72 }, topicCard: { width: 200, height: 72 },
  compactTopicCard: { width: 200, height: 72 },
};

const CLUSTER_TONES: GraphTone[] = ['cyan', 'teal', 'emerald', 'sky'];

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
  masteryBand?: GraphMasteryBand;
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
  labelPlacement?: 'inside' | 'below' | 'beside' | 'none';
  labelSide?: 'left' | 'right';
  sequence?: number;
  /** Satellites stay on-canvas but are ignored by fitView so hubs stay readable. */
  fitIgnore?: boolean;
  [key: string]: unknown;
};

function masteryTone(band: GraphMasteryBand): GraphTone {
  if (band === 'strong') return 'emerald';
  if (band === 'weak') return 'red';
  return 'amber';
}

function masteryTextClass(band: GraphMasteryBand): string {
  if (band === 'strong') return 'text-emerald-300';
  if (band === 'weak') return 'text-red-200';
  return 'text-amber-200';
}

function masteryCardClass(band: GraphMasteryBand): string {
  if (band === 'strong') return 'border-emerald-300/45 bg-emerald-300/[0.14] text-slate-50 hover:border-emerald-200/60';
  if (band === 'weak') return 'border-red-300/50 bg-red-400/[0.14] text-slate-50 hover:border-red-200/65';
  return 'border-amber-300/50 bg-amber-300/[0.14] text-slate-50 hover:border-amber-200/60';
}

export function getGraphNodeSize(size: GraphNodeSize) {
  return graphNodeSize[size];
}

export type GraphLayoutBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const BELOW_LABEL_EXTRA_HEIGHT = 44;

export function getGraphNodeFootprint(
  size: GraphNodeSize,
  labelPlacement: MapNodeData['labelPlacement'] = 'inside',
): { width: number; height: number } {
  const box = getGraphNodeSize(size);
  return {
    width: box.width,
    height: labelPlacement === 'below' ? box.height + BELOW_LABEL_EXTRA_HEIGHT : box.height,
  };
}

export function layoutRadialChildren(
  count: number,
  origin: { x: number; y: number },
  box: { width: number; height: number },
  {
    padding = 24,
    minRx = 140,
    minRy = 110,
    aspect = 0.78,
    start = -Math.PI / 2,
  }: {
    padding?: number;
    minRx?: number;
    minRy?: number;
    aspect?: number;
    start?: number;
  } = {},
): Array<{ x: number; y: number }> {
  const { rx, ry } = getGraphRingRadii(Math.max(count, 2), box, { padding, minRx, minRy, aspect });
  const safeCount = Math.max(count, 1);
  return Array.from({ length: count }, (_, index) => {
    const angle = start + (Math.PI * 2 * index) / safeCount;
    return {
      x: origin.x + Math.cos(angle) * rx,
      y: origin.y + Math.sin(angle) * ry,
    };
  });
}

export function layoutOrganicCloud(
  count: number,
  origin: { x: number; y: number },
  {
    radius = 56,
    seed = 1,
    spread = 0.32,
    inner = 0.28,
    flatten = 0.86,
  }: {
    radius?: number;
    seed?: number;
    spread?: number;
    inner?: number;
    flatten?: number;
  } = {},
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const safeInner = Math.max(0.08, Math.min(inner, 0.9));
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 1 : (index + 0.35) / count;
    const wobble = Math.sin((index + 1) * (1.73 + seed * 0.11)) * spread;
    const angle = index * golden + seed * 0.61 + wobble;
    const radial = radius * (safeInner + (1 - safeInner) * Math.sqrt(t));
    return {
      x: origin.x + Math.cos(angle) * radial,
      y: origin.y + Math.sin(angle) * radial * flatten,
    };
  });
}

export function getCourseOverviewCenters(_compactViewport: boolean): Array<{ x: number; y: number }> {
  return Array.from({ length: 10 }, (_, index) => ({
    x: index < 5 ? 130 : 730,
    y: 64 + (index % 5) * 88,
  }));
}

export function graphBoxesOverlap(
  left: GraphLayoutBox,
  right: GraphLayoutBox,
  padding = 0,
): boolean {
  return Math.abs(left.x - right.x) < (left.width + right.width) / 2 + padding
    && Math.abs(left.y - right.y) < (left.height + right.height) / 2 + padding;
}

export function layoutGraphGrid({
  count,
  columns,
  originX,
  originY,
  columnGap,
  rowGap,
}: {
  count: number;
  columns: number;
  originX: number;
  originY: number;
  columnGap: number;
  rowGap: number;
}): Array<{ x: number; y: number }> {
  const safeColumns = Math.max(1, columns);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / safeColumns);
    const rowStart = row * safeColumns;
    const rowCount = Math.min(safeColumns, count - rowStart);
    const column = index - rowStart;
    const rowWidth = (rowCount - 1) * columnGap;
    return {
      x: originX - rowWidth / 2 + column * columnGap,
      y: originY + row * rowGap,
    };
  });
}

/**
 * Ellipse radii that keep `count` equal boxes from colliding at the poles,
 * where a wide card is most likely to clip its neighbour.
 */
export function getGraphRingRadii(
  count: number,
  box: { width: number; height: number },
  {
    padding = 16,
    minRx = 300,
    minRy = 205,
    aspect = 0.72,
  }: {
    padding?: number;
    minRx?: number;
    minRy?: number;
    aspect?: number;
  } = {},
): { rx: number; ry: number } {
  const safeCount = Math.max(count, 2);
  const minChord = Math.max(box.width, box.height) + padding;
  const startAngle = -Math.PI / 2;
  const nextAngle = startAngle + (Math.PI * 2) / safeCount;
  const factor = Math.sqrt(
    (Math.cos(nextAngle) - Math.cos(startAngle)) ** 2
    + (aspect * (Math.sin(nextAngle) - Math.sin(startAngle))) ** 2,
  );
  const rx = Math.max(minRx, factor > 0 ? Math.ceil(minChord / factor) : minRx);
  const ry = Math.max(minRy, Math.round(rx * aspect));
  return { rx, ry };
}

export function separateGraphNodeCenters(
  boxes: GraphLayoutBox[],
  {
    padding = 16,
    iterations = 24,
    pinnedIds = new Set<string>(),
  }: {
    padding?: number;
    iterations?: number;
    pinnedIds?: Set<string>;
  } = {},
): Map<string, { x: number; y: number }> {
  const items = boxes.map((box) => ({ ...box }));
  const pinned = items.filter((item) => pinnedIds.has(item.id));

  const overlapsPinned = (node: GraphLayoutBox, x: number, y: number): boolean => (
    pinned.some((anchor) => (
      anchor.id !== node.id
      && graphBoxesOverlap(
        { ...node, x, y },
        anchor,
        padding,
      )
    ))
  );

  const pushPair = (left: GraphLayoutBox, right: GraphLayoutBox, leftPinned: boolean, rightPinned: boolean): boolean => {
    if (leftPinned && rightPinned) return false;
    const minDx = (left.width + right.width) / 2 + padding;
    const minDy = (left.height + right.height) / 2 + padding;
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const overlapX = minDx - Math.abs(dx);
    const overlapY = minDy - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return false;

    const alongX = overlapX <= overlapY;
    const direction = alongX
      ? (dx === 0 ? 1 : Math.sign(dx))
      : (dy === 0 ? 1 : Math.sign(dy));
    const overlap = alongX ? overlapX : overlapY;
    let leftDelta = 0;
    let rightDelta = 0;
    if (leftPinned) {
      rightDelta = overlap * direction;
    } else if (rightPinned) {
      leftDelta = -overlap * direction;
    } else {
      leftDelta = -overlap / 2 * direction;
      rightDelta = overlap / 2 * direction;
    }

    const leftBlocked = !leftPinned && overlapsPinned(
      left,
      alongX ? left.x + leftDelta : left.x,
      alongX ? left.y : left.y + leftDelta,
    );
    const rightBlocked = !rightPinned && overlapsPinned(
      right,
      alongX ? right.x + rightDelta : right.x,
      alongX ? right.y : right.y + rightDelta,
    );
    if (leftBlocked && !rightBlocked) {
      leftDelta = 0;
      rightDelta = overlap * direction;
    } else if (rightBlocked && !leftBlocked) {
      rightDelta = 0;
      leftDelta = -overlap * direction;
    } else if (leftBlocked && rightBlocked) {
      return false;
    }

    if (leftDelta === 0 && rightDelta === 0) return false;
    if (alongX) {
      left.x += leftDelta;
      right.x += rightDelta;
    } else {
      left.y += leftDelta;
      right.y += rightDelta;
    }
    return true;
  };

  for (let step = 0; step < iterations; step += 1) {
    let moved = false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const left = items[i]!;
        const right = items[j]!;
        const leftPinned = pinnedIds.has(left.id);
        const rightPinned = pinnedIds.has(right.id);
        if (leftPinned === rightPinned) continue;
        if (pushPair(left, right, leftPinned, rightPinned)) moved = true;
      }
    }
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const left = items[i]!;
        const right = items[j]!;
        if (pinnedIds.has(left.id) || pinnedIds.has(right.id)) continue;
        if (pushPair(left, right, false, false)) moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(items.map((item) => [item.id, { x: item.x, y: item.y }]));
}

function createMapNode(
  id: string,
  centerX: number,
  centerY: number,
  data: MapNodeData,
): RFNode<MapNodeData> {
  const size = getGraphNodeSize(data.size);
  const zIndex = data.selected
    ? 80
    : data.size === 'root' || data.size === 'core' || data.size === 'hub' || data.size === 'chapterCard'
      ? 40
      : data.size === 'net'
        ? 16
        : 30;
  const ariaDetails = [
    data.levelLabel,
    data.subtitle,
    typeof data.mastery === 'number' ? `最近掌握度 ${Math.round(data.mastery)}%` : null,
    data.masteryBand && typeof data.mastery !== 'number'
      ? graphMasteryLabel({ score: null, band: data.masteryBand })
      : null,
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
    className: 'kg-map-node-card',
    width: size.width,
    height: size.height,
    style: { zIndex, width: size.width, height: size.height },
  };
}

function MapNode({ data }: NodeProps<RFNode<MapNodeData>>) {
  const tone = graphTone[data.tone];
  const size = getGraphNodeSize(data.size);
  const mastery = typeof data.mastery === 'number' ? Math.max(0, Math.min(100, data.mastery)) : null;
  const masteryBand = data.masteryBand;
  const masteryStripe = masteryBand ? `inset 3px 0 0 ${tone.color}` : '';
  const handleCls = '!h-1 !w-1 !border-0 !bg-transparent';
  const centerStyle: CSSProperties = { left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' };
  const canvasBase = data.selected ? '#163242' : '#101821';
  const masteryMix = masteryBand ? (data.selected ? 36 : 24) : 12;
  return (
    <>
      <Handle id="tt" type="target" position={Position.Top} className={handleCls} />
      <Handle id="bt" type="target" position={Position.Bottom} className={handleCls} />
      <Handle id="lt" type="target" position={Position.Left} className={handleCls} />
      <Handle id="rt" type="target" position={Position.Right} className={handleCls} />
      <Handle id="ct" type="target" position={Position.Top} className={handleCls} style={centerStyle} />
      <div
        data-mastery-band={masteryBand}
        className={cn('flex flex-col justify-center gap-1 rounded-lg border px-3 transition-[border-color,background-color,opacity] duration-200', data.clickable === false ? 'cursor-default' : 'cursor-pointer')}
        style={{
          width: size.width, height: size.height,
          background: data.selected && !masteryBand
            ? '#163242'
            : `color-mix(in srgb, ${tone.color} ${masteryMix}%, ${canvasBase})`,
          borderColor: data.selected ? '#67e8f9' : tone.border,
          boxShadow: data.selected
            ? `0 0 0 1px #67e8f9${masteryStripe ? `, ${masteryStripe}` : ''}`
            : masteryStripe || '0 3px 9px rgba(0,0,0,.15)',
          opacity: !data.visible && !data.selected ? 0.3 : data.dimmed && !data.selected ? 0.68 : 1,
        }}
      >
        <div className="break-words text-[16px] font-semibold leading-[1.35] text-slate-100">{data.label}</div>
        {(data.subtitle || mastery !== null || masteryBand) && (
          <div className="flex flex-wrap items-center gap-x-2 text-[12px] leading-4 text-slate-400">
            {data.subtitle && <span>{data.subtitle}</span>}
            {masteryBand && (
              <span className={masteryTextClass(masteryBand)}>
                {graphMasteryLabel({ score: mastery, band: masteryBand })}
              </span>
            )}
          </div>
        )}
      </div>
      <Handle id="bs" type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="ts" type="source" position={Position.Top} className={handleCls} />
      <Handle id="ls" type="source" position={Position.Left} className={handleCls} />
      <Handle id="rs" type="source" position={Position.Right} className={handleCls} />
      <Handle id="cs" type="source" position={Position.Bottom} className={handleCls} style={centerStyle} />
    </>
  );
}

const mapNodeTypes = { mapNode: MapNode };

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

export const MIN_FOCUSED_GRAPH_ZOOM = 0.875;

type GraphViewport = { x: number; y: number; zoom: number };
type GraphViewportSnapshot = {
  viewport: GraphViewport;
  stage: { width: number; height: number };
};
const graphViewportCache = new Map<string, GraphViewportSnapshot>();

export function restoreGraphViewport(
  saved: GraphViewportSnapshot,
  stage: { width: number; height: number },
): GraphViewport {
  return {
    x: saved.viewport.x + (stage.width - saved.stage.width) / 2,
    y: saved.viewport.y + (stage.height - saved.stage.height) / 2,
    zoom: saved.viewport.zoom,
  };
}

/** Keep the selected card visible without changing the user's zoom. */
export function getGraphViewportPan({ viewport, node, stage, padding = 24 }: {
  viewport: GraphViewport;
  node: { x: number; y: number; width: number; height: number };
  stage: { width: number; height: number };
  padding?: number;
}): GraphViewport {
  const left = viewport.x + node.x * viewport.zoom;
  const top = viewport.y + node.y * viewport.zoom;
  const width = node.width * viewport.zoom;
  const height = node.height * viewport.zoom;
  const dx = width > stage.width - padding * 2
    ? stage.width / 2 - left - width / 2
    : left < padding ? padding - left : left + width > stage.width - padding ? stage.width - padding - left - width : 0;
  const topPadding = padding;
  const dy = height > stage.height - topPadding - padding
    ? stage.height / 2 - top - height / 2
    : top < topPadding ? topPadding - top : top + height > stage.height - padding ? stage.height - padding - top - height : 0;
  return { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom };
}


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
      <span>点击展开或选择节点</span>
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
  viewportKey?: string;
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
  viewportKey,
  focusIds: _focusIds,
  heightClassName = 'h-[660px] md:h-[760px]',
  fitPadding = 0.18,
  fitMaxZoom = 1.1,
  focusFitPadding: _focusFitPadding,
  focusFitMaxZoom: _focusFitMaxZoom,
  controlsPosition: _controlsPosition = 'top-right',
  onEdgeSelect,
  emptyState,
}, forwardedRef) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [instanceReady, setInstanceReady] = useState(false);
  const mapNodeKey = nodes
    .filter((node) => node.type === 'mapNode')
    .map((node) => node.id)
    .join('\0');
  const resolvedViewportKey = viewportKey ?? mapNodeKey;
  const lastStageSizeRef = useRef(graphViewportCache.get(resolvedViewportKey)?.stage ?? { width: 0, height: 0 });
  const saveViewport = useCallback((key: string, viewport: GraphViewport) => {
    const stage = stageRef.current;
    if (stage && stage.clientWidth > 0 && stage.clientHeight > 0) {
      lastStageSizeRef.current = { width: stage.clientWidth, height: stage.clientHeight };
    }
    const stageSize = lastStageSizeRef.current;
    if (stageSize.width <= 0 || stageSize.height <= 0) return;
    if (graphViewportCache.size >= 100 && !graphViewportCache.has(key)) {
      graphViewportCache.delete(graphViewportCache.keys().next().value!);
    }
    graphViewportCache.set(key, { viewport, stage: { ...stageSize } });
  }, []);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
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
        { zoom: 1.35, duration: currentGraphMotionDuration(opts?.duration ?? 200) },
      );
    },
  }), [nodes]);

  const fitAllMapNodes = useCallback((duration = 200) => {
    const instance = instanceRef.current;
    if (!instance) return;
    const targets = nodesRef.current.filter((node) => node.type === 'mapNode' && !(node.data as MapNodeData).fitIgnore);
    if (!targets.length) return;
    void instance.fitView({
      nodes: targets.map((node) => ({ id: node.id })), padding: fitPadding,
      duration: currentGraphMotionDuration(duration), maxZoom: fitMaxZoom,
      minZoom: MIN_FOCUSED_GRAPH_ZOOM,
    });
  }, [fitMaxZoom, fitPadding]);
  const fitRef = useRef(fitAllMapNodes);
  fitRef.current = fitAllMapNodes;

  const keepSelectedVisible = useCallback(() => {
    const instance = instanceRef.current;
    const stage = stageRef.current;
    const node = nodesRef.current.find((item) => item.id === selectedIdRef.current);
    if (!instance || !stage || !node || stage.clientWidth === 0 || stage.clientHeight === 0) return;
    const size = getGraphNodeSize((node.data as MapNodeData).size);
    const viewport = instance.getViewport();
    const next = getGraphViewportPan({
      viewport, node: { ...node.position, ...size },
      stage: { width: stage.clientWidth, height: stage.clientHeight },
    });
    if (next.x !== viewport.x || next.y !== viewport.y) {
      void instance.setViewport(next, { duration: currentGraphMotionDuration(200) });
    }
  }, []);

  // Restore each expanded path independently. Selection and sidebar resizing
  // never run fitView, so a manually positioned teaching view stays stable.
  useEffect(() => {
    if (!instanceReady) return;
    const saved = graphViewportCache.get(resolvedViewportKey);
    const timer = window.setTimeout(() => {
      const stage = stageRef.current;
      if (!stage || stage.clientWidth === 0 || stage.clientHeight === 0) return;
      const size = { width: stage.clientWidth, height: stage.clientHeight };
      lastStageSizeRef.current = size;
      if (saved) {
        void instanceRef.current?.setViewport(restoreGraphViewport(saved, size), { duration: 0 }).then(keepSelectedVisible);
      } else fitRef.current(200);
    }, 60);
    return () => {
      window.clearTimeout(timer);
      const current = instanceRef.current?.getViewport();
      if (current) saveViewport(resolvedViewportKey, current);
    };
  }, [instanceReady, resolvedViewportKey, keepSelectedVisible, saveViewport]);

  useEffect(() => {
    if (!instanceReady) return;
    const timer = window.setTimeout(keepSelectedVisible, 260);
    return () => window.clearTimeout(timer);
  }, [instanceReady, keepSelectedVisible, selectedId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !instanceReady) return;
    let resizeTimer = 0;
    let previousSize = { width: stage.clientWidth, height: stage.clientHeight };
    const observer = new ResizeObserver(() => {
      setHover(null);
      setEdgeHover(null);
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const nextSize = { width: stage.clientWidth, height: stage.clientHeight };
        const instance = instanceRef.current;
        if (!instance || nextSize.width === 0 || nextSize.height === 0) return;
        const viewport = instance.getViewport();
        const shifted = {
          x: viewport.x + (nextSize.width - previousSize.width) / 2,
          y: viewport.y + (nextSize.height - previousSize.height) / 2,
          zoom: viewport.zoom,
        };
        previousSize = nextSize;
        lastStageSizeRef.current = nextSize;
        void instance.setViewport(shifted, { duration: 0 }).then(keepSelectedVisible);
      }, 80);
    });
    observer.observe(stage);
    return () => { window.clearTimeout(resizeTimer); observer.disconnect(); };
  }, [instanceReady, keepSelectedVisible]);

  return (
    <div
      className={cn(
        'kg-map-stage relative isolate flex flex-col overflow-hidden bg-[#0b1118]',
        heightClassName,
      )}
    >
      {/* ReactFlow Controls 按钮默认白底，在深色画布上很扎眼；
          Tailwind 任意变体写不进带双下划线的类名，这里用作用域样式压成暗色，
          三个图谱视图共享同一观感 */}
      <style>{`
        .kg-map-stage {
          background: #070b11;
        }
        .kg-map-stage::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse 50% 42% at 16% 12%, rgba(90, 166, 222, 0.025), transparent 72%),
            radial-gradient(ellipse 44% 36% at 82% 18%, rgba(61, 191, 196, 0.02), transparent 70%),
            radial-gradient(ellipse 52% 44% at 60% 88%, rgba(58, 158, 136, 0.015), transparent 74%);
        }
        .kg-map-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(ellipse 80% 70% at 50% 48%, transparent 42%, rgba(4, 7, 12, 0.38) 100%);
        }
        .kg-map-stage .react-flow__node.kg-map-node-round {
          overflow: visible !important;
        }
        .kg-map-stage .react-flow__edge-path {
          stroke-linejoin: round;
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
          border-radius: 8px;
        }
        .kg-map-stage .react-flow__edge.kg-dependency-edge:focus-visible {
          outline: none;
        }
        .kg-map-stage .react-flow__edge.kg-dependency-edge:focus-visible .react-flow__edge-path {
          opacity: 1 !important;
          stroke-width: 3.2px !important;
          filter: none;
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
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .kg-learning-unit-enter { animation: kg-learning-unit-enter .2s cubic-bezier(.2,.75,.18,1) both; }
        /* clusterHalo 内层 div 已 pointer-events-none，但 ReactFlow 给节点外层
           wrapper 内联了 pointer-events:all（style 属性，优先级高于普通 class 规则），
           实测该内联样式确实盖住了下方的依赖边(kg-dep-*)，点击展开面板永远弹不出来。
           光晕纯装饰、无任何交互语义，用 !important 压过内联样式让整个节点穿透点击。 */
        .kg-map-stage .react-flow__node-clusterHalo {
          pointer-events: none !important;
        }
      `}</style>
      <div className="kg-stage-watermark" aria-hidden />
      {/* 先修依赖边：单色琥珀，与结构青、掌握青绿分开，避免青→琥珀渐变造成彩虹感 */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <linearGradient id="kg-dep-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1500" y2="900">
            <stop offset="0%" stopColor="#A87513" />
            <stop offset="100%" stopColor="#A87513" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-2">
        <span className="text-xs text-slate-500">拖动画布查看完整导图</span>
        <div role="group" aria-label="图谱缩放与视图控制" className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="缩小图谱" onClick={() => void instanceRef.current?.zoomOut({ duration: currentGraphMotionDuration(200) })} className="h-10 w-10 rounded border border-white/10 text-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">−</button>
          <button type="button" aria-label="放大图谱" onClick={() => void instanceRef.current?.zoomIn({ duration: currentGraphMotionDuration(200) })} className="h-10 w-10 rounded border border-white/10 text-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">+</button>
          <button type="button" aria-label="重置为适合画布的视图" onClick={() => fitAllMapNodes(200)} className="inline-flex h-10 items-center gap-1.5 rounded border border-white/10 px-2 text-xs text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"><Maximize2 className="h-3.5 w-3.5" />适合画布</button>
        </div>
      </div>
      <div ref={stageRef} className="relative min-h-0 flex-1">
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
        defaultViewport={graphViewportCache.get(resolvedViewportKey)?.viewport ?? { x: 0, y: 0, zoom: 1 }}
        onMoveEnd={(_, viewport) => saveViewport(resolvedViewportKey, viewport)}
        fitViewOptions={{ padding: fitPadding, maxZoom: fitMaxZoom, minZoom: MIN_FOCUSED_GRAPH_ZOOM }}
        minZoom={MIN_FOCUSED_GRAPH_ZOOM}
        maxZoom={2.4}
        autoPanOnNodeFocus
        ariaLabelConfig={GRAPH_ARIA_LABEL_CONFIG}
        proOptions={{ hideAttribution: true }}
      >
      </ReactFlow>
      {emptyState && (
        <div
          className="absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_50%_48%,rgba(15,23,32,.90),rgba(7,11,16,.84)_58%,rgba(7,11,16,.70))] px-5 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-sm rounded-md border border-white/[0.10] bg-[#0c131b]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.42)]">
            <div className="chip-mark mx-auto grid h-11 w-11 place-items-center rounded-md text-[rgb(var(--kg-accent))]">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-100">{emptyState.title}</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">{emptyState.description}</p>
            <button
              type="button"
              onClick={emptyState.onAction}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.06] px-4 text-xs font-semibold text-slate-100 transition hover:border-[rgb(var(--kg-accent)/.35)] hover:bg-[rgb(var(--kg-accent)/.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--kg-accent))]"
            >
              {emptyState.actionLabel}
            </button>
          </div>
        </div>
      )}
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
    </div>
  );
});

function NodeHoverCard({ hover }: { hover: HoverPayload }) {
  const { data } = hover;
  const position = getGraphHoverCardPosition({ ...hover, cardHeight: 132 });
  return (
    <div className="pointer-events-none absolute z-50 overflow-hidden rounded-lg border bg-[#0b1117] p-3 shadow-lg" style={{ ...position, maxHeight: Math.max(0, Math.min(132, hover.stageHeight - 16)), borderColor: graphTone[data.tone].border }}>
      <div className="text-sm font-semibold leading-snug text-slate-100">{data.label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400 line-clamp-3">{data.description || data.subtitle || '选择节点，按“查看详情”阅读内容。'}</div>
    </div>
  );
}

function nearestSideHandles(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) * 0.72) {
    return dx >= 0
      ? { sourceHandle: 'rs', targetHandle: 'lt' }
      : { sourceHandle: 'ls', targetHandle: 'rt' };
  }
  return dy >= 0
    ? { sourceHandle: 'bs', targetHandle: 'tt' }
    : { sourceHandle: 'ts', targetHandle: 'bt' };
}

function graphAssociationEdge(
  from: string,
  to: string,
  tone: GraphTone,
  active = true,
  width = 1.2,
  dashed = false,
  handles?: { sourceHandle?: string; targetHandle?: string },
): RFEdge {
  const color = graphEdgeTone[tone];
  return {
    id: `${from}-${to}`,
    source: from,
    target: to,
    sourceHandle: handles?.sourceHandle ?? 'cs',
    targetHandle: handles?.targetHandle ?? 'ct',
    type: dashed ? 'smoothstep' : 'default',
    animated: false,
    style: {
      stroke: color,
      strokeWidth: active ? width + 0.25 : 1.05,
      opacity: active ? (dashed ? 0.72 : 0.5) : 0.28,
      strokeDasharray: dashed ? '5 7' : undefined,
      strokeLinecap: 'round',
    },
    data: { kind: dashed ? 'mapping' : 'hier' },
  };
}

function knowledgeTone(chapter: number): GraphTone {
  return CLUSTER_TONES[(Math.max(1, chapter) - 1) % CLUSTER_TONES.length];
}

function problemTone(category: ProblemNode['category']): GraphTone {
  if (category === 'coding') return 'teal';
  if (category === 'experiment') return 'emerald';
  if (category === 'project') return 'sky';
  return 'cyan';
}

function ideologicalTone(category?: IdeologicalCategory): GraphTone {
  if (category === 'craftsmanship' || category === 'aerospace') return 'teal';
  if (category === 'ethics') return 'emerald';
  if (category === 'innovation') return 'sky';
  return 'cyan';
}

function GraphBreadcrumb({ items }: { items: Array<{ id: string; label: string; onSelect?: () => void }> }) {
  return (
    <nav aria-label="当前位置" className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
      {items.map((item, index) => (
        <span key={item.id} className="inline-flex min-w-0 items-center gap-1">
          {index > 0 && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
          <button type="button" onClick={item.onSelect} aria-current={index === items.length - 1 ? 'page' : undefined}
            className={cn('min-h-10 rounded px-2 py-1 text-left leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', index === items.length - 1 ? 'font-semibold text-cyan-100' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function FullKnowledgeMap({
  points, selectedId, visibleIds, progress: _progress, onSelect, onFocusChapter,
  chapterFilter, masteryByKa, experimentTitleByRefId, onClearVisibility,
  onReturnOverview, onDependencyDetail, dependencyDetailVisible, compactViewport = false,
}: {
  points: KnowledgePoint[];
  selectedId: string;
  visibleIds: Set<string>;
  progress: HyperLearningProgressRecord[];
  onSelect: (point: KnowledgePoint) => void;
  onFocusChapter?: (chapter: number) => void;
  chapterFilter: number | 'all';
  masteryByKa?: Record<string, GraphNodeMastery>;
  experimentTitleByRefId: Record<string, string>;
  onClearVisibility: () => void;
  onReturnOverview?: () => void;
  onDependencyDetail?: (detail: ReactNode | null) => void;
  dependencyDetailVisible?: boolean;
  compactViewport?: boolean;
}) {
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const edgeDetailPanelRef = useRef<HTMLDivElement>(null);
  const edgeFocusReturnRef = useRef<(Element & { focus: (options?: FocusOptions) => void }) | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const dependencyDetailCallback = useRef(onDependencyDetail);
  dependencyDetailCallback.current = onDependencyDetail;
  const pointById = useMemo(() => Object.fromEntries(points.map((point) => [point.id, point])), [points]);
  const selectedPoint = pointById[selectedId];
  const root = chapterFilter === 'all' ? undefined : points.find((point) => point.chapter === chapterFilter && point.level === 1);
  const activeTopic = chapterFilter === 'all' || selectedPoint?.chapter !== chapterFilter ? undefined
    : selectedPoint?.level === 2 ? selectedPoint : selectedPoint?.level === 3 ? pointById[selectedPoint.parentId || ''] : undefined;
  const viewportKey = `knowledge:${compactViewport ? 'compact' : 'full'}:${chapterFilter}:${activeTopic?.id || 'root'}`;
  const overviewRoots = useMemo(
    () => points.filter((point) => point.level === 1).sort((a, b) => a.chapter - b.chapter),
    [points],
  );
  const compactTopics = root ? points.filter((point) => point.parentId === root.id) : [];
  const compactLeaves = activeTopic ? points.filter((point) => point.parentId === activeTopic.id) : [];

  useEffect(() => { setSelectedEdgeKey(null); }, [selectedId, chapterFilter, showPrerequisites]);
  useEffect(() => { if (dependencyDetailVisible === false) setSelectedEdgeKey(null); }, [dependencyDetailVisible]);
  useEffect(() => () => dependencyDetailCallback.current?.(null), []);

  const layout = useMemo(() => {
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const addPoint = (point: KnowledgePoint, x: number, y: number, subtitle: string, size: GraphNodeSize = 'topicCard'): void => {
      const mastery = masteryByKa?.[point.id];
      nodes.push(createMapNode(point.id, x, y, {
        label: point.name, subtitle, levelLabel: point.level === 1 ? '单元' : point.level === 2 ? '主题' : '知识点',
        tone: mastery ? masteryTone(mastery.band) : knowledgeTone(point.chapter), size, selected: point.id === selectedId,
        visible: visibleIds.has(point.id) || points.some((child) => child.parentId === point.id && visibleIds.has(child.id)),
        chapter: point.chapter,
        ...(mastery?.score !== null && mastery?.score !== undefined ? { mastery: mastery.score } : {}),
        ...(mastery ? { masteryBand: mastery.band } : {}),
        description: point.description,
        experiments: (point.appliedIn || []).map((id) => experimentTitleByRefId[id] || id), labelPlacement: 'inside',
      }));
    };
    const addHierarchy = (parentId: string, childId: string): void => {
      const parent = nodes.find((node) => node.id === parentId);
      const child = nodes.find((node) => node.id === childId);
      if (!parent || !child) return;
      const childPoint = pointById[childId];
      edges.push(graphAssociationEdge(parentId, childId, knowledgeTone(childPoint?.chapter || 1), true, 1.35, false, chapterFilter === 'all' && child.position.x < parent.position.x
        ? { sourceHandle: 'ls', targetHandle: 'rt' }
        : { sourceHandle: 'rs', targetHandle: 'lt' }));
    };
    if (chapterFilter === 'all') {
      const roots = points.filter((point) => point.level === 1).sort((a, b) => a.chapter - b.chapter);
      nodes.push(createMapNode('knowledge-course', 430, 240, {
        label: '单片机原理与应用', subtitle: `${roots.length} 个单元`, tone: 'cyan', size: 'core',
        selected: false, visible: true, clickable: false, labelPlacement: 'inside',
      }));
      const centers = getCourseOverviewCenters(false);
      roots.forEach((point, index) => {
        const center = centers[index] || { x: 730, y: 64 + (index - 5) * 88 };
        addPoint(point, center.x, center.y, `单元 ${point.chapter} · ${points.filter((child) => child.parentId === point.id).length} 个主题`, 'chapterCard');
        addHierarchy('knowledge-course', point.id);
      });
    } else if (root) {
      const topics = points.filter((point) => point.parentId === root.id);
      const leaves = activeTopic ? points.filter((point) => point.parentId === activeTopic.id) : [];
      const maxLeafCount = Math.max(0, ...topics.map((topic) => points.filter((point) => point.parentId === topic.id).length));
      const height = Math.max(topics.length * 88, maxLeafCount * 80, 220);
      const middleY = height / 2 + 44;
      addPoint(root, 120, middleY, `单元 ${root.chapter} · ${topics.length} 个主题`, 'hub');
      topics.forEach((topic, index) => {
        const children = points.filter((point) => point.parentId === topic.id);
        addPoint(topic, 410, middleY + (index - (topics.length - 1) / 2) * 88, `${children.length} 个知识点`);
        addHierarchy(root.id, topic.id);
      });
      leaves.forEach((point, index) => {
        addPoint(point, 700, middleY + (index - (leaves.length - 1) / 2) * 80, '', 'learningUnit');
        addHierarchy(activeTopic!.id, point.id);
      });
      if (showPrerequisites && selectedPoint) {
        const renderedIds = new Set(nodes.map((node) => node.id));
        points.forEach((target) => (target.prerequisites || []).forEach((sourceId) => {
          if (sourceId !== selectedId && target.id !== selectedId) return;
          if (!renderedIds.has(sourceId) || !renderedIds.has(target.id)) return;
          const sourceNode = nodes.find((node) => node.id === sourceId)!;
          const targetNode = nodes.find((node) => node.id === target.id)!;
          edges.push({
            id: `kg-dep-local-${sourceId}-${target.id}`, source: sourceId, target: target.id,
            ...nearestSideHandles(sourceNode.position, targetNode.position), type: 'smoothstep',
            style: { stroke: graphEdgeTone.amber, strokeWidth: 1.8, opacity: .9, strokeDasharray: '6 6', cursor: 'pointer' },
            markerEnd: { type: MarkerType.ArrowClosed, color: graphEdgeTone.amber, width: 14, height: 14 },
            interactionWidth: 20, ...getDependencyEdgeAccessibility(pointById[sourceId]?.name || sourceId, target.name, 1),
            data: { kind: 'dep', pairs: [[sourceId, target.id]] },
          });
        }));
      }
    }
    return { nodes, edges };
  }, [points, pointById, selectedId, selectedPoint, visibleIds, chapterFilter, root, activeTopic, masteryByKa, experimentTitleByRefId, showPrerequisites]);

  const selectedEdge = layout.edges.find((edge) => edge.id === selectedEdgeKey);
  const selectedPairsKey = JSON.stringify((selectedEdge?.data as { pairs?: Array<[string, string]> } | undefined)?.pairs || []);
  const closeEdgeDetail = useCallback(() => {
    setSelectedEdgeKey(null);
    const trigger = edgeFocusReturnRef.current;
    edgeFocusReturnRef.current = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, []);
  const dependencyDetail = useMemo(() => {
    const pairs = JSON.parse(selectedPairsKey) as Array<[string, string]>;
    return pairs.length ? <DepEdgeDetailPanel ref={edgeDetailPanelRef} pairs={pairs} pointById={pointById} onClose={closeEdgeDetail}
      onSelectPoint={(id) => { const point = pointById[id]; if (point) onSelectRef.current(point); }} /> : null;
  }, [selectedPairsKey, pointById, closeEdgeDetail]);
  useEffect(() => {
    dependencyDetailCallback.current?.(dependencyDetail);
    if (dependencyDetail && edgeFocusReturnRef.current) {
      const frame = requestAnimationFrame(() => edgeDetailPanelRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [dependencyDetail]);

  const breadcrumbItems: Array<{ id: string; label: string; onSelect?: () => void }> = [
    { id: 'course', label: '课程总览', onSelect: onReturnOverview },
  ];
  if (root) breadcrumbItems.push({ id: root.id, label: root.name, onSelect: () => onSelect(root) });
  if (activeTopic) breadcrumbItems.push({ id: activeTopic.id, label: activeTopic.name, onSelect: () => onSelect(activeTopic) });
  if (activeTopic && selectedPoint?.level === 3) breadcrumbItems.push({ id: selectedPoint.id, label: selectedPoint.name });

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 px-1">
        <GraphBreadcrumb items={breadcrumbItems} />
        {chapterFilter !== 'all' && !compactViewport && <button type="button" aria-pressed={showPrerequisites}
          onClick={() => setShowPrerequisites((show) => !show)}
          className={cn('min-h-10 rounded-md border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', showPrerequisites ? 'border-amber-300/40 bg-amber-300/10 text-amber-100' : 'border-white/10 text-slate-400')}>
          {showPrerequisites ? '隐藏先修关系' : '显示先修关系'}
        </button>}
      </div>
      <div className="min-h-0 flex-1">
        {compactViewport && chapterFilter === 'all' ? (
          <div className="kg-scrollbar h-full overflow-y-auto px-2 pb-3" aria-label="课程单元总览">
            <div className="mx-auto mb-3 max-w-sm rounded-md border border-cyan-200/35 bg-cyan-200/[0.10] px-4 py-3 text-center">
              <div className="text-sm font-semibold text-cyan-50">单片机原理与应用</div>
              <div className="mt-1 text-xs text-cyan-100/65">{overviewRoots.length} 个平台单元</div>
            </div>
            <div className="mx-auto mb-2 h-5 w-px bg-cyan-200/25" aria-hidden />
            <div className="grid grid-cols-2 gap-2" aria-label="十个平台单元">
              {overviewRoots.map((point) => {
                const themeCount = points.filter((child) => child.parentId === point.id).length;
                const mastery = masteryByKa?.[point.id];
                const masteryText = mastery ? graphMasteryLabel(mastery) : null;
                return (
                  <button
                    key={point.id}
                    type="button"
                    data-mastery-band={mastery?.band}
                    onClick={() => {
                      onFocusChapter?.(point.chapter);
                      onSelect(point);
                    }}
                    className={cn(
                      'min-h-[92px] rounded-md border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                      mastery
                        ? masteryCardClass(mastery.band)
                        : 'border-white/[0.11] bg-[#102027] hover:border-cyan-200/35 hover:bg-cyan-200/[0.09]',
                    )}
                    aria-label={`单元 ${point.chapter} ${point.name}，${themeCount} 个主题${masteryText ? `，${masteryText}` : ''}`}
                  >
                    <span className="block font-mono text-[11px] text-cyan-200/65">单元 {point.chapter}</span>
                    <span className="mt-1 block text-sm font-semibold leading-5 text-slate-50">{point.name}</span>
                    <span className="mt-1 block text-xs text-slate-400">{themeCount} 个主题{masteryText ? ` · ${masteryText}` : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : compactViewport && root ? (
          <div className="kg-scrollbar h-full overflow-y-auto px-2 pb-3" aria-label={`单元 ${root.chapter} 层级总览`}>
            <button
              type="button"
              onClick={() => onSelect(root)}
              aria-current={!activeTopic ? 'page' : undefined}
              data-mastery-band={masteryByKa?.[root.id]?.band}
              className={cn(
                'mx-auto block w-full max-w-sm rounded-md border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                masteryByKa?.[root.id]
                  ? masteryCardClass(masteryByKa[root.id]!.band)
                  : !activeTopic
                    ? 'border-cyan-200/40 bg-cyan-200/[0.11] text-cyan-50'
                    : 'border-white/[0.11] bg-[#102027] text-slate-100 hover:border-cyan-200/30',
              )}
              aria-label={`单元 ${root.chapter} ${root.name}，${compactTopics.length} 个主题${masteryByKa?.[root.id] ? `，${graphMasteryLabel(masteryByKa[root.id]!)}` : ''}`}
            >
              <span className="block font-mono text-[11px] text-cyan-200/65">单元 {root.chapter}</span>
              <span className="mt-1 block text-base font-semibold leading-6">{root.name}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {compactTopics.length} 个主题
                {masteryByKa?.[root.id] ? ` · ${graphMasteryLabel(masteryByKa[root.id]!)}` : ''}
              </span>
            </button>

            <div className="mx-auto h-5 w-px bg-cyan-200/25" aria-hidden />
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{activeTopic ? '同级主题' : '选择主题继续展开'}</span>
              <span>{compactTopics.length} 项</span>
            </div>
            <div className="grid grid-cols-2 gap-2" aria-label={`${root.name}主题`}>
              {compactTopics.map((topic) => {
                const childCount = points.filter((point) => point.parentId === topic.id).length;
                const active = activeTopic?.id === topic.id;
                const mastery = masteryByKa?.[topic.id];
                const masteryText = mastery ? graphMasteryLabel(mastery) : null;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => onSelect(topic)}
                    aria-current={active ? 'page' : undefined}
                    data-mastery-band={mastery?.band}
                    className={cn(
                      'min-h-[88px] rounded-md border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                      mastery
                        ? cn(masteryCardClass(mastery.band), active && 'ring-1 ring-cyan-200/70')
                        : active
                          ? 'border-cyan-200/45 bg-cyan-200/[0.12] text-cyan-50'
                          : 'border-white/[0.10] bg-[#102027] text-slate-100 hover:border-cyan-200/30 hover:bg-cyan-200/[0.08]',
                    )}
                    aria-label={`主题 ${topic.name}，${childCount} 个知识点${masteryText ? `，${masteryText}` : ''}`}
                  >
                    <span className="block text-sm font-semibold leading-5">{topic.name}</span>
                    <span className="mt-1 block text-xs text-slate-400">{childCount} 个知识点{masteryText ? ` · ${masteryText}` : ''}</span>
                  </button>
                );
              })}
            </div>

            {activeTopic && (
              <>
                <div className="mx-auto h-5 w-px bg-cyan-200/25" aria-hidden />
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{activeTopic.name} · 知识点</span>
                  <span>{compactLeaves.length} 项</span>
                </div>
                <div className="grid grid-cols-2 gap-2" aria-label={`${activeTopic.name}知识点`}>
                  {compactLeaves.map((point) => {
                    const active = selectedPoint?.id === point.id;
                    const mastery = masteryByKa?.[point.id];
                    const masteryText = mastery ? graphMasteryLabel(mastery) : null;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => onSelect(point)}
                        aria-current={active ? 'page' : undefined}
                        data-mastery-band={mastery?.band}
                        className={cn(
                          'min-h-[72px] rounded-md border px-3 py-2.5 text-left text-sm font-medium leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                          mastery
                            ? cn(masteryCardClass(mastery.band), active && 'ring-1 ring-cyan-200/70')
                            : active
                              ? 'border-cyan-200/45 bg-cyan-200/[0.12] text-cyan-50'
                              : 'border-white/[0.10] bg-black/20 text-slate-200 hover:border-cyan-200/30 hover:bg-cyan-200/[0.07]',
                          !visibleIds.has(point.id) && 'opacity-45',
                        )}
                        aria-label={`知识点 ${point.name}${masteryText ? `，${masteryText}` : ''}`}
                      >
                        <span className="block">{point.name}</span>
                        {masteryText && <span className={cn('mt-1 block text-xs font-medium', masteryTextClass(mastery!.band))}>{masteryText}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : <GraphMapStage nodes={layout.nodes} edges={layout.edges.map((edge) => (edge.data as { kind?: string })?.kind === 'dep' ? { ...edge, domAttributes: { ...edge.domAttributes, 'aria-expanded': edge.id === selectedEdgeKey } } : edge)}
          viewportKey={viewportKey} selectedId={selectedId} heightClassName="h-full" fitPadding={0.08} fitMaxZoom={1.1}
          onSelect={(id) => {
            const point = pointById[id];
            if (!point) return;
            setSelectedEdgeKey(null);
            if (chapterFilter === 'all') onFocusChapter?.(point.chapter);
            onSelect(point);
          }}
          onEdgeSelect={(id, trigger) => {
            if (id === selectedEdgeKey) { closeEdgeDetail(); return; }
            edgeFocusReturnRef.current = trigger && 'focus' in trigger ? trigger as Element & { focus: (options?: FocusOptions) => void } : null;
            setSelectedEdgeKey(id);
          }}
          emptyState={visibleIds.size === 0 ? { title: '没有匹配的知识点', description: '清除搜索后可恢复完整课程位置。', actionLabel: '清除搜索', onAction: onClearVisibility } : undefined}
        />}
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
      className="h-full min-h-0 overflow-y-auto border-l border-amber-300/25 bg-[#0b1117] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
    >
      <div className="mb-3 flex items-center justify-between">
        <div id={`${DEPENDENCY_EDGE_DETAIL_ID}-title`} className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-amber-200">
          <GitBranch className="h-3.5 w-3.5" />
          先修关系 · {pairs.length} 条
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
              <div className="flex flex-wrap items-center gap-1.5 text-base">
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
                <div className="mt-1 text-base leading-7 text-slate-400">{reason}</div>
              ) : (
                <div className="mt-1 text-base leading-7 text-slate-600">暂无课程逻辑理由说明</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

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
    ...problemGraph.filter((node) => node.parentId === root.id).map((node) => node.id),
    ...problemGraph.filter((node) => node.parentId === domain.id).map((node) => node.id),
  ]);
}

export function getProblemOverviewCenters(
  _compactViewport: boolean,
  _teachingFocus: boolean,
): Array<{ x: number; y: number }> {
  return Array.from({ length: 4 }, (_, index) => ({
    x: 140 + (index % 2) * 300,
    y: 120 + Math.floor(index / 2) * 150,
  }));
}

export function shouldKeepGraphRootFocus(disableRootFocus: boolean, compactViewport: boolean): boolean {
  return !disableRootFocus || compactViewport;
}

function ProblemGraphCanvas({
  selectedId, visibleIds, onSelect, disableRootFocus = false, teachingFocus: _teachingFocus = false,
  heightClassName = 'h-[clamp(420px,calc(100vh-292px),720px)]', emptyState,
}: {
  selectedId: string;
  visibleIds: Set<string>;
  onSelect: (id: string) => void;
  disableRootFocus?: boolean;
  teachingFocus?: boolean;
  heightClassName?: string;
  emptyState?: GraphCanvasEmptyState;
}) {
  const selected = problemGraph.find((node) => node.id === selectedId);
  const topic = selected?.level === 2 ? selected : selected?.level === 3 ? problemGraph.find((node) => node.id === selected.parentId) : undefined;
  const root = selected?.level === 1 ? selected : topic ? problemGraph.find((node) => node.id === topic.parentId) : undefined;
  const layout = useMemo(() => {
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const matchesFilter = (point: ProblemNode): boolean => !disableRootFocus || visibleIds.has(point.id);
    const add = (point: ProblemNode, x: number, y: number, subtitle: string): void => {
      if (!matchesFilter(point)) return;
      nodes.push(createMapNode(point.id, x, y, {
        label: point.name, subtitle, tone: problemTone(point.category), size: point.level === 1 ? 'diagnosticUnit' : point.level === 3 ? 'learningUnit' : 'topicCard',
        selected: point.id === selectedId, visible: true, labelPlacement: 'inside',
      }));
      if (point.parentId && nodes.some((node) => node.id === point.parentId)) {
        edges.push(graphAssociationEdge(point.parentId, point.id, problemTone(point.category), true, 1.35, false, { sourceHandle: 'rs', targetHandle: 'lt' }));
      }
    };
    if (!root) {
      problemGraph.filter((node) => node.level === 1 && visibleIds.has(node.id)).forEach((point, index) => {
        add(point, getProblemOverviewCenters(false, false)[index]!.x, getProblemOverviewCenters(false, false)[index]!.y, `${problemGraph.filter((node) => node.parentId === point.id).length} 类问题`);
      });
    } else {
      const topics = problemGraph.filter((node) => node.parentId === root.id && matchesFilter(node));
      const leaves = topic ? problemGraph.filter((node) => node.parentId === topic.id && matchesFilter(node)) : [];
      const maxLeafCount = Math.max(0, ...topics.map((topic) => problemGraph.filter((point) => point.parentId === topic.id && matchesFilter(point)).length));
      const middle = Math.max(topics.length * 88, maxLeafCount * 80, 220) / 2 + 44;
      add(root, 120, middle, `${topics.length} 类问题`);
      topics.forEach((point, index) => add(point, 410, middle + (index - (topics.length - 1) / 2) * 88, `${problemGraph.filter((node) => node.parentId === point.id && matchesFilter(node)).length} 个典型问题`));
      leaves.forEach((point, index) => add(point, 700, middle + (index - (leaves.length - 1) / 2) * 80, ''));
    }
    return { nodes, edges };
  }, [selectedId, visibleIds, root, topic, disableRootFocus]);
  const breadcrumb: Array<{ id: string; label: string; onSelect?: () => void }> = [{ id: 'problem-all', label: '问题诊断总览', onSelect: () => onSelect('') }];
  if (root) breadcrumb.push({ id: root.id, label: root.name, onSelect: () => onSelect(root.id) });
  if (topic) breadcrumb.push({ id: topic.id, label: topic.name, onSelect: () => onSelect(topic.id) });
  if (selected?.level === 3) breadcrumb.push({ id: selected.id, label: selected.name });
  return (
    <div className={cn('flex min-h-0 flex-col gap-1', heightClassName)}>
      <GraphBreadcrumb items={breadcrumb} />
      <div className="min-h-0 flex-1">
        <GraphMapStage nodes={layout.nodes} edges={layout.edges} onSelect={onSelect} selectedId={selectedId}
          viewportKey={`problem:${root?.id || 'all'}:${topic?.id || 'root'}`} heightClassName="h-full" fitPadding={0.08} fitMaxZoom={1.1} emptyState={emptyState} />
      </div>
    </div>
  );
}

export function ProblemGraphView({
  workspace,
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
  workspace: GraphWorkspaceState;
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
  const isMobileFilterOpen = workspace.directoryOpen;
  const setIsMobileFilterOpen = workspace.setDirectory;
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileFilter = useCallback(() => setIsMobileFilterOpen(false), [setIsMobileFilterOpen]);
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
    () => isCanvasFocus && !usesConcreteProblemFilter
      ? getFocusedProblemNodeIds(selected?.id || '', visibleProblemIds)
      : visibleProblemIds,
    [isCanvasFocus, selected?.id, usesConcreteProblemFilter, visibleProblemIds],
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
    return roots.filter((root) => categoryFilter === 'all' || root.category === categoryFilter);
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
    // Presentation mode is independent from reading panels.
  }, [closeMobileFilter, isCanvasFocus]);

  return (
    <section
      id="graph-panel-problem"
      role="tabpanel"
      aria-labelledby="graph-tab-problem"
      data-graph-workspace="problem"
      data-canvas-focus={isCanvasFocus ? 'true' : 'false'}
      className={getGraphWorkspaceClassName(workspace.mode, isMobileFilterOpen, isInspectorOpen)}
    >
      {<GraphReadingPanel compact={workspace.mode === 'single'}
        open={workspace.directoryOpen}
        onClose={closeMobileFilter}
        triggerRef={mobileFilterTriggerRef}
        panelRef={mobileFilterPanelRef}
        id="problem-graph-filter"
        label="问题类型与难度筛选"
        labelId="problem-graph-filter-title"
        backdropLabel="关闭问题筛选遮罩"
        className="kg-scrollbar"
      >
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200/65">问题筛选</div>
            <div id="problem-graph-filter-title" className="mt-0.5 text-xs font-semibold text-slate-100">问题类型与难度</div>
          </div>
          <button
            type="button"
            aria-label="收起问题筛选"
            data-drawer-initial-focus="true"
            onClick={closeMobileFilter}
            className="grid min-h-11 min-w-11 place-items-center rounded-md border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between px-2 font-mono text-xs uppercase tracking-[0.1em] text-slate-500">
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
                  'min-h-11 w-full rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  categoryFilter === root.category || selected?.id === root.id ? meta.tone : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{root.name}</span>
                  <span className="ml-auto font-mono text-xs opacity-70">{count}</span>
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
                'min-h-11 rounded-md border p-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                difficultyTone[difficulty],
                difficultyFilter !== 'all' && difficultyFilter !== difficulty && 'opacity-35 grayscale',
              )}
            >
              <div className="font-mono text-lg">{problemGraphStats.byDifficulty[difficulty]}</div>
              <div className="text-xs opacity-75">{difficultyLabel[difficulty]}</div>
            </button>
          ))}
        </div>
      </GraphReadingPanel>}

      <section hidden={workspace.mode === 'single' && (isMobileFilterOpen || isInspectorOpen)} className="kg-canvas-column min-w-0 space-y-3">
        <div className="glass-hover overflow-hidden rounded-md border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)] transition-all">
          <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="chip-mark mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md">
                <AlertTriangle className="h-4 w-4 text-cyan-100" />
              </div>
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200/75">
                <span>
                  诊断结构 · {usesConcreteProblemFilter
                    ? `${filteredProblems.length} 条匹配`
                    : `${canvasProblemNodeCount} 个节点`}
                </span>
                {isSearchPending && <span role="status" className="text-cyan-200/80">搜索中…</span>}
                {selected && (
                  <span className="max-w-[260px] truncate rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] px-2 py-0.5 text-cyan-100/85" aria-live="polite">
                    当前 · {selected.name}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">问题诊断图谱</h2>
              <p className="mt-1 text-xs text-slate-400">先定位问题域与问题类型，再展开具体症状；连线仅表示分类归属，不表示因果关系。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={mobileFilterTriggerRef}
                type="button"
                aria-expanded={isMobileFilterOpen}
                aria-controls="problem-graph-filter"
                aria-haspopup={undefined}
                aria-label="展开问题筛选"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/20 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-cyan-200/25 hover:bg-cyan-200/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
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
                ref={mobileInspectorTriggerRef}
                type="button"
                aria-expanded={isInspectorOpen}
                aria-controls="problem-graph-inspector"
                aria-haspopup={undefined}
                onClick={onToggleInspector}
                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', isInspectorOpen ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}
              >
                {isInspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
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
              if (!id) { resetFilters(); return; }
              onSelect(id);
              if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) onToggleInspector();
            }}
            heightClassName={isCanvasFocus
              ? showLegend
                ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                : 'h-[max(520px,calc(100dvh-180px))]'
              : selected
                ? 'h-[600px] sm:h-[max(520px,calc(100dvh-270px))]'
                : 'h-[520px] sm:h-[max(520px,calc(100dvh-270px))]'}
            emptyState={contextualProblemNodes.length === 0 ? {
              title: '没有匹配的问题节点',
              description: '请调整错误现象、原因、解法关键词，或清除当前类型与难度筛选。',
              actionLabel: '清除筛选',
              onAction: resetFilters,
            } : undefined}
          />
        </div>

        <div className="glass-hover rounded-md border border-white/[0.08] bg-[#0b1118]/94 p-4 transition-all">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Target className="h-4 w-4 text-cyan-200" />
              {usesConcreteProblemFilter
                ? '搜索命中'
                : activeProblemDomainId
                  ? '当前类型的具体问题'
                  : activeProblemRootId
                    ? '当前问题域下的类型'
                    : '问题域入口'}
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
                <span className="ml-1.5 font-mono text-[11px] opacity-55">L{node.level}</span>
              </button>
            ))}
            {contextualProblemNodes.length === 0 && (
              <div className="w-full rounded-md border border-dashed border-white/[0.1] px-3 py-5 text-center text-xs text-slate-500">
                <p>未找到匹配问题。请尝试错误现象、原因或解法关键词。</p>
                <button type="button" onClick={resetFilters} className="mt-2 min-h-11 font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  清除筛选
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {isInspectorOpen && <GraphReadingPanel compact={workspace.mode === 'single'}
        open={isInspectorOpen}
        onClose={onToggleInspector}
        triggerRef={mobileInspectorTriggerRef}
        panelRef={mobileInspectorPanelRef}
        id="problem-graph-inspector"
        label="问题详情"
        labelId="problem-graph-inspector-title"
        backdropLabel="关闭问题详情遮罩"
        closeOnDesktop={false}
        className="kg-inspector space-y-3"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <span id="problem-graph-inspector-title" className="text-xs font-semibold text-slate-100">问题详情</span>
          <button type="button" data-drawer-initial-focus="true" onClick={onToggleInspector} aria-label="关闭问题详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="glass-hover rounded-md border border-white/[0.08] bg-[#0b1118]/95 transition-all">
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
                    <span className="text-xs font-normal text-slate-500">点击回到专业知识图谱</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenKnowledgePoint(id)}
                        className="min-h-11 rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        KP {id} <ArrowRight className="ml-1 inline h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {remediationPlan && (
                <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.045] p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-emerald-50">建议补弱闭环</div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">按顺序完成，每一步都在正式学习页面形成对应结果。</p>
                    </div>
                  </div>

                  <ol className="mt-4 space-y-2">
                    {remediationPlan.actions.map((action, index) => (
                      <li key={action.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-md border border-white/[0.07] bg-black/20 p-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] font-mono text-xs text-emerald-100">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100">{action.title}</div>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{action.purpose}</p>
                          {action.id === 'review' && action.knowledgePointId ? (
                            <button
                              type="button"
                              onClick={() => onOpenKnowledgePoint(action.knowledgePointId!)}
                              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-3 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                            >
                              开始补学 <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <Link
                              href={action.href}
                              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-3 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                            >
                              进入该步骤 <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-3 rounded-md border border-white/[0.07] bg-black/20 p-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-200/80">完成判定</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{remediationPlan.completionRule}</p>
                  </div>
                  <div role="note" className="mt-2 rounded-md border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-50/75">
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
                        <span className="min-w-0 flex-1 break-words leading-snug">{node.name}</span>
                        <span className="font-mono text-xs text-slate-600">L{node.level}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </GraphReadingPanel>}
    </section>
  );
}

function IdeologicalGraphCanvas({
  selectedId, visibleIds, onSelect, chapterFilter, disableRootFocus = false,
  teachingFocus: _teachingFocus = false, heightClassName = 'h-[clamp(420px,calc(100vh-292px),720px)]', emptyState,
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
  const selected = ideologicalNodes.find((node) => node.id === selectedId);
  const root = selected?.level === 1 ? selected : ideologicalNodes.find((node) => node.id === selected?.parentId);
  const layout = useMemo(() => {
    const nodes: RFNode[] = [];
    const edges: RFEdge[] = [];
    const matchesFilter = (point: IdeologicalNode): boolean => !disableRootFocus || visibleIds.has(point.id);
    const add = (point: IdeologicalNode, x: number, y: number, subtitle: string): void => {
      if (!matchesFilter(point)) return;
      nodes.push(createMapNode(point.id, x, y, {
        label: point.name, subtitle, tone: ideologicalTone(point.category), size: point.level === 1 ? 'thematicUnit' : 'topicCard',
        selected: point.id === selectedId, visible: true, labelPlacement: 'inside',
      }));
      if (point.parentId && nodes.some((node) => node.id === point.parentId)) edges.push(graphAssociationEdge(point.parentId, point.id, ideologicalTone(point.category), true, 1.35, false, { sourceHandle: 'rs', targetHandle: 'lt' }));
    };
    if (!root) {
      ideologicalNodes.filter((node) => node.level === 1 && visibleIds.has(node.id)).forEach((point, index) => {
        add(point, 140 + (index % 2) * 300, 100 + Math.floor(index / 2) * 120, `${ideologicalNodes.filter((node) => node.parentId === point.id).length} 个育人元素`);
      });
    } else {
      const children = ideologicalNodes.filter((node) => node.parentId === root.id && matchesFilter(node));
      const middle = Math.max(children.length * 104, 220) / 2 + 44;
      add(root, 140, middle, `${children.length} 个育人元素`);
      children.forEach((point, index) => add(point, 440, middle + (index - (children.length - 1) / 2) * 104, ''));
    }
    return { nodes, edges };
  }, [selectedId, visibleIds, root, chapterFilter, disableRootFocus]);
  const breadcrumb: Array<{ id: string; label: string; onSelect?: () => void }> = [{ id: 'sip-all', label: '育人主题总览', onSelect: () => onSelect('') }];
  if (root) breadcrumb.push({ id: root.id, label: root.name, onSelect: () => onSelect(root.id) });
  if (selected?.level === 2) breadcrumb.push({ id: selected.id, label: selected.name });
  return (
    <div className={cn('flex min-h-0 flex-col gap-1', heightClassName)}>
      <GraphBreadcrumb items={breadcrumb} />
      <div className="min-h-0 flex-1">
        <GraphMapStage nodes={layout.nodes} edges={layout.edges} onSelect={onSelect} selectedId={selectedId}
          viewportKey={`ideological:${chapterFilter}:${root?.id || 'all'}`} heightClassName="h-full" fitPadding={0.08} fitMaxZoom={1.1} emptyState={emptyState} />
      </div>
    </div>
  );
}

function IdeologicalGraphView({
  workspace,
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
  workspace: GraphWorkspaceState;
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
  const isMobileFilterOpen = workspace.directoryOpen;
  const setIsMobileFilterOpen = workspace.setDirectory;
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileFilter = useCallback(() => setIsMobileFilterOpen(false), [setIsMobileFilterOpen]);
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
    if (!isInspectorOpen) onToggleInspector();
  };

  useEffect(() => {
    if (!activeMappingWeek || !selected) return;
    const mapping = sipMappings.find((item) => item.weekRange === activeMappingWeek);
    if (mapping && !mapping.ideologicalNodeIds.includes(selected.id)) setActiveMappingWeek(null);
  }, [activeMappingWeek, selected]);

  useEffect(() => {
    // Presentation mode is independent from reading panels.
  }, [closeMobileFilter, isCanvasFocus]);

  return (
    <section
      id="graph-panel-ideological"
      role="tabpanel"
      aria-labelledby="graph-tab-ideological"
      data-graph-workspace="ideological"
      data-canvas-focus={isCanvasFocus ? 'true' : 'false'}
      className={getGraphWorkspaceClassName(workspace.mode, isMobileFilterOpen, isInspectorOpen)}
    >
      {<GraphReadingPanel compact={workspace.mode === 'single'}
        open={workspace.directoryOpen}
        onClose={closeMobileFilter}
        triggerRef={mobileFilterTriggerRef}
        panelRef={mobileFilterPanelRef}
        id="ideological-graph-filter"
        label="育人主题与平台单元筛选"
        labelId="ideological-graph-filter-title"
        backdropLabel="关闭育人主题筛选遮罩"
        className="kg-scrollbar"
      >
        <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200/65">主题筛选</div>
            <div id="ideological-graph-filter-title" className="mt-0.5 text-xs font-semibold text-slate-100">育人主题与平台单元</div>
          </div>
          <button
            type="button"
            aria-label="收起育人主题筛选"
            data-drawer-initial-focus="true"
            onClick={closeMobileFilter}
            className="grid min-h-11 min-w-11 place-items-center rounded-md border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between px-2 font-mono text-xs uppercase tracking-[0.1em] text-slate-500">
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
                  'min-h-11 w-full rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  categoryFilter === root.category || selected?.id === root.id ? 'text-slate-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
                )}
                style={categoryFilter === root.category || selected?.id === root.id ? { borderColor: `${meta.color}66`, backgroundColor: `${meta.color}18` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  <span className="text-sm font-semibold">{root.name}</span>
                  <span className="ml-auto font-mono text-xs opacity-70">{count}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 opacity-75">{root.description}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 px-2 font-mono text-xs uppercase tracking-[0.1em] text-slate-500">按明确周次定位</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          <button
            type="button"
            aria-pressed={chapterFilter === 'all'}
            onClick={() => {
              onChapterFilterChange('all');
              setIsMobileFilterOpen(false);
            }}
            className={cn('col-span-2 min-h-11 rounded-md border px-2 font-mono text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', chapterFilter === 'all' ? 'border-cyan-200/30 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:text-slate-200')}
          >
            全部
          </button>
          {ideologicalGraphStats.chaptersWithSip.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`平台单元 ${value}`}
              aria-pressed={chapterFilter === value}
              onClick={() => {
                onChapterFilterChange(chapterFilter === value ? 'all' : value);
                setIsMobileFilterOpen(false);
              }}
              className={cn('min-h-11 rounded-md border font-mono text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', chapterFilter === value ? 'border-cyan-200/30 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-500 hover:text-slate-200')}
            >
              U{value}
            </button>
          ))}
        </div>
      </GraphReadingPanel>}

      <section hidden={workspace.mode === 'single' && (isMobileFilterOpen || isInspectorOpen)} className="kg-canvas-column min-w-0 space-y-3">
        <div className="glass-hover overflow-hidden rounded-md border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)] transition-all">
          <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="chip-mark mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md">
                <Flag className="h-4 w-4 text-cyan-100" />
              </div>
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200/75">
                <span>
                  育人映射 · {usesCrossThemeFilter
                    ? `${filteredNodes.length} 条匹配`
                    : `${canvasIdeologicalNodeCount} 个节点`} · {filteredMappings.length} 条周次
                </span>
                {isSearchPending && <span role="status" className="text-cyan-200/80">搜索中…</span>}
                {selected && (
                  <span className="max-w-[260px] truncate rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] px-2 py-0.5 text-cyan-100/85" aria-live="polite">
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
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/20 px-2.5 text-[11px] font-medium text-slate-400 transition hover:border-cyan-200/25 hover:bg-cyan-200/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <Menu className="h-3.5 w-3.5" />筛选
              </button>
              <button type="button" aria-expanded={showLegend} aria-controls="ideological-graph-legend" onClick={onToggleLegend} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', showLegend ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
                <ListTree className="h-3.5 w-3.5" />图例与操作
              </button>
              <button ref={mobileInspectorTriggerRef} type="button" aria-expanded={isInspectorOpen} aria-controls="ideological-graph-inspector" aria-haspopup={undefined} onClick={onToggleInspector} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200', isInspectorOpen ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
                {isInspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
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
              if (!id) { resetFilters(); return; }
              onSelect(id);
              if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) onToggleInspector();
            }}
            chapterFilter={chapterFilter}
            heightClassName={isCanvasFocus
              ? showLegend
                ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                : 'h-[max(520px,calc(100dvh-180px))]'
              : selected
                ? 'h-[520px] sm:h-[max(520px,calc(100dvh-270px))]'
                : 'h-[520px] sm:h-[max(520px,calc(100dvh-270px))]'}
            emptyState={filteredNodes.length === 0 && filteredMappings.length === 0 ? {
              title: '没有匹配的育人主题',
              description: '请调整周次、案例或价值主题关键词，或清除当前主题与平台单元筛选。',
              actionLabel: '清除筛选',
              onAction: resetFilters,
            } : undefined}
          />
        </div>

        <div className="glass-hover rounded-md border border-white/[0.08] bg-[#0b1118]/94 p-4 transition-all">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <BookOpen className="h-4 w-4 text-cyan-200" />
              周次映射轨迹
            </div>
            <span className="font-mono text-xs text-slate-500">{filteredMappings.length}/{sipMappings.length}</span>
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
              <div className="w-full rounded-md border border-dashed border-white/[0.1] px-3 py-5 text-center text-xs text-slate-500">
                <p>未找到匹配主题。请尝试周次、案例或价值主题关键词。</p>
                <button type="button" onClick={resetFilters} className="mt-2 min-h-11 font-medium text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                  清除筛选
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {isInspectorOpen && <GraphReadingPanel compact={workspace.mode === 'single'}
        open={isInspectorOpen}
        onClose={onToggleInspector}
        triggerRef={mobileInspectorTriggerRef}
        panelRef={mobileInspectorPanelRef}
        id="ideological-graph-inspector"
        label="育人主题详情"
        labelId="ideological-graph-inspector-title"
        backdropLabel="关闭育人主题详情遮罩"
        closeOnDesktop={false}
        className="kg-inspector space-y-3"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <span id="ideological-graph-inspector-title" className="text-xs font-semibold text-slate-100">育人主题详情</span>
          <button type="button" data-drawer-initial-focus="true" onClick={onToggleInspector} aria-label="关闭育人主题详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        {activeMapping && (
          <div id="ideological-week-detail" className="glass-hover rounded-md border border-cyan-300/20 bg-[#0b1118]/95 p-4 transition-all">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-1 font-mono text-xs text-cyan-100">{activeMapping.weekRange}</span>
              <span className="font-mono text-xs text-slate-500">KP {activeMapping.knowledgePointId}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-50">{activeMapping.knowledgePointName} · {activeMapping.ideologicalTheme}</h2>
            <div className="mt-3 rounded-md border border-white/[0.08] bg-black/20 p-3">
              <div className="text-xs font-semibold text-cyan-100">本周课堂判断</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-300">{activeMapping.ideologicalContent}</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                <div className="text-xs font-semibold text-slate-100">教学动作</div>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{activeMapping.teachingMethod}</p>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
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
                        'min-h-11 rounded-md border px-2.5 py-1 text-left text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
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
        <div className="glass-hover rounded-md border border-white/[0.08] bg-[#0b1118]/95 transition-all">
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
                  <div className="text-xs text-slate-500">内容关联平台单元</div>
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
                      <span key={`${mapping.weekRange}-${mapping.knowledgePointId}`} className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-xs text-slate-300">
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
                    <span className="text-xs font-normal text-slate-500">点击回到专业知识图谱</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.relatedKnowledgePoints.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenKnowledgePoint(id)}
                        className="min-h-11 rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1 font-mono text-[11px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
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
                        className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        <span className="min-w-0 flex-1 break-words leading-snug">{node.name}</span>
                        <span className="font-mono text-xs text-slate-600">CH {node.relatedChapters.join('/')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="glass-hover rounded-md border border-white/[0.08] bg-[#0b1118]/95 p-4 transition-all">
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
              <div className="text-xs text-slate-500">覆盖平台单元</div>
            </div>
          </div>
        </div>
      </GraphReadingPanel>}
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
  const presencePoint = view === 'knowledge'
    ? knowledgePoints.find((point) => point.id === selectedId) ?? null
    : null;
  useLearningPresence('section', user?.role === 'STUDENT' && presencePoint ? {
    eventType: 'SECTION_VISIT',
    targetType: 'KNOWLEDGE_POINT',
    targetId: presencePoint.id,
    chapterId: String(presencePoint.chapter),
    moduleId: 'knowledge-graph',
    metadata: {
      source: 'knowledge-graph',
      route: '/knowledge-graph',
      sectionId: presencePoint.id,
      knowledgePointId: presencePoint.id,
    },
  } : null);
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
  const [masteryById, setMasteryById] = useState<Record<string, GraphNodeMastery>>({});
  const [diagnosticNote, setDiagnosticNote] = useState<string | null>(null);
  const [latestAssessmentSnapshot, setLatestAssessmentSnapshot] = useState<NextStepSnapshot | null | undefined>(undefined);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [isCanvasFocus, setIsCanvasFocus] = useState(false);
  const [presentationStep, setPresentationStep] = useState(0);
  const workspace = useGraphWorkspace(workbenchRef, !kgLoading, isCanvasFocus);
  const isDrawerViewport = workspace.mode === 'single';
  const isMobileSidebarOpen = workspace.directoryOpen;
  const setIsMobileSidebarOpen = workspace.setDirectory;
  const mobileSidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarPanelRef = useRef<HTMLElement>(null);
  const mobileInspectorTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileInspectorPanelRef = useRef<HTMLElement>(null);
  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), [setIsMobileSidebarOpen]);
  const isInspectorOpen = workspace.inspectorOpen;
  const setIsInspectorOpen = workspace.setInspector;
  const [dependencyDetail, setDependencyDetail] = useState<ReactNode>(null);
  const [showLegend, setShowLegend] = useState(false);
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

  // Color the graph from the same diagnostic receipt as 薄弱点. A later chapter
  // quiz must not put the page back into the empty "先做一次诊断测验" state.
  useEffect(() => {
    if (knowledgePoints.length === 0) return;
    let active = true;
    const controller = new AbortController();
    const pointRefs = knowledgePoints.map((point) => ({ id: point.id, parentId: point.parentId }));
    async function loadScores(): Promise<void> {
      if (typeof window === 'undefined') return;
      let view = graphViewFromAttempt(null, pointRefs);
      const token = getStoredAccessToken();
      let serverAnswered = false;
      if (user && token) {
        try {
          const response = await fetchClientRequest(diagnosticActivitiesQuery(), {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }, 6_000);
          if (response.ok) {
            const rawResponse: unknown = await response.json();
            const parsedResponse = activityResponseSchema.safeParse(rawResponse);
            if (parsedResponse.success) {
              serverAnswered = true;
              const activities = parsedResponse.data.activities ?? parsedResponse.data.data ?? [];
              view = resolveGraphMasteryFromActivities(activities, pointRefs);
            }
          }
        } catch {
          // A local receipt is only a fallback when the service is unavailable.
        }
      }

      if (!view.attempt && !serverAnswered) {
        try {
          const key = user ? `assessment-results-${user.id}` : 'assessment-results';
          const stored = localStorage.getItem(key);
          if (stored) view = graphViewFromAttempt(diagnosticAttemptFromLocalReceipt(stored), pointRefs, 'local');
        } catch {
          view = graphViewFromAttempt(null, pointRefs);
        }
      }

      if (!active) return;
      setMasteryById(view.masteryById);
      setDiagnosticNote(view.sourceLabel);
      setLatestAssessmentSnapshot(view.snapshot);
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

  const captureGraphContext = () => ({
    view, selectedId, selectedProblemId, selectedIdeologicalId, chapter, query,
    problemCategoryFilter, problemDifficultyFilter, ideologicalCategoryFilter,
    ideologicalChapterFilter, directoryOpen: isMobileSidebarOpen, inspectorOpen: isInspectorOpen,
    label: view === 'knowledge' ? selected?.name || '课程总览'
      : view === 'problem' ? problemGraph.find((item) => item.id === selectedProblemId)?.name || '问题总览'
        : ideologicalNodes.find((item) => item.id === selectedIdeologicalId)?.name || '育人总览',
  });
  const [returnContexts, setReturnContexts] = useState<Array<ReturnType<typeof captureGraphContext>>>([]);
  const rememberSource = () => setReturnContexts((items) => [...items, captureGraphContext()]);
  const returnToSource = () => {
    const previous = returnContexts[returnContexts.length - 1];
    if (!previous) return;
    setReturnContexts((items) => items.slice(0, -1));
    setView(previous.view); setChapter(previous.chapter); setQuery(previous.query); setUrlQuery(previous.query);
    setSelectedId(previous.selectedId); setSelectedProblemId(previous.selectedProblemId); setSelectedIdeologicalId(previous.selectedIdeologicalId);
    setProblemCategoryFilter(previous.problemCategoryFilter); setProblemDifficultyFilter(previous.problemDifficultyFilter);
    setIdeologicalCategoryFilter(previous.ideologicalCategoryFilter); setIdeologicalChapterFilter(previous.ideologicalChapterFilter);
    setDependencyDetail(null);
    workspace.setDirectory(previous.directoryOpen); workspace.setInspector(previous.inspectorOpen);
  };

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
    setDependencyDetail(null);
    setQuery(''); setUrlQuery('');
    setSelectedId(id);
    setChapter(target.chapter);
    replaceSelectedNodeInUrl('knowledge', id, target.chapter);
    if (shouldAutoOpenGraphInspector(isCanvasFocus, isInspectorOpen)) setIsInspectorOpen(true);
  };

  const selectProblemNode = (id: string): void => {
    if (!id) { setSelectedProblemId(''); setIsInspectorOpen(false); return; }
    if (!problemGraph.some((node) => node.id === id)) return;
    setSelectedProblemId(id);
    replaceSelectedNodeInUrl('problem', id);
  };

  const selectIdeologicalNode = (id: string): void => {
    if (!id) { setSelectedIdeologicalId(''); setIsInspectorOpen(false); return; }
    if (!ideologicalNodes.some((node) => node.id === id)) return;
    setSelectedIdeologicalId(id);
    replaceSelectedNodeInUrl('ideological', id);
  };

  const revealInspector = useCallback(() => {
    setIsInspectorOpen(true);
  }, [setIsInspectorOpen]);

  const focusChapter = (value: number) => {
    if (isAddressingTaskContext && value !== 3) return;
    setDependencyDetail(null);
    setChapter(value);
    const nextSelectedId = resolveChapterSelection(knowledgePoints, value, selectedId);
    if (nextSelectedId) setSelectedId(nextSelectedId);
  };

  const openKnowledgePoint = (id: string): void => {
    const target = pointById[id] || knowledgePoints.find((point) => point.id.startsWith(`${id}.`));
    if (!target) return;
    if (isAddressingTaskContext && target.id !== '3.1' && !target.id.startsWith('3.1.')) return;
    if (view !== 'knowledge') rememberSource();
    setDependencyDetail(null);
    setView('knowledge');
    setSelectedId(target.id);
    setChapter(target.chapter);
    setQuery('');
    setIsInspectorOpen(true);
  };

  const openProblemNode = (id: string): void => {
    if (isAddressingTaskContext) return;
    const target = problemGraph.find((node) => node.id === id);
    if (!target) return;
    if (view !== 'problem') rememberSource();
    setDependencyDetail(null);
    setView('problem');
    setSelectedProblemId(target.id);
    setProblemCategoryFilter(target.category);
    setProblemDifficultyFilter('all');
    setQuery('');
    setIsInspectorOpen(true);
  };

  const openIdeologicalNode = (id: string): void => {
    if (isAddressingTaskContext) return;
    const target = ideologicalNodes.find((node) => node.id === id);
    if (!target) return;
    if (view !== 'ideological') rememberSource();
    setDependencyDetail(null);
    setView('ideological');
    setSelectedIdeologicalId(target.id);
    setIdeologicalCategoryFilter(target.category);
    setIdeologicalChapterFilter('all');
    setQuery('');
    setIsInspectorOpen(true);
  };

  const runPresentationStep = (nextStep: number): void => {
    const boundedStep = Math.max(0, Math.min(graphPresentationSteps.length - 1, nextStep));
    setPresentationStep(boundedStep);
    setQuery('');
    setUrlQuery('');
    setDependencyDetail(null);
    workspace.setDirectory(false);

    const showKnowledgePoint = (id: string, inspectorOpen: boolean): void => {
      const target = pointById[id];
      if (!target) return;
      setView('knowledge');
      setChapter(target.chapter);
      setSelectedId(id);
      setIsInspectorOpen(inspectorOpen);
      replaceSelectedNodeInUrl('knowledge', id, target.chapter);
    };

    if (boundedStep === 0) {
      setView('knowledge');
      setChapter('all');
      setSelectedId('');
      setIsInspectorOpen(false);
      setReturnContexts([]);
      return;
    }
    if (boundedStep === 1) {
      showKnowledgePoint('3', false);
      return;
    }
    if (boundedStep === 2) {
      showKnowledgePoint('3.1', false);
      return;
    }
    if (boundedStep === 3) {
      showKnowledgePoint('3.1', true);
      return;
    }
    if (boundedStep === 4) {
      showKnowledgePoint('3.1.2', true);
      return;
    }
    if (boundedStep === 5) {
      openProblemNode('P1.2.1');
      return;
    }
    if (returnContexts.length > 0) returnToSource();
    else showKnowledgePoint('3.1.2', true);
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
      else if (isInspectorOpen) setIsInspectorOpen(false);
      else if (isCanvasFocus) setIsCanvasFocus(false);
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
    const current = pointById[selectedId];
    const topicId = current?.level === 2 ? current.id : current?.level === 3 ? current.parentId : null;
    return filteredList.filter((point) => point.level <= 2 || point.parentId === topicId);
  }, [chapter, deferredQuery, filteredList, pointById, selectedId]);
  const navigatorIndex = navigatorList.findIndex((point) => point.id === selectedId);
  const previousNavigatorPoint = navigatorIndex > 0 ? navigatorList[navigatorIndex - 1] : null;
  const nextNavigatorPoint = navigatorIndex >= 0 && navigatorIndex < navigatorList.length - 1
    ? navigatorList[navigatorIndex + 1]
    : null;
  const selectedPathLabel = useMemo(() => {
    if (!selected) return '课程总览';
    const items: string[] = [selected.name];
    let parentId = selected.parentId;
    while (parentId) {
      const parent = pointById[parentId];
      if (!parent) break;
      items.unshift(parent.name);
      parentId = parent.parentId;
    }
    return items.join(' › ');
  }, [pointById, selected]);
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
    if (isExternalSearchPending || query !== deferredQuery) return;
    if (!deferredQuery.trim() && chapter === 'all' && !selectedId) return;
    if (filteredList.some((point) => point.id === selectedId)) return;
    const nextId = filteredList[0]?.id || '';
    if (nextId !== selectedId) setSelectedId(nextId);
  }, [chapter, query, deferredQuery, filteredList, isExternalSearchPending, selectedId]);

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
    setReturnContexts([]);
    setDependencyDetail(null);
    setView(nextView);
    setQuery('');
    setIsMobileSidebarOpen(false);
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
          { value: ideologicalGraphStats.chaptersWithSip.length, label: '覆盖平台单元' },
        ]
      : [
          { value: knowledgePoints.length, label: '知识节点' },
          { value: relationCounts.deps, label: '先修依赖' },
          { value: relationCounts.expLinks, label: '实践关联' },
        ];

  if (kgLoading) {
    return (
      <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center overflow-hidden rounded-md border border-border bg-background" role="status" aria-live="polite">
        <div className="pointer-events-none absolute inset-0 circuit-grid opacity-40" aria-hidden />
        <div className="relative flex flex-col items-center px-6 text-center">
          <div className="absolute h-36 w-36 animate-pulse rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="chip-mark relative grid h-14 w-14 place-items-center rounded-md text-cyan-100">
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
      aria-label={isCanvasFocus ? `${activeGraphMeta.label}图谱演示模式` : undefined}
      tabIndex={isCanvasFocus ? -1 : undefined}
      className={cn(
        'kg-workbench relative m-0 min-h-[calc(100dvh-8rem)] min-w-0 rounded-md border border-border bg-background text-foreground',
        isCanvasFocus
          ? 'fixed inset-0 z-[80] h-dvh min-h-0 overflow-y-auto overscroll-contain rounded-none border-0'
          : 'overflow-hidden',
      )}
      data-view={view}
      data-layout={workspace.mode}
      data-inspector={isInspectorOpen ? 'open' : 'closed'}
    >
      <style>{`
        .kg-workspace > [hidden] { display: none !important; }
        .kg-workbench .kg-map-stage { padding: 0; }
        .kg-reading-panel { max-height: calc(100dvh - 190px); overflow-y: auto; scrollbar-width: thin; }
        .kg-reading-panel[hidden] { display: none !important; }
        .kg-inspector p { font-size: 16px; line-height: 1.65; }
        .kg-inspector button { white-space: normal; }
        .kg-reading-panel summary { cursor: pointer; min-height: 44px; padding-block: 10px; }
        .kg-workbench[data-layout="single"] .kg-reading-panel { min-height: 420px; max-height: calc(100dvh - 150px); }
        .kg-workbench {
          --kg-accent: 103 232 249;
          --kg-accent-soft: 34 211 238;
          --kg-muted: #94a3b8;
          --kg-muted-subtle: #8796aa;
        }
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
        .kg-panel > div:first-child button { border-radius: calc(var(--radius) - 2px) !important; }
        html.kg-focus-active [data-variant="sidebar"],
        html.kg-focus-active [data-sidebar="sidebar"] {
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .kg-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(103,232,249,.25) transparent; }
        .kg-inspector { scrollbar-width: thin; scrollbar-color: rgba(103,232,249,.25) transparent; }
        .kg-header { container-type: inline-size; container-name: kg-header; }
        @container kg-header (min-width: 760px) {
          .kg-header-grid { grid-template-columns: minmax(180px, .7fr) minmax(400px, 1.3fr); align-items: center; }
          .kg-header-actions { grid-column: 1 / -1; justify-content: flex-end; }
        }
        @container kg-header (min-width: 1200px) {
          .kg-header-grid { grid-template-columns: minmax(180px, .7fr) minmax(430px, 1.15fr) auto; }
          .kg-header-actions { grid-column: auto; }
        }
        @media (prefers-reduced-motion: reduce) { .kg-workbench *, .kg-workbench *::before, .kg-workbench *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgb(var(--kg-accent-soft)/0.045),transparent)]" aria-hidden />

      <header className={cn('kg-header relative z-10 border-b border-border bg-background/95 px-3 backdrop-blur-xl sm:px-4', isCanvasFocus ? 'py-2' : 'py-2.5')}>
        <div className="kg-header-grid grid min-w-0 gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="chip-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <Network className="h-4 w-4 text-cyan-100" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] text-cyan-200/80">
                  <span>教学分析图谱</span>
                  <span
                    role="status"
                    title={kgDataNote}
                    className={cn(
                      'truncate rounded border px-1.5 py-0.5 text-xs tracking-normal',
                      kgDataSource === 'client-fallback'
                        ? 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100'
                        : 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100',
                    )}
                  >
                    {kgDataSource === 'db' ? '服务端数据' : kgDataSource === 'server-static' ? '内置基线' : '内置回退'}
                  </span>
                </div>
                <h1 className="heading-gradient mt-0.5 truncate text-lg font-semibold leading-tight">{activeGraphMeta.label}图谱</h1>
              </div>
            </div>
            <div className="mt-1.5 hidden flex-wrap items-center gap-1 font-mono text-xs text-slate-400 sm:flex">
              {activeHeaderStats.map((stat) => (
                <span key={stat.label} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5">
                  <b className="text-[11px] font-semibold text-slate-50">{stat.value}</b> {stat.label}
                </span>
              ))}
            </div>
          </div>

          <nav className="grid grid-cols-3 gap-1 rounded-md border border-border bg-black/30 p-1 sm:gap-1" aria-label="图谱类型" role="tablist">
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
                  <span className={cn('hidden font-mono text-[11px] tracking-[0.12em] sm:inline', view === item.id ? tone.icon : 'text-slate-600')}>{tone.index}</span>
                  <Icon className={cn('h-[17px] w-[17px] shrink-0', view === item.id ? tone.icon : 'text-slate-500 group-hover:text-slate-300')} />
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-xs font-semibold sm:text-sm">{item.label} <span className="ml-1 hidden font-mono text-[11px] opacity-60 md:inline">{item.count}</span></span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="kg-header-actions flex min-w-0 shrink-0 flex-wrap items-center gap-2 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>a]:shrink-0 [&>a]:whitespace-nowrap">
            <div className="relative w-full min-w-0 sm:w-48">
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
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-xs text-slate-400">/</kbd>
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
                setReturnContexts([]);
                setDependencyDetail(null);
                setIsInspectorOpen(isAddressingTaskContext);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              <RotateCcw className="h-4 w-4" />
              {isAddressingTaskContext ? '返回 3.1' : '重置'}
            </button>
            <button type="button" data-kg-focus-exit="true" aria-pressed={isCanvasFocus}
              aria-label={isCanvasFocus ? '退出演示模式' : '进入演示模式'}
              onClick={() => {
                if (isCanvasFocus) setIsCanvasFocus(false);
                else {
                  setIsCanvasFocus(true);
                  if (!isAddressingTaskContext) runPresentationStep(0);
                }
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-cyan-200/25 bg-cyan-200/[0.08] px-3 text-xs font-medium text-cyan-100">
              {isCanvasFocus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isCanvasFocus ? '退出演示' : '演示讲解'}
            </button>
            <Link href={isAddressingTaskContext ? '/tasks' : '/'} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {isAddressingTaskContext ? '返回任务' : '课程内容'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {returnContexts.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 pb-2 pt-1">
          {returnContexts.length > 0 && <button type="button" onClick={returnToSource} className="min-h-11 rounded-md border border-cyan-200/20 bg-cyan-200/[0.06] px-3 text-sm text-cyan-100">← 返回来源：{returnContexts[returnContexts.length - 1].label}</button>}
        </div>}
        {view === 'knowledge' && query.trim() && <div className="border-t border-white/10 py-2" aria-label="知识搜索结果">
          <div className="mb-2 text-xs text-slate-400">{isSearchPending ? '正在搜索…' : `${filteredList.length} 条匹配 · 选择结果进入对应位置`}</div>
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {filteredList.slice(0, 8).map((point) => <button key={point.id} type="button" onClick={() => goToPoint(point.id)}
              className="min-h-11 rounded-md border border-cyan-200/20 bg-cyan-200/[0.05] px-3 py-2 text-left text-sm text-cyan-100">
              {point.name}<span className="ml-2 text-xs text-slate-400">单元 {point.chapter} · {point.id}</span>
            </button>)}
            {filteredList.length > 8 && <button type="button" onClick={() => workspace.setDirectory(true)} className="min-h-11 px-3 text-sm text-cyan-100">查看全部结果</button>}
            {!isSearchPending && filteredList.length === 0 && <span className="text-sm text-slate-300">没有匹配内容，请调整关键词。</span>}
          </div>
        </div>}
      </header>

      {isCanvasFocus && !isAddressingTaskContext && (
        <section className="relative z-10 border-b border-white/[0.08] bg-[#091017]/96 px-3 py-2.5 sm:px-4" aria-label="预设讲解路径">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-cyan-200">
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                预设讲解 · {presentationStep + 1} / {graphPresentationSteps.length}
              </div>
              <div className="mt-1 flex min-w-0 items-baseline gap-2">
                <strong className="truncate text-sm text-slate-50">{graphPresentationSteps[presentationStep].title}</strong>
                <span className="truncate text-xs text-slate-400">{graphPresentationSteps[presentationStep].detail}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="mr-1 hidden items-center gap-1.5 xl:flex" aria-hidden="true">
                {graphPresentationSteps.map((step, index) => (
                  <span key={step.title} className={cn('h-1.5 w-8 rounded-full', index <= presentationStep ? 'bg-cyan-300' : 'bg-white/[0.12]')} />
                ))}
              </div>
              <button type="button" disabled={presentationStep === 0} onClick={() => runPresentationStep(presentationStep - 1)} className="inline-flex min-h-11 items-center rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                ← 上一步
              </button>
              <button type="button" disabled={presentationStep === graphPresentationSteps.length - 1} onClick={() => runPresentationStep(presentationStep + 1)} className="inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-3 text-xs font-semibold text-[#001014] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
                下一步 →
              </button>
            </div>
          </div>
        </section>
      )}

      {view === 'knowledge' && activeTaskPathId && !isCanvasFocus && (
        <div className="relative z-10 min-h-[68px] px-4 pt-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cyan-200/20 bg-[#0a151b]/88 px-3 py-2.5 text-sm text-cyan-50 shadow-lg backdrop-blur" role="status">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-200/20 bg-cyan-200/[0.08] font-mono text-xs font-semibold text-cyan-100">
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
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-cyan-200/20 bg-cyan-200/[0.07] px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              返回我的任务
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {view === 'problem' ? (
        <ProblemGraphView
          workspace={workspace}
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
            if (isInspectorOpen) setIsInspectorOpen(false);
            else {
              setIsInspectorOpen(true);
            }
          }}
          onOpenKnowledgePoint={openKnowledgePoint}
        />
      ) : view === 'ideological' ? (
        <IdeologicalGraphView
          workspace={workspace}
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
            if (isInspectorOpen) setIsInspectorOpen(false);
            else {
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
        className={getGraphWorkspaceClassName(workspace.mode, isMobileSidebarOpen, isInspectorOpen)}
      >
        <GraphReadingPanel compact={workspace.mode === 'single'}
          open={workspace.directoryOpen}
          onClose={closeMobileSidebar}
          triggerRef={mobileSidebarTriggerRef}
          panelRef={mobileSidebarPanelRef}
          id="knowledge-graph-directory"
          label="知识点目录"
          labelId="knowledge-graph-directory-title"
          backdropLabel="关闭平台单元目录遮罩"
          className="kg-scrollbar"
      >
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200/65">目录导航</div>
              <span id="knowledge-graph-directory-title" className="mt-0.5 block text-xs font-semibold text-slate-100">平台单元与知识点</span>
            </div>
            <button
              type="button"
              aria-label="收起平台单元目录"
              data-drawer-initial-focus="true"
              onClick={closeMobileSidebar}
              className="grid min-h-11 min-w-11 place-items-center rounded-md border border-white/[0.08] bg-black/30 text-slate-300 hover:bg-white/[0.06]"
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
              全部平台单元
            </button>
            <div className="flex min-h-11 items-center justify-center rounded-md border border-white/[0.08] bg-black/20 px-2 py-2 text-center font-mono text-[11px] text-slate-400">
              目录 <span className="mx-1 text-slate-200">{navigatorList.length}</span> / {knowledgePoints.length}
            </div>
          </div>
          <div className="mb-3 rounded-md border border-cyan-200/12 bg-cyan-200/[0.035] px-3 py-2.5 text-[11px] leading-5 text-slate-400" role="note">
            {navigatorMode === 'task' && '当前任务仅开放 3.1 与七个子节点；逐项完成后返回任务页进入下一步。'}
            {navigatorMode === 'overview' && '先选平台单元建立课程位置；总览显示各单元，进入单元后逐层展开主题与知识点。'}
            {navigatorMode === 'chapter' && '当前按 L1 单元 → L2 主题 → L3 知识点排列；选择节点后核对层级、先修关系与实践入口。'}
            {navigatorMode === 'search' && `正在显示 ${navigatorList.length} 条匹配结果，并保留所属平台单元与上级位置。`}
          </div>
          <div className="mb-2 flex items-center justify-between px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">
            <span>{navigatorMode === 'task' ? '任务范围' : navigatorMode === 'overview' ? '单元入口' : navigatorMode === 'search' ? '搜索结果' : '单元层级'}</span>
            <span>{navigatorList.length} 项</span>
          </div>
          <div className="kg-scrollbar max-h-[min(660px,calc(100vh-350px))] space-y-1 overflow-y-auto pr-1">
            {navigatorList.map((point) => {
              const mastery = masteryById[point.id];
              const chapterProgress = mastery ? null : progressForChapter(progress, point.chapter);
              const parentPoint = point.parentId ? pointById[point.parentId] : null;
              const chapterCounts = childCountsByParent[point.id];
              return (
                <button
                  key={point.id}
                  type="button"
                  aria-expanded={point.level < 3 ? (point.level === 1 ? chapter === point.chapter : selectedId === point.id || selected?.parentId === point.id) : undefined}
                  onClick={() => {
                    // L1 即章节根：点击列表里的章节直接聚焦到该章单章树，
                    // 而不是只在原地高亮
                    if (point.level === 1) goToPoint(point.id);
                    else if (point.level === 2 && (selectedId === point.id || selected?.parentId === point.id)) goToPoint(point.parentId!);
                    else goToPoint(point.id);
                    if (workspace.mode === 'single') setIsMobileSidebarOpen(false);
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
                    <span className="block break-words leading-snug">{point.name}</span>
                    {navigatorMode === 'overview' && chapterCounts && (
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-600">单元 {point.chapter} · {chapterCounts.level2} 个主题 · {chapterCounts.level3} 点 · 点击进入</span>
                    )}
                    {navigatorMode === 'search' && (
                      <span className="mt-0.5 block line-clamp-1 font-mono text-[11px] text-slate-600">单元 {point.chapter}{parentPoint ? ` / ${parentPoint.name}` : ''}</span>
                    )}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 pt-0.5 font-mono text-xs text-slate-500">
                    {mastery && <span className={masteryTextClass(mastery.band)}>{graphMasteryLabel(mastery)}</span>}
                    {point.level === 1 && chapterProgress !== null && <span>{chapterProgress}%</span>}
                    <span>L{point.level}</span>
                  </span>
                </button>
              );
            })}
            {navigatorList.length === 0 && (
              <div className="rounded-md border border-dashed border-white/[0.1] bg-black/15 px-3 py-5 text-center">
                <Search className="mx-auto h-4 w-4 text-slate-600" />
                <p className="mt-2 text-xs text-slate-400">没有匹配的知识点</p>
                <button type="button" onClick={() => setQuery('')} className="mt-2 min-h-11 rounded-md px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">清除搜索</button>
              </div>
            )}
          </div>
        </GraphReadingPanel>

        <section hidden={workspace.mode === 'single' && (isMobileSidebarOpen || isInspectorOpen)} className="kg-canvas-column kg-panel min-w-0 overflow-hidden rounded-md border border-border bg-background shadow-[0_18px_54px_rgba(0,0,0,0.30)]">
          <div className="flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 lg:px-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <button
                ref={mobileSidebarTriggerRef}
                type="button"
                aria-label="打开层级阅读"
                aria-expanded={isMobileSidebarOpen}
                aria-controls="knowledge-graph-directory"
                aria-haspopup={undefined}
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.055] px-2.5 text-xs text-slate-200 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.10] hover:text-cyan-100"
              >
                <Menu className="h-4 w-4" />
                <span className="lg:hidden">层级</span>
              </button>
              <div className="chip-mark grid h-9 w-9 place-items-center rounded-md">
                <Network className="h-4 w-4 text-cyan-100" />
              </div>
              <div className="min-w-0" aria-live="polite">
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  {chapter === 'all' ? `课程总览 · ${levelCounts.l1} 个单元` : `平台单元 ${chapter} · 本单元 ${canvasKnowledgeNodeCount} 个节点`}
                  {isSearchPending
                    ? <span className="ml-1.5 text-cyan-200/70" role="status">· 搜索中…</span>
                    : deferredQuery.trim() && <span className="ml-1.5 text-cyan-200/70">· {filteredList.length} 条匹配</span>}
                </div>
                <div className="truncate text-base font-semibold text-slate-50">
                  {selected ? selected.name : chapter === 'all' ? '十个平台单元总览' : `平台单元 ${chapter}`}
                  {selected && <span className="ml-2 font-mono text-[11px] font-normal text-cyan-200/70">#{selected.id}</span>}
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
                ref={mobileInspectorTriggerRef}
                type="button"
                aria-expanded={isInspectorOpen}
                aria-controls="kg-node-inspector"
                aria-haspopup={undefined}
                onClick={() => {
                  if (isInspectorOpen) setIsInspectorOpen(false);
                  else {
                    revealInspector();
                  }
                }}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                  isInspectorOpen ? 'border-cyan-200/25 bg-cyan-200/[0.09] text-cyan-50' : 'border-white/[0.08] bg-black/20 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100',
                )}
              >
                {isInspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                节点详情
              </button>
            </div>
          </div>
          {diagnosticNote && (
            <p className="border-b border-white/[0.06] bg-black/10 px-4 py-1.5 text-[11px] leading-5 text-slate-300" role="status">
              图谱上色依据：{diagnosticNote}
            </p>
          )}
          {workspace.mode === 'single' && (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0a0f15]/96 px-3 py-2 backdrop-blur" aria-label="手机节点导航">
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={selectedPathLabel}>当前位置：{selectedPathLabel}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={!previousNavigatorPoint} onClick={() => previousNavigatorPoint && goToPoint(previousNavigatorPoint.id)} className="min-h-11 rounded-md px-2.5 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">上一节点</button>
                <button type="button" disabled={!nextNavigatorPoint} onClick={() => nextNavigatorPoint && goToPoint(nextNavigatorPoint.id)} className="min-h-11 rounded-md px-2.5 text-xs text-cyan-100 hover:bg-cyan-300/[0.07] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">下一节点</button>
              </span>
            </div>
          )}
          {showLegend && (
            <div id="knowledge-graph-legend" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.08] bg-black/15 px-4 py-2.5 font-mono text-[11px] text-slate-300" role="note">
              <span className="text-slate-500">节点层级</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-cyan-300/65 bg-cyan-300/15" />L1 单元 {levelCounts.l1}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-cyan-300/45 bg-cyan-300/10" />L2 主题 {levelCounts.l2}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm border border-cyan-300/35 bg-cyan-300/[0.08]" />L3 知识单元 {levelCounts.l3}</span>
              <span className="h-3 w-px bg-white/10" aria-hidden />
              <span className="inline-flex items-center gap-1.5">
                <svg width="24" height="6" aria-hidden>
                  <defs>
                    <linearGradient id="kg-legend-dep" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#A87513" />
                      <stop offset="100%" stopColor="#A87513" />
                    </linearGradient>
                  </defs>
                  <line x1="1" y1="3" x2="19" y2="3" stroke="url(#kg-legend-dep)" strokeWidth="1.8" strokeDasharray="5 3" strokeLinecap="round" />
                  <path d="M18 0.5 23 3 18 5.5 Z" fill="#A87513" opacity="0.85" />
                </svg>
                先修依赖 · 指向后学内容
              </span>
              {chapter === 'all' && (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="24" height="6" aria-hidden><line x1="1" y1="3" x2="23" y2="3" stroke="#5B8FC7" strokeWidth="1.6" strokeDasharray="4 4" strokeLinecap="round" opacity="0.6" /></svg>
                  单元顺序 · 非先修
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg width="24" height="6" aria-hidden><line x1="1" y1="3" x2="23" y2="3" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.5" /></svg>
                层级归属 · 非先修
              </span>
                <span className="inline-flex items-center gap-1"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-[#1D8076]/55 bg-[#0a1c1a] text-[#5BA89F]"><FlaskConical className="h-2 w-2" /></span>实践入口</span>
              {Object.keys(masteryById).length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="text-slate-500">诊断掌握度</span>
                  <span className="text-emerald-200">● ≥80</span>
                  <span className="text-amber-200">● 60–79 · 含薄弱点</span>
                  <span className="text-red-200">● &lt;60 · 诊断薄弱</span>
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
            key="knowledge-canvas"
            className={cn(
              'animate-fade-in',
              isCanvasFocus
                ? showLegend
                  ? 'h-[clamp(320px,calc(100dvh-390px),560px)] sm:h-[clamp(360px,calc(100dvh-280px),680px)]'
                  : 'h-[max(520px,calc(100dvh-180px))]'
                : 'h-[560px] sm:h-[max(560px,calc(100dvh-270px))]',
            )}
          >
            <FullKnowledgeMap
              onReturnOverview={() => {
                setChapter('all');
                setSelectedId('');
                setQuery('');
                setUrlQuery('');
                setIsInspectorOpen(false);
                replaceSelectedNodeInUrl('knowledge', '');
              }}
              dependencyDetailVisible={dependencyDetail !== null && isInspectorOpen}
              onDependencyDetail={(content) => { setDependencyDetail(content); if (content) setIsInspectorOpen(true); }}
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
              masteryByKa={masteryById}
              experimentTitleByRefId={experimentTitleByRefId}
              onClearVisibility={() => setQuery('')}
              compactViewport={workspace.mode === 'single'}
            />
          </div>
        </section>

        {isInspectorOpen && (
        <GraphReadingPanel compact={workspace.mode === 'single'}
          open={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          triggerRef={mobileInspectorTriggerRef}
          panelRef={mobileInspectorPanelRef}
          id="kg-node-inspector"
          label="知识节点详情"
          labelId="kg-node-inspector-title"
          backdropLabel="关闭知识节点详情遮罩"
          closeOnDesktop={false}
          className="kg-inspector space-y-3"
      >
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
            <span id="kg-node-inspector-title" className="text-xs font-semibold text-slate-100">知识节点详情</span>
            <button type="button" data-drawer-initial-focus="true" onClick={() => setIsInspectorOpen(false)} aria-label="关闭知识节点详情" className="grid min-h-11 min-w-11 place-items-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          {dependencyDetail || <DetailPanel
            point={selected}
            childPoints={childPoints}
            pointById={pointById}
            experimentTitleByRefId={experimentTitleByRefId}
            onSelectId={goToPoint}
            onOpenProblemNode={openProblemNode}
            onOpenIdeologicalNode={openIdeologicalNode}
            allPoints={knowledgePoints}
          />}
          <div className="rounded-md border border-white/[0.09] bg-[#0b1118]/95 p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ListTree className="h-4 w-4 text-cyan-200" />
              {isAddressingTaskContext ? '本任务节点' : '同单元知识点'}
            </div>
            <div className="space-y-1">
              {siblings.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => goToPoint(point.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  <span className="min-w-0 flex-1 break-words leading-snug">{point.name}</span>
                  <span className="font-mono text-xs text-slate-600">L{point.level}</span>
                </button>
              ))}
              {siblings.length === 0 && <div className="text-xs text-slate-500">暂无同单元节点。</div>}
            </div>
          </div>
          <div className="rounded-md border border-white/[0.09] bg-[#0b1118]/95 p-4 shadow-xl">
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
                <div className="text-xs text-slate-500">平台单元</div>
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
                <div className="text-xs text-slate-500">先修依赖 · 跨单元 {relationCounts.cross}</div>
              </div>
              <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] p-3">
                <div className="font-mono text-xl text-emerald-100">{relationCounts.expLinks}</div>
                <div className="text-xs text-slate-500">节点-实践关联</div>
              </div>
            </div>
          </div>
        </GraphReadingPanel>
        )}
      </section>
      )}
      {view === 'knowledge' && !activeTaskPathId && !isCanvasFocus && (
        <div className="relative z-10 min-h-[72px] px-4 pt-3 md:px-5">
          <NextStepBanner compact assessmentManaged assessmentSnapshot={latestAssessmentSnapshot} />
        </div>
      )}

    </div>
  );
}
