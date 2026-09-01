'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Monitor,
  PlayCircle,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Timer,
  ToggleRight,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { experiments as staticExperiments, type ExperimentConfig, getExperimentConfig } from '@/lib/experiment-config';
import {
  buildHyperExperiments,
  fetchHyperJson,
  getContinueExperiment,
  normalizeExperimentRecords,
  type HyperExperimentCard,
} from '@/lib/hyper-data';
import {
  getChildPoints,
  getPointsByLevel,
  getResourcesByChapter,
  resolveKnowledgeResourceHref,
  type KnowledgePoint,
  type KnowledgePointResource,
} from '@/lib/knowledge-points';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { NextStepBanner } from '@/components/onboarding/NextStepBanner';
import { ADDRESSING_TASK_PRESET, type LearningTaskStepType } from '@/lib/lesson-tasks';

const topicIcons: Record<string, LucideIcon> = {
  基础入门: ToggleRight,
  基础指令: Cpu,
  定时器应用: Timer,
  中断系统: Zap,
  显示器件: Monitor,
};

type SectionMode = 'chapters' | 'labs';
type PersonalProgressView = 'in-progress' | 'completed';

function isPersonalProgressView(value: unknown): value is PersonalProgressView {
  return value === 'in-progress' || value === 'completed';
}

export interface HyperCoursesPageProps {
  initialFilters?: {
    section: SectionMode;
    query: string;
    view: string;
    topic: string;
  };
}

const courseChapters = getPointsByLevel(1).sort((a, b) => a.chapter - b.chapter);

const labReportMaterial = {
  title: '微控制器原理及应用技术实验报告（1-8）',
  href: '/resources/course/microcontroller-lab-report-1-8.pdf',
  meta: 'PDF · 实验 1—8 记录模板 · 课程配套资料',
};

const verifiedDiagrams: { title: string; href: string; meta: string }[] = [
  {
    title: '实验1 流水灯硬件原理图',
    href: '/resources/course/diagrams/lab1-flowing-led-schematic.svg',
    meta: 'SVG · 单片机 P1 端口 → LED1—4 连接图 · 课程配套图样',
  },
  {
    title: '实验1 流水灯程序流程图',
    href: '/resources/course/diagrams/lab1-flowing-led-flowchart.svg',
    meta: 'SVG · 初始化 → 点亮 → 延时 → 循环主流程 · 课程配套图样',
  },
];

const resourceLabels: Record<KnowledgePointResource['type'], string> = {
  video: '视频',
  animation: '动画',
  slide: '课件',
  quiz: '测验',
  document: '文档',
  experiment: '实验',
  image: '图样',
};

const resourceIcons: Record<KnowledgePointResource['type'], LucideIcon> = {
  video: PlayCircle,
  animation: Zap,
  slide: Monitor,
  quiz: CheckCircle2,
  document: FileText,
  experiment: Cpu,
  image: ImageIcon,
};

const lessonStepIcons: Record<LearningTaskStepType, LucideIcon> = {
  CHAPTER: BookOpen,
  GRAPH: Share2,
  ANIMATION: PlayCircle,
  QUIZ: CheckCircle2,
  REMEDIATION: RefreshCw,
  SIMULATION: Cpu,
  RETEST: CheckCircle2,
};

function iconForTopic(topic: string): LucideIcon {
  return topicIcons[topic] || Cpu;
}

function hrefForResource(resource: KnowledgePointResource, chapter?: number): string | null {
  if (resource.url) return resource.url;
  if (resource.type === 'experiment' && resource.refId) {
    return `/simulation?experiment=${encodeURIComponent(resource.refId)}`;
  }
  if (resource.type === 'animation' && resource.refId === 'anim-addressing-modes') {
    return '/simulation?experiment=exp02&view=guide';
  }
  if (resource.type === 'quiz') return resolveKnowledgeResourceHref(resource, chapter);
  return null;
}

function buildChapterSummary(chapter: KnowledgePoint, childPoints: KnowledgePoint[]): string {
  const keyTopics = childPoints.slice(0, 5).map((point) => point.name).join('、');
  const topicText = keyTopics ? `重点覆盖${keyTopics}等内容` : `重点围绕${chapter.name}展开`;
  return `本章围绕${chapter.description || chapter.name}展开，${topicText}。学生完成本章后，可继续进入知识图谱查看概念关系，并通过测验、实验和资料阅读完成巩固。`;
}

function formatDate(value: string | null): string {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无记录';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function isExperimentRecordsPayload(value: unknown): value is { success: true; experiments: unknown[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.success === true && Array.isArray(record.experiments);
}

