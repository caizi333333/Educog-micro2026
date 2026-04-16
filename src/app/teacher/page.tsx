'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Activity, ClipboardCheck, AlertTriangle, FileDown,
  BookOpen, Beaker, TrendingUp, ChevronRight, BarChart3, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/* ── Constants ── */
const CHAPTERS = [
  '概述', '硬件', '指令', 'C语言', '中断', '定时器', '串口', '接口', '系统', '前沿',
];

const EXPERIMENT_NAMES: Record<string, string> = {
  exp01: 'LED控制', exp02: '指令系统', exp03: '定时器', exp04: '数码管',
  exp05: '按键', exp06: '定时中断', exp07: '蜂鸣器', exp08: '步进电机',
  exp09: '串口', proj01: '项目一', proj02: '项目二', proj03: '项目三', proj04: '项目四',
};

/* ── Fallback mock data (used when DB is empty) ── */
const MOCK_STUDENTS = [
  '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '冯十二',
  '陈十三', '褚十四', '卫十五', '蒋十六', '沈十七', '韩十八', '杨十九', '朱二十',
];

function generateMockData() {
  const mastery = MOCK_STUDENTS.map(() =>
    CHAPTERS.map(() => Math.round(30 + Math.random() * 70))
  );
  const students = MOCK_STUDENTS.map((name, i) => ({
    name,
    chapterScores: mastery[i],
    avgScore: Math.round(mastery[i].reduce((s, v) => s + v, 0) / mastery[i].length),
  }));
  const experiments = Object.entries(EXPERIMENT_NAMES).map(([id, name]) => ({
    id, name, completed: Math.round(Math.random() * 18),
  }));
  return {
    overview: {
      totalStudents: 18,
      activeToday: 13,
      avgQuizScore: Math.round(students.reduce((s, st) => s + st.avgScore, 0) / students.length),
      avgExpCompletion: Math.round(experiments.reduce((s, e) => s + e.completed, 0) / experiments.length / 18 * 100),
    },
    students,
    experiments,
    alertStudents: students.filter(s => s.avgScore < 60).map(s => ({ name: s.name, avg: s.avgScore })),
    isMock: true,
  };
}

/* ── Helpers ── */
const masteryColor = (v: number) => {
  if (v >= 80) return 'bg-emerald-500/25 text-emerald-300';
  if (v >= 60) return 'bg-amber-500/20 text-amber-300';
  return 'bg-red-500/20 text-red-400';
};

const barColor = (v: number, max: number) => {
  const pct = max > 0 ? v / max : 0;
  if (pct >= 0.75) return '#a6e3a1';
  if (pct >= 0.4) return '#f9e2af';
  return '#f38ba8';
};

interface DashboardData {
  overview: { totalStudents: number; activeToday: number; avgQuizScore: number; avgExpCompletion: number };
  students: { id?: string; name: string; studentId?: string | null; class?: string | null; chapterScores: number[]; avgScore: number }[];
  experiments: { id: string; name: string; completed: number }[];
  alertStudents: { name: string; avg: number }[];
  isMock: boolean;
}

