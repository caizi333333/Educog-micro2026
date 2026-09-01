'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ComponentType, type JSX, type ReactNode } from 'react';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Gauge,
  GitBranch,
  GraduationCap,
  Layers3,
  Loader2,
  MonitorPlay,
  RefreshCcw,
  Route,
  Search,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { type LearningPlanOutput } from '@/ai/flows/learning-plan-flow';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { knowledgePoints as staticKnowledgePoints } from '@/lib/knowledge-points';
import { experiments as staticExperiments } from '@/lib/experiment-config';
import { cn } from '@/lib/utils';
import { fetchHyperJson, normalizeLearningProgress, type HyperLearningProgressRecord } from '@/lib/hyper-data';
import { ClientRequestTimeoutError, fetchClientRequest } from '@/lib/client-fetch';

type LearningStep = LearningPlanOutput['plan'][number];
type StepType = LearningStep['type'];

type DataStatus = 'checking' | 'ready' | 'none' | 'error';

const weakAreasSchema = z.array(z.string());
const storedAssessmentSchema = z.object({
  timestamp: z.string().optional(),
  weakKAs: weakAreasSchema,
});
const weakAreaDetailsSchema = z.object({
  weakAreas: weakAreasSchema.optional(),
  weakKAs: weakAreasSchema.optional(),
});
const activityItemSchema = z.object({ details: z.string().nullish() });
const activityResponseSchema = z.object({
  activities: z.array(activityItemSchema).optional(),
  data: z.array(activityItemSchema).optional(),
});
const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string().min(1),
  note: z.string().min(1),
});
const learningProgressEnvelopeSchema = z.object({
  dataProvenance: dataProvenanceSchema,
  asOf: z.string().datetime(),
  sampleSize: z.object({ learningProgressRecords: z.number().int().nonnegative() }),
});
const learningExperimentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  duration: z.number().nonnegative(),
  knowledgePoints: z.array(z.string()),
});
const experimentResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(learningExperimentSchema),
});
const knowledgePointResourceSchema = z.object({
  type: z.enum(['video', 'animation', 'slide', 'quiz', 'document', 'experiment', 'image']),
  title: z.string(),
  refId: z.string().optional(),
  duration: z.number().optional(),
});
const learningKnowledgePointSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  parentId: z.string().optional(),
  chapter: z.number().int().positive(),
  description: z.string().optional(),
  resources: z.array(knowledgePointResourceSchema).optional(),
});
const knowledgePointResponseSchema = z.object({
  data: z.array(learningKnowledgePointSchema),
});
const learningPlanSchema = z.object({
  plan: z.array(z.object({
    step: z.number(),
    type: z.enum(['read', 'simulate', 'watch', 'quiz']),
    title: z.string(),
    description: z.string(),
    resource: z.object({ text: z.string(), href: z.string() }),
  })),
});

type LearningExperiment = z.infer<typeof learningExperimentSchema>;
type LearningKnowledgePoint = z.infer<typeof learningKnowledgePointSchema>;

interface AreaProfile {
  area: string;
  chapter: number;
  chapterTitle: string;
  primaryPoint: LearningKnowledgePoint | null;
  relatedCount: number;
  relatedExperiment: {
    id: string;
    title: string;
    duration: number;
    difficulty: string;
  } | null;
  progress: number | null;
}

const stepTypeMeta: Record<StepType, { label: string; Icon: ComponentType<{ className?: string }>; tone: string; hint: string }> = {
  read: {
    label: '理论校准',
    Icon: BookOpen,
    tone: 'border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100',
    hint: '先把概念、寄存器和约束讲清楚',
  },
  simulate: {
    label: '仿真实作',
    Icon: Cpu,
    tone: 'border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100',
    hint: '用实验观察端口、时序和状态变化',
  },
  watch: {
    label: '示例观察',
    Icon: MonitorPlay,
    tone: 'border-sky-300/30 bg-sky-300/[0.08] text-sky-100',
    hint: '通过案例演示补齐操作细节',
  },
  quiz: {
    label: '测评回收',
    Icon: ClipboardCheck,
    tone: 'border-amber-300/30 bg-amber-300/[0.08] text-amber-100',
    hint: '用题目确认是否真正掌握',
  },
};

const areaAliasMap: Record<string, string[]> = {
  CPU结构: ['cpu', '中央处理器', '运算器', '控制器'],
  存储器结构: ['存储器', 'ram', 'rom', 'sfr', '特殊功能寄存器'],
  'I/O 端口': ['io', 'i/o', '端口', 'p0', 'p1', 'p2', 'p3'],
  指令系统: ['指令', '汇编', '寻址'],
  寻址方式: ['寻址', '立即寻址', '直接寻址', '寄存器寻址'],
  '定时器/计数器': ['定时器', '计数器', 't0', 't1'],
  中断系统: ['中断', '优先级', '外部中断'],
  LED动态扫描: ['led', '动态扫描', '数码管'],
  矩阵键盘扫描: ['键盘', '矩阵键盘', '消抖'],
  ADC应用: ['adc', '模数转换', '采样'],
  'ADC 应用': ['adc', '模数转换', '采样'],
  串行通信: ['串口', '串行通信', 'uart', 'scon', 'sbuf'],
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s/\\（）()·:：,，-]/g, '');
}

