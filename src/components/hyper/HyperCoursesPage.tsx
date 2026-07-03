'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Monitor,
  PlayCircle,
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
  type KnowledgePoint,
  type KnowledgePointResource,
} from '@/lib/knowledge-points';
import { quizQuestions } from '@/lib/quiz-data';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { NextStepBanner } from '@/components/onboarding/NextStepBanner';

const topicIcons: Record<string, LucideIcon> = {
  基础入门: ToggleRight,
  基础指令: Cpu,
  定时器应用: Timer,
  中断系统: Zap,
  显示器件: Monitor,
};

type SectionMode = 'chapters' | 'labs';

const courseChapters = getPointsByLevel(1).sort((a, b) => a.chapter - b.chapter);

const labReportMaterial = {
  title: '微控制器原理及应用技术实验报告（1-8）',
  href: '/resources/course/microcontroller-lab-report-1-8.pdf',
  meta: 'PDF · 实验模板 · 本地教案材料已转换',
};

const verifiedDiagrams: { title: string; href: string; meta: string }[] = [
  {
    title: '实验1 流水灯硬件原理图',
    href: '/resources/course/diagrams/lab1-flowing-led-schematic.svg',
    meta: 'SVG · 单片机 P1 端口 → LED1-4 连接图（本地实验素材）',
  },
  {
    title: '实验1 流水灯程序流程图',
    href: '/resources/course/diagrams/lab1-flowing-led-flowchart.svg',
    meta: 'SVG · 初始化 → 点亮 → 延时 → 循环 主流程（本地实验素材）',
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

function iconForTopic(topic: string): LucideIcon {
  return topicIcons[topic] || Cpu;
}

function hrefForResource(resource: KnowledgePointResource, chapter?: number): string | null {
  if (resource.url) return resource.url;
  if (resource.type === 'experiment' && resource.refId) {
    return `/simulation?experiment=${encodeURIComponent(resource.refId)}`;
  }
  // 带上章节参数，测评页按章筛题
  if (resource.type === 'quiz') return chapter ? `/quiz?chapter=${chapter}` : '/quiz';
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

function Difficulty({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn('h-2.5 w-1 rounded-sm', index < level ? 'bg-cyan-300' : 'bg-white/[0.12]')}
        />
      ))}
      <span className="ml-1 font-mono text-[11px] text-slate-500">L{level}</span>
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

function LabThumb({ lab }: { lab: HyperExperimentCard }) {
  const Icon = iconForTopic(lab.topic);
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
        <circle cx="54" cy="104" r="5" fill={lab.state === 'completed' ? '#10b981' : '#ef4444'} opacity={lab.state === 'pending' ? 0.35 : 1} />
      </svg>
      <div className="absolute left-3 top-3 rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 font-mono text-[10px] text-slate-400">
        {lab.id.toUpperCase()}
      </div>
      <div className="absolute right-3 top-3">
        <StatusTag state={lab.state} label={lab.stateLabel} />
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[11px] text-cyan-100">
        <Icon className="h-3 w-3" />
        {lab.topic}
      </div>
    </div>
  );
}

