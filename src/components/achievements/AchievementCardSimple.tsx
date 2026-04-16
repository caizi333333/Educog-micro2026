import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Lock, Trophy, Crown, Award } from 'lucide-react';
import { Achievement } from '@/lib/achievements-v2';

interface AchievementCardSimpleProps {
  achievement: Achievement;
  unlocked: boolean;
  progress?: number;
  onClick?: () => void;
  isHidden?: boolean;
}

const tierStyles = {
  bronze: {
    bgColor: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20',
    borderColor: 'border-amber-300 dark:border-amber-600',
    textColor: 'text-amber-700 dark:text-amber-300'
  },
  silver: {
    bgColor: 'bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900/20 dark:to-slate-900/20',
    borderColor: 'border-gray-300 dark:border-gray-600',
    textColor: 'text-gray-700 dark:text-gray-300'
  },
  gold: {
    bgColor: 'bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20',
    borderColor: 'border-yellow-300 dark:border-yellow-600',
    textColor: 'text-yellow-700 dark:text-yellow-300'
  },
  platinum: {
    bgColor: 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20',
    borderColor: 'border-purple-300 dark:border-purple-600',
    textColor: 'text-purple-700 dark:text-purple-300'
  }
};

const rarityColors = {
  common: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  uncommon: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rare: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  legendary: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
};

const rarityLabels = {
  common: '普通',
  uncommon: '不常见',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

export function AchievementCardSimple({
  achievement,
  unlocked,
  progress = 0,
  onClick,
  isHidden = false
}: AchievementCardSimpleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  
  const tierStyle = tierStyles[achievement.tier || 'bronze'];
  const rarityColor = rarityColors[achievement.rarity || 'common'];
  const rarityLabel = rarityLabels[achievement.rarity || 'common'];

  const cardVariants = {
    initial: { scale: 1, y: 0 },
    hover: prefersReducedMotion ? {} : { scale: 1.02, y: -2 },
    tap: prefersReducedMotion ? {} : { scale: 0.98 }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      className={cn(
        'relative overflow-hidden cursor-pointer group',
        'bg-card border rounded-xl shadow-md hover:shadow-lg',
        'transition-all duration-300 ease-out',
        'min-h-[180px] w-full max-w-sm', // 优化卡片尺寸
        tierStyle.borderColor,
        !unlocked && 'opacity-60 grayscale'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 简化的背景层 */}
      <div className="absolute inset-0">
        <div 
          className={cn(
            'h-full w-full opacity-5 group-hover:opacity-10 transition-opacity duration-300',
            tierStyle.bgColor
          )}
        />
        
        {/* 简化的悬停效果 */}
        {unlocked && !prefersReducedMotion && (
          <div
            className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300",
              "bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10"
            )}
          />
        )}
      </div>

      {/* 内容区域 */}
      <div className="relative z-10 p-6 h-full flex flex-col">
        {/* 图标和等级区域 */}
        <div className="flex items-center justify-between mb-4">
          <div className="relative">
            {/* 主图标 */}
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                'bg-gradient-to-br shadow-md transition-all duration-200',
                unlocked ? tierStyle.bgColor : 'bg-gray-100 dark:bg-gray-800',
                isHovered && 'scale-105 shadow-lg'
              )}
            >
              {isHidden ? (
                <span className="text-2xl opacity-50">❓</span>
              ) : unlocked ? (
                <span className="text-2xl">{achievement.icon}</span>
              ) : (
                <Lock className="w-6 h-6 text-gray-500" />
              )}
            </div>
            
            {/* 等级指示器 */}
            {unlocked && achievement.tier === 'platinum' && (
              <div className="absolute -top-2 -right-2">
                <Crown className="h-5 w-5 text-purple-500" />
              </div>
            )}
            {unlocked && achievement.tier === 'gold' && (
              <div className="absolute -top-2 -right-2">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
            )}
            {unlocked && achievement.tier === 'silver' && (
              <div className="absolute -top-2 -right-2">
                <Trophy className="h-4 w-4 text-gray-500" />
              </div>
            )}
          </div>

          {/* 等级徽章 */}
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide',
              'border backdrop-blur-sm',
              tierStyle.bgColor,
              tierStyle.textColor,
              tierStyle.borderColor
            )}
          >
            {achievement.tier}
          </div>
        </div>

        {/* 标题和描述 */}
        <div className="flex-1">
          <h3 
            className={cn(
              'font-bold text-lg mb-2 transition-colors duration-200',
              isHidden ? 'text-muted-foreground' : tierStyle.textColor,
              unlocked && 'group-hover:text-primary'
            )}
          >
            {isHidden ? '???' : achievement.title}
            {unlocked && achievement.tier === 'platinum' && (
              <span className="ml-2 text-purple-500">👑</span>
            )}
          </h3>
          
          <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/90 transition-colors duration-200">
            {isHidden ? '完成特定条件解锁' : achievement.description}
          </p>
          
          {/* 进度条 */}
          {!unlocked && !isHidden && progress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">进度</span>
                <span className="font-bold text-primary">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
        
        {/* 底部信息 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            {/* 积分 */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
              <Trophy className="h-3 w-3 text-primary" />
              <span className="text-xs font-bold text-primary">
                {achievement.points}
              </span>
            </div>
            
            {/* 稀有度 */}
            {!isHidden && (
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-full',
                rarityColor
              )}>
                {rarityLabel}
              </span>
            )}
          </div>
          
          {/* 解锁状态 */}
          {unlocked && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                已解锁
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}