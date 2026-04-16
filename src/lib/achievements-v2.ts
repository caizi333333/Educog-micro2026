/**
 * Enhanced Achievement System V2
 * 
 * 更吸引人的成就系统，具有：
 * - 渐进式成就（铜/银/金）
 * - 隐藏成就
 * - 连续性成就
 * - 特殊挑战成就
 */

import type { Achievement, AchievementCategory, AchievementRarity } from '../types/global';

// Re-export Achievement type for other modules
export type { Achievement };

// 成就定义
export const ACHIEVEMENTS_V2: Achievement[] = [
  // === 学习成就 ===
  {
    id: 'first_steps',
    title: '初露锋芒',
    description: '完成第一个学习模块',
    icon: '🌱',
    category: 'progress',
    criteria: { type: 'modules_completed', target: 1 },
    points: 10,
    rarity: 'common',
  },
  {
    id: 'knowledge_seeker',
    title: '求知若渴',
    description: '完成10个学习模块',
    icon: '📚',
    category: 'progress',
    criteria: { type: 'modules_completed', target: 10 },
    points: 50,
    rarity: 'common',
  },
  {
    id: 'scholar',
    title: '博学者',
    description: '完成50个学习模块',
    icon: '🎓',
    category: 'progress',
    criteria: { type: 'modules_completed', target: 50 },
    points: 200,
    rarity: 'rare',
  },
  {
    id: 'master_scholar',
    title: '学霸降临',
    description: '完成100个学习模块',
    icon: '🏆',
    category: 'progress',
    criteria: { type: 'modules_completed', target: 100 },
    points: 500,
    rarity: 'epic',
  },

  // === 实践成就 ===
  {
    id: 'code_runner',
    title: '代码新手',
    description: '运行第一个8051程序',
    icon: '💻',
    category: 'experiment',
    criteria: { type: 'code_runs', target: 1 },
    points: 15,
    rarity: 'common',
  },
  {
    id: 'debugger',
    title: '调试专家',
    description: '成功调试20个程序',
    icon: '🐛',
    category: 'experiment',
    criteria: { type: 'debug_success', target: 20 },
    points: 75,
    rarity: 'common',
  },
  {
    id: 'circuit_master',
    title: '电路大师',
    description: '完成所有硬件实验',
    icon: '⚡',
    category: 'experiment',
    criteria: { type: 'experiments_completed', target: 15 },
    points: 300,
    rarity: 'rare',
  },

  // === 连续性成就 ===
  {
    id: 'daily_learner',
    title: '日积月累',
    description: '连续7天学习',
    icon: '📅',
    category: 'social',
    criteria: { type: 'daily_streak', target: 7 },
    points: 50,
    rarity: 'common',
  },
  {
    id: 'dedicated_student',
    title: '坚持不懈',
    description: '连续30天学习',
    icon: '🔥',
    category: 'social',
    criteria: { type: 'daily_streak', target: 30 },
    points: 200,
    rarity: 'rare',
  },
  {
    id: 'learning_legend',
    title: '学习传奇',
    description: '连续100天学习',
    icon: '💎',
    category: 'social',
    criteria: { type: 'daily_streak', target: 100 },
    points: 1000,
    rarity: 'legendary',
  },

  // === 挑战成就 ===
  {
    id: 'perfect_score',
    title: '完美主义者',
    description: '在测验中获得满分',
    icon: '💯',
    category: 'quiz',
    criteria: { type: 'perfect_quiz', target: 1 },
    points: 100,
    rarity: 'common',
  },
  {
    id: 'speed_learner',
    title: '神速学习',
    description: '在5分钟内完成一个模块（需满足质量要求）',
    icon: '⚡',
    category: 'progress',
    criteria: { type: 'speed_completion', target: 1 },
    points: 150,
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    title: '夜猫子',
    description: '在凌晨2-5点之间学习',
    icon: '🦉',
    category: 'social',
    criteria: { type: 'night_study', target: 1 },
    points: 30,
    rarity: 'common',
  },
  {
    id: 'early_bird',
    title: '早起鸟',
    description: '在早上5-7点之间学习',
    icon: '🐦',
    category: 'social',
    criteria: { type: 'morning_study', target: 1 },
    points: 30,
    rarity: 'common',
  },

  // === 社交成就 ===
  {
    id: 'helpful_peer',
    title: '乐于助人',
    description: '回答10个同学的问题',
    icon: '🤝',
    category: 'social',
    criteria: { type: 'questions_answered', target: 10 },
    points: 50,
    rarity: 'common',
  },
  {
    id: 'discussion_leader',
    title: '讨论领袖',
    description: '发起10个有价值的讨论',
    icon: '💬',
    category: 'social',
    criteria: { type: 'discussions_started', target: 10 },
    points: 100,
    rarity: 'rare',
  },

  // === 隐藏成就 ===
  {
    id: 'easter_egg',
    title: '彩蛋猎人',
    description: '发现隐藏的彩蛋',
    icon: '🥚',
    category: 'social',
    criteria: { type: 'easter_egg_found', target: 1 },
    points: 200,
    rarity: 'epic',
    tier: 'platinum',
    hidden: true,
  },
  {
    id: 'bug_reporter',
    title: 'Bug捕手',
    description: '报告一个有效的系统Bug',
    icon: '🐞',
    category: 'social',
    criteria: { type: 'bugs_reported', target: 1 },
    points: 150,
    rarity: 'rare',
    tier: 'gold',
    hidden: true,
  },
  {
    id: 'all_nighter',
    title: '通宵达人',
    description: '连续学习8小时',
    icon: '🌙',
    category: 'social',
    criteria: { type: 'continuous_hours', target: 8 },
    points: 300,
    rarity: 'legendary',
    tier: 'platinum',
    hidden: true,
  },
  {
    id: 'secret_path',
    title: '秘密探索者',
    description: '发现隐藏的学习路径',
    icon: '🗝️',
    category: 'progress',
    criteria: { type: 'secret_paths_found', target: 1 },
    points: 250,
    rarity: 'epic',
    tier: 'platinum',
    hidden: true,
  },
  {
    id: 'code_archaeologist',
    title: '代码考古学家',
    description: '查看超过100行历史代码',
    icon: '🏺',
    category: 'practice' as const,
    criteria: { type: 'code_history_viewed', target: 100 },
    points: 180,
    rarity: 'rare',
    tier: 'gold',
    hidden: true,
  },
];