function Difficulty({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`难度 ${level}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn('h-2.5 w-1 rounded-sm', index < level ? 'bg-cyan-300' : 'bg-white/[0.12]')}
        />
      ))}
      <span className="ml-1 font-mono text-xs text-slate-400">难度 {level}/5</span>
    </span>
  );
}

function StatusTag({ state, label }: { state: HyperExperimentCard['state']; label: string }) {
  const cls =
    state === 'completed'
      ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200'
      : state === 'in-progress'
        ? 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200'
        : 'border-white/[0.1] bg-white/[0.04] text-slate-300';
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', cls)}>{label}</span>;
}

function LabThumb({ lab, showPersonalProgress }: { lab: HyperExperimentCard; showPersonalProgress: boolean }) {
  const Icon = iconForTopic(lab.topic);
  const statusDot = lab.state === 'completed' ? '#10b981' : lab.state === 'in-progress' ? '#22d3ee' : '#64748b';
  return (
    <div className="relative h-32 overflow-hidden border-b border-white/[0.08] bg-[#090d12]">
      <div className="absolute inset-0 circuit-grid opacity-70" />
      <svg viewBox="0 0 260 128" className="relative h-full w-full" aria-hidden="true">
        <rect x="100" y="36" width="60" height="56" rx="2" fill="#0a0a0a" stroke="#334155" />
        <text x="130" y="66" textAnchor="middle" fill="#a8b1c0" fontSize="8" fontFamily="monospace">AT89C52</text>
        <text x="130" y="78" textAnchor="middle" fill="#64748b" fontSize="6" fontFamily="monospace">{lab.id.toUpperCase()}</text>
        {[46, 56, 66, 76, 86].map((y) => (
          <circle key={`l-${y}`} cx="100" cy={y} r="1.6" fill="#d4a854" />
        ))}
        {[46, 56, 66, 76, 86].map((y) => (
          <circle key={`r-${y}`} cx="160" cy={y} r="1.6" fill="#d4a854" />
        ))}
        <path d="M160 50 L202 50 L202 28" stroke="#06b6d4" strokeWidth="1.2" fill="none" />
        <path d="M160 64 L220 64 L220 34" stroke="#f59e0b" strokeWidth="1.2" fill="none" strokeDasharray="3 3" />
        <path d="M100 72 L54 72 L54 98" stroke="#10b981" strokeWidth="1.2" fill="none" />
        <rect x="184" y="18" width="54" height="22" rx="2" fill="#0d1510" stroke="#164e63" />
        <text x="211" y="33" textAnchor="middle" fill="#22d3ee" fontSize="10" fontFamily="monospace">
          {lab.topic.includes('定时') ? 'T0' : lab.topic.includes('显示') ? '88' : 'LED'}
        </text>
        <circle cx="54" cy="104" r="5" fill={showPersonalProgress ? statusDot : '#22d3ee'} opacity={showPersonalProgress && lab.state === 'pending' ? 0.55 : 0.9} />
      </svg>
      <div className="absolute left-3 top-3 rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-400">
        {lab.id.toUpperCase()}
      </div>
      <div className="absolute right-3 top-3">
        <StatusTag state={showPersonalProgress ? lab.state : 'pending'} label={showPersonalProgress ? lab.stateLabel : '课程目录'} />
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[11px] text-cyan-100">
        <Icon className="h-3 w-3" />
        {lab.topic}
      </div>
    </div>
  );
}

function LabCard({ lab, showPersonalProgress }: { lab: HyperExperimentCard; showPersonalProgress: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = getExperimentConfig(lab.id);
  const code = config?.code?.trim() || '';
  const objectives = config?.objectives ?? lab.objectives ?? [];
  const knowledgePoints = config?.knowledgePoints ?? lab.knowledgePoints ?? [];

  return (
    <article
      className={cn(
        'glass-hover animate-scale-in group flex flex-col overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035] transition-all hover:border-cyan-300/30 hover:bg-cyan-300/[0.045]',
        expanded ? '' : 'min-h-[264px]',
      )}
    >
      <LabThumb lab={lab} showPersonalProgress={showPersonalProgress} />
      <div className="flex flex-col gap-2 p-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-100">{lab.title}</h3>
          <p className={cn('mt-1 text-xs leading-5 text-slate-400', !expanded && 'line-clamp-2')}>
            {lab.description}
          </p>
        </div>
        <div className="border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-3">
            <Difficulty level={lab.level} />
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              {lab.duration} min
            </span>
          </div>
          {showPersonalProgress && lab.state === 'in-progress' && lab.progress !== null ? (
            <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-cyan-200">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${lab.progress}%` }} />
              </div>
              {lab.progress}%
            </div>
          ) : showPersonalProgress ? (
            <div className="mt-3 font-mono text-xs text-slate-400">最近记录：{formatDate(lab.updatedAt)}</div>
          ) : (
            <div className="mt-3 text-xs text-slate-400">学生登录后显示个人实验进度</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`lab-${lab.id}-preview`}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/[0.08] bg-black/20 px-3 text-[11px] text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            {expanded ? '收起预览 ▴' : '内嵌预览 ▾'}
          </button>
          <Link
            href={lab.href}
            className="inline-flex min-h-11 items-center gap-1 rounded-md bg-cyan-300 px-3 text-[11px] font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            进入仿真页 →
          </Link>
        </div>

        {expanded && (
          <div id={`lab-${lab.id}-preview`} className="mt-2 space-y-3 border-t border-cyan-300/15 pt-3">
            {objectives.length > 0 && (
              <div>
                <div className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">实验目标</div>
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] leading-5 text-slate-300">
                  {objectives.slice(0, 4).map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
            {knowledgePoints.length > 0 && (
              <div>
                <div className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">涉及知识点</div>
                <div className="flex flex-wrap gap-1.5">
                  {knowledgePoints.slice(0, 6).map((kp, i) => (
                    <span key={i} className="rounded-sm border border-white/[0.06] bg-black/20 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {kp}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {code && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="font-mono text-xs uppercase tracking-[0.1em] text-slate-400">参考代码（节选）</div>
                  <span className="font-mono text-xs text-slate-400">8051 ASM</span>
                </div>
                <pre className="max-h-[280px] overflow-y-auto rounded-md border border-white/[0.06] bg-black/40 p-2 font-mono text-[10px] leading-4 text-slate-300">
                  {code}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

type CourseNavigationProps = {
  topics: string[];
  chapters: KnowledgePoint[];
  activeSection: SectionMode;
  activeView: string;
  activeTopic: string;
  setSection: (value: SectionMode) => void;
  setView: (value: string) => void;
  setTopic: (value: string) => void;
  labs: HyperExperimentCard[];
  isTeacher: boolean;
  isAuthenticated: boolean;
  showPersonalProgress: boolean;
};

function CourseSideNav({
  topics,
  chapters,
  activeSection,
  activeView,
  activeTopic,
  setSection,
  setView,
  setTopic,
  labs,
  isTeacher,
  isAuthenticated,
  showPersonalProgress,
}: CourseNavigationProps) {
  const navClass = (active: boolean) =>
    cn(
      'flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
      active ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
    );

  return (
    <aside className="glass-hover order-2 hidden rounded-md border border-white/[0.08] bg-white/[0.035] p-3 transition-all lg:order-1 lg:sticky lg:top-20 lg:block lg:self-start">
      <div className="border-b border-white/[0.08] px-2 pb-3">
        <div className="font-mono text-xs text-slate-400">当前课程</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">《微控制器原理及应用技术》</div>
        <div className="mt-1 text-xs text-slate-400">8051 · AT89C52 · 实验工作台</div>
      </div>

      <nav aria-label="课程目录与筛选">
      <div className="mt-3 px-2 py-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">导航</div>
      <button type="button" aria-pressed={activeSection === 'chapters'} className={navClass(activeSection === 'chapters')} onClick={() => setSection('chapters')}>
        <BookOpen className="h-3.5 w-3.5" />
        课程章节
        <span className="ml-auto font-mono text-xs text-slate-400">{chapters.length}</span>
      </button>
      <button type="button" aria-pressed={activeSection === 'labs'} className={navClass(activeSection === 'labs')} onClick={() => setSection('labs')}>
        <LayoutGrid className="h-3.5 w-3.5" />
        实验工作台
        <span className="ml-auto font-mono text-xs text-slate-400">{labs.length}</span>
      </button>

      {activeSection === 'chapters' && (
        <>
          <div className="mt-4 px-2 py-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">章节目录</div>
          {chapters.map((chapter) => (
            <a
              key={chapter.id}
              href={`#item-${chapter.chapter}`}
              className={navClass(false)}
              onClick={() => setSection('chapters')}
            >
              <span className="font-mono text-xs text-cyan-200">CH{chapter.chapter}</span>
              <span className="min-w-0 truncate">{chapter.name}</span>
            </a>
          ))}
        </>
      )}

      {activeSection === 'labs' && (
        <>
      <button type="button" aria-pressed={activeView === 'all' && activeTopic === 'all'} className={navClass(activeView === 'all' && activeTopic === 'all')} onClick={() => { setView('all'); setTopic('all'); }}>
        <LayoutGrid className="h-3.5 w-3.5" />
        全部实验
        <span className="ml-auto font-mono text-xs text-slate-400">{labs.length}</span>
      </button>
      {showPersonalProgress && <button type="button" aria-pressed={activeView === 'in-progress'} className={navClass(activeView === 'in-progress')} onClick={() => { setView('in-progress'); setTopic('all'); }}>
        <PlayCircle className="h-3.5 w-3.5" />
        进行中
        <span className="ml-auto font-mono text-xs text-slate-400">{labs.filter((lab) => lab.state === 'in-progress').length}</span>
      </button>}
      {showPersonalProgress && <button type="button" aria-pressed={activeView === 'completed'} className={navClass(activeView === 'completed')} onClick={() => { setView('completed'); setTopic('all'); }}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        已完成
        <span className="ml-auto font-mono text-xs text-slate-400">{labs.filter((lab) => lab.state === 'completed').length}</span>
      </button>}
      <div className="mt-4 px-2 py-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">按主题</div>
      {topics.map((topic) => {
        const Icon = iconForTopic(topic);
        return (
          <button key={topic} type="button" aria-pressed={activeTopic === topic} className={navClass(activeTopic === topic)} onClick={() => { setView('all'); setTopic(topic); }}>
            <Icon className="h-3.5 w-3.5" />
            {topic}
            <span className="ml-auto font-mono text-xs text-slate-400">{labs.filter((lab) => lab.topic === topic).length}</span>
          </button>
        );
      })}
        </>
      )}

      <div className="mt-4 px-2 py-1 font-mono text-xs uppercase tracking-[0.1em] text-slate-400">其他</div>
      {/* 实验报告与顶部材料卡为同一份 PDF */}
      <a href={labReportMaterial.href} target="_blank" rel="noreferrer" className={navClass(false)}>
        <FileText className="h-3.5 w-3.5" />
        实验报告
      </a>
      {isAuthenticated && <Link href="/analytics" className={navClass(false)}>
        <BarChart3 className="h-3.5 w-3.5" />
        成绩与进度
      </Link>}
      {isTeacher && (
        <Link href="/teacher/classes" className={navClass(false)}>
          <Users className="h-3.5 w-3.5" />
          班级管理
        </Link>
      )}
      {isAuthenticated && <Link href="/settings" className={navClass(false)}>
        <Settings className="h-3.5 w-3.5" />
        设置
      </Link>}
      </nav>
    </aside>
  );
}

function MobileCourseNavigation({
  topics,
  chapters,
  activeSection,
  activeView,
  activeTopic,
  setSection,
  setView,
  setTopic,
  labs,
  showPersonalProgress,
}: CourseNavigationProps) {
  const segmentClass = (active: boolean) => cn(
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70',
    active
      ? 'border border-cyan-300/25 bg-cyan-300/[0.12] text-cyan-100'
      : 'border border-white/[0.08] bg-white/[0.035] text-slate-300',
  );
  const chipClass = (active: boolean) => cn(
    'inline-flex min-h-11 shrink-0 items-center rounded-md border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70',
    active
      ? 'border-cyan-300/30 bg-cyan-300/[0.1] text-cyan-100'
      : 'border-white/[0.08] bg-black/20 text-slate-300',
  );

  return (
    <section aria-label="课程移动导航" className="order-1 min-w-0 rounded-md border border-white/[0.08] bg-[#0c1117] p-3 lg:hidden">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={activeSection === 'chapters'} onClick={() => setSection('chapters')} className={segmentClass(activeSection === 'chapters')}>
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          章节内容 <span className="font-mono text-[10px] opacity-70">{chapters.length}</span>
        </button>
        <button type="button" aria-pressed={activeSection === 'labs'} onClick={() => setSection('labs')} className={segmentClass(activeSection === 'labs')}>
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          实验内容 <span className="font-mono text-[10px] opacity-70">{labs.length}</span>
        </button>
      </div>

      <div className="mt-3 max-w-full overflow-x-auto pb-1" role="navigation" aria-label={activeSection === 'chapters' ? '章节快捷跳转' : '实验快捷筛选'}>
        <div className="flex min-w-max gap-2">
          {activeSection === 'chapters' ? chapters.map((chapter) => (
            <a key={chapter.id} href={`#item-${chapter.chapter}`} className={chipClass(false)}>
              <span className="mr-1.5 font-mono text-[10px] text-cyan-200">CH{chapter.chapter}</span>
              {chapter.name}
            </a>
          )) : (
            <>
              <button type="button" aria-pressed={activeView === 'all' && activeTopic === 'all'} onClick={() => { setView('all'); setTopic('all'); }} className={chipClass(activeView === 'all' && activeTopic === 'all')}>全部 {labs.length}</button>
              {showPersonalProgress && <button type="button" aria-pressed={activeView === 'in-progress'} onClick={() => { setView('in-progress'); setTopic('all'); }} className={chipClass(activeView === 'in-progress')}>进行中 {labs.filter((lab) => lab.state === 'in-progress').length}</button>}
              {showPersonalProgress && <button type="button" aria-pressed={activeView === 'completed'} onClick={() => { setView('completed'); setTopic('all'); }} className={chipClass(activeView === 'completed')}>已完成 {labs.filter((lab) => lab.state === 'completed').length}</button>}
              {topics.map((topicName) => (
                <button key={topicName} type="button" aria-pressed={activeTopic === topicName} onClick={() => { setView('all'); setTopic(topicName); }} className={chipClass(activeTopic === topicName)}>
                  {topicName} {labs.filter((lab) => lab.topic === topicName).length}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">可左右滑动查看更多{activeSection === 'chapters' ? '章节' : '筛选条件'}</p>
    </section>
  );
}

function ResourceChip({ resource, chapter }: { resource: KnowledgePointResource; chapter: number }) {
  const Icon = resourceIcons[resource.type];
  const href = hrefForResource(resource, chapter);

  // Inline image preview: any type='image' with a real URL gets rendered as
  // a small thumbnail card instead of a text chip, so students see the
  // figure right on the chapter card without opening a new tab.
  if (resource.type === 'image' && resource.url) {
    // 图纸类素材（电路原理图/流程图）本身是白底黑线的技术文档，不改动
    // 内容配色——但外层直接 bg-white 会在深色主题里露出一整块刺眼白板。
    // 改为"深色画框裱图纸"：外层容器保持深色，白色只出现在留白+圆角+
    // 轻阴影的内层小卡片里，让图纸看起来像被精心裱在深色背景上，而不是
    // 没套上深色皮肤的组件。
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${resource.title}，在新标签打开`}
        className="group col-span-full block overflow-hidden rounded-md border border-white/[0.08] bg-[#0c1117] sm:col-span-2"
        title={`点击查看大图：${resource.title}`}
      >
        <div className="flex items-center justify-center p-3">
          <div className="flex items-center justify-center rounded-md bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
            <img src={resource.url} alt={resource.title} className="block h-32 w-auto" loading="lazy" />
          </div>
        </div>
        <div className="border-t border-white/[0.08] bg-[#0c1117] px-3 py-2 text-[11px] text-slate-300 group-hover:text-cyan-100">
          {resource.title}
          <span className="ml-2 font-mono text-xs text-slate-400">{resourceLabels[resource.type]}</span>
        </div>
      </a>
    );
  }

  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{resource.title}</span>
      <span className="shrink-0 rounded-sm bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs text-slate-400">
        {resourceLabels[resource.type]}
      </span>
    </>
  );

  const className =
    'inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.035] px-2.5 py-2 text-xs text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60';

  if (!href) {
    return (
      <span className={cn(className, 'hover:border-white/[0.08] hover:bg-white/[0.035] hover:text-slate-300')} title={`第${chapter}章资料位`}>
        {content}
      </span>
    );
  }

  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={`${resource.title}，在新标签打开`} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function SampleLessonPanel({ isPublicShell, role }: { isPublicShell: boolean; role?: string | null }) {
  const resolveHref = (href: string): string => (
    isPublicShell ? `/login?role=student&from=${encodeURIComponent(href)}` : href
  );
  const isTeacherReview = role === 'TEACHER';
  const isAdminReview = role === 'ADMIN';
  const showStudentStepLinks = isPublicShell || role === 'STUDENT';
  const primaryHref = isPublicShell
    ? '/login?role=teacher&from=%2Fteacher'
    : isAdminReview
      ? '/admin'
      : isTeacherReview
        ? '/teacher'
        : '/tasks';
  const primaryLabel = isPublicShell
    ? '教师登录复核样板课'
    : isAdminReview
      ? '返回管理工作台'
      : isTeacherReview
        ? '返回教师工作台'
        : '进入我的任务';

  return (
    <section
      id="addressing-sample"
      aria-labelledby="addressing-sample-title"
      className="relative mb-5 overflow-hidden rounded-lg border border-cyan-300/18 bg-[#0b1117] shadow-[0_22px_70px_rgba(0,0,0,0.28)]"
    >
      <div className="absolute inset-0 circuit-grid opacity-55" aria-hidden="true" />
      <div className="relative grid gap-5 border-b border-white/[0.08] px-4 py-5 sm:px-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.13em] text-cyan-100">
              Sample Lesson · 教学流程样板
            </span>
            <span className="rounded-md border border-amber-300/18 bg-amber-300/[0.06] px-2 py-1 text-[10px] text-amber-100">
              非教学成效数据
            </span>
          </div>
          <h2 id="addressing-sample-title" className="mt-3 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            3.1 寻址方式专项学习任务
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            从知识结构定位开始，完成学习、诊断、补弱、实践和复测；每一步都有完成规则，结果以服务端保存记录为准。
          </p>
        </div>
        <Link
          href={primaryHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1117]"
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ol className="relative grid gap-px bg-white/[0.07] sm:grid-cols-2 xl:grid-cols-3">
        {ADDRESSING_TASK_PRESET.steps.map((step, index) => {
          const Icon = lessonStepIcons[step.type];
          const stepBody = (
            <>
              <span className="chip-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <Icon className="h-4 w-4 text-cyan-100" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-xs uppercase tracking-[0.12em] text-slate-400">STEP {String(index + 1).padStart(2, '0')}</span>
                <span className="mt-1 block text-sm font-semibold text-slate-100 transition-colors group-hover:text-cyan-100">{step.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-300">目的：{step.purpose}</span>
                <span className="mt-1.5 block border-l border-cyan-300/25 pl-2 text-xs leading-5 text-slate-400">完成条件：{step.completionRule}</span>
                {!showStudentStepLinks && (
                  <span className="mt-2 inline-flex rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1 text-xs text-slate-300">学生动作预览</span>
                )}
              </span>
            </>
          );
          return (
            <li key={step.stepId} className="bg-[#0b1117]/95 p-4 transition-colors hover:bg-cyan-300/[0.045]">
              {showStudentStepLinks ? (
                <Link
                  href={resolveHref(step.href)}
                  aria-label={`样板课第${index + 1}步，${step.title}，${isPublicShell ? '学生登录后进入' : '进入对应页面'}`}
                  className="group flex min-h-11 items-start gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
                >
                  {stepBody}
                </Link>
              ) : (
                <div
                  aria-label={`样板课第${index + 1}步，${step.title}，学生动作流程预览`}
                  className="group flex min-h-11 items-start gap-3 rounded"
                >
                  {stepBody}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="relative flex flex-col gap-2 border-t border-white/[0.08] bg-black/15 px-4 py-3 text-xs leading-5 text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span>正式资源：CH3 · 3.1 · quiz-ch3-addressing · exp02</span>
        <span className="font-mono text-xs text-emerald-200">AI 仅作解释辅助</span>
      </div>
    </section>
  );
}

function CourseMaterialPanel() {
  const [showLabPdf, setShowLabPdf] = useState(false);
  const [showDiagrams, setShowDiagrams] = useState(false);
  return (
    <div className="glass-hover transition-all mb-5 space-y-3 rounded-md border border-emerald-300/18 bg-emerald-300/[0.045] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-200">Course Material · 已接入资料</div>
          <h2 className="mt-2 text-base font-semibold text-slate-50">{labReportMaterial.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{labReportMaterial.meta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={showDiagrams}
            aria-controls="course-material-diagrams"
            onClick={() => setShowDiagrams((value) => !value)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.035] px-4 text-sm text-slate-200 hover:border-emerald-300/30 hover:bg-emerald-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/60"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            {showDiagrams ? '收起图纸' : '查看图纸'}
          </button>
          <button
            type="button"
            aria-expanded={showLabPdf}
            aria-controls="course-material-pdf"
            onClick={() => setShowLabPdf((v) => !v)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/[0.10] px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/60"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {showLabPdf ? '收起预览' : '内嵌预览'}
          </button>
          <a
            href={labReportMaterial.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-[#02130c] hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/60"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            新标签打开
          </a>
        </div>
      </div>
      {showLabPdf && (
        <div id="course-material-pdf" className="rounded-md border border-emerald-300/20 bg-[#0c1117] p-3">
          <object
            data={labReportMaterial.href}
            type="application/pdf"
            title={labReportMaterial.title}
            className="block h-[640px] w-full rounded bg-white"
          >
            <div className="flex h-[640px] items-center justify-center rounded bg-white p-6 text-sm text-slate-700">
              浏览器未启用 PDF 内嵌预览。
              <a href={labReportMaterial.href} target="_blank" rel="noreferrer" className="ml-2 underline">
                点击在新标签打开
              </a>
            </div>
          </object>
        </div>
      )}
      {showDiagrams && (
        <div id="course-material-diagrams" className="grid gap-3 border-t border-emerald-300/15 pt-3 md:grid-cols-2">
          {verifiedDiagrams.map((diagram) => (
            <a
              key={diagram.href}
              href={diagram.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${diagram.title}，在新标签打开`}
              className="group block overflow-hidden rounded-md border border-emerald-300/15 bg-[#0c1117]"
            >
              <div className="flex items-center justify-center p-3">
                <div className="flex items-center justify-center rounded-md bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
                  <img src={diagram.href} alt={diagram.title} className="block h-24 w-auto" loading="lazy" />
                </div>
              </div>
              <div className="border-t border-emerald-300/15 bg-[#0c1117] px-3 py-2">
                <div className="text-[12px] font-medium text-slate-100 group-hover:text-emerald-100">{diagram.title}</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-400">{diagram.meta}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterCard({ chapter, forceExpanded = false }: { chapter: KnowledgePoint; forceExpanded?: boolean }) {
  const childPoints = getChildPoints(chapter.id);
  const chapterPoints = childPoints.length + 1;
  const resources = getResourcesByChapter(chapter.chapter);
  // 只展示有真实链接的资源，避免出现点不动的条目
  const linkedResources = resources.filter((r) => hrefForResource(r, chapter.chapter) !== null);
  const video = resources.find((resource) => resource.type === 'video' && resource.url);
  const visibleResources = linkedResources.slice(0, 10);
  const summary = buildChapterSummary(chapter, childPoints);
  const hasQuiz = resources.some((resource) => resource.type === 'quiz');
  const [showTop5, setShowTop5] = useState(false);
  const [expanded, setExpanded] = useState(chapter.chapter === 3);
  const top5 = childPoints.slice(0, 5);
  const isOpen = forceExpanded || expanded;

  useEffect(() => {
    const openFromHash = (): void => {
      const hash = window.location.hash;
      if (hash === `#item-${chapter.chapter}` || hash === `#chapter-${chapter.chapter}`) {
        setExpanded(true);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [chapter.chapter]);

  return (
    <article id={`item-${chapter.chapter}`} className="glass-hover transition-all scroll-mt-24 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
      <span id={`chapter-${chapter.chapter}`} className="sr-only" />
      <div className={cn('bg-[#0c1117] p-4', isOpen && 'border-b border-white/[0.08]')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[11px] text-cyan-100">
            CH{chapter.chapter}
          </span>
          <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-xs text-slate-400">
            {chapterPoints} 个核心条目
          </span>
          <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-xs text-slate-400">
            {linkedResources.length} 项资源
          </span>
          {hasQuiz && (
            <Link
              href={`/quiz?chapter=${chapter.chapter}`}
              className="inline-flex min-h-11 items-center rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2 font-mono text-[11px] text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/60"
            >
              进入章节测验
            </Link>
          )}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-50">{chapter.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{chapter.description}</p>
          </div>
          <button
            type="button"
            aria-label={forceExpanded
              ? `第${chapter.chapter}章${chapter.name}搜索结果已展开`
              : `${isOpen ? '收起' : '展开'}第${chapter.chapter}章${chapter.name}详情`}
            aria-expanded={isOpen}
            aria-controls={`chapter-${chapter.chapter}-details`}
            disabled={forceExpanded}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.07] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:cursor-default disabled:opacity-60"
          >
            {forceExpanded ? '搜索结果已展开' : isOpen ? '收起详情' : '展开详情'}
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isOpen && (
      <div id={`chapter-${chapter.chapter}-details`} className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-100">章节概要</h4>
            <p className="text-sm leading-6 text-slate-400">{summary}</p>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-100">知识点导航</h4>
            <div className="flex flex-wrap gap-2">
              {childPoints.slice(0, 8).map((point) => (
                <Link
                  key={point.id}
                  href={`/knowledge-graph?chapter=${chapter.chapter}&node=${encodeURIComponent(point.id)}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
                >
                  {point.name}
                </Link>
              ))}
            </div>
          </div>

          {top5.length > 0 && (
            <div>
              <button
                type="button"
                aria-expanded={showTop5}
                aria-controls={`chapter-${chapter.chapter}-core-points`}
                onClick={() => setShowTop5((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
              >
                <span className="font-semibold">核心知识点说明 · {top5.length} 项</span>
                <span className="font-mono text-xs text-slate-400">{showTop5 ? '收起 ▴' : '展开 ▾'}</span>
              </button>
              {showTop5 && (
                <ul id={`chapter-${chapter.chapter}-core-points`} className="mt-2 space-y-1.5">
                  {top5.map((point) => (
                    <li
                      key={point.id}
                      className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-xs"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] text-cyan-300">#{point.id}</span>
                        <Link
                          href={`/knowledge-graph?chapter=${chapter.chapter}&node=${encodeURIComponent(point.id)}`}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-slate-100 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
                        >
                          {point.name}
                        </Link>
                        <span className="ml-auto rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-slate-400">
                          L{point.level}
                        </span>
                      </div>
                      {point.description && (
                        <p className="mt-1 leading-5 text-slate-400">{point.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-100">章节资源</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleResources.map((resource) => (
                <ResourceChip key={`${resource.type}-${resource.refId || resource.url || resource.title}`} resource={resource} chapter={chapter.chapter} />
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {video?.url ? (
            <div className="glass-hover transition-all overflow-hidden rounded-md border border-white/[0.08] bg-black/25">
              <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2 text-xs text-slate-300">
                <PlayCircle className="h-3.5 w-3.5 text-cyan-200" />
                {video.title}
              </div>
              <iframe
                src={video.url}
                title={video.title}
                className="aspect-video w-full"
                allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex min-h-[180px] flex-col justify-center rounded-md border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <div className="chip-mark flex h-7 w-7 items-center justify-center rounded-md"><BookOpen className="h-4 w-4 text-cyan-200" /></div>
                章节内容已接入
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                本章已接入知识点、课件、测验与实验入口，可按学习目的选择相应资源。
              </p>
            </div>
          )}
        </div>
      </div>

      )}

      {isOpen && (
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
        <Link href={`/knowledge-graph?chapter=${chapter.chapter}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition-all hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
          <Share2 className="h-3.5 w-3.5" />
          知识图谱
        </Link>
      </div>
      )}
    </article>
  );
}

function CourseChaptersView({
  query,
  isPublicShell,
  role,
  onClearQuery,
}: {
  query: string;
  isPublicShell: boolean;
  role?: string | null;
  onClearQuery: () => void;
}) {
  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courseChapters;
    return courseChapters.filter((chapter) => {
      const children = getChildPoints(chapter.id).map((point) => point.name).join(' ');
      const resources = getResourcesByChapter(chapter.chapter).map((resource) => resource.title).join(' ');
      return `${chapter.name} ${chapter.description || ''} ${children} ${resources}`.toLowerCase().includes(q);
    });
  }, [query]);

  return (
    <div className="order-1 min-w-0 lg:order-2">
      <SampleLessonPanel isPublicShell={isPublicShell} role={role} />
      <CourseMaterialPanel />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <span className="chip-mark flex h-7 w-7 items-center justify-center rounded-md"><BookOpen className="h-4 w-4 text-cyan-200" /></span>
          课程章节
        </h2>
        <div className="font-mono text-xs text-slate-400">{filteredChapters.length} / {courseChapters.length} CHAPTERS</div>
      </div>

      {filteredChapters.length > 0 ? (
        <div className="grid gap-4">
          {filteredChapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} forceExpanded={query.trim().length > 0} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-8 text-center sm:p-10" role="status">
          <Search className="mx-auto h-6 w-6 text-slate-500" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-300">没有找到与“{query.trim()}”匹配的章节、知识点或资源。</p>
          <button
            type="button"
            onClick={onClearQuery}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
          >
            清除搜索
          </button>
        </div>
      )}

    </div>
  );
}

export function HyperCoursesPage({ initialFilters }: HyperCoursesPageProps = {}) {
  const { user, loading: authLoading } = useAuth();
  const showPersonalProgress = !authLoading && user?.role === 'STUDENT';
  const [experimentCatalog, setExperimentCatalog] = useState<ExperimentConfig[]>(staticExperiments);
  const [labs, setLabs] = useState<HyperExperimentCard[]>(() => buildHyperExperiments(staticExperiments, []));
  const [loading, setLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [recordsReloadKey, setRecordsReloadKey] = useState(0);
  const [query, setQuery] = useState(initialFilters?.query ?? '');
  const [section, setSection] = useState<SectionMode>(initialFilters?.section ?? 'chapters');
  const [view, setView] = useState<string>(isPersonalProgressView(initialFilters?.view) ? initialFilters.view : 'all');
  const [topic, setTopic] = useState(initialFilters?.topic ?? 'all');
  const [filtersReady, setFiltersReady] = useState(Boolean(initialFilters));

  useEffect(() => {
    const restoreFromUrl = (): void => {
      const params = new URLSearchParams(window.location.search);
      setSection(params.get('section') === 'labs' ? 'labs' : 'chapters');
      setQuery(params.get('q') || '');
      const requestedView = params.get('view');
      setView(
        (authLoading || showPersonalProgress) && isPersonalProgressView(requestedView)
          ? requestedView
          : 'all',
      );
      setTopic(params.get('topic') || 'all');
      setFiltersReady(true);
    };

    if (!initialFilters) restoreFromUrl();
    else setFiltersReady(true);
    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  }, [authLoading, initialFilters, showPersonalProgress]);

  useEffect(() => {
    if (!authLoading && !showPersonalProgress && isPersonalProgressView(view)) {
      setView('all');
    }
  }, [authLoading, showPersonalProgress, view]);

  useEffect(() => {
    if (!filtersReady || authLoading) return;
    const url = new URL(window.location.href);
    const setOptionalParam = (key: string, value: string, defaultValue: string): void => {
      if (!value || value === defaultValue) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    const chapterParam = url.searchParams.get('chapter');
    const hasChapterContext = chapterParam !== null && /^(?:[1-9]|10)$/.test(chapterParam);
    if (chapterParam !== null && !hasChapterContext) url.searchParams.delete('chapter');
    if (section === 'chapters' && hasChapterContext) url.searchParams.set('section', 'chapters');
    else setOptionalParam('section', section, 'chapters');
    if (section !== 'chapters') url.searchParams.delete('chapter');
    setOptionalParam('q', query.trim(), '');
    setOptionalParam('view', showPersonalProgress ? view : 'all', 'all');
    setOptionalParam('topic', topic, 'all');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [authLoading, filtersReady, query, section, showPersonalProgress, topic, view]);

  // Fetch experiments from API on mount
  useEffect(() => {
    let active = true;
    async function fetchExperiments() {
      try {
        const res = await fetch('/api/experiments');
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.success && Array.isArray(json.data)) {
          setExperimentCatalog(json.data);
        }
      } catch {
        // Keep static fallback on error
      }
    }
    fetchExperiments();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      setLoading(true);
      setRecordsError(null);
      if (!showPersonalProgress) {
        setLabs(buildHyperExperiments(experimentCatalog, []));
        setLoading(false);
        return;
      }
      const token = getStoredAccessToken();
      if (!token) {
        setLabs(buildHyperExperiments(experimentCatalog, []));
        if (user) setRecordsError('登录凭据尚未恢复，个人实验完成状态无法确认。');
        setLoading(false);
        return;
      }
      const result = await fetchHyperJson<unknown>('/api/experiments/save', token);
      if (!active) return;
      if (!result.ok) {
        setLabs(buildHyperExperiments(experimentCatalog, []));
        setRecordsError(
          result.status === 401 || result.status === 403
            ? '登录状态已失效，个人实验完成状态无法确认。'
            : '个人实验进度读取失败；下方仅展示课程实验目录，完成状态尚未确认。',
        );
        setLoading(false);
        return;
      }
      if (!isExperimentRecordsPayload(result.data)) {
        setLabs(buildHyperExperiments(experimentCatalog, []));
        setRecordsError('个人实验进度返回格式异常；下方完成状态尚未确认。');
        setLoading(false);
        return;
      }
      setLabs(buildHyperExperiments(experimentCatalog, normalizeExperimentRecords(result.data)));
      setLoading(false);
    }
    void loadRecords();
    return () => {
      active = false;
    };
  }, [experimentCatalog, recordsReloadKey, showPersonalProgress, user?.id]);

  const topics = useMemo(() => Array.from(new Set(labs.map((lab) => lab.topic))), [labs]);
  const continueLab = useMemo(() => getContinueExperiment(labs), [labs]);

  const filteredLabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const effectiveView = showPersonalProgress ? view : 'all';
    return labs.filter((lab) => {
      if (effectiveView === 'in-progress' && lab.state !== 'in-progress') return false;
      if (effectiveView === 'completed' && lab.state !== 'completed') return false;
      if (topic !== 'all' && lab.topic !== topic) return false;
      if (!q) return true;
      return `${lab.title} ${lab.description} ${lab.topic} ${lab.id}`.toLowerCase().includes(q);
    });
  }, [labs, query, showPersonalProgress, topic, view]);

  const isPublicShell = !user;
  const ContentLandmark: 'main' | 'div' = isPublicShell ? 'main' : 'div';

  return (
    <div
      className={cn(
        'animate-fade-in bg-[#070a0d] text-slate-100',
        isPublicShell ? 'min-h-screen' : '-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto sm:-m-6',
      )}
    >
      {isPublicShell && (
        <>
          <a
            href="#main-content"
            className="fixed left-4 top-3 z-[100] inline-flex min-h-11 -translate-y-20 items-center rounded-md bg-cyan-200 px-4 text-sm font-semibold text-[#001014] shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-50"
          >
            跳到主要内容
          </a>
          <header className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <nav aria-label="公开课程导航" className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
          >
            <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md">
              <Cpu aria-hidden="true" className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-50">芯智育才</span>
              <span className="block font-mono text-xs uppercase tracking-[0.16em] text-slate-400">8051 Lab</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/welcome"
              className="hidden min-h-11 items-center rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 sm:inline-flex"
            >
              平台介绍
            </Link>
            <a
              href="#addressing-sample"
              className="hidden min-h-11 items-center rounded-md px-3 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 md:inline-flex"
            >
              样板课
            </a>
            <Link
              href="/login?role=teacher&from=%2Fteacher"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              教师登录
            </Link>
          </div>
          </nav>
          </header>
        </>
      )}
      <ContentLandmark
        id={isPublicShell ? 'main-content' : undefined}
        tabIndex={isPublicShell ? -1 : undefined}
        className={isPublicShell ? 'outline-none' : undefined}
      >
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Cpu aria-hidden="true" className="h-3.5 w-3.5" />
              MICROCONTROLLER COURSE · 8051 · AT89C52
            </div>
            <h1 className="heading-gradient text-2xl font-semibold tracking-tight md:text-3xl">
              {section === 'chapters' ? '课程内容' : '课程实验工作台'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {section === 'chapters'
                ? '按教学大纲组织 10 个章节，当前资源以知识图谱、课件、测验和仿真实验为主。'
                : '以实验为主线组织 8051 学习内容，直接连接仿真器、知识图谱和学习进度。'}
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              aria-label={section === 'chapters' ? '搜索课程章节、知识点或资源' : '搜索实验、主题或编号'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={section === 'chapters' ? '搜索章节、知识点、资源...' : '搜索实验、主题、编号...'}
              className="min-h-11 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
          </div>
        </div>
      </div>

      {!isPublicShell && (
        <div className="space-y-3 px-4 pt-4 md:px-6">
          {recordsError && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-amber-50 sm:flex-row sm:items-center" role="alert">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <p className="min-w-0 flex-1 text-sm leading-6">{recordsError}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRecordsReloadKey((value) => value + 1)}
                  disabled={loading}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-200/25 px-3 text-sm hover:bg-amber-200/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw aria-hidden="true" className={cn('h-4 w-4', loading && 'animate-spin')} />
                  重新读取实验进度
                </button>
                <Link href="/login?from=%2F" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-cyan-100 hover:bg-white/[0.06]">
                  重新登录
                </Link>
              </div>
            </div>
          )}
          <NextStepBanner />
        </div>
      )}

      <div className="grid gap-5 px-4 py-5 outline-none lg:grid-cols-[240px_1fr] md:px-6">
        <MobileCourseNavigation
          topics={topics}
          chapters={courseChapters}
          activeSection={section}
          activeView={view}
          activeTopic={topic}
          setSection={setSection}
          setView={setView}
          setTopic={setTopic}
          labs={labs}
          isTeacher={user?.role === 'TEACHER' || user?.role === 'ADMIN'}
          isAuthenticated={Boolean(user)}
          showPersonalProgress={showPersonalProgress}
        />
        <CourseSideNav
          topics={topics}
          chapters={courseChapters}
          activeSection={section}
          activeView={view}
          activeTopic={topic}
          setSection={setSection}
          setView={setView}
          setTopic={setTopic}
          labs={labs}
          isTeacher={user?.role === 'TEACHER' || user?.role === 'ADMIN'}
          isAuthenticated={Boolean(user)}
          showPersonalProgress={showPersonalProgress}
        />

        {section === 'chapters' ? (
          <CourseChaptersView
            query={query}
            isPublicShell={isPublicShell}
            role={user?.role}
            onClearQuery={() => setQuery('')}
          />
        ) : (
          <div className="order-1 min-w-0 lg:order-2">
          {continueLab && (
            <Link
              href={continueLab.href}
              className="glass-hover transition-all mb-5 grid gap-4 overflow-hidden rounded-md border border-cyan-300/25 bg-cyan-300/[0.07] p-4 hover:border-cyan-200/50 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200">Continue · 继续上次实验</div>
                <h2 className="mt-2 text-lg font-semibold text-slate-50">{continueLab.id.toUpperCase()} · {continueLab.title}</h2>
                <p className="mt-1 text-sm text-slate-400">上次保存：{formatDate(continueLab.updatedAt)} · 状态：{continueLab.stateLabel}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="font-mono text-2xl font-semibold text-cyan-100">{continueLab.progress ?? 0}</div>
                <span className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014]">
                  继续 <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <span className="chip-mark flex h-7 w-7 items-center justify-center rounded-md"><LayoutGrid className="h-4 w-4 text-cyan-200" /></span>
              实验列表
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />}
            </h2>
            <div className="font-mono text-xs text-slate-400">{filteredLabs.length} / {labs.length} ITEMS</div>
          </div>

          {filteredLabs.length > 0 ? (
            <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLabs.map((lab) => (
                <LabCard key={lab.id} lab={lab} showPersonalProgress={showPersonalProgress} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-8 text-center sm:p-10" role="status">
              <Search className="mx-auto h-6 w-6 text-slate-500" aria-hidden="true" />
              <p className="mt-3 text-sm text-slate-300">当前搜索与筛选条件下没有匹配的实验。</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setView('all');
                  setTopic('all');
                }}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
              >
                清除搜索与筛选
              </button>
            </div>
          )}
          </div>
        )}
      </div>
      </ContentLandmark>
      {isPublicShell && (
        <footer className="border-t border-white/[0.08] bg-[#080c11]">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-medium text-slate-200">芯智育才 · 微控制器课程教学平台</p>
              <p className="mt-1">公开页展示课程结构与样板流程；个人学习记录需登录后查看。</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/welcome" className="inline-flex min-h-11 items-center rounded px-1 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">平台介绍</Link>
              <Link href="/privacy" className="inline-flex min-h-11 items-center rounded px-1 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">隐私政策</Link>
              <Link href="/terms" className="inline-flex min-h-11 items-center rounded px-1 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">使用条款</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
