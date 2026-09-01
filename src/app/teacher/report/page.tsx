'use client';

import { useEffect, useState, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { getPointsByLevel } from '@/lib/knowledge-points';
import { ClientRequestTimeoutError, fetchClientRequest } from '@/lib/client-fetch';

// 章节号 → "第N章 名称"；'0' 或未知章节归入"未分类"
const CHAPTER_NAME_MAP = new Map(
  getPointsByLevel(1).map((p) => [String(p.chapter), `第${p.chapter}章 ${p.name}`]),
);
function chapterLabel(chapterId?: string | null): string {
  if (!chapterId) return '未分类';
  const key = String(chapterId).trim().replace(/^ch/i, '');
  return CHAPTER_NAME_MAP.get(key) ?? '未分类';
}

interface DashboardData {
  dataProvenance: DataProvenance;
  scope: AnalysisScope;
  overview: {
    totalStudents: number;
    activeToday: number;
    avgQuizScore: number;
    avgExpCompletion: number;
    avgTimeSpent?: number;
  };
  students: {
    name: string;
    avgQuizScore?: number;
    quizAttemptCount?: number;
    totalTimeSpent?: number;
    learningProgressCount?: number;
    analysisEligible?: boolean;
    studentId?: string | null;
    class?: string | null;
  }[];
  alertStudents: { name: string; avg: number; weakChapters?: { chapter: string; progress: number }[] }[];
  experiments: { id: string; name: string; completed: number }[];
}

interface GainsData {
  dataProvenance: DataProvenance;
  scope: AnalysisScope;
  scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN';
  comparisonType: 'REPEATED_ATTEMPT';
  scoreDistribution: { label: string; count: number }[];
  scoreSummary: { avg: number; total: number };
  experimentCorrelation: { experimentsCompleted: number; avgScore: number; studentCount: number }[];
  prePostComparison: { name: string; firstScore: number; latestScore: number; gain: number }[];
  chapterMasteryAvg: { chapter: string; avgMastery: number }[];
}

interface DataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

interface AnalysisScope {
  asOf: string;
  basis: 'ACTIVE_CLASS_ENROLLMENT' | 'ACTIVE_STUDENT_ACCOUNT';
  accessibleClassCount: number;
  enrolledStudentCount: number;
  includedStudentCount: number;
  excludedStudentCount: number;
  exclusions: { code: string; label: string; count: number }[];
  metricSamples: {
    quizStudents: number;
    learningTimeStudents: number;
    experimentStudents: number;
    repeatedAttemptStudents: number;
  };
}

const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string(),
  note: z.string(),
});
const analysisScopeSchema = z.object({
  asOf: z.string().datetime(),
  basis: z.enum(['ACTIVE_CLASS_ENROLLMENT', 'ACTIVE_STUDENT_ACCOUNT']),
  accessibleClassCount: z.number().int().nonnegative(),
  enrolledStudentCount: z.number().int().nonnegative(),
  includedStudentCount: z.number().int().nonnegative(),
  excludedStudentCount: z.number().int().nonnegative(),
  exclusions: z.array(z.object({
    code: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
  })),
  metricSamples: z.object({
    quizStudents: z.number().int().nonnegative(),
    learningTimeStudents: z.number().int().nonnegative(),
    experimentStudents: z.number().int().nonnegative(),
    repeatedAttemptStudents: z.number().int().nonnegative(),
  }),
}).superRefine((scope, context) => {
  if (scope.includedStudentCount + scope.excludedStudentCount !== scope.enrolledStudentCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '纳入与排除人数不等于在册人数' });
  }
  if (scope.exclusions.reduce((sum, item) => sum + item.count, 0) !== scope.excludedStudentCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '排除原因人数与排除总数不一致' });
  }
  if (Object.values(scope.metricSamples).some((sample) => sample > scope.includedStudentCount)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '指标样本数超过纳入分析人数' });
  }
});

