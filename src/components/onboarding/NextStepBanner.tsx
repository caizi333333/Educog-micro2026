'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Rocket,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientRequest } from '@/lib/client-fetch';

export type NextStepSnapshot = {
  weakKAs?: string[];
  totalScore?: number;
  scores?: Record<string, { score?: number }>;
  timestamp?: string;
};

const snapshotSchema = z.object({
  weakKAs: z.array(z.string()).optional(),
  totalScore: z.number().optional(),
  scores: z.record(z.string(), z.object({ score: z.number().optional() })).optional(),
  timestamp: z.string().optional(),
}).passthrough();

const activityResponseSchema = z.object({
  activities: z.array(z.object({
    details: z.string().nullable().optional(),
  })).optional(),
});

const assessmentDetailsSchema = z.object({
  score: z.number().optional(),
  weakAreas: z.array(z.string()).optional(),
  scoresByKA: z.record(z.string(), z.object({ score: z.number().optional() })).optional(),
}).passthrough();

const experimentResponseSchema = z.object({
  experiments: z.array(z.object({
    status: z.string(),
  }).passthrough()).optional(),
});

type StepKind = 'no-quiz' | 'no-experiment' | 'has-weak' | 'all-strong';

type Step = {
  kind: StepKind;
  title: string;
  body: string;
  cta: { label: string; href: string };
  Icon: LucideIcon;
  tone: 'cyan' | 'amber' | 'emerald';
};

export function computeStep(snapshot: NextStepSnapshot | null, hasExperimentProgress: boolean): Step {
  if (!snapshot?.weakKAs) {
    return {
      kind: 'no-quiz',
      title: '先做一次诊断测验',
      body: '5 分钟摸清你在 8051 全部 10 个章节里的强弱分布；之后知识图谱会按你的掌握度上色。',
      cta: { label: '开始诊断', href: '/quiz' },
      Icon: GraduationCap,
      tone: 'cyan',
    };
  }
  if ((snapshot.weakKAs?.length ?? 0) > 0) {
    return {
      kind: 'has-weak',
      title: `你有 ${snapshot.weakKAs?.length ?? 0} 个薄弱点等着补`,
      body: '一站式复习页会把每个薄弱点的父节点、前置、对应实验和原题都摊开给你。',
      cta: { label: '查看我的薄弱节点', href: '/weak-nodes' },
      Icon: Target,
      tone: 'amber',
    };
  }
  if (!hasExperimentProgress) {
    return {
      kind: 'no-experiment',
      title: '去实验工作台完成一次实践',
      body: '测评未发现薄弱点。现在进入仿真器，用实际指令执行验证已掌握的知识。',
      cta: { label: '开始实验', href: '/simulation' },
      Icon: FlaskConical,
      tone: 'cyan',
    };
  }
  return {
    kind: 'all-strong',
    title: '你已经把基础题都拿下了',
    body: '换一套进阶题继续挑战，或者去实验工作台把对应电路真的跑一遍。',
    cta: { label: '挑战进阶测验', href: '/quiz' },
    Icon: Sparkles,
    tone: 'emerald',
  };
}

const TONE_STYLES: Record<Step['tone'], { wrap: string; pill: string; cta: string }> = {
  cyan: {
    wrap: 'border-cyan-300/30 bg-cyan-300/[0.06]',
    pill: 'bg-cyan-300/[0.12] text-cyan-100',
    cta: 'bg-cyan-300 text-slate-900 hover:bg-cyan-200',
  },
  amber: {
    wrap: 'border-amber-300/30 bg-amber-300/[0.06]',
    pill: 'bg-amber-300/[0.12] text-amber-100',
    cta: 'bg-amber-300 text-slate-900 hover:bg-amber-200',
  },
  emerald: {
    wrap: 'border-emerald-300/30 bg-emerald-300/[0.06]',
    pill: 'bg-emerald-300/[0.12] text-emerald-100',
    cta: 'bg-emerald-300 text-slate-900 hover:bg-emerald-200',
  },
};