function getAreaTerms(area: string): string[] {
  const normalized = compact(area);
  const aliasEntry = Object.entries(areaAliasMap).find(([label, aliases]) => {
    const labelText = compact(label);
    return normalized.includes(labelText) || labelText.includes(normalized) || aliases.some((alias) => normalized.includes(compact(alias)));
  });
  return Array.from(new Set([area, aliasEntry?.[0] ?? '', ...(aliasEntry?.[1] ?? [])].map(compact).filter((item) => item.length > 1)));
}

function findRelatedPoints(area: string, kps: LearningKnowledgePoint[]): LearningKnowledgePoint[] {
  // 测评薄弱点以知识原子 id 形式存储（如 "3.5"），优先按 id 精确匹配到知识点
  const byId = kps.filter((point) => point.id === area);
  if (byId.length > 0) return byId;
  const terms = getAreaTerms(area);
  if (terms.length === 0) return [];
  return kps.filter((point) => {
    const text = compact(`${point.name} ${point.description ?? ''}`);
    return terms.some((term) => text.includes(term) || term.includes(compact(point.name)));
  });
}

function findRelatedExperiment(area: string, experiments: LearningExperiment[]): AreaProfile['relatedExperiment'] {
  const terms = getAreaTerms(area);
  const match = experiments.find((experiment) => {
    const text = compact(`${experiment.title} ${experiment.description ?? ''} ${experiment.knowledgePoints.join(' ')}`);
    return terms.some((term) => text.includes(term));
  });

  if (!match) return null;

  return {
    id: match.id,
    title: match.title,
    duration: match.duration,
    difficulty: match.difficulty,
  };
}

// 薄弱点多为 KA id（"5.3"）而非关键词，getAreaTerms 的别名表按文本关键词
// 匹配，对纯数字编号的 area 基本必失配。知识点数据里 resources 已经显式
// 标注了对应实验（refId），优先按这条权威关系找，找不到再退回关键词模糊匹配。
function findExperimentFromPoints(
  points: LearningKnowledgePoint[],
  experiments: LearningExperiment[],
): AreaProfile['relatedExperiment'] {
  for (const point of points) {
    const resource = point.resources?.find((item) => item.type === 'experiment');
    if (!resource) continue;
    const match = experiments.find((experiment) => experiment.id === resource.refId);
    if (match) {
      return { id: match.id, title: match.title, duration: match.duration, difficulty: match.difficulty };
    }
  }
  return null;
}

function getChapterProgress(progress: HyperLearningProgressRecord[], chapter: number): number | null {
  const keys = new Set([`ch${chapter}`, String(chapter)]);
  const records = progress.filter((record) => record.chapterId && keys.has(record.chapterId));
  if (records.length === 0) return null;
  return Math.round(records.reduce((sum, record) => sum + (record.progress ?? 0), 0) / records.length);
}

function buildAreaProfile(
  area: string,
  progress: HyperLearningProgressRecord[],
  experiments: LearningExperiment[],
  kps: LearningKnowledgePoint[],
): AreaProfile {
  const relatedPoints = findRelatedPoints(area, kps);
  const primaryPoint = relatedPoints.find((point) => point.level === 2) ?? relatedPoints[0] ?? null;
  const chapter = primaryPoint?.chapter ?? 1;
  const chapterRoot = kps.find((point) => point.level === 1 && point.chapter === chapter);
  const relatedExperiment =
    (primaryPoint?.id === '3.1' || primaryPoint?.id.startsWith('3.1.')
      ? ((): AreaProfile['relatedExperiment'] => {
        const experiment = experiments.find((item) => item.id === 'exp02');
        return experiment ? { id: experiment.id, title: experiment.title, duration: experiment.duration, difficulty: experiment.difficulty } : null;
      })()
      : null) ??
    findExperimentFromPoints([primaryPoint, ...relatedPoints].filter((point): point is LearningKnowledgePoint => Boolean(point)), experiments) ??
    findRelatedExperiment(area, experiments);

  return {
    area,
    chapter,
    chapterTitle: chapterRoot?.name ?? `第${chapter}章`,
    primaryPoint,
    relatedCount: relatedPoints.length,
    relatedExperiment,
    progress: getChapterProgress(progress, chapter),
  };
}