export default function TeacherPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick actions dialogs/state
  const [pushOpen, setPushOpen] = useState(false);
  const [preclassOpen, setPreclassOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [targetScope, setTargetScope] = useState<'ALL' | 'CLASS'>('CLASS');
  const [targetClass, setTargetClass] = useState<string>('机电2401');
  const [pathType, setPathType] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  const [moduleCount, setModuleCount] = useState<number>(5);
  const [experimentId, setExperimentId] = useState<string>('exp01');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) {
          setData(generateMockData());
          return;
        }
        const res = await fetch('/api/teacher/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setData(generateMockData());
          return;
        }
        const json = await res.json();

        // Transform API response
        if (json.overview.totalStudents === 0) {
          setData(generateMockData());
          return;
        }

        const students = (json.students || []).map((s: any) => {
          const chapterScores = CHAPTERS.map((_, ci) => {
            // Try multiple key formats: ch1, ch01, chapter-1
            const idx = ci + 1;
            const v = s.chapterMastery?.[`ch${idx}`]
              ?? s.chapterMastery?.[`ch${String(idx).padStart(2, '0')}`]
              ?? s.chapterMastery?.[`chapter-${idx}`]
              ?? 0;
            return Math.round(v);
          });
          return {
            id: s.id,
            name: s.name || s.studentId || '未知',
            studentId: s.studentId || null,
            class: s.class || null,
            chapterScores,
            avgScore: s.avgQuizScore || 0,
          };
        });

        const experiments = Object.entries(EXPERIMENT_NAMES).map(([id, name]) => ({
          id, name, completed: json.experimentCompletion?.[id] || 0,
        }));

        setData({
          overview: json.overview,
          students,
          experiments,
          alertStudents: json.alertStudents || [],
          isMock: false,
        });
      } catch {
        setData(generateMockData());
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>仅教师和管理员可访问此页面。</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const { overview, students, experiments, alertStudents } = data;

  const exportGradesCsv = () => {
    const headers = [
      '姓名',
      '学号',
      '班级',
      ...CHAPTERS.map((c) => `章节-${c}`),
      '平均分',
    ];

    const rows = students.map((s) => ([
      s.name,
      s.studentId || '',
      s.class || '',
      ...s.chapterScores.map((v) => String(v)),
      String(s.avgScore),
    ]));

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `成绩单_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: '已导出', description: '成绩单 CSV 已开始下载' });
  };

  const pushLearningTask = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast({ title: '未登录', description: '请先登录教师/管理员账号', variant: 'destructive' });
        return;
      }
      const res = await fetch('/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          scope: targetScope,
          targetClass: targetScope === 'CLASS' ? targetClass : undefined,
          pathType,
          moduleCount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '推送失败');

      toast({
        title: '推送成功',
        description: `已为 ${json.created} 名学生推送学习任务`,
      });
      setPushOpen(false);
    } catch (e: any) {
      toast({
        title: '推送失败',
        description: e?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const assignPreclassQuiz = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        toast({ title: '未登录', description: '请先登录教师/管理员账号', variant: 'destructive' });
        return;
      }
      const res = await fetch('/api/teacher/assign-preclass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          experimentId,
          scope: targetScope,
          targetClass: targetScope === 'CLASS' ? targetClass : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || '布置失败');

      const link = `${window.location.origin}/simulation?experiment=${encodeURIComponent(experimentId)}`;
      await navigator.clipboard.writeText(link);
      toast({
        title: '布置成功',
        description: `已标记 ${json.assigned} 名学生（并已复制实验链接到剪贴板）`,
      });
      setPreclassOpen(false);
    } catch (e: any) {
      toast({
        title: '布置失败',
        description: e?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">教学管理仪表板</h1>
          <p className="text-sm text-muted-foreground mt-1">
            微控制器应用技术 · 2024-2025学年第一学期
            {data.isMock && (
              <Badge variant="outline" className="ml-2 text-[10px]">演示数据</Badge>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <FileDown className="w-4 h-4 mr-1.5" />
          导出学情报告
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{overview.totalStudents}</p>
                <p className="text-xs text-muted-foreground">选课学生</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><Activity className="h-5 w-5 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{overview.activeToday}</p>
                <p className="text-xs text-muted-foreground">今日活跃</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><ClipboardCheck className="h-5 w-5 text-amber-400" /></div>
              <div>
                <p className="text-2xl font-bold">{overview.avgQuizScore}%</p>
                <p className="text-xs text-muted-foreground">平均测验得分</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><TrendingUp className="h-5 w-5 text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold">{overview.avgExpCompletion}%</p>
                <p className="text-xs text-muted-foreground">平均实验完成率</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mastery Heat Map + Experiment Completion */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Heat Map */}
        <Card id="teacher-heatmap" className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              知识点掌握度热力图
            </CardTitle>
            <CardDescription>各学生各章节掌握情况（百分制）</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 w-20">学生</TableHead>
                    {CHAPTERS.map(ch => (
                      <TableHead key={ch} className="text-center text-xs px-1.5 min-w-[48px]">{ch}</TableHead>
                    ))}
                    <TableHead className="text-center text-xs px-2">均分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.name}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium text-xs py-1">{student.name}</TableCell>
                      {student.chapterScores.map((v, ci) => (
                        <TableCell key={ci} className="p-0.5 text-center">
                          <span className={cn(
                            'inline-block w-full py-0.5 rounded text-[10px] font-mono font-semibold',
                            masteryColor(v)
                          )}>
                            {v}
                          </span>
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn('text-[10px] font-bold', masteryColor(student.avgScore))}>
                          {student.avgScore}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/25" /> 优秀 (&ge;80)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/20" /> 良好 (60-79)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20" /> 薄弱 (&lt;60)</span>
            </div>
          </CardContent>
        </Card>

        {/* Experiment Completion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              实验完成情况
            </CardTitle>
            <CardDescription>已完成人数 / {overview.totalStudents}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={experiments} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
                <XAxis type="number" domain={[0, overview.totalStudents]} tick={{ fill: '#6c7086', fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fill: '#a6adc8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}/${overview.totalStudents} 人`, '已完成']}
                />
                <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
                  {experiments.map((e, i) => (
                    <Cell key={i} fill={barColor(e.completed, overview.totalStudents)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alert Panel */}
      {alertStudents.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              学习预警 ({alertStudents.length} 人)
            </CardTitle>
            <CardDescription>以下学生平均掌握度低于60%，建议关注</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {alertStudents.map(s => (
                <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                  <span className="text-sm font-medium">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <Progress value={s.avg} className="w-16 h-1.5" />
                    <span className="text-xs text-red-400 font-mono font-bold">{s.avg}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            快捷操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => setPushOpen(true)}>
              <BookOpen className="w-3.5 h-3.5 mr-1.5" /> 推送学习任务
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreclassOpen(true)}>
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> 布置课前测试
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportGradesCsv}>
              <FileDown className="w-3.5 h-3.5 mr-1.5" /> 导出成绩单
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const el = document.getElementById('teacher-heatmap');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <Activity className="w-3.5 h-3.5 mr-1.5" /> 查看详细分析
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 推送学习任务 */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>推送学习任务</DialogTitle>
            <DialogDescription>为选定范围的学生生成一条新的学习计划（学生可在“学习计划”页面看到）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">推送范围</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={targetScope === 'CLASS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetScope('CLASS')}
                >
                  按班级
                </Button>
                <Button
                  type="button"
                  variant={targetScope === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetScope('ALL')}
                >
                  全部学生
                </Button>
              </div>
            </div>

            {targetScope === 'CLASS' && (
              <div className="space-y-1">
                <div className="text-sm font-medium">班级</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                >
                  <option value="机电2401">机电2401</option>
                  <option value="机电2402">机电2402</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-sm font-medium">任务类型</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={pathType}
                onChange={(e) => setPathType(e.target.value as any)}
              >
                <option value="BASIC">基础强化任务</option>
                <option value="ADVANCED">进阶学习任务</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">覆盖章节数（1-9）</div>
              <Input
                type="number"
                min={1}
                max={9}
                value={moduleCount}
                onChange={(e) => setModuleCount(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPushOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={pushLearningTask} disabled={actionLoading}>
              {actionLoading ? '正在推送...' : '确认推送'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 布置课前测试 */}
      <Dialog open={preclassOpen} onOpenChange={setPreclassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>布置课前测试</DialogTitle>
            <DialogDescription>
              选择一个实验的课前预习测试，并生成可分享的进入链接（会自动打开对应实验并显示课前测试）。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">实验</div>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
              >
                <option value="exp01">exp01 · LED控制</option>
                <option value="exp02">exp02 · 指令系统</option>
                <option value="exp03">exp03 · 定时/计数器</option>
                <option value="exp04">exp04 · 数码管显示</option>
                <option value="exp05">exp05 · 按键与消抖</option>
                <option value="exp06">exp06 · 定时器中断</option>
                <option value="exp07">exp07 · 蜂鸣器</option>
                <option value="exp08">exp08 · 步进电机</option>
                <option value="exp09">exp09 · 串口通信</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">推送范围</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={targetScope === 'CLASS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetScope('CLASS')}
                >
                  按班级
                </Button>
                <Button
                  type="button"
                  variant={targetScope === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTargetScope('ALL')}
                >
                  全部学生
                </Button>
              </div>
            </div>

            {targetScope === 'CLASS' && (
              <div className="space-y-1">
                <div className="text-sm font-medium">班级</div>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                >
                  <option value="机电2401">机电2401</option>
                  <option value="机电2402">机电2402</option>
                </select>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-sm font-medium">分享链接（将自动复制）</div>
              <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/simulation?experiment=${experimentId}`} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreclassOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={assignPreclassQuiz} disabled={actionLoading}>
              {actionLoading ? '正在布置...' : '确认布置并复制链接'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
