'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardData {
  overview: {
    totalStudents: number;
    activeToday: number;
    avgQuizScore: number;
    avgExpCompletion: number;
    avgTimeSpent?: number;
  };
  students: { name: string; avgQuizScore?: number; studentId?: string | null; class?: string | null }[];
  alertStudents: { name: string; avg: number; weakChapters?: { chapter: string; progress: number }[] }[];
  experiments: { id: string; name: string; completed: number }[];
}

interface GainsData {
  scoreDistribution: { label: string; count: number }[];
  scoreSummary: { avg: number; total: number };
  experimentCorrelation: { experimentsCompleted: number; avgScore: number; studentCount: number }[];
  prePostComparison: { name: string; firstScore: number; latestScore: number; gain: number }[];
  chapterMasteryAvg: { chapter: string; avgMastery: number }[];
}

function formatHours(seconds?: number) {
  if (!seconds) return '0h';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h${m}m` : `${h}h`;
}

export default function TeacherReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [gains, setGains] = useState<GainsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      router.push('/login');
      return;
    }
    async function fetchData() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [dashRes, gainsRes] = await Promise.all([
          fetch('/api/teacher/dashboard', { headers }),
          fetch('/api/analytics/learning-gains', { headers }),
        ]);
        if (dashRes.ok) setDashboard(await dashRes.json());
        if (gainsRes.ok) setGains(await gainsRes.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    fetchData();
  }, [user, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const ov = dashboard?.overview;
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  // Dynamic section numbering — only counts visible sections
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  let sectionIdx = 0;
  const nextNum = () => CN[sectionIdx++] ?? String(sectionIdx);

  const showScoreDistribution = gains && gains.scoreDistribution.length > 0;
  const showExpCorrelation = gains && gains.experimentCorrelation.length > 0;
  const showPrePost = gains && gains.prePostComparison.length > 0;
  const showChapterMastery = gains && gains.chapterMasteryAvg.length > 0;
  const showAlerts = dashboard && dashboard.alertStudents.length > 0;
  const showTopStudents = !!dashboard;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Print button - hidden in print */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <h1 className="text-lg font-semibold">教学报告预览</h1>
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">返回</button>
          <button onClick={() => window.print()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">打印 / 导出 PDF</button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-12 py-10 print:px-8 print:py-6">
        {/* Header */}
        <div className="mb-8 border-b-2 border-slate-900 pb-6 text-center">
          <h1 className="text-2xl font-bold">芯智育才平台教学质量分析报告</h1>
          <p className="mt-2 text-sm text-slate-500">桂林航天工业学院 · 微控制器原理与应用 · {dateStr}</p>
        </div>

        {/* 1. Overview */}
        <section className="mb-8">
          <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、班级概览</h2>
          <div className="grid grid-cols-5 gap-4">
            {[
              ['学生总数', `${ov?.totalStudents || 0} 人`],
              ['今日活跃', `${ov?.activeToday || 0} 人`],
              ['平均测验', `${Math.round(ov?.avgQuizScore || 0)}%`],
              ['实验完成率', `${Math.round(ov?.avgExpCompletion || 0)}%`],
              ['平均学习时长', formatHours(ov?.avgTimeSpent)],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-slate-200 p-3 text-center">
                <div className="text-xl font-bold">{value}</div>
                <div className="mt-1 text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Score Distribution */}
        {showScoreDistribution && (
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、成绩分布分析</h2>
            <p className="mb-3 text-sm text-slate-600">
              共 {gains.scoreSummary.total} 名学生参与测验，全班平均分 {gains.scoreSummary.avg}%。分布如下：
            </p>
            <table className="w-full text-sm">
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
          </section>
        )}

        {/* 3. Experiment Correlation */}
        {showExpCorrelation && (
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、实验完成与成绩相关性</h2>
            <p className="mb-3 text-sm text-slate-600">完成实验数量与测验平均分的正相关分析：</p>
            <table className="w-full text-sm">
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
          </section>
        )}

        {/* 4. Pre/Post Comparison */}
        {showPrePost && (
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、前后测验成绩对比</h2>
            <p className="mb-3 text-sm text-slate-600">多次测验学生的成绩变化（按进步幅度降序）：</p>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1">
              {gains.prePostComparison.slice(0, 15).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-600">{i + 1}. {item.name}</span>
                  <span className="font-mono text-slate-500">{item.firstScore}%→{item.latestScore}%</span>
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
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、各章节平均掌握度</h2>
            <table className="w-full text-sm">
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
                    <td className="py-2">{item.chapter}</td>
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
          </section>
        )}

        {/* 6. Alert Students */}
        {showAlerts && (
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、预警学生名单</h2>
            <p className="mb-3 text-sm text-slate-600">以下学生平均测验成绩低于60分，建议重点关注：</p>
            <table className="w-full text-sm">
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
                      {s.weakChapters?.map((c) => `${c.chapter}(${c.progress}%)`).join('、') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 7. Top Students */}
        {showTopStudents && (
          <section className="mb-8">
            <h2 className="mb-4 border-b border-slate-300 pb-2 text-lg font-bold">{nextNum()}、优秀学生表彰（Top 10）</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-semibold">排名</th>
                  <th className="py-2 text-left font-semibold">姓名</th>
                  <th className="py-2 text-left font-semibold">学号</th>
                  <th className="py-2 text-right font-semibold">平均分</th>
                </tr>
              </thead>
              <tbody>
                {[...dashboard.students]
                  .sort((a, b) => (b.avgQuizScore || 0) - (a.avgQuizScore || 0))
                  .slice(0, 10)
                  .map((s, i) => (
                    <tr key={s.name} className="border-b border-slate-100">
                      <td className="py-2 font-mono">{i + 1}</td>
                      <td className="py-2">{s.name}</td>
                      <td className="py-2 font-mono text-slate-500">{s.studentId || '—'}</td>
                      <td className="py-2 text-right font-mono">{Math.round(s.avgQuizScore || 0)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
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