// 成就进度追踪
export interface AchievementProgress {
  achievementId: string;
  progress: number;
  unlocked: boolean;
  unlockedAt?: Date;
  notified?: boolean;
}

// 成就通知
export interface AchievementNotification {
  achievement: Achievement;
  message: string;
  confetti?: boolean;
}

/**
 * 检查成就解锁条件
 */
export function checkAchievementUnlock(
  achievement: Achievement,
  userStats: Record<string, number>
): { unlocked: boolean; progress: number } {
  const criteriaType = achievement.criteria.type as string;
  const criteriaTarget = achievement.criteria.target as number;
  const current = userStats[criteriaType] || 0;
  const progress = Math.min(100, (current / criteriaTarget) * 100);
  const unlocked = current >= criteriaTarget;
  
  return { unlocked, progress };
}

/**
 * 检查隐藏成就是否应该显示
 * 隐藏成就只有在满足以下条件之一时才显示：
 * 1. 已经解锁
 * 2. 进度达到50%以上
 * 3. 用户已解锁同类别的其他高级成就
 */
export function shouldShowHiddenAchievement(
  achievement: Achievement,
  userProgress: AchievementProgress[],
  userStats: Record<string, number>
): boolean {
  if (!achievement.hidden) {
    return true; // 非隐藏成就总是显示
  }

  const progress = userProgress.find(p => p.achievementId === achievement.id);
  
  // 已解锁的隐藏成就总是显示
  if (progress?.unlocked) {
    return true;
  }

  // 检查进度是否达到50%
  const unlockInfo = checkAchievementUnlock(achievement, userStats);
  if (unlockInfo.progress >= 50) {
    return true;
  }

  // 检查是否已解锁同类别的高级成就
  const categoryAchievements = ACHIEVEMENTS_V2.filter(
    a => a.category === achievement.category && !a.hidden
  );
  
  const unlockedInCategory = categoryAchievements.filter(a => {
    const p = userProgress.find(up => up.achievementId === a.id);
    return p?.unlocked && (a.rarity === 'epic' || a.rarity === 'legendary');
  });

  // 如果已解锁同类别的史诗或传说成就，则显示隐藏成就
  return unlockedInCategory.length > 0;
}

/**
 * 获取成就稀有度标签
 */
export function getRarityLabel(rarity: string): { label: string; color: string } {
  switch (rarity) {
    case 'common':
      return { label: '常见', color: 'text-gray-500' };
    case 'uncommon':
      return { label: '稀有', color: 'text-green-500' };
    case 'rare':
      return { label: '罕见', color: 'text-blue-500' };
    case 'epic':
      return { label: '史诗', color: 'text-purple-500' };
    case 'legendary':
      return { label: '传说', color: 'text-orange-500' };
    default:
      return { label: '未知', color: 'text-gray-400' };
  }
}

/**
 * 获取稀有度对应的样式
 */
