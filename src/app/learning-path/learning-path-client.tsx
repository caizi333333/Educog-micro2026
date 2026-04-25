'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
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
import { generateLearningPlan, type LearningPlanOutput } from '@/ai/flows/learning-plan-flow';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { knowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
import { experiments } from '@/lib/experiment-config';
import { cn } from '@/lib/utils';
import { fetchHyperJson, normalizeLearningProgress, type HyperLearningProgressRecord } from '@/lib/hyper-data';

type LearningStep = LearningPlanOutput['plan'][number];
type StepType = LearningStep['type'];

type DataStatus = 'checking' | 'ready' | 'none';

interface AreaProfile {
  area: string;
  chapter: number;
  chapterTitle: string;
  primaryPoint: KnowledgePoint | null;
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

function compact(value: string) {
  return value.toLowerCase().replace(/[\s/\\（）()·:：,，-]/g, '');
}

function getAreaTerms(area: string) {
  const normalized = compact(area);
  const aliasEntry = Object.entries(areaAliasMap).find(([label, aliases]) => {
    const labelText = compact(label);
    return normalized.includes(labelText) || labelText.includes(normalized) || aliases.some((alias) => normalized.includes(compact(alias)));
  });
  return Array.from(new Set([area, aliasEntry?.[0] || '', ...(aliasEntry?.[1] || [])].map(compact).filter((item) => item.length > 1)));
}

function findRelatedPoints(area: string) {
  const terms = getAreaTerms(area);
  if (terms.length === 0) return [];
  return knowledgePoints.filter((point) => {
    const text = compact(`${point.name} ${point.description || ''}`);
    return terms.some((term) => text.includes(term) || term.includes(compact(point.name)));
  });
}

function findRelatedExperiment(area: string) {
  const terms = getAreaTerms(area);
  const match = experiments.find((experiment) => {
    const text = compact(`${experiment.title} ${experiment.description || ''} ${experiment.knowledgePoints.join(' ')}`);
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

function getChapterProgress(progress: HyperLearningProgressRecord[], chapter: number) {
  const keys = new Set([`ch${chapter}`, String(chapter)]);
  const records = progress.filter((record) => record.chapterId && keys.has(record.chapterId));
  if (records.length === 0) return null;
  return Math.round(records.reduce((sum, record) => sum + (record.progress || 0), 0) / records.length);
}

function buildAreaProfile(area: string, progress: HyperLearningProgressRecord[]): AreaProfile {
  const relatedPoints = findRelatedPoints(area);
  const primaryPoint = relatedPoints.find((point) => point.level === 2) || relatedPoints[0] || null;
  const chapter = primaryPoint?.chapter || 1;
  const chapterRoot = knowledgePoints.find((point) => point.level === 1 && point.chapter === chapter);
  const relatedExperiment = findRelatedExperiment(area);

  return {
    area,
    chapter,
    chapterTitle: chapterRoot?.name || `第${chapter}章`,
    primaryPoint,
    relatedCount: relatedPoints.length,
    relatedExperiment,
    progress: getChapterProgress(progress, chapter),
  };
}

function buildFallbackPlan(weakAreas: string[]): LearningPlanOutput {
  const plan: LearningStep[] = [];
  let step = 1;

  weakAreas.slice(0, 4).forEach((area) => {
    const profile = buildAreaProfile(area, []);
    plan.push({
      step: step++,
      type: 'read',
      title: `${area}概念校准`,
      description: `回到${profile.chapterTitle}，先确认${area}涉及的核心概念、寄存器作用和常见约束。`,
      resource: {
        text: '打开知识图谱',
        href: '/knowledge-graph',
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
      href: '/quiz',
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
        title: '完成一个综合项目实验',
        description: '从项目实验中选择一个场景，把端口、定时、中断和通信知识组合起来验证。',
        resource: { text: '进入项目实验', href: '/simulation?experiment=proj02' },
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

function PlanShell({ children }: { children: ReactNode }) {
  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
      {children}
    </div>
  );
}

function RoutePreview() {
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

function EmptyAssessmentState() {
  return (
    <main className="grid gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1.3fr)_380px] md:px-6">
      <section className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <AlertCircle className="h-3.5 w-3.5" />
              需要测评数据
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-50">还不能生成个人路径</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              当前没有找到最近的在线测评结果。先完成一次测评，系统才能识别薄弱知识点并生成可执行路径。
            </p>
          </div>
          <Link href="/quiz" className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
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
              { href: '/knowledge-graph', title: '先看知识图谱', desc: '浏览 270 个课程知识点' },
              { href: '/simulation?experiment=exp01', title: '基础 LED 实验', desc: '从 I/O 输出和延时程序开始' },
              { href: '/quiz', title: '完成一次测评', desc: '生成后续个性化路径' },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="block rounded-md border border-white/[0.08] bg-black/20 p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-100">{item.title}</div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}

function AreaCard({ profile }: { profile: AreaProfile }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-slate-100">{profile.area}</div>
          <div className="mt-1 text-xs text-slate-500">CH{profile.chapter} · {profile.chapterTitle}</div>
        </div>
        <span className="rounded border border-amber-300/25 bg-amber-300/[0.08] px-2 py-1 font-mono text-[10px] text-amber-100">
          FOCUS
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-white/[0.08] bg-white/[0.035] p-2">
          <div className="font-mono text-slate-100">{profile.relatedCount}</div>
          <div className="text-slate-500">关联节点</div>
        </div>
        <div className="rounded border border-white/[0.08] bg-white/[0.035] p-2">
          <div className="font-mono text-slate-100">{profile.progress === null ? 'N/A' : `${profile.progress}%`}</div>
          <div className="text-slate-500">记录进度</div>
        </div>
      </div>
    </div>
  );
}

function PlanStepCard({ step }: { step: LearningStep }) {
  const meta = stepTypeMeta[step.type];
  const Icon = meta.Icon;

  return (
    <article className="group relative rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.045]">
      <div className="absolute -left-[35px] top-5 hidden h-4 w-4 rounded-full border border-cyan-300/45 bg-[#071116] shadow-[0_0_18px_rgba(34,211,238,0.28)] lg:block" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', meta.tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-500">
                STEP {String(step.step).padStart(2, '0')}
              </span>
              <span className={cn('rounded border px-2 py-1 text-[11px]', meta.tone)}>{meta.label}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-6 text-slate-50">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
          </div>
        </div>
        <Link
          href={step.resource.href}
          target={step.resource.href.startsWith('http') ? '_blank' : '_self'}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 transition hover:bg-cyan-300 hover:text-[#001014]"
        >
          {step.resource.text}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 rounded-md border border-white/[0.07] bg-black/20 px-3 py-2 text-xs leading-5 text-slate-500">
        {meta.hint}
      </div>
    </article>
  );
}

export function LearningPathClient({ weakKAsParam }: { weakKAsParam?: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [weakAreas, setWeakAreas] = useState<string[] | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>('checking');
  const [plan, setPlan] = useState<LearningPlanOutput | null>(null);
  const [progress, setProgress] = useState<HyperLearningProgressRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let nextAreas: string[] | null = null;
    let restoredFromStorage = false;

    if (weakKAsParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(weakKAsParam));
        if (Array.isArray(decoded)) {
          nextAreas = decoded.filter((item): item is string => typeof item === 'string');
        }
      } catch (error) {
        console.warn('Failed to parse weakKAsParam:', error);
      }
    }

    if (!nextAreas && typeof window !== 'undefined') {
      try {
        const storageKey = user ? `assessment-results-${user.id}` : 'assessment-results';
        const savedResults = localStorage.getItem(storageKey);
        if (savedResults) {
          const results = JSON.parse(savedResults);
          const timestamp = typeof results?.timestamp === 'string' ? new Date(results.timestamp).getTime() : Date.now();
          const isRecent = Date.now() - timestamp < 48 * 60 * 60 * 1000;
          if (isRecent && Array.isArray(results?.weakKAs)) {
            nextAreas = results.weakKAs.filter((item: unknown): item is string => typeof item === 'string');
            restoredFromStorage = true;
          }
        }
      } catch (error) {
        console.warn('Failed to recover assessment results from localStorage:', error);
      }
    }

    setWeakAreas(nextAreas);
    setDataStatus(nextAreas ? 'ready' : 'none');
    setPlan(null);

    if (restoredFromStorage) {
      toast({
        title: '已恢复测评数据',
        description: '已从本地记录恢复最近一次薄弱点。',
      });
    }
  }, [weakKAsParam, toast, user]);

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

  useEffect(() => {
    if (dataStatus !== 'ready' || !weakAreas || plan || isGenerating) return;

    if (weakAreas.length === 0) {
      setPlan(buildAdvancedPlan());
      return;
    }

    async function fetchPlan() {
      if (!weakAreas) return;
      setIsGenerating(true);
      const cacheKey = `learningPlan_${weakAreas.join('_')}`;

      try {
        const cachedPlan = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(`${cacheKey}_time`);
        if (cachedPlan && cacheTime && Date.now() - Number(cacheTime) < 24 * 60 * 60 * 1000) {
          setPlan(JSON.parse(cachedPlan));
          setIsGenerating(false);
          return;
        }

        const fallbackPlan = buildFallbackPlan(weakAreas);
        setPlan(fallbackPlan);
        localStorage.setItem(cacheKey, JSON.stringify(fallbackPlan));
        localStorage.setItem(`${cacheKey}_time`, Date.now().toString());

        setTimeout(async () => {
          try {
            const result = await generateLearningPlan({ weakKnowledgeAreas: weakAreas });
            localStorage.setItem(`${cacheKey}_ai`, JSON.stringify(result));
          } catch (error) {
            console.log('后台AI计划生成失败，继续使用本地路径:', error);
          }
        }, 120);
      } catch (error) {
        console.error('Failed to generate learning plan:', error);
        setPlan(buildFallbackPlan(weakAreas));
      } finally {
        setIsGenerating(false);
      }
    }

    fetchPlan();
  }, [dataStatus, weakAreas, plan, isGenerating]);

  const areaProfiles = useMemo(() => {
    return (weakAreas || []).map((area) => buildAreaProfile(area, progress));
  }, [progress, weakAreas]);

  const filteredSteps = useMemo(() => {
    const steps = plan?.plan || [];
    const keyword = query.trim().toLowerCase();
    if (!keyword) return steps;
    return steps.filter((step) => `${step.title} ${step.description} ${step.resource.text}`.toLowerCase().includes(keyword));
  }, [plan, query]);

  const stepCounts = useMemo(() => {
    const counts: Record<StepType, number> = { read: 0, simulate: 0, watch: 0, quiz: 0 };
    (plan?.plan || []).forEach((step) => {
      counts[step.type] += 1;
    });
    return counts;
  }, [plan]);

  const estimatedMinutes = (plan?.plan.length || 0) * 35;
  const hasWeakAreas = dataStatus === 'ready' && !!weakAreas && weakAreas.length > 0;
  const title = hasWeakAreas ? '个性教学路径' : '进阶学习路径';
  const subtitle = hasWeakAreas
    ? `根据最近测评识别的 ${weakAreas.length} 个薄弱点生成路径。`
    : '当前没有薄弱点时，推荐走综合项目和跨章节复盘。';

  return (
    <PlanShell>
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Route className="h-3.5 w-3.5" />
              Adaptive Route · Lab Loop · Mastery Check
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">个性教学</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              把测评薄弱点、知识图谱、仿真实验和回测任务整理成一个可执行的学习闭环。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/quiz" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <RefreshCcw className="h-4 w-4" />
              重新测评
            </Link>
            <Link href="/knowledge-graph" className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              查看图谱 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {dataStatus === 'checking' ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-200" />
          <p className="mt-4 text-sm text-slate-400">正在读取测评数据和学习记录...</p>
        </div>
      ) : dataStatus === 'none' ? (
        <EmptyAssessmentState />
      ) : (
        <main className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_340px] md:px-6">
          <aside className="space-y-4 xl:sticky xl:top-20">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">诊断摘要</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {hasWeakAreas ? '来自最近一次测评的薄弱知识点。' : '当前没有检测到薄弱点。'}
                  </div>
                </div>
                <span className="rounded border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[10px] text-cyan-100">
                  {weakAreas?.length || 0} KA
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {areaProfiles.length > 0 ? (
                  areaProfiles.map((profile) => <AreaCard key={profile.area} profile={profile} />)
                ) : (
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-sm leading-6 text-emerald-100">
                    没有薄弱点，建议进入综合项目训练。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="text-sm font-semibold text-slate-100">学习闭环</div>
              <div className="mt-4 space-y-3">
                {[
                  { label: '定位问题', value: `${areaProfiles.length || 1} 个焦点`, Icon: Target },
                  { label: '预计用时', value: `${estimatedMinutes || 90} 分钟`, Icon: Timer },
                  { label: '路径步骤', value: `${plan?.plan.length || 0} 步`, Icon: Layers3 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 p-3">
                    <item.Icon className="h-4 w-4 text-cyan-200" />
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-slate-100">{item.value}</div>
                      <div className="text-xs text-slate-500">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="border-b border-white/[0.08] bg-[#0c1117] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 text-xs text-cyan-100">
                      <Sparkles className="h-3.5 w-3.5" />
                      {hasWeakAreas ? 'Personalized' : 'Advanced'}
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
                        <div className="font-mono text-lg text-slate-50">{stepCounts[type]}</div>
                        <div className="text-[10px] text-slate-500">{label}</div>
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
                  <div className="rounded-md border border-white/[0.08] bg-black/20 p-6 text-center text-sm text-slate-500">
                    当前筛选条件下没有路径步骤。
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
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                数据说明
              </div>
              <p className="text-xs leading-6 text-slate-500">
                路径优先使用最近测评结果和本地课程配置；学习进度只读取已有接口记录，没有记录时显示 N/A。
              </p>
            </div>
          </aside>
        </main>
      )}
    </PlanShell>
  );
}
