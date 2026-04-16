import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';

interface AchievementFilterProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  userProgress: Array<{
    achievementId: string;
    unlocked: boolean;
  }>;
}

const categories = [
  { id: 'all', name: '全部', icon: '🏆', gradient: 'from-primary to-accent' },
  { id: 'learning', name: '学习', icon: '📚', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'practice', name: '实践', icon: '⚡', gradient: 'from-yellow-500 to-orange-500' },
  { id: 'social', name: '社交', icon: '👥', gradient: 'from-green-500 to-emerald-500' },
  { id: 'special', name: '特殊', icon: '✨', gradient: 'from-purple-500 to-pink-500' }
];

export const AchievementFilter: React.FC<AchievementFilterProps> = ({
  selectedCategory,
  onCategoryChange,
  userProgress
}) => {
  // 计算每个分类的成就数量
  const getCategoryStats = (categoryId: string) => {
    const categoryAchievements = categoryId === 'all' 
      ? ACHIEVEMENTS_V2 
      : ACHIEVEMENTS_V2.filter(a => a.category === categoryId);
    
    const unlockedCount = categoryAchievements.filter(a => 
      userProgress.find(p => p.achievementId === a.id)?.unlocked
    ).length;
    
    return {
      total: categoryAchievements.length,
      unlocked: unlockedCount
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          🎯 成就分类
        </h3>
        <Badge 
          variant="outline" 
          className="border-primary/50 text-primary bg-primary/5 px-3 py-1 font-semibold"
        >
          {getCategoryStats(selectedCategory).unlocked} / {getCategoryStats(selectedCategory).total} 已解锁
        </Badge>
      </div>
      
      <Tabs value={selectedCategory} onValueChange={onCategoryChange}>
        <TabsList className="grid w-full grid-cols-5 gap-2 bg-muted/30 p-2 h-auto">
          {categories.map((category) => {
            const stats = getCategoryStats(category.id);
            const isSelected = selectedCategory === category.id;
            const completionRate = stats.total > 0 ? (stats.unlocked / stats.total) * 100 : 0;
            
            return (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className={cn(
                  "flex flex-col gap-2 h-auto py-4 px-3 rounded-lg transition-all duration-300",
                  "hover:scale-105 hover:shadow-lg relative overflow-hidden",
                  isSelected && "shadow-xl border-2 border-primary/50"
                )}
              >
                {/* 背景渐变 */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300",
                  category.gradient,
                  isSelected ? "opacity-10" : "group-hover:opacity-5"
                )} />
                
                {/* 内容 */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className={cn(
                    "text-2xl p-2 rounded-full transition-all duration-300",
                    isSelected ? "animate-bounce" : "group-hover:scale-110"
                  )}>
                    {category.icon}
                  </div>
                  
                  <span className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    isSelected ? "text-primary font-bold" : "text-muted-foreground"
                  )}>
                    {category.name}
                  </span>
                  
                  <div className="flex flex-col items-center gap-1">
                    <Badge 
                      variant={isSelected ? "default" : "secondary"}
                      className={cn(
                        "text-xs px-2 py-0.5 transition-all duration-300",
                        isSelected && "bg-primary text-primary-foreground shadow-lg"
                      )}
                    >
                      {stats.unlocked}/{stats.total}
                    </Badge>
                    
                    {/* 进度条 */}
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full bg-gradient-to-r transition-all duration-500",
                          category.gradient
                        )}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
};