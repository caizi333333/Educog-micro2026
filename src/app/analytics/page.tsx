'use client';
import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, Lightbulb, ClipboardCheck, Activity, Trophy, Star, BrainCircuit, GitBranch, Info, Loader2, AlertCircle } from "lucide-react";
import { AnalyticsCharts } from "./charts";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/analytics/StatCard';
import LearnerProfile from '@/components/analytics/LearnerProfile';
import FiveDimensionEval from '@/components/analytics/FiveDimensionEval';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';



const getCellColor = (value: number) => {
  if (value < 60) return 'bg-destructive/20 text-destructive-foreground/90 hover:bg-destructive/30';
  if (value < 80) return 'bg-yellow-500/20 text-yellow-500/90 hover:bg-yellow-500/30';
  return 'bg-blue-100 text-blue-900 font-bold hover:bg-blue-200';
};

const getTextColor = (value: number) => {
  if (value < 60) return 'text-destructive';
  if (value < 80) return 'text-yellow-500';
  return 'text-primary';
}





export default function AnalyticsPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();
  const {
    loading,
    profile,
    quizHistory,
    achievements,
    calculateKnowledgeMastery,
    calculateLearningStats
  } = useAnalytics();

  // 使用hook中的函数
  const knowledgeMastery = calculateKnowledgeMastery();
  const learningStats = calculateLearningStats();
  const avgMastery = knowledgeMastery.reduce((sum, ka) => sum + ka.mastery, 0) / knowledgeMastery.length;
  const weeklyProgress = learningStats.weeklyProgress;

  // 计算测验分数趋势
  const quizScoreTrend = learningStats.quizScoreTrend;

  const exportToPng = () => {
    if (pageRef.current) {
      const computedStyle = getComputedStyle(document.body);
      const backgroundColor = computedStyle.backgroundColor;
      
      html2canvas(pageRef.current, {
        scale: 2,
        backgroundColor: backgroundColor || '#ffffff',
        logging: false,
        useCORS: true,
      }).then(canvas => {
        canvas.toBlob(blob => {
          if (blob) {
            saveAs(blob, `学情分析_${user?.name}_${new Date().toLocaleDateString('zh-CN')}.png`);
          }
        });
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          请先登录以查看学情分析。
          <Link href="/login" className="ml-2 text-primary hover:underline">前往登录</Link>
        </AlertDescription>
      </Alert>
    );
  }

  const stats = profile?.stats || {} as any;
  const quizStats = learningStats;

  return (
    <div className="space-y-8" ref={pageRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">学情分析</h1>
          <p className="text-muted-foreground mt-2">全面了解您的学习情况和进度</p>
        </div>
        <Button onClick={exportToPng} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          导出报告
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          title="累计学习时长"
          value={`${Math.round((stats.totalLearningTime || 0) / 3600)} 小时`}
          footer="持续努力，必有收获"
          loading={loading}
        />
        <StatCard 
          icon={<ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
          title="平均测验得分"
          value={`${quizStats.averageScore}%`}
          footer={`共完成 ${quizStats.quizCount} 次测验`}
          loading={loading}
        />
        <StatCard 
          icon={<BrainCircuit className="h-4 w-4 text-muted-foreground" />}
          title="知识掌握度"
          value={`${Math.round(avgMastery)}%`}
          footer="基于测验表现综合评估"
          loading={loading}
        />
        <StatCard 
          icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
          title="获得成就"
          value={`${achievements.stats?.unlockedAchievements || 0}/${achievements.stats?.totalAchievements || 0}`}
          footer={`完成率 ${achievements.stats?.completionRate || 0}%`}
          loading={loading}
        />
      </div>

      {/* 知识点掌握度热力图 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>知识点掌握度热力图</CardTitle>
              <CardDescription>点击知识点查看详细掌握情况</CardDescription>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <p className="text-sm">知识掌握度说明：</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-primary/20 rounded" />
                      <span>优秀 (80-100%): 已熟练掌握</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500/20 rounded" />
                      <span>良好 (60-79%): 基本掌握，仍需巩固</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-destructive/20 rounded" />
                      <span>薄弱 (0-59%): 需要重点学习</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">知识原子</TableHead>
                  <TableHead>细分知识点掌握度</TableHead>
                  <TableHead className="text-right w-[100px]">综合掌握度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {knowledgeMastery.map((item) => (
                  <TableRow key={item.topic}>
                    <TableCell className="font-medium">{item.topic}</TableCell>
                    <TableCell>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(item.details).map(([detail, score]) => (
                          <Popover key={detail}>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "p-2 text-xs rounded transition-all duration-200 cursor-pointer",
                                  getCellColor(score as number)
                                )}
                              >
                                {detail}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <div className="space-y-2">
                                <h4 className="font-semibold">{detail}</h4>
                                <Progress value={score as number} className="h-2" />
                                <p className="text-sm text-muted-foreground">
                                  掌握度: <span className={cn("font-semibold", getTextColor(typeof score === 'number' ? score : 0))}>{typeof score === 'number' ? score : 0}%</span>
                                </p>
                                {(typeof score === 'number' && score < 60) && (
                                  <div className="pt-2 border-t">
                                    <p className="text-sm text-muted-foreground mb-2">建议加强学习：</p>
                                    <Link href={`/#${item.topic}`} className="text-sm text-primary hover:underline">
                                      查看相关课程内容 →
                                    </Link>
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className={cn("font-bold", getTextColor(item.mastery))}>
                        {Math.round(item.mastery)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <AnalyticsCharts 
        weeklyProgress={weeklyProgress}
        quizScoreTrend={quizScoreTrend}
        knowledgeMastery={knowledgeMastery}
        loading={loading}
      />

      {/* 学习者画像 & 五维评价 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LearnerProfile
          quizScores={Object.fromEntries(
            knowledgeMastery.map((ka, i) => [i + 1, Math.round(ka.mastery)])
          )}
          experimentStatus={{}}
          totalStudyTime={Math.round((stats.totalLearningTime || 0) / 60)}
          streakDays={stats.streakDays || 0}
        />
        <FiveDimensionEval />
      </div>

      {/* 学习建议 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            个性化学习建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* 薄弱知识点提醒 */}
              {knowledgeMastery.filter(ka => ka.mastery < 60).length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    需要重点加强的知识点
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {knowledgeMastery
                      .filter(ka => ka.mastery < 60)
                      .map(ka => (
                        <Badge key={ka.topic} variant="destructive">
                          {ka.topic} ({Math.round(ka.mastery)}%)
                        </Badge>
                      ))}
                  </div>
                  <Link href="/learning-path" className="text-sm text-primary hover:underline">
                    生成个性化学习计划 →
                  </Link>
                </div>
              )}

              {/* 进步提醒 */}
              {quizHistory.length >= 2 && quizHistory[0]?.score && quizHistory[1]?.score && quizHistory[0].score > quizHistory[1].score && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    持续进步中！
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    您的最新测验分数提升了 {quizHistory[0].score - quizHistory[1].score} 分，
                    继续保持这种学习势头！
                  </p>
                </div>
              )}

              {/* 学习建议 */}
              <div className="p-4 rounded-lg bg-secondary/50">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  下一步学习建议
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 每天保持至少30分钟的学习时间，养成良好的学习习惯</li>
                  <li>• 重点复习掌握度低于60%的知识点</li>
                  <li>• 通过实验仿真加深对理论知识的理解</li>
                  <li>• 定期进行测验，检验学习效果</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}