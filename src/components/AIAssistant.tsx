'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bug, Brain, Database, Gauge, ShieldCheck, Wrench } from 'lucide-react';
import ErrorDiagnostic from '@/components/ai-assistant/ErrorDiagnostic';
import IntelligentQA from '@/components/ai-assistant/IntelligentQA';
import benchmarkReport from '../../public/ai-benchmark.json';

const benchmarkDate = new Date(benchmarkReport.generatedAt).toLocaleDateString('zh-CN', {
  timeZone: 'Asia/Shanghai',
});
const generativeReport = benchmarkReport.generative as {
  status: string;
  sampleSize?: number;
  automaticRequiredFactPassRate?: number;
  groundedCitationRate?: number;
  forbiddenClaimRate?: number;
  latencyMs?: { p95?: number | null };
  reason?: string;
};
const generativeCompleted = generativeReport.status === 'COMPLETED';
const generativeNotRun = generativeReport.status === 'NOT_RUN';
const benchmarkSourceDigest = benchmarkReport.codeVersion.sourceManifest.digest.slice(0, 12);

// AI助教只保留"智能问答 + 错误诊断"两个真实功能：
// 辅助答疑与诊断，设边界、不代替学生写代码/作答。
const AIAssistant: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState('qa');

  // 缓存标签页配置
  const tabsConfig = useMemo(() => [
    { value: 'qa', icon: Brain, label: '智能问答' },
    { value: 'debug', icon: Bug, label: '错误诊断' }
  ], []);

  // 缓存标签页切换处理函数
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-0 sm:p-6">
      {/* 标题区域 */}
      <div className="order-1 space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Brain className="w-8 h-8 text-cyan-300" />
          <h1 className="text-3xl font-bold text-slate-50">
            AI智能助手
          </h1>
        </div>
        <p className="text-lg text-slate-400 max-w-3xl mx-auto">
          基于课程知识库的AI辅助答疑与汇编错误诊断，帮助你理解问题，不代替你完成作答
        </p>
      </div>

      <details className="group order-3 overflow-hidden rounded-xl border border-white/[0.09] bg-[#0c1117]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 sm:px-5">
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Gauge className="h-4 w-4 text-cyan-200" aria-hidden="true" />
              能力边界与固定基准
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">非作答区域 · 需要时展开查看口径和运行记录</span>
          </span>
          <span className="shrink-0 rounded-md border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 group-open:hidden">展开</span>
          <span className="hidden shrink-0 rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1 text-[11px] text-cyan-100 group-open:inline-flex">收起</span>
        </summary>
        <section className="border-t border-white/[0.08]" aria-labelledby="ai-capability-title">
        <div className="flex flex-col gap-2 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="ai-capability-title" className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Gauge className="h-4 w-4 text-cyan-200" />
              能力构成与判定边界
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">当前系统未进行模型微调；生成式回答与规则诊断分别记录、分别评测。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2.5 py-1 text-[11px] font-medium text-cyan-100">
              本地固定基准运行记录 · 非线上当前版本
            </span>
            <span className="inline-flex w-fit rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-1 text-[11px] text-amber-100">
              {generativeCompleted
                ? '生成式质量：固定题集已实测'
                : generativeNotRun
                  ? '生成式质量：未运行（NOT_RUN）'
                  : `生成式质量：${generativeReport.status}`}
            </span>
            <a
              href="/ai-benchmark.json"
              download
              className="inline-flex min-h-11 items-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-3 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              下载固定运行记录 JSON
            </a>
          </div>
        </div>
        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Database, title: '课程内容检索', text: '对正式知识点和实验资源做关键词召回，回答附节点编号。' },
            { icon: Brain, title: 'DeepSeek 解释', text: '仅在密钥可用时生成解释；失败后进入本地回退。' },
            { icon: Wrench, title: '8051 静态诊断', text: '规则检查助记符、操作数、标号和伪指令，结果不依赖大模型。' },
            { icon: ShieldCheck, title: '教学判定隔离', text: 'AI不直接修改测验得分、实验完成状态或教师评价。' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-[#0c1117] px-4 py-4">
              <Icon className="h-4 w-4 text-cyan-200" />
              <div className="mt-2 text-xs font-semibold text-slate-200">{title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
        <div className="grid border-t border-white/[0.08] bg-black/15 sm:grid-cols-2 lg:grid-cols-4">
          <div className="px-4 py-3">
            <div className="font-mono text-lg font-semibold text-cyan-100">{benchmarkReport.retrieval.recallAt3}% Recall@3</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.retrieval.sampleSize}｜全返回命中 {benchmarkReport.retrieval.knowledgePointHitRate}%｜MRR {benchmarkReport.retrieval.meanReciprocalRank.toFixed(4)}｜p95 {benchmarkReport.retrieval.latencyMs.p95}ms
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 sm:border-l">
            <div className="font-mono text-lg font-semibold text-emerald-200">F1 {benchmarkReport.staticDiagnostic.f1.toFixed(2)}</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.staticDiagnostic.sampleSize}｜P {benchmarkReport.staticDiagnostic.precision.toFixed(2)}｜R {benchmarkReport.staticDiagnostic.recall.toFixed(2)}｜行号 {benchmarkReport.staticDiagnostic.lineLocalizationAccuracy}%
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 lg:border-l">
            <div className="font-mono text-lg font-semibold text-sky-100">{benchmarkReport.localFallback.effectiveAnswerCoverageRate}% 回退覆盖</div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              n={benchmarkReport.localFallback.sampleSize}｜触发 {benchmarkReport.localFallback.triggerSuccessRate}%｜边界 {benchmarkReport.localFallback.boundaryPassRate}%｜p95 {benchmarkReport.localFallback.latencyMs.p95}ms
            </p>
          </div>
          <div className="border-white/[0.08] px-4 py-3 sm:border-l">
            <div className="font-mono text-lg font-semibold text-amber-100">
              {generativeCompleted ? `${generativeReport.automaticRequiredFactPassRate ?? 0}% 事实通过` : generativeNotRun ? '未运行' : generativeReport.status}
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
              {generativeCompleted
                ? `n=${generativeReport.sampleSize ?? 0}｜依据引用 ${generativeReport.groundedCitationRate ?? 0}%｜禁用陈述 ${generativeReport.forbiddenClaimRate ?? 0}%｜p95 ${generativeReport.latencyMs?.p95 ?? '—'}ms`
                : generativeNotRun
                  ? 'DeepSeek固定基准｜未传入 --with-deepseek｜未消耗外部额度'
                  : `DeepSeek固定基准｜${generativeReport.reason ?? '未形成可发布运行记录'}`}
            </p>
          </div>
        </div>
        <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] leading-4 text-slate-400">
          <p>注：检索题来自正式题库，不额外写入目标节点名称；回退覆盖只核对节点或章节对齐，二者均不等同于开放问答正确率，静态诊断指标也不归因于DeepSeek。</p>
          <p className="mt-1">延迟口径：检索、静态诊断和本地回退的 p95 是固定基准函数的本机运行耗时，不是页面端到端延迟或 DeepSeek 响应时间。</p>
          <p className="mt-1 font-mono text-slate-500">RUN {benchmarkDate} · SCHEMA v{benchmarkReport.schemaVersion} · SOURCE {benchmarkSourceDigest} · Recall@3=前3位命中数/n · F1=2PR/(P+R)</p>
        </div>
        </section>
      </details>

      {/* 功能选项卡 */}
      <Tabs id="ai-workspace" value={activeTab} onValueChange={handleTabChange} className="order-2 w-full scroll-mt-4">
        <TabsList className="grid w-full grid-cols-2">
          {tabsConfig.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-2 text-slate-300 data-[state=active]:text-cyan-100"
            >
              <Icon className="w-4 h-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 智能问答 */}
        <TabsContent value="qa">
          <IntelligentQA />
        </TabsContent>

        {/* 错误诊断 */}
        <TabsContent value="debug">
          <ErrorDiagnostic />
        </TabsContent>
      </Tabs>
    </div>
  );
});

AIAssistant.displayName = 'AIAssistant';

export default AIAssistant;
