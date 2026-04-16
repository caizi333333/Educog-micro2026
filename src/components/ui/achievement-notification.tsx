'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Achievement, RARITY_STYLES } from '@/lib/achievements-v2';
import { X, Sparkles, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AchievementNotificationProps {
  achievement: Achievement | null;
  onClose: () => void;
  duration?: number;
}

export function AchievementNotification({
  achievement,
  onClose,
  duration = 5000,
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      
      // Trigger confetti for epic and legendary achievements
      if (achievement.rarity === 'epic' || achievement.rarity === 'legendary') {
        const colors = achievement.rarity === 'legendary' 
          ? ['#FFD700', '#FFA500', '#FF6347']
          : ['#9333EA', '#7C3AED', '#6D28D9'];
          
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: colors,
        });
      }

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [achievement, duration, onClose]);

  if (!achievement) return null;

  const rarityStyle = RARITY_STYLES[achievement.rarity];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-4 right-4 z-50 max-w-md"
        >
          <Card className={cn(
            'relative overflow-hidden shadow-2xl',
            rarityStyle.borderColor,
            'border-2',
            achievement.rarity === 'legendary' && 'animate-pulse'
          )}>
            {/* Background Effects */}
            <div className={cn(
              'absolute inset-0',
              rarityStyle.bgColor,
              'opacity-20'
            )} />
            
            {achievement.rarity === 'legendary' && (
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/20 via-transparent to-orange-300/20" />
            )}

            {/* Content */}
            <div className="relative p-6 space-y-4">
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(onClose, 300);
                }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="relative"
                >
                  <div className="text-5xl">{achievement.icon}</div>
                  {achievement.rarity === 'legendary' && (
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 animate-pulse" />
                  )}
                </motion.div>

                <div className="flex-1 space-y-1">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2"
                  >
                    <Trophy className={cn('w-5 h-5', rarityStyle.color)} />
                    <h3 className="font-bold text-lg">成就解锁！</h3>
                  </motion.div>
                  
                  <motion.h4
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className={cn('font-semibold', rarityStyle.color)}
                  >
                    {achievement.title}
                  </motion.h4>
                </div>
              </div>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground"
              >
                {achievement.description}
              </motion.p>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-between pt-2 border-t"
              >
                <div className={cn(
                  'text-sm font-medium px-2 py-1 rounded',
                  rarityStyle.bgColor,
                  rarityStyle.color
                )}>
                  {achievement.rarity === 'common' && '普通成就'}
                  {achievement.rarity === 'rare' && '稀有成就'}
                  {achievement.rarity === 'epic' && '史诗成就'}
                  {achievement.rarity === 'legendary' && '传说成就'}
                </div>

                <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-semibold">
                  <span className="text-lg">+{achievement.points}</span>
                  <span className="text-sm">积分</span>
                </div>
              </motion.div>
            </div>

            {/* Progress Bar Animation */}
            <motion.div
              className={cn(
                'absolute bottom-0 left-0 h-1',
                rarityStyle.bgColor
              )}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
            />
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}