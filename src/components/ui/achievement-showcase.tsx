'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ACHIEVEMENTS_V2, 
  RARITY_STYLES, 
  getAchievementsByCategory,
  formatAchievementDisplay,
  type ExtendedAchievementCategory,
  type ExtendedAchievementRarity
} from '@/lib/achievements-v2';
// import type { AchievementCategory, AchievementRarity } from '@/types/global'; // Unused - using extended types
import { cn } from '@/lib/utils';
import { Trophy, Lock, Star, Sparkles, Crown, Diamond, Flame, Gem } from 'lucide-react';

interface UserProgressData {
  [key: string]: number;
}

interface AchievementShowcaseProps {
  unlockedAchievements: string[];
  userProgress?: UserProgressData;
  className?: string;
}

// const categoryIcons: Record<ExtendedAchievementCategory, React.ReactNode> = {
//   learning: <BookOpen className="w-4 h-4" />,
//   practice: <Trophy className="w-4 h-4" />,
//   quiz: <ClipboardCheck className="w-4 h-4" />,
//   experiment: <Beaker className="w-4 h-4" />,
//   social: <Users className="w-4 h-4" />,
//   progress: <Star className="w-4 h-4" />,
//   special: <Star className="w-4 h-4" />,
//   hidden: <Eye className="w-4 h-4" />,
//   milestone: <Trophy className="w-4 h-4" />,
// }; // Unused - commented out

const rarityIcons: Record<ExtendedAchievementRarity, React.ReactNode> = {
  common: <Star className="w-4 h-4" />,
  uncommon: <Gem className="w-4 h-4" />,
  rare: <Diamond className="w-4 h-4" />,
  epic: <Crown className="w-4 h-4" />,
  legendary: <Flame className="w-4 h-4" />,
};

export function AchievementShowcase({ 
  unlockedAchievements, 
  userProgress, 
  className 
}: AchievementShowcaseProps) {
  const [selectedCategory, setSelectedCategory] = useState<ExtendedAchievementCategory | 'all'>('all');
  const [hoveredAchievement, setHoveredAchievement] = useState<string | null>(null);

  // Calculate statistics
  const totalAchievements = ACHIEVEMENTS_V2.length;
  const unlockedCount = unlockedAchievements.length;
  const completionPercentage = Math.round((unlockedCount / totalAchievements) * 100);

  // Get achievements to display
  const displayAchievements = selectedCategory === 'all' 
    ? ACHIEVEMENTS_V2
    : getAchievementsByCategory(selectedCategory as ExtendedAchievementCategory);

  // Sort achievements: unlocked first, then by rarity
  const sortedAchievements = displayAchievements.sort((a, b) => {
    const aUnlocked = unlockedAchievements.includes(a.id);
    const bUnlocked = unlockedAchievements.includes(b.id);
    
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    
    const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    return rarityOrder[b.rarity] - rarityOrder[a.rarity];
  });

  return (
    <div className={cn("space-y-6", className)}>
      {/* Statistics Overview */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            成就总览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">解锁进度</span>
                <span className="text-sm text-muted-foreground">
                  {unlockedCount} / {totalAchievements} ({completionPercentage}%)
                </span>
              </div>
              <Progress value={completionPercentage} className="h-3" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              {Object.entries(rarityIcons).map(([rarity, icon]) => {
                const count = unlockedAchievements.filter(id => 
                  ACHIEVEMENTS_V2.find(a => a.id === id)?.rarity === rarity
                ).length;
                const total = ACHIEVEMENTS_V2.filter(a => 
                  a.rarity === rarity && !a.hidden
                ).length;
                
                return (
                  <div key={rarity} className="text-center">
                    <div className={cn(
                      "flex items-center justify-center gap-1 mb-1",
                      RARITY_STYLES[rarity as ExtendedAchievementRarity].color
                    )}>
                      {icon}
                      <span className="text-sm font-semibold capitalize">{rarity}</span>
                    </div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">/ {total}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
        <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="learning">学习</TabsTrigger>
          <TabsTrigger value="quiz">测验</TabsTrigger>
          <TabsTrigger value="experiment">实验</TabsTrigger>
          <TabsTrigger value="social">社交</TabsTrigger>
          <TabsTrigger value="special">特殊</TabsTrigger>
          <TabsTrigger value="hidden">隐藏</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAchievements.map((achievement) => {
              const isUnlocked = unlockedAchievements.includes(achievement.id);
              const display = formatAchievementDisplay(achievement, userProgress);
              const styles = RARITY_STYLES[achievement.rarity];

              return (
                <Card
                  key={achievement.id}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300",
                    !isUnlocked && "opacity-75",
                    hoveredAchievement === achievement.id && "scale-105",
                    styles.glowColor && isUnlocked && `shadow-lg ${styles.glowColor}`
                  )}
                  onMouseEnter={() => setHoveredAchievement(achievement.id)}
                  onMouseLeave={() => setHoveredAchievement(null)}
                >
                  {/* Rarity indicator */}
                  <div className={cn(
                    "absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-20",
                    styles.bgColor
                  )} />

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "text-2xl",
                          !isUnlocked && "grayscale opacity-50"
                        )}>
                          {achievement.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">
                            {display.displayName}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {display.displayDescription}
                          </p>
                        </div>
                      </div>
                      {!isUnlocked && (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {/* Progress bar for unlockable achievements */}
                      {!isUnlocked && display.progressPercentage !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>进度</span>
                            <span>{display.progressText}</span>
                          </div>
                          <Progress 
                            value={display.progressPercentage} 
                            className="h-2"
                          />
                        </div>
                      )}

                      {/* Points and rarity */}
                      <div className="flex items-center justify-between pt-2">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs",
                            styles.color,
                            styles.bgColor
                          )}
                        >
                          {rarityIcons[achievement.rarity]}
                          <span className="ml-1 capitalize">{achievement.rarity}</span>
                        </Badge>
                        <span className="text-sm font-semibold">
                          +{achievement.points} 分
                        </span>
                      </div>

                      {/* Unlock condition hint */}
                      {!isUnlocked && !achievement.hidden && (
                        <p className="text-xs text-muted-foreground pt-1">
                          💡 {achievement.description}
                        </p>
                      )}
                    </div>
                  </CardContent>

                  {/* Sparkle effect for legendary achievements */}
                  {isUnlocked && achievement.rarity === 'legendary' && (
                    <Sparkles className="absolute bottom-2 right-2 w-4 h-4 text-yellow-500 animate-pulse" />
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