export function getRarityStyles(rarity: string): {
  bgColor: string;
  borderColor: string;
  textColor: string;
  glowColor?: string;
} {
  switch (rarity) {
    case 'common':
      return {
        bgColor: 'bg-gray-100 dark:bg-gray-800/20',
        borderColor: 'border-gray-400',
        textColor: 'text-gray-700 dark:text-gray-400',
      };
    case 'rare':
      return {
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-700 dark:text-blue-400',
      };
    case 'epic':
      return {
        bgColor: 'bg-purple-100 dark:bg-purple-900/20',
        borderColor: 'border-purple-400',
        textColor: 'text-purple-700 dark:text-purple-400',
        glowColor: 'shadow-purple-400/50',
      };
    case 'legendary':
      return {
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-700 dark:text-yellow-400',
        glowColor: 'shadow-yellow-400/50',
      };
    default:
      return {
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        textColor: 'text-gray-600',
      };
  }
}

/**
 * 获取等级对应的样式 (向后兼容)
 * @deprecated 请使用 getRarityStyles 替代
 */
export function getTierStyles(tier: string): {
  bgColor: string;
  borderColor: string;
  textColor: string;
  glowColor?: string;
} {
  // 将 tier 映射到 rarity 以保持向后兼容
  const rarityMapping: Record<string, string> = {
    'bronze': 'common',
    'silver': 'rare',
    'gold': 'epic',
    'platinum': 'legendary'
  };
  
  const mappedRarity = rarityMapping[tier] || tier;
  return getRarityStyles(mappedRarity);
}

/**
 * 生成成就解锁消息
 */
export function generateUnlockMessage(achievement: Achievement): string {
  const messages: Record<string, string[]> = {
    common: ['不错的开始！', '继续努力！', '初见成效！'],
    uncommon: ['表现不错！', '继续加油！', '有所进步！'],
    rare: ['表现出色！', '令人印象深刻！', '越来越棒了！'],
    epic: ['太棒了！', '卓越成就！', '金光闪闪！'],
    legendary: ['传奇诞生！', '无与伦比！', '巅峰时刻！'],
  };
  
  // 隐藏成就有特殊的解锁消息
  if (achievement.hidden) {
    const hiddenMessages = [
      '🎉 发现隐藏成就！',
      '✨ 秘密解锁！',
      '🔓 隐藏宝藏发现！',
      '🌟 意外惊喜！',
      '🎊 神秘成就达成！'
    ];
    const message = hiddenMessages[Math.floor(Math.random() * hiddenMessages.length)];
    return message || '🔓 隐藏成就解锁！';
  }
  
  const rarity = achievement.rarity || 'common';
  const rarityMessages = messages[rarity] || messages.common;
  if (!rarityMessages || rarityMessages.length === 0) {
    return messages.common?.[0] || '恭喜获得成就！';
  }
  const message = rarityMessages[Math.floor(Math.random() * rarityMessages.length)];
  return message || '恭喜获得成就！';
}

// Re-export types from global for backward compatibility
export type { AchievementCategory, AchievementRarity } from '../types/global';

// Additional V2 specific types
export type ExtendedAchievementCategory = AchievementCategory;
export type ExtendedAchievementRarity = AchievementRarity;

// Rarity styles for UI
export const RARITY_STYLES = {
  common: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    glowColor: 'shadow-gray-400/50',
  },
  uncommon: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    glowColor: 'shadow-green-400/50',
  },
  rare: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    glowColor: 'shadow-blue-400/50',
  },
  epic: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    glowColor: 'shadow-purple-400/50',
  },
  legendary: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    glowColor: 'shadow-yellow-400/50',
  },
};

// Get achievements by category
export function getAchievementsByCategory(category: string): Achievement[] {
  return ACHIEVEMENTS_V2.filter(achievement => achievement.category === category);
}

interface UserProgressStats {
  [key: string]: number;
}

// Format achievement display
export function formatAchievementDisplay(achievement: Achievement, userProgress?: UserProgressStats) {
  // Handle hidden achievements
  if (achievement.hidden && !(achievement as any).dateUnlocked) {
    return {
      displayName: '???',
      displayDescription: '隐藏成就',
      progressPercentage: 0,
      progressText: '',
    };
  }
  
  const displayName = achievement.title;
  const displayDescription = achievement.description;
  
  let progressPercentage = 0;
  let progressText = '';
  
  if (userProgress && achievement.criteria) {
    const criteriaType = achievement.criteria.type as string;
    const criteriaTarget = achievement.criteria.target as number;
    const current = userProgress[criteriaType] || 0;
    progressPercentage = Math.min((current / criteriaTarget) * 100, 100);
    progressText = `${current} / ${criteriaTarget}`;
  }
  
  return {
    displayName,
    displayDescription,
    progressPercentage,
    progressText,
  };
}

/**
 * 获取隐藏成就的显示信息
 * 对于未解锁且不应显示的隐藏成就，返回模糊的信息
 */
export function getHiddenAchievementDisplay(achievement: Achievement, shouldShow: boolean) {
  if (!achievement.hidden || shouldShow) {
    return {
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      isHidden: false
    };
  }

  return {
    title: '???',
    description: '完成特定条件解锁',
    icon: '❓',
    isHidden: true
  };
}