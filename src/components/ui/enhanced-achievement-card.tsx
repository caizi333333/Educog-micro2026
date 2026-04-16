'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, Trophy, Star, Sparkles } from 'lucide-react';
import { Achievement, RARITY_STYLES, formatAchievementDisplay } from '@/lib/achievements-v2';

interface EnhancedAchievementCardProps {
  achievement: Achievement;
  isUnlocked?: boolean;
  userProgress?: any;
  onClick?: () => void;
  className?: string;
}

export function EnhancedAchievementCard({
  achievement,
  isUnlocked = false,
  userProgress,
  onClick,
  className,
}: EnhancedAchievementCardProps) {
  const rarityStyle = RARITY_STYLES[achievement.rarity];
  const display = formatAchievementDisplay(achievement, userProgress);
  const isHidden = achievement.hidden && !isUnlocked;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              'relative overflow-hidden transition-all duration-300 cursor-pointer',
              'hover:scale-105 hover:shadow-lg',
              isUnlocked ? rarityStyle.glowColor : 'opacity-75 grayscale',
              rarityStyle.borderColor,
              'border-2',
              className
            )}
            onClick={onClick}
          >
            {/* Background Pattern */}
            <div className={cn(
              'absolute inset-0 opacity-10',
              rarityStyle.bgColor
            )}>
              {achievement.rarity === 'legendary' && (
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-transparent to-orange-300 animate-pulse" />
              )}
            </div>

            {/* Content */}
            <div className="relative p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={cn(
                    'text-4xl',
                    isUnlocked ? '' : 'filter grayscale opacity-50'
                  )}>
                    {isHidden ? '❓' : achievement.icon}
                  </div>

                  {/* Title and Description */}
                  <div className="space-y-1">
                    <h4 className={cn(
                      'font-semibold text-sm',
                      isUnlocked ? rarityStyle.color : 'text-muted-foreground'
                    )}>
                      {display.displayName}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {display.displayDescription}
                    </p>
                  </div>
                </div>

                {/* Lock/Unlock Status */}
                {isUnlocked ? (
                  <Trophy className={cn('w-5 h-5', rarityStyle.color)} />
                ) : (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Progress Bar (if applicable) */}
              {!isUnlocked && display.progressPercentage !== undefined && display.progressPercentage > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>进度</span>
                    <span>{display.progressText}</span>
                  </div>
                  <Progress value={display.progressPercentage} className="h-2" />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t">
                {/* Rarity Badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    isUnlocked ? rarityStyle.color : '',
                    rarityStyle.borderColor
                  )}
                >
                  {achievement.rarity === 'common' && '普通'}
                  {achievement.rarity === 'rare' && '稀有'}
                  {achievement.rarity === 'epic' && '史诗'}
                  {achievement.rarity === 'legendary' && '传说'}
                </Badge>

                {/* Points */}
                <div className={cn(
                  'flex items-center gap-1 text-sm font-semibold',
                  isUnlocked ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
                )}>
                  <Star className="w-4 h-4" />
                  {achievement.points}
                </div>
              </div>

              {/* Unlock Date */}
              {isUnlocked && userProgress?.unlockedAt && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-xs">
                    {new Date(userProgress?.unlockedAt).toLocaleDateString()}
                  </Badge>
                </div>
              )}

              {/* Special Effects for Legendary */}
              {isUnlocked && achievement.rarity === 'legendary' && (
                <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-500 animate-pulse" />
              )}
            </div>
          </Card>
        </TooltipTrigger>
        
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold">{display.displayName}</p>
            <p className="text-sm">{display.displayDescription}</p>
            {!isUnlocked && (
              <p className="text-sm text-muted-foreground">
                解锁条件: {achievement.description}
              </p>
            )}
            {isUnlocked && userProgress?.unlockedAt && (
              <p className="text-sm text-muted-foreground">
                解锁时间: {new Date(userProgress?.unlockedAt).toLocaleString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}