'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Trophy, Users, Target, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCampusDateTime } from '@/lib/campus-time';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { practiceRequest } from '@/lib/practice-cards-client';

type Summary = {
  classes: { id: string; name: string }[];
  classId?: string;
  students: { name: string; studentId: string | null; attempted: number; attempts: number; accuracy: number; lastActive: string | null }[];
  chapters: { chapter: number; title: string; attempts: number; accuracy: number }[];
  missed: { questionId: number; text: string; count: number; commonWrong: string }[];
  leaderboard: { name: string; best: number }[];
};

export default function TeacherPracticePage() {
  const [summary,setSummary] = useState<Summary | null>(null);
  const [classId,setClassId] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const load = useCallback(async (id: string) => {
    setLoading(true);setSummary(null);setError('');
    try { const data=await practiceRequest<Summary>('teacher',undefined,id);setSummary(data); }
    catch(e){ setError(e instanceof Error?e.message:'读取刷题学情失败'); }
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load(classId);},[classId,load]);
  const download = async (kind: string) => {
    try{
      const token=getStoredAccessToken();
      const params=new URLSearchParams({classId:summary?.classId||classId,export:kind});
      const response=await fetch('/api/practice/cards/teacher?'+params,{credentials:'same-origin',headers:token?{Authorization:'Bearer '+token}:{}});
      if(!response.ok)throw new Error('导出失败，请确认班级权限后重试');
      const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download='practice-'+kind+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:'导出失败');}
  };
  const students=summary?.students||[];
  return <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
    <Link href="/teacher" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>返回教学仪表板</Link>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs tracking-widest text-primary">GROWING TOGETHER / 8051</p><h1 className="mt-2 text-2xl font-bold">刷题学情</h1><p className="mt-2 text-sm text-muted-foreground">看见每一次小小的进步。记录按作答时班级归属统计，不作为正式考试成绩。</p></div>{summary&&<label className="text-sm">任教班级<select aria-label="任教班级" className="ml-3 min-h-11 max-w-[240px] rounded-lg border bg-background px-3" value={classId||summary.classId||''} onChange={e=>setClassId(e.target.value)}>{summary.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}</div>
    {error&&<div role="alert" className="rounded-xl border border-destructive/50 p-4 text-sm">{error}<Button variant="ghost" onClick={()=>void load(classId)}>重新加载</Button></div>}
    {loading&&<p role="status" className="py-10 text-center text-muted-foreground">正在读取班级刷题记录…</p>}
    {summary&&!summary.classes.length&&<Card className="p-8 text-muted-foreground">暂无可访问班级，请先创建班级或联系管理员。</Card>}
    {summary&&summary.classes.length>0&&<>
      <div className="grid grid-cols-3 gap-3">{[[Users,students.length,'位学习伙伴'],[Activity,students.reduce((n,s)=>n+s.attempts,0),'次认真练习'],[Target,students.filter(s=>s.attempts>0).length,'位已参与同学']].map(([Icon,value,label],i)=>{const Symbol=Icon as typeof Users;return <Card key={i} className="rounded-2xl p-4 sm:p-6"><Symbol className="mb-3 h-5 w-5 text-primary"/><strong className="text-2xl text-primary">{String(value)}</strong><p className="mt-2 text-xs text-muted-foreground">{String(label)}</p></Card>;})}</div>
      <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={loading} onClick={()=>void download('attempts')}><Download className="mr-2 h-4 w-4"/>答题明细 CSV</Button><Button variant="outline" disabled={loading} onClick={()=>void download('students')}><Download className="mr-2 h-4 w-4"/>学生汇总 CSV</Button></div>
      <h2 className="text-lg font-semibold">学习伙伴们</h2><div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr>{['姓名','学号','已练题数','作答次数','正确率','最后活跃（北京时间）'].map(t=><th key={t} className="px-4 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{students.map((s,i)=><tr key={i} className="border-t bg-card"><td className="px-4 py-4">{s.name}</td><td className="px-4 py-4">{s.studentId||'—'}</td><td className="px-4 py-4">{s.attempted}</td><td className="px-4 py-4">{s.attempts}</td><td className="px-4 py-4">{s.attempts?s.accuracy+'%':'未作答'}</td><td className="px-4 py-4 text-muted-foreground">{s.lastActive?formatCampusDateTime(s.lastActive):'尚未开始'}</td></tr>)}</tbody></table></div>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]"><section><h2 className="mb-3 text-lg font-semibold">章节正确率</h2><p className="mb-3 text-xs text-muted-foreground">按全部作答次数计算，含重练；无作答的章节不显示正确率。</p><div className="grid grid-cols-2 gap-3">{summary.chapters.map(c=><Card key={c.chapter} className="rounded-xl p-4"><div className="flex items-start justify-between gap-2"><span className="text-sm">{c.chapter}. {c.title}</span><strong className="text-primary">{c.attempts?c.accuracy+'%':'—'}</strong></div><p className="mt-2 text-xs text-muted-foreground">{c.attempts} 次作答</p></Card>)}</div></section><Card className="h-fit rounded-2xl p-5"><h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-5 w-5 text-amber-400"/>本班闪电榜</h2><p className="mt-2 text-xs text-muted-foreground">个人最佳 · 姓名展示 · Top 10</p><ol className="mt-5 space-y-4">{summary.leaderboard.map((r,i)=><li key={i} className="flex gap-3"><span className="font-mono text-primary">{String(i+1).padStart(2,'0')}</span><span className="flex-1">{r.name}</span><b>{r.best} 题</b></li>)}</ol>{!summary.leaderboard.length&&<p className="mt-5 text-sm text-muted-foreground">还没有完成的挑战。</p>}</Card></div>
      <section><h2 className="mb-3 text-lg font-semibold">值得再讲一遍的题 · Top 20</h2><div className="space-y-3">{summary.missed.map(q=><Card key={q.questionId} className="rounded-xl p-5"><div className="flex gap-3"><span className="text-primary">#{q.questionId}</span><p className="flex-1 leading-7">{q.text}</p><b className="whitespace-nowrap text-destructive">错 {q.count} 次</b></div><p className="mt-3 break-words text-sm text-muted-foreground">最常见错误答案：{q.commonWrong}</p></Card>)}</div>{!summary.missed.length&&<p className="rounded-xl border p-6 text-sm text-muted-foreground">当前班级还没有错题记录。</p>}</section>
    </>}
  </div>;
}
