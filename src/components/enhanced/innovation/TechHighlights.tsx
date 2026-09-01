'use client';

import { BarChart3, Brain, Database, FileJson, ShieldCheck, Wrench } from 'lucide-react';
import benchmarkReport from '../../../../public/ai-benchmark.json';

type GenerativeBenchmark = {
  status: string;
  automaticRequiredFactPassRate?: number;
  sampleSize?: number;
  latencyMs?: { p95?: number };
};

const runDate = new Date(benchmarkReport.generatedAt).toLocaleDateString('zh-CN', {
  timeZone: 'Asia/Shanghai',
});
const sourceDigest = benchmarkReport.codeVersion.sourceManifest.digest.slice(0, 12);

/**
 * 历史兼容组件。只显示 public/ai-benchmark.json 中可追溯的固定基准，
 * 不再保留推测准确率、竞品均值、专利数或教学效果提升等无运行记录数据。
 */
export default function TechHighlights(): React.JSX.Element {
  const generative = benchmarkReport.generative as GenerativeBenchmark;
  const generativeCompleted = generative.status === 'COMPLETED';

  const metrics = [
    {
      title: '课程内容检索',
      value: `${benchmarkReport.retrieval.recallAt3}%`,
      metric: 'Recall@3',
      note: `n=${benchmarkReport.retrieval.sampleSize} · MRR ${benchmarkReport.retrieval.meanReciprocalRank.toFixed(4)} · p95 ${benchmarkReport.retrieval.latencyMs.p95}ms`,
      Icon: Database,
      tone: 'text-cyan-100 border-cyan-300/20 bg-cyan-300/[0.06]',
    },
    {
      title: '8051 静态诊断',
      value: benchmarkReport.staticDiagnostic.f1.toFixed(2),
      metric: 'F1',
      note: `n=${benchmarkReport.staticDiagnostic.sampleSize} · 行号定位 ${benchmarkReport.staticDiagnostic.lineLocalizationAccuracy}% · p95 ${benchmarkReport.staticDiagnostic.latencyMs.p95}ms`,
      Icon: Wrench,
      tone: 'text-emerald-100 border-emerald-300/20 bg-emerald-300/[0.06]',
    },
    {
      title: '本地回退',
      value: `${benchmarkReport.localFallback.effectiveAnswerCoverageRate}%`,
      metric: '有效覆盖',
      note: `n=${benchmarkReport.localFallback.sampleSize} · 触发 ${benchmarkReport.localFallback.triggerSuccessRate}% · p95 ${benchmarkReport.localFallback.latencyMs.p95}ms`,
      Icon: ShieldCheck,
      tone: 'text-sky-100 border-sky-300/20 bg-sky-300/[0.06]',
    },
    {
      title: 'DeepSeek 生成解释',
      value: generativeCompleted
        ? `${generative.automaticRequiredFactPassRate ?? 0}%`
        : '未运行',
      metric: generativeCompleted ? '必需事实通过' : 'NOT_RUN',
      note: generativeCompleted
        ? `n=${generative.sampleSize ?? 0} · p95 ${generative.latencyMs?.p95 ?? '—'}ms`
        : '未消耗外部额度；不填推测值，也不声称已完成生成式质量实测。',
      Icon: Brain,
      tone: 'text-amber-100 border-amber-300/20 bg-amber-300/[0.06]',
    },
  ];

  return (
    <section aria-labelledby="verified-tech-title" className="overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1117] text-slate-100">
      <header className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-cyan-200">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Verified benchmark
          </div>
          <h2 id="verified-tech-title" className="mt-2 text-lg font-semibold">可复核的 AI 技术指标</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            当前系统未进行模型微调。检索、静态诊断、本地回退和生成式解释分别记录，指标不能相互替代，也不能用于证明教学成效。
          </p>
        </div>
        <a
          href="/ai-benchmark.json"
          download
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-3 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <FileJson className="h-4 w-4" aria-hidden="true" />
          下载运行记录
        </a>
      </header>

      <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, metric, note, Icon, tone }) => (
          <article key={title} className={`border bg-[#0c1117] p-4 ${tone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <h3 className="mt-3 text-xs font-semibold text-slate-200">{title}</h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold">{value}</span>
              <span className="text-[10px] uppercase tracking-[0.08em] opacity-70">{metric}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{note}</p>
          </article>
        ))}
      </div>

      <footer className="border-t border-white/[0.07] px-5 py-3 font-mono text-[10px] leading-5 text-slate-500">
        RUN {runDate} · SCHEMA v{benchmarkReport.schemaVersion} · SOURCE {sourceDigest} · p95 为本机基准函数耗时，非页面端到端或 DeepSeek 延迟 · 详细公式与样例清单见运行记录
      </footer>
    </section>
  );
}
