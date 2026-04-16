'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Lock, Trophy, Sparkles, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTierStyles, getRarityLabel, getHiddenAchievementDisplay, shouldShowHiddenAchievement, type Achievement, type AchievementProgress } from '@/lib/achievements-v2';

interface AchievementCardProps {
  achievement: Achievement;
  progress: number;
  unlocked: boolean;
  userProgress?: AchievementProgress[];
  userStats?: Record<string, number>;
  onClick?: (achievement: Achievement) => void;
}

export function AchievementCard({ achievement, progress, unlocked, userProgress = [], userStats = {}, onClick }: AchievementCardProps) {
  const tierStyles = getTierStyles(achievement.tier ?? 'bronze');
  const rarityInfo = getRarityLabel(achievement.rarity);
  
  // Determine if this hidden achievement should be shown and how
  const shouldShow = shouldShowHiddenAchievement(achievement, userProgress, userStats);
  const displayInfo = getHiddenAchievementDisplay(achievement, shouldShow);
  const isHidden = displayInfo.isHidden;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-label={`${achievement.title} - ${unlocked ? '已解锁' : '未解锁'} - ${achievement.points}积分`}
        className={cn(
          'relative overflow-hidden cursor-pointer transition-all duration-300',
          'hover:shadow-lg dark:hover:shadow-primary/20',
          tierStyles.borderColor,
          unlocked && achievement.tier === 'gold' && 'animate-pulse',
          unlocked && achievement.tier === 'platinum' && 'animate-shimmer',
          !unlocked && 'opacity-75'
        )}
        onClick={() => onClick?.(achievement)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(achievement);
          }
        }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className={cn(
            'h-full w-full',
            tierStyles.bgColor
          )} />
        </div>

        {/* Content */}
        <div className="relative p-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={cn(
              'relative flex h-16 w-16 items-center justify-center rounded-full',
              tierStyles.bgColor,
              tierStyles.borderColor,
              'border-2'
            )}>
              {displayInfo.icon === '❓' ? (
                <HelpCircle 
                  data-testid="help-circle-icon"
                  className={cn(
                    'h-8 w-8',
                    isHidden && 'opacity-50'
                  )} 
                />
              ) : (
                <span className={cn(
                  'text-3xl',
                  isHidden && 'opacity-50'
                )}>
                  {displayInfo.icon}
                </span>
              )}
              
              {/* Lock overlay for locked achievements */}
              {!unlocked && !isHidden && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Lock className="h-6 w-6 text-white" />
                </div>
              )}
              
              {/* Sparkle effect for unlocked gold/platinum */}
              {unlocked && achievement.tier && (achievement.tier === 'gold' || achievement.tier === 'platinum') && (
                <Sparkles className={cn(
                  'absolute -top-1 -right-1 h-4 w-4',
                  tierStyles.textColor
                )} />
              )}
            </div>

            {/* Details */}
            <div className="flex-1">
              <h3 className={cn(
                'font-semibold',
                isHidden ? 'text-muted-foreground' : tierStyles.textColor
              )}>
                {displayInfo.title}
              </h3>
              
              <p className="text-sm text-muted-foreground mt-1">
                {displayInfo.description}
              </p>
              
              {/* Progress bar for locked achievements */}
              {!unlocked && !isHidden && progress > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>进度</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress 
                    value={progress} 
                    className="h-1.5" 
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  />
                </div>
              )}
              
              {/* Meta info */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1">
                  <Trophy data-testid="trophy-icon" className="h-3 w-3" />
                  <span className="text-xs font-medium">{achievement.points} 积分</span>
                </div>
                
                {!isHidden && (
                  <span className={cn('text-xs font-medium', rarityInfo.color)}>
                    {rarityInfo.label}
                  </span>
                )}
                
                {achievement.hidden && unlocked && (
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    隐藏成就
                  </span>
                )}
                
                {unlocked && (
                  <span className="text-xs text-muted-foreground">
                    已解锁
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tier badge */}
        {achievement.tier && (
          <div className={cn(
            'absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium',
            tierStyles.bgColor,
            tierStyles.textColor
          )}>
            {achievement.tier === 'bronze' && '铜'}
            {achievement.tier === 'silver' && '银'}
            {achievement.tier === 'gold' && '金'}
            {achievement.tier === 'platinum' && '铂金'}
          </div>
        )}
      </Card>
    </motion.div>
  );
}