const dashboardSchema = z.object({
  dataProvenance: dataProvenanceSchema,
  scope: analysisScopeSchema,
  overview: z.object({
    totalStudents: z.number(), activeToday: z.number(), avgQuizScore: z.number(),
    avgExpCompletion: z.number(), avgTimeSpent: z.number().optional(),
  }),
  students: z.array(z.object({
    name: z.string(), avgQuizScore: z.number().optional(), studentId: z.string().nullable().optional(),
    class: z.string().nullable().optional(), quizAttemptCount: z.number().int().nonnegative().optional(),
    totalTimeSpent: z.number().nonnegative().optional(), learningProgressCount: z.number().int().nonnegative().optional(),
    analysisEligible: z.boolean().optional(),
  })),
  alertStudents: z.array(z.object({
    name: z.string(), avg: z.number(),
    weakChapters: z.array(z.object({ chapter: z.string(), progress: z.number() })).optional(),
  })),
  experiments: z.array(z.object({ id: z.string(), name: z.string(), completed: z.number() })),
}).superRefine((value, context) => {
  const eligibleStudents = value.students.filter((student) => student.analysisEligible !== false);
  const quizStudents = eligibleStudents.filter((student) => (student.quizAttemptCount ?? 0) > 0).length;
  const timeStudents = eligibleStudents.filter(
    (student) => (student.learningProgressCount ?? 0) > 0 && (student.totalTimeSpent ?? 0) > 0,
  ).length;
  if (value.overview.totalStudents !== value.scope.enrolledStudentCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '看板在册人数与范围元数据不一致' });
  }
  if (quizStudents !== value.scope.metricSamples.quizStudents) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '看板测验样本与学生明细不一致' });
  }
  if (timeStudents !== value.scope.metricSamples.learningTimeStudents) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '看板学习时长样本与学生明细不一致' });
  }
});
const gainsSchema = z.object({
  dataProvenance: dataProvenanceSchema,
  scope: analysisScopeSchema,
  scoreAggregation: z.literal('BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN'),
  comparisonType: z.literal('REPEATED_ATTEMPT'),
  scoreDistribution: z.array(z.object({ label: z.string(), count: z.number() })),
  scoreSummary: z.object({ avg: z.number(), total: z.number() }),
  experimentCorrelation: z.array(z.object({ experimentsCompleted: z.number(), avgScore: z.number(), studentCount: z.number() })),
  prePostComparison: z.array(z.object({ name: z.string(), firstScore: z.number(), latestScore: z.number(), gain: z.number() })),
  chapterMasteryAvg: z.array(z.object({ chapter: z.string(), avgMastery: z.number() })),
}).superRefine((value, context) => {
  if (value.scoreSummary.total !== value.scope.metricSamples.quizStudents) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '成绩汇总人数与测验样本数不一致' });
  }
  if (value.prePostComparison.length !== value.scope.metricSamples.repeatedAttemptStudents) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '多次作答明细与样本数不一致' });
  }
});

const LOGIN_EXPIRED_ERROR = '登录已过期，请重新登录后继续';

function reportResponseError(status: number): string {
  if (status === 401) return LOGIN_EXPIRED_ERROR;
  if (status === 403) return '当前账号无权读取教学报告数据';
  return '报告数据读取失败，请稍后重试';
}

const SAFE_REPORT_LOAD_ERRORS = new Set([
  LOGIN_EXPIRED_ERROR,
  '当前账号无权读取教学报告数据',
  '报告数据读取失败，请稍后重试',
  '报告数据格式异常，已阻止导出，请重新加载',
]);

