'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pen, Star, BarChart4, Trophy, Loader2, AlertCircle, Clock, BookOpen, Target } from "lucide-react";
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ icon, title, value, footer, loading = false }: { 
  icon: React.ReactNode, 
  title: string, 
  value: string, 
  footer: string,
  loading?: boolean
}) => (
  <Card className="bg-secondary/50">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-full" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{footer}</p>
        </>
      )}
    </CardContent>
  </Card>
);

interface ActivityDetails {
  score?: number;
  moduleId?: string;
  name?: string;
  [key: string]: unknown;
}

interface UserActivity {
  action: string;
  createdAt: string;
  details?: ActivityDetails;
}

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  studentId?: string;
  class?: string;
  totalPoints?: number;
  stats?: {
    totalQuizAttempts: number;
    averageQuizScore: number;
    completedModules: number;
    totalAchievements: number;
    averageProgress: number;
    totalLearningTime: number;
  };
  recentActivity: UserActivity[];
}

interface UserAchievement {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlockedAt?: Date;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchUserProfile();
      fetchUserAchievements();
    }
  }, [user, authLoading]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('获取用户资料失败');
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (error: unknown) {
      console.error('Failed to fetch profile:', error);
      setError('无法加载用户资料');
      toast({
        title: '加载失败',
        description: '无法获取用户资料，请刷新页面重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAchievements = async () => {
    try {
      const response = await fetch('/api/achievements', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('获取成就失败');
      }

      const data = await response.json();
      setAchievements(data.achievements.filter((a: UserAchievement) => a.unlocked));
    } catch (error: unknown) {
      console.error('Failed to fetch achievements:', error);
    }
  };

  // 计算学习统计
  const calculateStats = () => {
    if (!profile) return { totalScore: 0, avgProgress: 0, totalTime: 0 };
    
    const stats = profile.stats || {} as any;
    return {
      totalScore: (stats.totalQuizAttempts || 0) * 10 + (stats.completedModules || 0) * 20,
      avgProgress: stats.averageProgress || 0,
      totalTime: Math.round((stats.totalLearningTime || 0) / 3600) // 转换为小时
    };
  };

  const { avgProgress, totalTime } = calculateStats();
  const recentAchievements = achievements.slice(-3).reverse();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先登录以查看个人资料。
            <Link href="/login" className="ml-2 text-primary hover:underline">前往登录</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <Avatar className="h-24 w-24 border-4 border-primary">
            <AvatarImage src={profile?.avatar} alt="User Avatar" />
            <AvatarFallback className="text-4xl">
              {profile?.name?.charAt(0) || user.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-3xl">{profile?.name || user.name}</CardTitle>
            <CardDescription className="mt-2 text-base">{profile?.email || user.email}</CardDescription>
            <div className="flex gap-2 mt-3 justify-center md:justify-start">
              <Badge variant="secondary">{profile?.role || user.role}</Badge>
              {profile?.studentId && (
                <Badge variant="outline">学号: {profile.studentId}</Badge>
              )}
              {profile?.class && (
                <Badge variant="outline">{profile.class}</Badge>
              )}
            </div>
          </div>
          <Button>
            <Pen className="mr-2 h-4 w-4" />
            编辑个人资料
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard 
          title="学习积分"
          value={profile?.totalPoints?.toLocaleString() || '0'}
          footer="通过完成学习活动获得"
          icon={<Star className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
        <StatCard 
          title="平均进度"
          value={`${avgProgress}%`}
          footer="所有学习模块的平均完成度"
          icon={<BarChart4 className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
        <StatCard 
          title="学习时长"
          value={`${totalTime} 小时`}
          footer="累计学习时间"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
      </div>

      {/* 学习统计详情 */}
      <Card>
        <CardHeader>
          <CardTitle>学习统计</CardTitle>
          <CardDescription>您的学习数据概览</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profile?.stats?.totalQuizAttempts || 0}</div>
              <div className="text-sm text-muted-foreground">测验次数</div>
            </div>
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profile?.stats?.averageQuizScore || 0}%</div>
              <div className="text-sm text-muted-foreground">平均得分</div>
            </div>
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profile?.stats?.completedModules || 0}</div>
              <div className="text-sm text-muted-foreground">完成模块</div>
            </div>
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profile?.stats?.totalAchievements || 0}</div>
              <div className="text-sm text-muted-foreground">获得成就</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>最近解锁的成就</CardTitle>
          <CardDescription>
            您最近获得的荣誉徽章。
            <Link href="/achievements" className="text-primary hover:underline ml-2 font-semibold">
              查看全部 ({achievements.length})
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : recentAchievements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentAchievements.map((ach, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/20 text-2xl">
                    {ach.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{ach.name}</p>
                    <p className="text-xs text-muted-foreground">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>还没有解锁任何成就</p>
              <p className="text-sm mt-2">继续学习以获得成就徽章！</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近活动 */}
      <Card>
        <CardHeader>
          <CardTitle>最近活动</CardTitle>
          <CardDescription>您的学习动态</CardDescription>
        </CardHeader>
        <CardContent>
          {profile?.recentActivity && profile.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {profile.recentActivity.slice(0, 5).map((activity: UserActivity, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{getActivityDescription(activity)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">暂无活动记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 获取活动图标
function getActivityIcon(action: string) {
  switch (action) {
    case 'COMPLETE_QUIZ':
      return <Target className="h-4 w-4" />;
    case 'UPDATE_PROGRESS':
      return <BookOpen className="h-4 w-4" />;
    case 'UNLOCK_ACHIEVEMENT':
      return <Trophy className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

// 获取活动描述
function getActivityDescription(activity: UserActivity) {
  switch (activity.action) {
    case 'COMPLETE_QUIZ':
      const quizDetails = activity.details || {};
      return `完成测验，得分 ${quizDetails.score || 0}%`;
    case 'UPDATE_PROGRESS':
      const progressDetails = activity.details || {};
      return `学习进度更新 - ${progressDetails.moduleId || '未知模块'}`;
    case 'UNLOCK_ACHIEVEMENT':
      const achievementDetails = activity.details || {};
      return `解锁成就「${achievementDetails.name || '未知成就'}」`;
    case 'CREATE_LEARNING_PATH':
      return '创建了新的学习计划';
    case 'UPDATE_PROFILE':
      return '更新了个人资料';
    default:
      return activity.action;
  }
}