const COMPACT_TONE_STYLES: Record<Step['tone'], { wrap: string; pill: string; cta: string }> = {
  cyan: {
    wrap: 'border-cyan-300/20 bg-cyan-300/[0.045]',
    pill: 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200',
    cta: 'bg-primary text-primary-foreground hover:brightness-105',
  },
  amber: {
    wrap: 'border-amber-300/20 bg-amber-300/[0.045]',
    pill: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-200',
    cta: 'bg-amber-300 text-amber-950 hover:bg-amber-200',
  },
  emerald: {
    wrap: 'border-emerald-300/20 bg-emerald-300/[0.045]',
    pill: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200',
    cta: 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200',
  },
};

export function NextStepBanner({
  className,
  hasExperimentProgress,
  assessmentManaged = false,
  assessmentSnapshot,
  compact = false,
}: {
  className?: string;
  hasExperimentProgress?: boolean;
  /**
   * When true, the caller owns assessment loading. An undefined snapshot means
   * "still loading"; null means "loaded, no assessment". In managed mode this
   * component never requests the assessment activity endpoint itself.
   */
  assessmentManaged?: boolean;
  /** In unmanaged mode, a defined value remains a backwards-compatible override. */
  assessmentSnapshot?: NextStepSnapshot | null;
  compact?: boolean;
}): JSX.Element | null {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<NextStepSnapshot | null>(assessmentSnapshot ?? null);
  const [serverHasExperimentProgress, setServerHasExperimentProgress] = useState(hasExperimentProgress ?? false);
  const [hydrated, setHydrated] = useState(false);
  const managedAssessmentPending = assessmentManaged && assessmentSnapshot === undefined;

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    if (assessmentManaged && assessmentSnapshot === undefined) {
      setHydrated(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const userId = user.id;

    async function loadNextStepState(): Promise<void> {
      const callerResolvedAssessment = assessmentManaged || assessmentSnapshot !== undefined;
      let resolvedSnapshot: NextStepSnapshot | null = assessmentSnapshot ?? null;
      let resolvedExperimentProgress = hasExperimentProgress ?? false;

      if (!callerResolvedAssessment) {
        try {
          const key = `assessment-results-${userId}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed: unknown = JSON.parse(raw);
            const validated = snapshotSchema.safeParse(parsed);
            if (validated.success) resolvedSnapshot = validated.data;
          }
        } catch {
          resolvedSnapshot = null;
        }
      }

      // Local/caller evidence is enough for a stable first decision. Server
      // receipts refine it in place instead of holding the entire banner open.
      if (active) {
        setSnapshot(resolvedSnapshot);
        setServerHasExperimentProgress(resolvedExperimentProgress);
        setHydrated(true);
      }

      const token = getStoredAccessToken();
      if (token) {
        const [activityResult, experimentResult] = await Promise.allSettled([
          callerResolvedAssessment
            ? Promise.resolve<Response | null>(null)
            : fetchClientRequest('/api/user/activities?action=COMPLETE_QUIZ&limit=1', {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              }, 6_000),
          hasExperimentProgress === undefined
            ? fetchClientRequest('/api/experiments/save', {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              }, 6_000)
            : Promise.resolve<Response | null>(null),
        ]);
        const activityResponse = activityResult.status === 'fulfilled' ? activityResult.value : null;
        const experimentResponse = experimentResult.status === 'fulfilled' ? experimentResult.value : null;

        try {
          if (activityResponse?.ok) {
            const rawActivity: unknown = await activityResponse.json();
            const parsedActivity = activityResponseSchema.safeParse(rawActivity);
            const detailsText = parsedActivity.success ? parsedActivity.data.activities?.[0]?.details : null;
            if (detailsText) {
              const rawDetails: unknown = JSON.parse(detailsText);
              const parsedDetails = assessmentDetailsSchema.safeParse(rawDetails);
              if (parsedDetails.success) {
                resolvedSnapshot = {
                  weakKAs: parsedDetails.data.weakAreas ?? [],
                  ...(parsedDetails.data.score !== undefined ? { totalScore: parsedDetails.data.score } : {}),
                  ...(parsedDetails.data.scoresByKA ? { scores: parsedDetails.data.scoresByKA } : {}),
                };
              }
            }
          }

          if (experimentResponse?.ok) {
            const rawExperiments: unknown = await experimentResponse.json();
            const parsedExperiments = experimentResponseSchema.safeParse(rawExperiments);
            if (parsedExperiments.success) {
              resolvedExperimentProgress = (parsedExperiments.data.experiments ?? [])
                .some((experiment) => experiment.status === 'COMPLETED');
            }
          }
        } catch {
          // Keep the already-rendered local receipt and caller-provided state.
        }
      }

      if (!active) return;
      setSnapshot(resolvedSnapshot);
      setServerHasExperimentProgress(resolvedExperimentProgress);
      setHydrated(true);
    }

    void loadNextStepState();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [assessmentManaged, assessmentSnapshot, hasExperimentProgress, user]);

  if (!user) return null;
  if (user.role !== 'STUDENT') return null;
  if (managedAssessmentPending || !hydrated) {
    return (
      <div
        className={`${compact ? 'h-[60px] rounded-lg' : 'h-[68px] rounded-md'} animate-pulse border border-white/[0.07] bg-white/[0.025] ${className ?? ''}`}
        aria-busy="true"
        aria-label="正在判断下一项学习动作"
      />
    );
  }

  const effectiveSnapshot = assessmentManaged ? assessmentSnapshot ?? null : snapshot;
  const step = computeStep(effectiveSnapshot, serverHasExperimentProgress);
  const style = compact ? COMPACT_TONE_STYLES[step.tone] : TONE_STYLES[step.tone];
  const Icon = step.Icon;

  return (
    <div className={`${compact ? 'rounded-lg px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,.18)]' : 'rounded-md px-4 py-3'} border ${style.wrap} ${className ?? ''}`}>
      <div className={compact
        ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2'
        : 'flex flex-wrap items-center justify-between gap-3'}>
        <div className={`flex min-w-0 ${compact ? 'items-center gap-2.5' : 'items-start gap-3'}`}>
          <div className={`flex shrink-0 items-center justify-center border ${compact ? 'h-8 w-8 rounded-[8px]' : 'h-9 w-9 rounded-md'} ${style.pill}`}>
            <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </div>
          <div className="min-w-0">
            <div className={`${compact ? 'text-[13px] text-slate-100' : 'text-sm text-slate-50'} font-semibold`}>{step.title}</div>
            <div className={`${compact ? 'line-clamp-2 text-[11px] leading-4 text-slate-400 sm:line-clamp-1' : 'text-xs text-slate-300/90'}`}>{step.body}</div>
          </div>
        </div>
        <Link
          href={step.cta.href}
          className={`inline-flex shrink-0 items-center gap-1.5 px-3 text-xs font-semibold transition active:translate-y-px ${compact ? 'min-h-11 rounded-[8px] py-1' : 'min-h-11 rounded-md py-1.5'} ${style.cta}`}
        >
          {step.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** Three-step welcome card for brand-new students */
export function WelcomeOnboarding({
  className,
  onDismiss,
  hasLearningEvidence = false,
}: {
  className?: string;
  onDismiss?: () => void;
  hasLearningEvidence?: boolean;
}): JSX.Element | null {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `onboarding-dismissed-${user.id}`;
    if (localStorage.getItem(key)) setDismissed(true);
  }, [user]);

  if (user?.role !== 'STUDENT' || dismissed || hasLearningEvidence) return null;

  const handleDismiss = (): void => {
    localStorage.setItem(`onboarding-dismissed-${user.id}`, '1');
    setDismissed(true);
    onDismiss?.();
  };

  const steps = [
    { icon: BookOpen, title: '浏览课程', desc: '10章 8051 知识点，从基础到综合', href: '/', done: false },
    { icon: GraduationCap, title: '完成第一章测验', desc: '5 分钟检验你的掌握程度', href: '/quiz', done: false },
    { icon: FlaskConical, title: '体验实验仿真', desc: '在线操作 LED、数码管、按键电路', href: '/simulation', done: false },
  ];

  return (
    <div className={`relative rounded-md border border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.06] to-emerald-300/[0.04] px-5 py-4 ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="关闭新手引导"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center text-slate-500 hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-300/[0.15]">
          <Rocket className="h-4 w-4 text-cyan-100" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-50">欢迎来到芯智育才，{user.name || '同学'}</div>
          <div className="text-xs text-slate-400">三步开始你的 8051 学习之旅</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Link
            key={s.title}
            href={s.href}
            className="group flex items-start gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 font-mono text-xs text-cyan-100">
              {i + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 group-hover:text-cyan-100">
                <s.icon className="h-3.5 w-3.5" />
                {s.title}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{s.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