function buildFallbackPlan(
  weakAreas: string[],
  experiments: LearningExperiment[],
  kps: LearningKnowledgePoint[],
): LearningPlanOutput {
  const plan: LearningStep[] = [];
  let step = 1;

  weakAreas.slice(0, 4).forEach((area) => {
    const profile = buildAreaProfile(area, [], experiments, kps);
    plan.push({
      step: step++,
      type: 'read',
      title: `${area}概念校准`,
      description: `回到${profile.chapterTitle}，先确认${area}涉及的核心概念、寄存器作用和常见约束。`,
      resource: {
        text: '打开知识图谱',
        href: profile.primaryPoint ? `/knowledge-graph?node=${encodeURIComponent(profile.primaryPoint.id)}` : '/knowledge-graph',
      },
    });

    plan.push({
      step: step++,
      type: 'simulate',
      title: profile.relatedExperiment ? profile.relatedExperiment.title : `${area}仿真验证`,
      description: profile.relatedExperiment
        ? `用${profile.relatedExperiment.title}观察输入、输出和状态变化，把薄弱点落实到可运行程序。`
        : `进入仿真页面，用示例程序验证${area}的关键现象。`,
      resource: {
        text: profile.relatedExperiment ? '进入对应实验' : '进入实验仿真',
        href: profile.relatedExperiment ? `/simulation?experiment=${encodeURIComponent(profile.relatedExperiment.id)}` : '/simulation',
      },
    });
  });

  plan.push({
    step: step++,
    type: 'quiz',
    title: '回到测评验证掌握度',
    description: '完成理论和仿真后重新测评，重点观察薄弱知识点是否仍然低于掌握阈值。',
    resource: {
      text: '重新测评',
      href: weakAreas.some((area) => area === '3.1' || area.startsWith('3.1.'))
        ? '/quiz?topic=addressing-modes&mode=retest'
        : '/quiz',
    },
  });

  return { plan };
}

function buildAdvancedPlan(): LearningPlanOutput {
  return {
    plan: [
      {
        step: 1,
        type: 'simulate',
        title: '完成智能温室综合项目',
        description: '在 proj04 中把传感采集、阈值控制、串口上报和异常处理组合起来验证。',
        resource: { text: '进入智能温室项目', href: '/simulation?experiment=proj04' },
      },
      {
        step: 2,
        type: 'read',
        title: '补看跨章节知识关系',
        description: '在知识图谱中查看硬件结构、指令系统和接口应用之间的依赖关系。',
        resource: { text: '查看知识图谱', href: '/knowledge-graph' },
      },
      {
        step: 3,
        type: 'quiz',
        title: '挑战一次综合测评',
        description: '通过综合题检查知识迁移能力，不只看单点记忆。',
        resource: { text: '开始挑战', href: '/quiz' },
      },
    ],
  };
}

function PlanShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      {children}
    </div>
  );
}

