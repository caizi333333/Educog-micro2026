import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Target, Award, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AchievementStatsProps {
  stats: {
    unlockedCount: number;
    totalCount: number;
    totalPoints: number;
    byTier: {
      bronze: number;
      silver: number;
      gold: number;
      platinum: number;
    };
    completionPercentage: number;
  };
}

const tierConfig = {
  bronze: { 
    icon: Trophy, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    glow: 'shadow-amber-400/50'
  },
  silver: { 
    icon: Star, 
    color: 'text-gray-600 dark:text-gray-400', 
    bg: 'bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900/30 dark:to-slate-900/30',
    glow: 'shadow-gray-400/50'
  },
  gold: { 
    icon: Award, 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bg: 'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30',
    glow: 'shadow-yellow-400/50'
  },
  platinum: { 
    icon: Crown, 
    color: 'text-purple-600 dark:text-purple-400', 
    bg: 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30',
    glow: 'shadow-purple-400/50'
  }
};

export const AchievementStats: React.FC<AchievementStatsProps> = ({ stats }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* 总体进度 */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
          <CardTitle className="text-sm font-medium">完成进度</CardTitle>
          <div className="p-2 rounded-full bg-primary/10 transition-colors duration-200 hover:bg-primary/20">
            <Trophy className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {stats.completionPercentage}%
          </div>
          <div className="mt-3">
            <Progress value={stats.completionPercentage} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <span className="text-primary font-semibold">{stats.unlockedCount}</span> / {stats.totalCount} 个成就
          </p>
        </CardContent>
      </Card>

      {/* 总积分 */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-amber-400/5" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
          <CardTitle className="text-sm font-medium">总积分</CardTitle>
          <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 transition-colors duration-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50">
            <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
            {stats.totalPoints.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            通过解锁成就获得
          </p>
        </CardContent>
      </Card>

      {/* 各等级成就统计 */}
      {Object.entries(stats.byTier).map(([tier, count]) => {
        const config = tierConfig[tier as keyof typeof tierConfig];
        const Icon = config.icon;
        
        return (
          <Card key={tier} className="relative overflow-hidden transition-all duration-300 hover:shadow-lg">
            <div className={cn(
              "absolute inset-0",
              config.bg
            )} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-sm font-medium capitalize">
                {tier === 'bronze' && '青铜'}
                {tier === 'silver' && '白银'}
                {tier === 'gold' && '黄金'}
                {tier === 'platinum' && '铂金'}
              </CardTitle>
              <div className="p-2 rounded-full">
                <Icon className={cn(
                  "h-5 w-5", 
                  config.color
                )} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className={cn(
                "text-4xl font-bold",
                config.color
              )}>
                {count}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {tier === 'bronze' && '基础成就'}
                {tier === 'silver' && '进阶成就'}
                {tier === 'gold' && '高级成就'}
                {tier === 'platinum' && '传奇成就'}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};