function LabCard({ lab }: { lab: HyperExperimentCard }) {
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
      <LabThumb lab={lab} />
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
          {lab.state === 'in-progress' && lab.progress !== null ? (
            <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-cyan-200">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${lab.progress}%` }} />
              </div>
              {lab.progress}%
            </div>
          ) : (
            <div className="mt-3 font-mono text-[11px] text-slate-500">{formatDate(lab.updatedAt)}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-black/20 px-2.5 text-[11px] text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100"
          >
            {expanded ? '收起预览 ▴' : '内嵌预览 ▾'}
          </button>
          <Link
            href={lab.href}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-cyan-300 px-2.5 text-[11px] font-semibold text-[#001014] hover:bg-cyan-200"
          >
            进入仿真页 →
          </Link>
        </div>

        {expanded && (
          <div className="mt-2 space-y-3 border-t border-cyan-300/15 pt-3">
            {objectives.length > 0 && (
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">实验目标</div>
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] leading-5 text-slate-300">
                  {objectives.slice(0, 4).map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
            {knowledgePoints.length > 0 && (
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">涉及知识点</div>
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
                  <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">参考代码（节选）</div>
                  <span className="font-mono text-[10px] text-slate-600">8051 ASM</span>
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
}: {
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
}) {
  const navClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition',
      active ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
    );

  return (
    <aside className="glass-hover transition-all order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 lg:order-1 lg:sticky lg:top-20 lg:self-start">
      <div className="border-b border-white/[0.08] px-2 pb-3">
        <div className="font-mono text-[11px] text-slate-500">当前课程</div>
        <div className="mt-1 text-sm font-semibold text-slate-100">《微控制器原理及应用技术》</div>
        <div className="mt-1 text-xs text-slate-400">8051 · AT89C52 · 实验工作台</div>
      </div>

      <div className="mt-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">导航</div>
      <button className={navClass(activeSection === 'chapters')} onClick={() => setSection('chapters')}>
        <BookOpen className="h-3.5 w-3.5" />
        课程章节
        <span className="ml-auto font-mono text-[10px] text-slate-500">{chapters.length}</span>
      </button>
      <button className={navClass(activeSection === 'labs')} onClick={() => setSection('labs')}>
        <LayoutGrid className="h-3.5 w-3.5" />
        实验工作台
        <span className="ml-auto font-mono text-[10px] text-slate-500">{labs.length}</span>
      </button>

      {activeSection === 'chapters' && (
        <>
          <div className="mt-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">章节目录</div>
          {chapters.map((chapter) => (
            <a
              key={chapter.id}
              href={`#item-${chapter.chapter}`}
              className={navClass(false)}
              onClick={() => setSection('chapters')}
            >
              <span className="font-mono text-[10px] text-cyan-200">CH{chapter.chapter}</span>
              <span className="min-w-0 truncate">{chapter.name}</span>
            </a>
          ))}
        </>
      )}

      {activeSection === 'labs' && (
        <>
      <button className={navClass(activeView === 'all' && activeTopic === 'all')} onClick={() => { setView('all'); setTopic('all'); }}>
        <LayoutGrid className="h-3.5 w-3.5" />
        全部实验
        <span className="ml-auto font-mono text-[10px] text-slate-500">{labs.length}</span>
      </button>
      <button className={navClass(activeView === 'in-progress')} onClick={() => { setView('in-progress'); setTopic('all'); }}>
        <PlayCircle className="h-3.5 w-3.5" />
        进行中
        <span className="ml-auto font-mono text-[10px] text-slate-500">{labs.filter((lab) => lab.state === 'in-progress').length}</span>
      </button>
      <button className={navClass(activeView === 'completed')} onClick={() => { setView('completed'); setTopic('all'); }}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        已完成
        <span className="ml-auto font-mono text-[10px] text-slate-500">{labs.filter((lab) => lab.state === 'completed').length}</span>
      </button>
      <div className="mt-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">按主题</div>
      {topics.map((topic) => {
        const Icon = iconForTopic(topic);
        return (
          <button key={topic} className={navClass(activeTopic === topic)} onClick={() => { setView('all'); setTopic(topic); }}>
            <Icon className="h-3.5 w-3.5" />
            {topic}
            <span className="ml-auto font-mono text-[10px] text-slate-500">{labs.filter((lab) => lab.topic === topic).length}</span>
          </button>
        );
      })}
        </>
      )}

      <div className="mt-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">其他</div>
      {/* 实验报告与顶部材料卡为同一份 PDF */}
      <a href={labReportMaterial.href} target="_blank" rel="noreferrer" className={navClass(false)}>
        <FileText className="h-3.5 w-3.5" />
        实验报告
      </a>
      <Link href="/analytics" className={navClass(false)}>
        <BarChart3 className="h-3.5 w-3.5" />
        成绩与进度
      </Link>
      {isTeacher && (
        <Link href="/teacher/classes" className={navClass(false)}>
          <Users className="h-3.5 w-3.5" />
          班级管理
        </Link>
      )}
      <Link href="/settings" className={navClass(false)}>
        <Settings className="h-3.5 w-3.5" />
        设置
      </Link>
    </aside>
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
          <span className="ml-2 font-mono text-[10px] text-slate-500">{resourceLabels[resource.type]}</span>
        </div>
      </a>
    );
  }

  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{resource.title}</span>
      <span className="shrink-0 rounded-sm bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
        {resourceLabels[resource.type]}
      </span>
    </>
  );

  const className =
    'inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 text-xs text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06] hover:text-cyan-100';

  if (!href) {
    return (
      <span className={cn(className, 'hover:border-white/[0.08] hover:bg-white/[0.035] hover:text-slate-300')} title={`第${chapter}章资料位`}>
        {content}
      </span>
    );
  }

  if (href.startsWith('http')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
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

function CourseMaterialPanel() {
  const [showLabPdf, setShowLabPdf] = useState(false);
  return (
    <div className="glass-hover transition-all mb-5 space-y-3 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-200">Course Material · 已接入资料</div>
          <h2 className="mt-2 text-base font-semibold text-slate-50">{labReportMaterial.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{labReportMaterial.meta}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLabPdf((v) => !v)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/[0.10] px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/[0.18]"
          >
            <FileText className="h-4 w-4" />
            {showLabPdf ? '收起预览' : '内嵌预览'}
          </button>
          <a
            href={labReportMaterial.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-[#02130c] hover:bg-emerald-200"
          >
            <FileText className="h-4 w-4" />
            新标签打开
          </a>
        </div>
      </div>
      {/* PDF/图纸内容本身是白纸黑字的文档，不改动——但外层直接 bg-white
          会在深色主题里露出大片刺眼白板。统一"深色画框裱文档"处理：外层
          容器深色+内边距，白色只出现在留白包裹的内层，让文档像被精心
          裱在深色背景上，呼应 ResourceChip 图纸预览的同款处理。 */}
      {showLabPdf && (
        <div className="rounded-md border border-emerald-300/20 bg-[#0c1117] p-3">
          <object
            data={labReportMaterial.href}
            type="application/pdf"
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
      <div className="grid gap-3 border-t border-emerald-300/15 pt-3 md:grid-cols-2">
        {verifiedDiagrams.map((diagram) => (
          <a
            key={diagram.href}
            href={diagram.href}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-md border border-emerald-300/15 bg-[#0c1117]"
          >
            <div className="flex items-center justify-center p-3">
              <div className="flex items-center justify-center rounded-md bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
                <img src={diagram.href} alt={diagram.title} className="block h-32 w-auto" loading="lazy" />
              </div>
            </div>
            <div className="border-t border-emerald-300/15 bg-[#0c1117] px-3 py-2">
              <div className="text-[12px] font-medium text-slate-100 group-hover:text-emerald-100">{diagram.title}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{diagram.meta}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ChapterCard({ chapter }: { chapter: KnowledgePoint }) {
  const childPoints = getChildPoints(chapter.id);
  const chapterPoints = childPoints.length + 1;
  const resources = getResourcesByChapter(chapter.chapter);
  // 只展示有真实链接的资源，避免出现点不动的条目
  const linkedResources = resources.filter((r) => hrefForResource(r, chapter.chapter) !== null);
  const video = resources.find((resource) => resource.type === 'video' && resource.url);
  const visibleResources = linkedResources.slice(0, 10);
  const summary = buildChapterSummary(chapter, childPoints);
  // 徽章显示题库按章真实题数，而非测验资源条目数
  const quizCount = quizQuestions.filter((q) => q.chapter === chapter.chapter).length;
  const [showTop5, setShowTop5] = useState(false);
  const top5 = childPoints.slice(0, 5);

  return (
    <article id={`item-${chapter.chapter}`} className="glass-hover transition-all scroll-mt-24 overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
      <span id={`chapter-${chapter.chapter}`} className="sr-only" />
      <div className="border-b border-white/[0.08] bg-[#0c1117] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[11px] text-cyan-100">
            CH{chapter.chapter}
          </span>
          <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-500">
            {chapterPoints} 个核心条目
          </span>
          <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-500">
            {linkedResources.length} 项资源
          </span>
          {quizCount > 0 && (
            <Link
              href={`/quiz?chapter=${chapter.chapter}`}
              className="rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-2 py-1 font-mono text-[11px] text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-300/[0.14]"
            >
              {quizCount} 道测验题
            </Link>
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-slate-50">{chapter.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{chapter.description}</p>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-100">章节概要</div>
            <p className="text-sm leading-6 text-slate-400">{summary}</p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-100">二级知识点</div>
            <div className="flex flex-wrap gap-2">
              {childPoints.slice(0, 8).map((point) => (
                <Link
                  key={point.id}
                  href={`/knowledge-graph?chapter=${chapter.chapter}&node=${encodeURIComponent(point.graphNodeId || point.id)}`}
                  className="rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
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
                onClick={() => setShowTop5((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100"
              >
                <span className="font-semibold">本章核心 {top5.length} 个知识点 · 含描述</span>
                <span className="font-mono text-[10px] text-slate-500">{showTop5 ? '收起 ▴' : '展开 ▾'}</span>
              </button>
              {showTop5 && (
                <ul className="mt-2 space-y-1.5">
                  {top5.map((point) => (
                    <li
                      key={point.id}
                      className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-xs"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[10px] text-cyan-300">#{point.id}</span>
                        <Link
                          href={`/knowledge-graph?chapter=${chapter.chapter}&node=${encodeURIComponent(point.id)}`}
                          className="text-sm font-medium text-slate-100 hover:text-cyan-100"
                        >
                          {point.name}
                        </Link>
                        <span className="ml-auto rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
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
            <div className="mb-2 text-sm font-semibold text-slate-100">章节资源</div>
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
                本章已接入知识点、课件、测验与实验入口；课程视频资源持续补充中。
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
        <Link href={`/knowledge-graph?chapter=${chapter.chapter}`} className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition-all hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100">
          <Share2 className="h-3.5 w-3.5" />
          知识图谱
        </Link>
        <Link href={`/quiz?chapter=${chapter.chapter}`} className="inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition-all hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-cyan-100">
          <CheckCircle2 className="h-3.5 w-3.5" />
          章节测验
        </Link>
      </div>
    </article>
  );
}

function CourseChaptersView({ query }: { query: string }) {
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
      <CourseMaterialPanel />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <div className="chip-mark flex h-7 w-7 items-center justify-center rounded-md"><BookOpen className="h-4 w-4 text-cyan-200" /></div>
          课程章节
        </div>
        <div className="font-mono text-[11px] text-slate-500">{filteredChapters.length} / {courseChapters.length} CHAPTERS</div>
      </div>

      {filteredChapters.length > 0 ? (
        <div className="grid gap-4">
          {filteredChapters.map((chapter) => (
            <ChapterCard key={chapter.id} chapter={chapter} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-10 text-center text-sm text-slate-400">
          没有匹配的章节或资源，换个关键词试试
        </div>
      )}
    </div>
  );
}

export function HyperCoursesPage() {
  const { user } = useAuth();
  const [experimentCatalog, setExperimentCatalog] = useState<ExperimentConfig[]>(staticExperiments);
  const [labs, setLabs] = useState<HyperExperimentCard[]>(() => buildHyperExperiments(staticExperiments, []));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<SectionMode>('chapters');
  const [view, setView] = useState('all');
  const [topic, setTopic] = useState('all');

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
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      const result = await fetchHyperJson<unknown>('/api/experiments/save', token);
      if (!active) return;
      setLabs(buildHyperExperiments(experimentCatalog, normalizeExperimentRecords(result.data)));
      setLoading(false);
    }
    loadRecords();
    return () => {
      active = false;
    };
  }, [experimentCatalog]);

  const topics = useMemo(() => Array.from(new Set(labs.map((lab) => lab.topic))), [labs]);
  const continueLab = useMemo(() => getContinueExperiment(labs), [labs]);

  const filteredLabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return labs.filter((lab) => {
      if (view === 'in-progress' && lab.state !== 'in-progress') return false;
      if (view === 'completed' && lab.state !== 'completed') return false;
      if (topic !== 'all' && lab.topic !== topic) return false;
      if (!q) return true;
      return `${lab.title} ${lab.description} ${lab.topic} ${lab.id}`.toLowerCase().includes(q);
    });
  }, [labs, query, topic, view]);

  const isPublicShell = !user;

  return (
    <div
      className={cn(
        'animate-fade-in bg-[#070a0d] text-slate-100',
        isPublicShell ? 'min-h-screen' : '-m-6 min-h-[calc(100vh-3.5rem)] overflow-auto',
      )}
    >
      {isPublicShell && (
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md">
              <Cpu className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-slate-50">芯智育才</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">8051 Lab</span>
            </div>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.05] px-3 text-sm text-slate-100 hover:bg-white/[0.09]"
          >
            登录平台
          </Link>
        </div>
      )}
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Cpu className="h-3.5 w-3.5" />
              8051 · AT89C52 · Intel MCS-51
            </div>
            <h1 className="heading-gradient text-2xl font-semibold tracking-tight md:text-3xl">
              {section === 'chapters' ? '课程内容' : '课程实验工作台'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {section === 'chapters'
                ? '按教学大纲组织 10 个章节，接入知识图谱、课件、测验和实验报告；课程视频资源持续补充中。'
                : '以实验为主线组织 8051 学习内容，直接连接仿真器、知识图谱和学习进度。'}
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={section === 'chapters' ? '搜索章节、知识点、资源...' : '搜索实验、主题、编号...'}
              className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
          </div>
        </div>
      </div>

      {!isPublicShell && (
        <div className="px-4 pt-4 md:px-6">
          <NextStepBanner />
        </div>
      )}

      <main className="grid gap-5 px-4 py-5 lg:grid-cols-[240px_1fr] md:px-6">
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
        />

        {section === 'chapters' ? (
          <CourseChaptersView query={query} />
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
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <div className="chip-mark flex h-7 w-7 items-center justify-center rounded-md"><LayoutGrid className="h-4 w-4 text-cyan-200" /></div>
              实验列表
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />}
            </div>
            <div className="font-mono text-[11px] text-slate-500">{filteredLabs.length} / {labs.length} ITEMS</div>
          </div>

          {filteredLabs.length > 0 ? (
            <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLabs.map((lab) => (
                <LabCard key={lab.id} lab={lab} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-10 text-center text-sm text-slate-400">
              没有匹配的实验，换个关键词或筛选条件试试
            </div>
          )}
          </div>
        )}
      </main>
    </div>
  );
}