function RoutePreview(): JSX.Element {
  const items = [
    { label: '诊断', Icon: Gauge },
    { label: '图谱', Icon: BrainCircuit },
    { label: '仿真', Icon: Cpu },
    { label: '回测', Icon: ClipboardCheck },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className="relative rounded-md border border-white/[0.08] bg-black/20 p-3">
          {index < items.length - 1 && <div className="absolute right-[-14px] top-1/2 hidden h-px w-7 bg-cyan-300/30 sm:block" />}
          <item.Icon className="h-4 w-4 text-cyan-200" />
          <div className="mt-3 font-mono text-[11px] text-slate-300">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyAssessmentState(): JSX.Element {
  return (
    <section aria-labelledby="empty-assessment-title" className="grid gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1.3fr)_380px] md:px-6">
      <section className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <AlertCircle className="h-3.5 w-3.5" />
              需要测评数据
            </div>
            <h2 id="empty-assessment-title" className="mt-4 text-2xl font-semibold text-slate-50">还不能生成个人路径</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              当前没有找到最近的在线测评结果。先完成一次测评，系统才能识别薄弱知识点并生成可执行路径。
            </p>
          </div>
          <Link href="/quiz" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
            去测评 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8">
          <RoutePreview />
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="text-sm font-semibold text-slate-100">可先进入的基础路径</div>
          <div className="mt-3 space-y-2">
            {[
              { href: '/knowledge-graph', title: '先看知识图谱', desc: '浏览 279 个课程知识点' },
              { href: '/simulation?experiment=exp01', title: '基础 LED 实验', desc: '从 I/O 输出和延时程序开始' },
              { href: '/quiz', title: '完成一次测评', desc: '生成后续个性化路径' },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="block rounded-md border border-white/[0.08] bg-black/20 p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-100">{item.title}</div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

function AssessmentRecoveryErrorState({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <section aria-labelledby="assessment-recovery-title" className="px-4 py-5 md:px-6">
      <div className="mx-auto max-w-3xl rounded-md border border-amber-300/25 bg-amber-300/[0.06] p-5 text-center" role="alert">
        <AlertCircle className="mx-auto h-7 w-7 text-amber-200" aria-hidden="true" />
        <h2 id="assessment-recovery-title" className="mt-3 text-xl font-semibold text-amber-50">最近测评记录暂未核验</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-50/75">{message}</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-400">
          当前不把读取失败解释为“没有测评记录”，也不会据此生成个人路径。
        </p>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            重新读取测评记录
          </button>
          <Link
            href="/quiz"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            开始一次新测评
          </Link>
        </div>
      </div>
    </section>
  );
}

function AreaCard({ profile }: { profile: AreaProfile }): JSX.Element {
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-100">{profile.area}</div>
          <div className="mt-1 text-xs text-slate-400">CH{profile.chapter} · {profile.chapterTitle}</div>
        </div>
        <span className="rounded border border-amber-300/25 bg-amber-300/[0.08] px-2 py-1 font-mono text-[10px] text-amber-100">
          待补强
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-white/[0.08] bg-white/[0.035] p-2">
          <div className="font-mono text-slate-100">{profile.relatedCount}</div>
          <div className="text-slate-400">关联节点</div>
        </div>
        <div className="rounded border border-white/[0.08] bg-white/[0.035] p-2">
          <div className="font-mono text-slate-100">{profile.progress === null ? 'N/A' : `${profile.progress}%`}</div>
          <div className="text-slate-400">记录进度</div>
        </div>
      </div>
    </div>
  );
}

function PlanStepCard({ step }: { step: LearningStep }): JSX.Element {
  const meta = stepTypeMeta[step.type];
  const Icon = meta.Icon;

  return (
    <article className="group relative rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.045] glass-hover">
      <div className="absolute -left-[35px] top-5 hidden h-4 w-4 rounded-full border border-cyan-300/45 bg-[#071116] shadow-[0_0_18px_rgba(34,211,238,0.28)] lg:block" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', meta.tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-400">
                STEP {String(step.step).padStart(2, '0')}
              </span>
              <span className={cn('rounded border px-2 py-1 text-[11px]', meta.tone)}>{meta.label}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-6 text-slate-50">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400"><span className="font-medium text-slate-300">学习目的：</span>{step.description}</p>
          </div>
        </div>
        <Link
          href={step.resource.href}
          target={step.resource.href.startsWith('http') ? '_blank' : '_self'}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 transition hover:bg-cyan-300 hover:text-[#001014] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:w-auto"
        >
          {step.resource.text}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 grid gap-2 text-xs leading-5 sm:grid-cols-2">
        <div className="rounded-md border border-white/[0.07] bg-black/20 px-3 py-2 text-slate-400">
          <span className="font-medium text-slate-300">学习提示：</span>{meta.hint}
        </div>
        <div className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.035] px-3 py-2 text-slate-400">
          <span className="font-medium text-emerald-100">建议完成标志：</span>
          {step.type === 'read' && '完成节点阅读，并能说明核心概念、寄存器作用和约束。'}
          {step.type === 'simulate' && '运行对应实验，观察关键现象并保存实验结果。'}
          {step.type === 'watch' && '看完示例并记录一个关键操作或常见错误。'}
          {step.type === 'quiz' && '完成交卷并取得服务端测评回执。'}
        </div>
      </div>
    </article>
  );
}

export function LearningPathClient({ weakKAsParam }: { weakKAsParam?: string }): JSX.Element {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [weakAreas, setWeakAreas] = useState<string[] | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>('checking');
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [returnHref, setReturnHref] = useState('/learning-path');
  const [plan, setPlan] = useState<LearningPlanOutput | null>(null);
  const [progress, setProgress] = useState<HyperLearningProgressRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [experiments, setExperiments] = useState<LearningExperiment[]>(staticExperiments);
  const [knowledgePoints, setKnowledgePoints] = useState<LearningKnowledgePoint[]>(staticKnowledgePoints);
  const [dataProvenance, setDataProvenance] = useState<z.infer<typeof dataProvenanceSchema> | null>(null);
  const [dataAsOf, setDataAsOf] = useState<string | null>(null);
  const [progressRecordCount, setProgressRecordCount] = useState<number | null>(null);
  const [progressEvidenceStatus, setProgressEvidenceStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [recoverySource, setRecoverySource] = useState<'server' | null>(null);
  const [unverifiedHintCount, setUnverifiedHintCount] = useState(0);
  const [assessmentLoadError, setAssessmentLoadError] = useState<string | null>(null);
  const [assessmentRecoveryAttempt, setAssessmentRecoveryAttempt] = useState(0);

  // Fetch experiments and knowledge points from API on mount
  useEffect(() => {
    if (authLoading || !user || user.role !== 'STUDENT') return;
    let active = true;
    const controller = new AbortController();
    async function fetchData(): Promise<void> {
      try {
        const [expRes, kpRes] = await Promise.all([
          fetchClientRequest('/api/experiments', { signal: controller.signal }),
          fetchClientRequest('/api/knowledge-graph?type=raw', { signal: controller.signal }),
        ]);
        if (expRes.ok) {
          const json: unknown = await expRes.json();
          const parsed = experimentResponseSchema.safeParse(json);
          if (active && parsed.success && parsed.data.success !== false) setExperiments(parsed.data.data);
        }
        if (kpRes.ok) {
          const json: unknown = await kpRes.json();
          const parsed = knowledgePointResponseSchema.safeParse(json);
          if (active && parsed.success && parsed.data.data.length > 0) setKnowledgePoints(parsed.data.data);
        }
      } catch {
        // Keep static fallback on error
      }
    }
    fetchData();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (window.location.pathname.startsWith('/learning-path')) {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, [weakKAsParam]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function init(): Promise<void> {
      if (authLoading) return;
      if (!user || user.role !== 'STUDENT') {
        setWeakAreas(null);
        setPlan(null);
        setDataStatus('checking');
        setAccessErrorStatus(null);
        setRecoverySource(null);
        setUnverifiedHintCount(0);
        setAssessmentLoadError(null);
        return;
      }

      const token = getStoredAccessToken();
      if (!token) {
        setWeakAreas(null);
        setPlan(null);
        setDataStatus('checking');
        setAccessErrorStatus(401);
        setUnverifiedHintCount(0);
        setAssessmentLoadError(null);
        return;
      }

      setAccessErrorStatus(null);
      setAssessmentLoadError(null);
      let urlAreas: string[] | null = null;
      let localAreas: string[] | null = null;
      let serverAreas: string[] | null = null;
      let serverRecoveryError: string | null = null;
      let resolvedRecoverySource: 'server' | null = null;

      if (weakKAsParam) {
        try {
          const decoded: unknown = JSON.parse(decodeURIComponent(weakKAsParam));
          const parsed = weakAreasSchema.safeParse(decoded);
          if (parsed.success) urlAreas = parsed.data;
        } catch (error) {
          console.warn('Failed to parse weakKAsParam:', error);
        }
      }

      // URL 与本机缓存都可被修改，只作为返回位置和恢复线索；
      // 正式薄弱点必须由服务端最近一次测评记录核验后才能生成路径。
      if (typeof window !== 'undefined') {
        const storageKey = user ? `assessment-results-${user.id}` : 'assessment-results';
        const savedResults = localStorage.getItem(storageKey);
        if (savedResults) {
          try {
            const decoded: unknown = JSON.parse(savedResults);
            const parsed = storedAssessmentSchema.safeParse(decoded);
            if (parsed.success) {
              const timestamp = parsed.data.timestamp ? new Date(parsed.data.timestamp).getTime() : Date.now();
              const isRecent = Number.isFinite(timestamp) && Date.now() - timestamp < 48 * 60 * 60 * 1000;
              if (isRecent) localAreas = parsed.data.weakKAs;
            }
          } catch (error) {
            console.warn('Failed to recover assessment results from localStorage:', error);
          }
        }

        try {
          const actRes = await fetchClientRequest('/api/user/activities?action=COMPLETE_QUIZ&limit=1', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (actRes.status === 401 || actRes.status === 403) {
            if (active) {
              setWeakAreas(null);
              setPlan(null);
              setDataStatus('checking');
              setAccessErrorStatus(actRes.status);
            }
            return;
          }
          if (actRes.ok) {
            const raw: unknown = await actRes.json();
            const parsed = activityResponseSchema.safeParse(raw);
            if (parsed.success) {
              const activities = parsed.data.activities ?? parsed.data.data ?? [];
              const detailsText = activities[0]?.details;
              if (detailsText) {
                const detailsRaw: unknown = JSON.parse(detailsText);
                const details = weakAreaDetailsSchema.safeParse(detailsRaw);
                if (details.success) serverAreas = details.data.weakAreas ?? details.data.weakKAs ?? null;
              }
            } else serverRecoveryError = '最近测评记录格式异常，请重新读取。';
          } else {
            serverRecoveryError = `最近测评记录读取失败（${actRes.status}），请稍后重试。`;
          }
        } catch (error) {
          if (controller.signal.aborted && !(error instanceof ClientRequestTimeoutError)) return;
          console.warn('Failed to recover assessment results from server:', error);
          serverRecoveryError = error instanceof ClientRequestTimeoutError
            ? '读取最近测评记录超时；未核验前不会把网址或本机缓存当作正式诊断。'
            : '网络异常，暂时无法核验最近一次服务端测评记录。';
        }
      }

      const unverifiedHints = [...new Set([...(urlAreas ?? []), ...(localAreas ?? [])])];
      const nextAreas = serverAreas;
      if (serverAreas !== null) resolvedRecoverySource = 'server';

      if (!active) return;
      setUnverifiedHintCount(unverifiedHints.length);
      if (nextAreas === null && serverRecoveryError) {
        setWeakAreas(null);
        setPlan(null);
        setRecoverySource(null);
        setAssessmentLoadError(serverRecoveryError);
        setDataStatus('error');
        return;
      }
      setWeakAreas(nextAreas);
      setDataStatus(nextAreas !== null ? 'ready' : 'none');
      setPlan(null);
      setRecoverySource(resolvedRecoverySource);
      setAssessmentLoadError(null);

      if (resolvedRecoverySource === 'server') {
        toast({
          title: '已恢复测评数据',
          description: '已读取服务端保存的最近一次测评结果。',
        });
      }
    }

    void init();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [assessmentRecoveryAttempt, authLoading, weakKAsParam, toast, user]);

  useEffect(() => {
    if (authLoading || !user || user.role !== 'STUDENT') {
      setProgress([]);
      setDataProvenance(null);
      setDataAsOf(null);
      setProgressRecordCount(null);
      setProgressEvidenceStatus('loading');
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function loadProgress(): Promise<void> {
      setProgressEvidenceStatus('loading');
      const token = getStoredAccessToken();
      if (!token) {
        setProgress([]);
        setDataProvenance(null);
        setDataAsOf(null);
        setProgressRecordCount(null);
        setProgressEvidenceStatus('error');
        setAccessErrorStatus(401);
        return;
      }
      const result = await fetchHyperJson<unknown>('/api/learning-progress', token, { signal: controller.signal });
      if (!active) return;
      if (result.status === 401 || result.status === 403) {
        setProgress([]);
        setWeakAreas(null);
        setPlan(null);
        setDataStatus('checking');
        setAccessErrorStatus(result.status);
        setDataProvenance(null);
        setDataAsOf(null);
        setProgressRecordCount(null);
        setProgressEvidenceStatus('error');
        return;
      }
      const evidence = learningProgressEnvelopeSchema.safeParse(result.data);
      if (evidence.success) {
        setDataProvenance(evidence.data.dataProvenance);
        setDataAsOf(evidence.data.asOf);
        setProgressRecordCount(evidence.data.sampleSize.learningProgressRecords);
        setProgressEvidenceStatus('ready');
      } else {
        setDataProvenance(null);
        setDataAsOf(null);
        setProgressRecordCount(null);
        setProgressEvidenceStatus('error');
      }
      setProgress(normalizeLearningProgress(result.data));
    }
    loadProgress();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (accessErrorStatus || dataStatus !== 'ready' || !weakAreas || plan || isGenerating) return;

    if (weakAreas.length === 0) {
      setPlan(buildAdvancedPlan());
      return;
    }

    async function fetchPlan(): Promise<void> {
      if (!weakAreas) return;
      setIsGenerating(true);
      const cacheKey = `learningPlan_${user?.id ?? 'anonymous'}_${weakAreas.join('_')}`;

      try {
        const cachedPlan = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        const cachedAt = cacheTime ? Number(cacheTime) : Number.NaN;
        if (cachedPlan && Number.isFinite(cachedAt) && Date.now() - cachedAt < 24 * 60 * 60 * 1000) {
          const cachedRaw: unknown = JSON.parse(cachedPlan);
          const cached = learningPlanSchema.safeParse(cachedRaw);
          if (cached.success) {
            setPlan(cached.data);
            return;
          }
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(`${cacheKey}_time`);
        }

        const fallbackPlan = buildFallbackPlan(weakAreas, experiments, knowledgePoints);
        setPlan(fallbackPlan);
        localStorage.setItem(cacheKey, JSON.stringify(fallbackPlan));
        localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
      } catch (error) {
        console.error('Failed to generate learning plan:', error);
        setPlan(buildFallbackPlan(weakAreas, experiments, knowledgePoints));
      } finally {
        setIsGenerating(false);
      }
    }

    fetchPlan();
  }, [accessErrorStatus, dataStatus, weakAreas, plan, isGenerating, experiments, knowledgePoints, user?.id]);

  const areaProfiles = useMemo(() => {
    return (weakAreas ?? []).map((area) => buildAreaProfile(area, progress, experiments, knowledgePoints));
  }, [progress, weakAreas, experiments, knowledgePoints]);

  const filteredSteps = useMemo(() => {
    const steps = plan?.plan ?? [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return steps;
    return steps.filter((step) => `${step.title} ${step.description} ${step.resource.text}`.toLowerCase().includes(keyword));
  }, [plan, query]);

  const stepCounts = useMemo(() => {
    const counts: Record<StepType, number> = { read: 0, simulate: 0, watch: 0, quiz: 0 };
    (plan?.plan ?? []).forEach((step) => {
      counts[step.type] += 1;
    });
    return counts;
  }, [plan]);

  const estimatedMinutes = (plan?.plan.length ?? 0) * 35;
  const recoverySourceLabel = recoverySource === 'server' ? '服务端最近测评' : '尚无已核验诊断';
  const hasWeakAreas = dataStatus === 'ready' && weakAreas !== null && weakAreas.length > 0;
  const title = hasWeakAreas ? '个性化学习路径' : '进阶学习路径';
  const subtitle = hasWeakAreas
    ? `根据最近一次服务端测评识别的 ${weakAreas.length} 个薄弱点生成路径。`
    : '当前没有薄弱点时，推荐走综合项目和跨章节复盘。';

  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  if (authLoading) {
    return (
      <PlanShell>
        <div className="flex min-h-[520px] flex-col items-center justify-center px-4 text-center" role="status">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-200" />
          <p className="mt-4 text-sm text-slate-400">正在确认访问角色...</p>
        </div>
      </PlanShell>
    );
  }

  if (!user || accessErrorStatus) {
    return (
      <PlanShell>
        <div className="flex min-h-[520px] items-center justify-center px-4 py-8 text-center">
          <div className="w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.035] p-6">
            <AlertCircle className="mx-auto h-7 w-7 text-cyan-200" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-semibold text-slate-50">
              {accessErrorStatus === 403 ? '需要学生账号' : '登录后查看个人学习路径'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              登录成功后将返回当前地址并保留任务定位参数；薄弱点仍会重新读取服务端测评记录核验。
            </p>
            <Link href={loginRecoveryHref} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              {accessErrorStatus === 403 ? '切换学生账号' : '前往登录'}
            </Link>
          </div>
        </div>
      </PlanShell>
    );
  }

  if (user.role !== 'STUDENT') {
    const destination = user.role === 'TEACHER' ? '/teacher' : '/admin';
    return (
      <PlanShell>
        <div className="flex min-h-[520px] items-center justify-center px-4 py-8 text-center">
          <div className="w-full max-w-md rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6">
            <AlertCircle className="mx-auto h-7 w-7 text-amber-200" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-semibold text-amber-100">该页仅生成学生个人学习路径</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">当前账号不会读取学生测评缓存或生成个性化计划。</p>
            <Link href={destination} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              {user.role === 'TEACHER' ? '返回教学仪表板' : '返回管理端'}
            </Link>
          </div>
        </div>
      </PlanShell>
    );
  }

  return (
    <PlanShell>
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Route className="h-3.5 w-3.5" />
              Adaptive Route · Lab Loop · Mastery Check
            </div>
            <h1 id="learning-path-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">个性化学习</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              把测评薄弱点、知识图谱、仿真实验和回测任务整理成一个可执行的学习闭环。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/quiz" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <RefreshCcw className="h-4 w-4" />
              重新测评
            </Link>
            <Link href="/knowledge-graph" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              查看图谱 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {unverifiedHintCount > 0 && recoverySource === null && (
        <div role="status" className="mx-4 mt-4 rounded-md border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-sm leading-6 text-amber-50 md:mx-6">
          收到 {unverifiedHintCount} 个网址或本机恢复线索，但尚未与服务端测评记录核验，因此不作为正式薄弱点，也不会据此生成诊断路径。请重新读取或完成一次测评。
        </div>
      )}

      <div className="px-4 pt-5 md:px-6">
        {progressEvidenceStatus === 'ready' && dataProvenance && dataAsOf && progressRecordCount !== null ? (
          <div
            role="note"
            className={cn(
              'rounded-md border px-4 py-3',
              dataProvenance.mode === 'REAL'
                ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
                : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
            )}
          >
            <div className="text-sm font-semibold">{dataProvenance.label}</div>
            <p className="mt-1 text-xs leading-5 opacity-80">{dataProvenance.note}</p>
            <p className="mt-1 font-mono text-[10px] leading-5 opacity-70">
              截止 {new Date(dataAsOf).toLocaleString('zh-CN', { hour12: false })}
              {' · '}学习进度 n={progressRecordCount}
              {' · '}薄弱点来源：{recoverySourceLabel}
              {' · '}0 表示服务端确认零记录，N/A 表示暂无可核验记录
            </p>
          </div>
        ) : progressEvidenceStatus === 'error' ? (
          <div role="alert" className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-amber-50">
            <div className="text-sm font-semibold">学习记录身份尚未核验</div>
            <p className="mt-1 text-xs leading-5 text-amber-50/75">当前路径可继续查看，但进度 n 与截止时间显示为 N/A；刷新或重新登录后再核验。</p>
          </div>
        ) : (
          <div role="status" className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-xs text-cyan-50/75">
            正在核验数据身份、截止时间和学习记录样本量…
          </div>
        )}
      </div>

      {dataStatus === 'checking' ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-200" />
          <p className="mt-4 text-sm text-slate-400">正在核验最近测评与学习记录…</p>
        </div>
      ) : dataStatus === 'error' ? (
        <AssessmentRecoveryErrorState
          message={assessmentLoadError ?? '最近测评记录读取失败，请重新核验。'}
          onRetry={() => {
            setDataStatus('checking');
            setAssessmentLoadError(null);
            setAssessmentRecoveryAttempt((attempt) => attempt + 1);
          }}
        />
      ) : dataStatus === 'none' ? (
        <EmptyAssessmentState />
      ) : (
        <section aria-labelledby="learning-path-page-title" className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_340px] md:px-6">
          <aside className="space-y-4 xl:sticky xl:top-20">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">诊断摘要</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    {hasWeakAreas ? `来自${recoverySourceLabel}的薄弱知识点。` : '当前没有检测到薄弱点。'}
                  </div>
                </div>
                <span className="rounded border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[10px] text-cyan-100">
                  {weakAreas?.length ?? 0} 个薄弱知识点
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {areaProfiles.length > 0 ? (
                  areaProfiles.map((profile) => <AreaCard key={profile.area} profile={profile} />)
                ) : (
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-sm leading-6 text-emerald-100">
                    <p>没有薄弱点，建议进入综合项目训练。</p>
                    <Link
                      href="/simulation?experiment=proj04"
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-between rounded-md border border-emerald-200/25 bg-emerald-200/[0.08] px-3 font-semibold text-emerald-50 transition hover:bg-emerald-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                    >
                      进入智能温室项目
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="text-sm font-semibold text-slate-100">学习闭环</div>
              <div className="mt-4 space-y-3">
                {[
                  { label: '定位问题', value: `${areaProfiles.length} 个焦点`, Icon: Target },
                  { label: '规划用时（估算）', value: estimatedMinutes > 0 ? `${estimatedMinutes} 分钟` : 'N/A', Icon: Timer },
                  { label: '路径步骤', value: `${plan?.plan.length ?? 0} 步`, Icon: Layers3 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 p-3 glass-hover">
                    <item.Icon className="h-4 w-4 text-cyan-200" />
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-slate-100">{item.value}</div>
                      <div className="text-xs text-slate-400">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-4 text-slate-400">
                规划用时按“步骤数 × 35 分钟”估算，仅用于安排学习，不是平台记录的实际学习时长。
              </p>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="border-b border-white/[0.08] bg-[#0c1117] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 text-xs text-cyan-100">
                      <Sparkles className="h-3.5 w-3.5" />
                      {hasWeakAreas ? '薄弱点补强路径' : '进阶迁移路径'}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-50">{title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      ['read', '理论'],
                      ['simulate', '仿真'],
                      ['watch', '视频'],
                      ['quiz', '回测'],
                    ] as Array<[StepType, string]>).map(([type, label]) => (
                      <div key={type} className="rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
                        <div className="font-mono text-lg text-slate-50 stat-glow">{stepCounts[type]}</div>
                        <div className="text-[10px] text-slate-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <RoutePreview />
                </div>
              </div>

              <div className="border-b border-white/[0.08] p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="筛选路径步骤..."
                    aria-label="筛选学习路径步骤"
                    className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
                  />
                </div>
              </div>

              <div className="relative p-5">
                <div className="absolute bottom-5 left-[34px] top-5 hidden w-px bg-cyan-300/15 lg:block" />
                {isGenerating && !plan ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-cyan-200" />
                    <p className="mt-4 text-sm text-slate-400">正在生成路径...</p>
                  </div>
                ) : filteredSteps.length > 0 ? (
                  <div className="space-y-4 lg:pl-12">
                    {filteredSteps.map((step) => <PlanStepCard key={`${step.step}-${step.title}`} step={step} />)}
                  </div>
                ) : (
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-6 text-center text-sm text-slate-400" role="status">
                    <p>当前筛选条件下没有路径步骤。</p>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.1] px-3 text-xs text-slate-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                    >
                      清除筛选
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-4 xl:col-span-2 2xl:col-span-1">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <BarChart3 className="h-4 w-4 text-cyan-200" />
                本轮目标
              </div>
              <div className="space-y-2">
                {[
                  { text: '把薄弱点映射到章节和知识节点', Icon: BrainCircuit },
                  { text: '至少完成一次对应仿真实验', Icon: Cpu },
                  { text: '回测并保存新的测评结果', Icon: ClipboardCheck },
                ].map((item) => (
                  <div key={item.text} className="flex gap-3 rounded-md border border-white/[0.08] bg-black/20 p-3 text-sm leading-6 text-slate-300">
                    <item.Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Zap className="h-4 w-4 text-amber-200" />
                快速入口
              </div>
              <div className="grid gap-2">
                {[
                  { href: '/simulation', title: '实验仿真', desc: '验证代码和硬件现象', Icon: Cpu },
                  { href: '/knowledge-graph', title: '知识图谱', desc: '查看完整课程结构', Icon: GitBranch },
                  { href: '/achievements', title: '成就徽章', desc: '检查学习激励记录', Icon: Trophy },
                  { href: '/quiz', title: '在线测评', desc: '完成回测闭环', Icon: GraduationCap },
                ].map((item) => (
                  <Link key={item.title} href={item.href} className="group rounded-md border border-white/[0.08] bg-black/20 p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]">
                    <div className="flex items-start justify-between gap-3">
                      <item.Icon className="h-4 w-4 text-cyan-200" />
                      <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-100">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                数据说明
              </div>
              <p className="text-xs leading-6 text-slate-400">
                路径只使用最近一次服务端测评结果和课程内置知识结构；学习进度只读取已有接口记录，没有记录时显示 N/A。
              </p>
            </div>
          </aside>
        </section>
      )}
    </PlanShell>
  );
}