function reportLoadErrorMessage(error: unknown): string {
  if (error instanceof ClientRequestTimeoutError) {
    return '报告数据读取超时，请检查网络后重试';
  }
  if (error instanceof Error && SAFE_REPORT_LOAD_ERRORS.has(error.message)) {
    return error.message;
  }
  // 不把 Failed to fetch、AbortError 或上游服务异常原文暴露给评审人员。
  return '暂时无法读取报告数据，请检查网络后重试';
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h${m}m` : `${h}h`;
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}

function scopeExclusionText(scope: AnalysisScope): string {
  if (scope.exclusions.length === 0) return '无';
  return scope.exclusions.map((item) => `${item.label}（${item.count}人）`).join('；');
}

function scopeBasisLabel(scope: AnalysisScope): string {
  return scope.basis === 'ACTIVE_CLASS_ENROLLMENT' ? '有效班级在册学生' : '有效学生账号';
}

function scopesAlign(dashboardScope: AnalysisScope, gainsScope: AnalysisScope): boolean {
  return dashboardScope.asOf === gainsScope.asOf
    && dashboardScope.basis === gainsScope.basis
    && dashboardScope.accessibleClassCount === gainsScope.accessibleClassCount
    && dashboardScope.enrolledStudentCount === gainsScope.enrolledStudentCount
    && dashboardScope.includedStudentCount === gainsScope.includedStudentCount
    && dashboardScope.excludedStudentCount === gainsScope.excludedStudentCount
    && scopeExclusionText(dashboardScope) === scopeExclusionText(gainsScope);
}

function currentPagePath(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return `${window.location.pathname}${window.location.search}`;
}

function loginHref(returnPath: string, roleMismatch = false): string {
  return `/login?from=${encodeURIComponent(returnPath)}${roleMismatch ? '&reason=teacher-role' : ''}`;
}

function resolveReportProvenance(dashboardValue: DataProvenance, gainsValue: DataProvenance): DataProvenance {
  if (dashboardValue.mode === gainsValue.mode) {
    if (dashboardValue.label === gainsValue.label && dashboardValue.note === gainsValue.note) return dashboardValue;
    return {
      mode: dashboardValue.mode,
      label: dashboardValue.label,
      note: `教学看板：${dashboardValue.note}；学习分析：${gainsValue.note}`,
    };
  }
  return {
    mode: 'MIXED',
    label: '混合数据',
    note: `本报告合并了不同数据身份的来源：教学看板为${dashboardValue.label}，学习分析为${gainsValue.label}。各项仅按对应来源解释。`,
  };
}

export default function TeacherReportPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [gains, setGains] = useState<GainsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [returnPath, setReturnPath] = useState('/teacher/report');

  useEffect(() => {
    setReturnPath(currentPagePath('/teacher/report'));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      router.push(loginHref(currentPagePath('/teacher/report'), Boolean(user)));
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function fetchData(): Promise<void> {
      setLoading(true);
      setLoadError(null);
      setDashboard(null);
      setGains(null);
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error(LOGIN_EXPIRED_ERROR);
        const headers = { Authorization: `Bearer ${token}` };
        // 两个来源使用同一截止时刻，避免报告在并行读取期间出现样本漂移。
        const asOf = new Date().toISOString();
        const scopeQuery = `?asOf=${encodeURIComponent(asOf)}`;
        const [dashRes, gainsRes] = await Promise.all([
          fetchClientRequest(`/api/teacher/dashboard${scopeQuery}`, { headers, signal: controller.signal }),
          fetchClientRequest(`/api/analytics/learning-gains${scopeQuery}`, { headers, signal: controller.signal }),
        ]);
        if (!dashRes.ok || !gainsRes.ok) {
          const failingStatus = [dashRes.status, gainsRes.status].find((status) => status === 401)
            ?? [dashRes.status, gainsRes.status].find((status) => status === 403)
            ?? (!dashRes.ok ? dashRes.status : gainsRes.status);
          throw new Error(reportResponseError(failingStatus));
        }

        const [rawDashboard, rawGains]: [unknown, unknown] = await Promise.all([
          dashRes.json(),
          gainsRes.json(),
        ]);
        const parsedDashboard = dashboardSchema.safeParse(rawDashboard);
        const parsedGains = gainsSchema.safeParse(rawGains);
        if (!parsedDashboard.success || !parsedGains.success) {
          throw new Error('报告数据格式异常，已阻止导出，请重新加载');
        }
        if (active) {
          setDashboard(parsedDashboard.data);
          setGains(parsedGains.data);
        }
      } catch (error) {
        if (active) {
          controller.abort();
          setDashboard(null);
          setGains(null);
          setLoadError(reportLoadErrorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchData();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [user, authLoading, reloadToken, router]);

  // print=1 时（工作台"打印/导出PDF"入口）数据加载完自动唤起打印
  useEffect(() => {
    if (loading || authLoading || loadError) return;
    if (new URLSearchParams(window.location.search).get('print') !== '1') return;
    const timer = setTimeout(() => window.print(), 500);
    return (): void => clearTimeout(timer);
  }, [loading, authLoading, loadError]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-white" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">正在读取并核对教学报告数据…</span>
      </div>
    );
  }

  if (loadError || !dashboard || !gains) {
    const requiresLogin = loadError === LOGIN_EXPIRED_ERROR;
    const requiresTeacherRole = loadError === '当前账号无权读取教学报告数据';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-slate-900">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-semibold">报告数据加载失败</p>
        <p className="text-sm text-slate-500">{loadError ?? '报告数据不完整，已阻止导出。'}</p>
        {requiresLogin || requiresTeacherRole ? (
          <Link
            href={loginHref(returnPath, requiresTeacherRole)}
            className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {requiresTeacherRole ? '切换教师账号' : '重新登录'}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            className="min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            重新加载
          </button>
        )}
      </div>
    );
  }

  const ov = dashboard.overview;
  const reportProvenance = resolveReportProvenance(dashboard.dataProvenance, gains.dataProvenance);
  const reportScopeAligned = scopesAlign(dashboard.scope, gains.scope);
  const reportAsOf = dashboard.scope.asOf;
  const reportDate = new Date(reportAsOf);
  const dateStr = `${reportDate.getFullYear()}年${reportDate.getMonth() + 1}月${reportDate.getDate()}日`;
  const rankedStudents = dashboard.students
    .filter((student) => student.analysisEligible !== false && (student.quizAttemptCount ?? 0) > 0)
    .sort((a, b) => (b.avgQuizScore ?? 0) - (a.avgQuizScore ?? 0));
  const timedStudents = dashboard.students.filter(
    (student) => student.analysisEligible !== false
      && (student.learningProgressCount ?? 0) > 0
      && (student.totalTimeSpent ?? 0) > 0,
  );
  const averageLearningTime = timedStudents.length > 0
    ? Math.round(timedStudents.reduce((sum, student) => sum + (student.totalTimeSpent ?? 0), 0) / timedStudents.length)
    : null;

  // Dynamic section numbering — only counts visible sections
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  let sectionIdx = 0;
  const nextNum = (): string => CN[sectionIdx++] ?? String(sectionIdx);

  const showScoreDistribution = true;
  const showExpCorrelation = gains.experimentCorrelation.length > 0;
  const showPrePost = gains.prePostComparison.length > 0;
  const showChapterMastery = gains.chapterMasteryAvg.length > 0;
  const showAlerts = dashboard.alertStudents.length > 0;
  const showTopStudents = rankedStudents.length > 0;
  const missingAnalysisLabels = [
    !showExpCorrelation && '实验完成数与成绩分组',
    !showPrePost && '同一测验多次作答变化',
    !showChapterMastery && '章节掌握度',
    !showTopStudents && '学生排名',
  ].filter((label): label is string => Boolean(label));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* 打印时隐藏应用侧栏与顶栏，只留白底黑字的报告内容 */}
      <style>{`@page { size: A4 portrait; margin: 14mm 12mm 16mm; }
      @media print {
        header, div[data-variant][data-side] { display: none !important; }
        main { padding: 0 !important; }
        body { background: #fff !important; }
        h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr, img, .report-keep-together { break-inside: avoid; page-break-inside: avoid; }
        .report-table-section { break-inside: auto; page-break-inside: auto; }
        .report-page-start { break-before: page; page-break-before: always; }
      }`}</style>
      {/* Print button - hidden in print */}
      <div className="print:hidden sticky top-0 z-10 flex flex-col items-stretch gap-3 border-b bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h1 className="text-base font-semibold sm:text-lg">教学报告预览</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <button type="button" onClick={() => router.push('/teacher')} className="min-h-11 rounded-md border px-3 py-2 text-sm leading-5 hover:bg-slate-50 sm:px-4">返回教学仪表板</button>
          <button type="button" onClick={() => window.print()} className="min-h-11 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold leading-5 text-white hover:bg-slate-800 sm:px-4">打印 / 导出 PDF</button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 print:px-8 print:py-6">
        {/* Header */}
        <div className="mb-8 border-b-2 border-slate-900 pb-6 text-center">
          <h1 className="text-xl font-bold sm:text-2xl">芯智育才平台教学质量分析报告</h1>
          <p className="mt-2 text-sm text-slate-500">桂林航天工业学院 · 微控制器原理及应用技术 · {dateStr}</p>
          <div className={`mx-auto mt-4 max-w-2xl rounded border px-4 py-3 text-left text-xs leading-5 ${reportProvenance.mode === 'REAL' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
            <strong>{reportProvenance.label}：</strong>{reportProvenance.note}
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-left text-xs leading-5 text-slate-500">
            数据截止：{formatReportDate(reportAsOf)}；范围为当前教师可管理班级的有效学生，不代表某一个单独班级。
          </p>
        </div>

        <section className="report-keep-together mb-8">
          <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、数据范围与样本口径</h2>
          {!reportScopeAligned && (
            <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              教学看板与学习分析的样本范围不一致，以下按来源分别列示；不同来源指标不得直接横向比较。
            </div>
          )}
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[680px] text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-2 text-left font-semibold">数据来源</th>
                  <th className="py-2 text-left font-semibold">对象口径</th>
                  <th className="py-2 text-right font-semibold">在册学生</th>
                  <th className="py-2 text-right font-semibold">纳入分析</th>
                  <th className="py-2 text-right font-semibold">排除</th>
                  <th className="py-2 pl-4 text-left font-semibold">排除原因</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['教学看板', dashboard.scope],
                  ['学习分析', gains.scope],
                ] as const).map(([label, scope]) => (
                  <tr key={label} className="border-b border-slate-100 align-top">
                    <td className="py-2 font-medium">{label}</td>
                    <td className="py-2 text-xs text-slate-600">{scopeBasisLabel(scope)}</td>
                    <td className="py-2 text-right font-mono">{scope.enrolledStudentCount}</td>
                    <td className="py-2 text-right font-mono">{scope.includedStudentCount}</td>
                    <td className="py-2 text-right font-mono">{scope.excludedStudentCount}</td>
                    <td className="py-2 pl-4 text-xs leading-5 text-slate-600">{scopeExclusionText(scope)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            有效样本：测验 {gains.scope.metricSamples.quizStudents} 人；学习时长 {dashboard.scope.metricSamples.learningTimeStudents} 人；正式实验 {gains.scope.metricSamples.experimentStudents} 人；同一测验多次作答 {gains.scope.metricSamples.repeatedAttemptStudents} 人。缺少对应记录的学生不以 0 值代入，也不进入相关排序。
          </p>
        </section>

        {/* 1. Overview */}
        <section className="report-keep-together mb-8">
          <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、教学范围概览</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {[
              ['在册学生', `${ov.totalStudents} 人`],
              ['近24小时活跃', `${ov.activeToday} 人`],
              ['平均测验', gains.scoreSummary.total > 0 ? `${gains.scoreSummary.avg}%` : '—'],
              ['实验完成率', dashboard.scope.metricSamples.experimentStudents > 0 ? `${Math.round(ov.avgExpCompletion)}%` : '—'],
              ['平均学习时长', averageLearningTime !== null ? formatHours(averageLearningTime) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded border border-slate-200 p-3 text-center last:col-span-2 sm:last:col-span-1">
                <div className="break-words text-lg font-bold sm:text-xl">{value}</div>
                <div className="mt-1 text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            平均测验 n={gains.scoreSummary.total}；实验完成率 n={dashboard.scope.metricSamples.experimentStudents}；平均学习时长 n={timedStudents.length}。样本数为 0 时显示“—”。
          </p>
        </section>

        {/* 2. Score Distribution */}
        {showScoreDistribution && (gains.scoreSummary.total === 0 ? (
          <section className="report-keep-together mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、成绩分布分析</h2>
            <p className="text-sm text-slate-500">暂无测验数据，学生完成测验后此处将展示成绩分布。</p>
          </section>
        ) : (
          <section className="report-table-section mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、成绩分布分析</h2>
            <p className="mb-3 text-sm text-slate-600">
              当前可管理范围内共 {gains.scoreSummary.total} 名学生参与测验。每名学生先取各测验的服务端最高分，再对其已作答测验求均值；参与学生平均分为 {gains.scoreSummary.avg}%。分布如下：
            </p>
            <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-[520px] w-full text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">分数段</th>
                  <th className="py-2 text-right font-semibold">人数</th>
                  <th className="py-2 text-right font-semibold">占比</th>
                  <th className="py-2 text-left font-semibold">分布</th>
                </tr>
              </thead>
              <tbody>
                {gains.scoreDistribution.map((r) => {
                  const pct = gains.scoreSummary.total > 0 ? Math.round((r.count / gains.scoreSummary.total) * 100) : 0;
                  return (
                    <tr key={r.label} className="border-b border-slate-100">
                      <td className="py-2">{r.label}</td>
                      <td className="py-2 text-right font-mono">{r.count}</td>
                      <td className="py-2 text-right font-mono">{pct}%</td>
                      <td className="py-2">
                        <div className="h-4 w-full bg-slate-100">
                          <div className="h-full bg-slate-700" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </section>
        ))}

        {/* 3. Experiment score grouping */}
        {showExpCorrelation && (
          <section className="report-table-section mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、实验完成数与成绩分组</h2>
            <p className="mb-3 text-sm text-slate-600">按实验完成数量分组展示测验平均分；该描述性结果不用于判断相关或因果关系。</p>
            <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-[520px] w-full text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">实验完成数</th>
                  <th className="py-2 text-right font-semibold">学生人数</th>
                  <th className="py-2 text-right font-semibold">平均分</th>
                  <th className="py-2 text-left font-semibold">分数条</th>
                </tr>
              </thead>
              <tbody>
                {gains.experimentCorrelation.map((item) => (
                  <tr key={item.experimentsCompleted} className="border-b border-slate-100">
                    <td className="py-2">{item.experimentsCompleted} 个</td>
                    <td className="py-2 text-right font-mono">{item.studentCount}</td>
                    <td className="py-2 text-right font-mono">{item.avgScore}%</td>
                    <td className="py-2">
                      <div className="h-4 w-full bg-slate-100">
                        <div className="h-full bg-emerald-600" style={{ width: `${item.avgScore}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* 4. Repeated-attempt comparison */}
        {showPrePost && (
          <section className="report-keep-together mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、同一测验多次作答变化</h2>
            <p className="mb-3 text-sm text-slate-600">比较同一测验的首次与最近一次作答；该结果不是受控前测/后测，不能单独用于教学效果归因。</p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              {gains.prePostComparison.slice(0, 15).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-600">{i + 1}. {item.name}</span>
                  <span className="font-mono text-slate-500">首次{item.firstScore}%→最近{item.latestScore}%</span>
                  <span className={`font-mono font-semibold ${item.gain > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {item.gain > 0 ? '+' : ''}{item.gain}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Chapter Mastery */}
        {showChapterMastery && (
          <section className="report-table-section mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、各章节平均掌握度</h2>
            <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-[500px] w-full text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">章节</th>
                  <th className="py-2 text-right font-semibold">平均掌握度</th>
                  <th className="py-2 text-left font-semibold">进度</th>
                </tr>
              </thead>
              <tbody>
                {gains.chapterMasteryAvg.map((item) => (
                  <tr key={item.chapter} className="border-b border-slate-100">
                    <td className="py-2">{chapterLabel(item.chapter)}</td>
                    <td className="py-2 text-right font-mono">{item.avgMastery}%</td>
                    <td className="py-2">
                      <div className="h-3 w-full bg-slate-100">
                        <div
                          className={`h-full ${item.avgMastery >= 80 ? 'bg-emerald-600' : item.avgMastery >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${item.avgMastery}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* 6. Alert Students */}
        {showAlerts && (
          <section className="report-table-section mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、预警学生名单</h2>
            <p className="mb-3 text-sm text-slate-600">以下学生平均测验成绩低于60分，建议重点关注：</p>
            <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-[500px] w-full text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">姓名</th>
                  <th className="py-2 text-right font-semibold">平均分</th>
                  <th className="py-2 text-left font-semibold">薄弱章节</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.alertStudents.map((s) => (
                  <tr key={s.name} className="border-b border-slate-100">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right font-mono text-red-600">{Math.round(s.avg)}%</td>
                    <td className="py-2 text-xs text-slate-500">
                      {s.weakChapters?.length
                        ? s.weakChapters.map((c) => `${chapterLabel(c.chapter)}(${c.progress}%)`).join('、')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* 7. Top Students */}
        {showTopStudents && (
          <section className="report-table-section mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、学生成绩概览（按平均分排序）</h2>
            <p className="mb-3 text-sm text-slate-600">
              仅纳入分析范围内且已有服务端测验记录的学生（n={rankedStudents.length}）；排序采用“各测验最高分的学生均值”，真实 0 分保留，无作答记录者不参与排序。
            </p>
            <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-[560px] w-full text-sm print:min-w-0">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">排名</th>
                  <th className="py-2 text-left font-semibold">姓名</th>
                  <th className="py-2 text-left font-semibold">学号</th>
                  <th className="py-2 text-right font-semibold">平均分</th>
                </tr>
              </thead>
              <tbody>
                {rankedStudents
                  .slice(0, 10)
                  .map((s, i) => (
                    <tr key={s.name} className="border-b border-slate-100">
                      <td className="py-2 font-mono">{i + 1}</td>
                      <td className="py-2">{s.name}</td>
                      <td className="py-2 font-mono text-slate-500">{s.studentId ?? '—'}</td>
                      <td className="py-2 text-right font-mono">{Math.round(s.avgQuizScore ?? 0)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {missingAnalysisLabels.length > 0 && (
          <section className="mb-8 rounded border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold">数据说明</h2>
            <p className="mt-2 text-sm text-slate-600">
              当前缺少足够记录，未生成{missingAnalysisLabels.join('、')}。本报告仅呈现已取得的数据，不据此作趋势判断。
            </p>
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-slate-300 pt-4 text-center text-xs text-slate-400">
          芯智育才平台自动生成 · {dateStr} · 桂林航天工业学院
        </div>
      </div>
    </div>
  );
}
