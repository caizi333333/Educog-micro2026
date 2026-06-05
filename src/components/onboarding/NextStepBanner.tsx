'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FlaskConical,
  GraduationCap,
  Rocket,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Snapshot = {
  weakKAs?: string[];
  totalScore?: number;
  scores?: Record<string, { score?: number }>;
  timestamp?: string;
};

type StepKind = 'no-quiz' | 'no-experiment' | 'has-weak' | 'all-strong';

type Step = {
  kind: StepKind;
  title: string;
  body: string;
  cta: { label: string; href: string };
  Icon: typeof Compass;
  tone: 'cyan' | 'amber' | 'emerald';
};

function computeStep(snapshot: Snapshot | null, hasExperimentProgress: boolean): Step {
  if (!snapshot || !snapshot.weakKAs) {
    return {
      kind: 'no-quiz',
      title: '先做一次诊断测验',
      body: '5 分钟摸清你在 8051 全部 10 个章节里的强弱分布；之后知识图谱会按你的掌握度上色。',
      cta: { label: '开始诊断', href: '/quiz' },
      Icon: GraduationCap,
      tone: 'cyan',
    };
  }
  if (!hasExperimentProgress) {
    return {
      kind: 'no-experiment',
      title: '去实验工作台跑一个电路',
      body: '知识图谱已按你的掌握度上色。现在打开仿真器，亲手操作 LED、数码管和按键。',
      cta: { label: '开始实验', href: '/simulation' },
      Icon: FlaskConical,
      tone: 'cyan',
    };
  }
  if ((snapshot.weakKAs?.length || 0) > 0) {
    return {
      kind: 'has-weak',
      title: `你有 ${snapshot.weakKAs!.length} 个薄弱点等着补`,
      body: '一站式复习页会把每个薄弱点的父节点、前置、对应实验和原题都摊开给你。',
      cta: { label: '查看我的薄弱节点', href: '/weak-nodes' },
      Icon: Target,
      tone: 'amber',
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

export function NextStepBanner({ className, hasExperimentProgress }: { className?: string; hasExperimentProgress?: boolean }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = user ? `assessment-results-${user.id}` : 'assessment-results';
      const raw = localStorage.getItem(key);
      setSnapshot(raw ? (JSON.parse(raw) as Snapshot) : null);
    } catch {
      setSnapshot(null);
    }
    setHydrated(true);
  }, [user]);

  if (!user || !hydrated) return null;
  if (user.role !== 'STUDENT') return null;

  const step = computeStep(snapshot, !!hasExperimentProgress);
  const style = TONE_STYLES[step.tone];
  const Icon = step.Icon;

  return (
    <div className={`rounded-md border ${style.wrap} px-4 py-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${style.pill}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-50">{step.title}</div>
            <div className="text-xs text-slate-300/90">{step.body}</div>
          </div>
        </div>
        <Link
          href={step.cta.href}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${style.cta}`}
        >
          {step.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** Three-step welcome card for brand-new students */
export function WelcomeOnboarding({ className, onDismiss }: { className?: string; onDismiss?: () => void }) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `onboarding-dismissed-${user.id}`;
    if (localStorage.getItem(key)) setDismissed(true);
  }, [user]);

  if (!user || user.role !== 'STUDENT' || dismissed) return null;

  const handleDismiss = () => {
    if (user) localStorage.setItem(`onboarding-dismissed-${user.id}`, '1');
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
        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
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
