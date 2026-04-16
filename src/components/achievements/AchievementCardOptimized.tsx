import React, { memo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AchievementBadge } from "@/components/ui/achievement-badge";
import { cn } from '@/lib/utils';
import { Lock, CheckCircle } from 'lucide-react';
import type { Achievement, AchievementProgress } from '@/lib/achievements-v2';

interface AchievementCardProps {
  achievement: Achievement;
  progress?: AchievementProgress;
  onClick?: () => void;
  className?: string;
}

export const AchievementCardOptimized = memo(function AchievementCardOptimized({
  achievement,
  progress,
  onClick,
  className
}: AchievementCardProps) {
  const isUnlocked = progress?.unlocked || false;
  const progressValue = progress?.progress || 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 cursor-pointer",
        "hover:shadow-lg hover:scale-[1.02]",
        isUnlocked ? "bg-card" : "bg-muted/30",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Badge */}
          <div className="flex-shrink-0">
            <AchievementBadge
              tier={achievement.tier ?? 'bronze'}
              locked={!isUnlocked}
              progress={progressValue}
              size="md"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className={cn(
                  "font-semibold text-sm",
                  !isUnlocked && "text-muted-foreground"
                )}>                  {achievement.title}                </h3>
                <p className={cn(
                  "text-xs mt-1",
                  isUnlocked ? "text-muted-foreground" : "text-muted-foreground/70"
                )}>
                  {achievement.description}
                </p>
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {isUnlocked ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
            </div>

            {/* Progress bar */}
            {!isUnlocked && progressValue > 0 && (
              <div className="mt-3 space-y-1">
                <Progress value={progressValue} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  进度: {progressValue}%
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={isUnlocked ? "default" : "outline"} className="text-xs">
                {achievement.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                +{achievement.points} 积分
              </span>
              {isUnlocked && progress?.unlockedAt && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(progress.unlockedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hidden achievement overlay */}
        {false && !isUnlocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent flex items-center justify-center">
            <span className="text-sm font-medium">隐藏成就</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// List view for better performance with many items
export const AchievementListItem = memo(function AchievementListItem({
  achievement,
  progress,
  onClick
}: AchievementCardProps) {
  const isUnlocked = progress?.unlocked || false;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-accent/50",
        isUnlocked ? "bg-card" : "bg-muted/20"
      )}
      onClick={onClick}
    >
      <AchievementBadge
        tier={achievement.tier ?? 'bronze'}
        locked={!isUnlocked}
        size="sm"
      />
      
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "font-medium text-sm",
          !isUnlocked && "text-muted-foreground"
        )}>          {achievement.title}        </h4>
        <p className="text-xs text-muted-foreground truncate">
          {achievement.description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          +{achievement.points}
        </Badge>
        {isUnlocked ? (
          <CheckCircle className="h-4 w-4 text-primary" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
    </div>
  );
});