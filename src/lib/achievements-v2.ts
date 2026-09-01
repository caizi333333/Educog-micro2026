/**
 * Enhanced Achievement System V2 (Unified)
 *
 * Single source of truth for all achievement definitions.
 * Legacy tiered achievements from achievement-system.ts are expanded
 * into flat entries and merged here.
 */

import type { Achievement, AchievementCategory, AchievementRarity } from '../types/global';

// Re-export Achievement type for other modules
export type { Achievement };

// Legacy tiered achievements expanded into flat entries
export const ACHIEVEMENTS_LEGACY_FLAT: Achievement[] = [
  // learning_time tiers
  { id: 'learning_time_bronze', title: '学习达人 · 铜章', description: '累计学习1小时', icon: '🥉', category: 'progress', criteria: { type: 'learning_time', target: 3600 }, points: 50, rarity: 'common' },
  { id: 'learning_time_silver', title: '学习达人 · 银章', description: '累计学习10小时', icon: '🥈', category: 'progress', criteria: { type: 'learning_time', target: 36000 }, points: 100, rarity: 'rare' },
  { id: 'learning_time_gold', title: '学习达人 · 金章', description: '累计学习100小时', icon: '🥇', category: 'progress', criteria: { type: 'learning_time', target: 360000 }, points: 200, rarity: 'epic' },

  // modules_completed tiers
  { id: 'modules_completed_bronze', title: '知识探索者 · 铜章', description: '完成1个学习模块', icon: '🥉', category: 'progress', criteria: { type: 'modules_completed', target: 1 }, points: 50, rarity: 'common' },
  { id: 'modules_completed_silver', title: '知识探索者 · 银章', description: '完成5个学习模块', icon: '🥈', category: 'progress', criteria: { type: 'modules_completed', target: 5 }, points: 100, rarity: 'rare' },
  { id: 'modules_completed_gold', title: '知识探索者 · 金章', description: '完成10个学习模块', icon: '🥇', category: 'progress', criteria: { type: 'modules_completed', target: 10 }, points: 200, rarity: 'epic' },

  // learning_streak tiers
  { id: 'learning_streak_bronze', title: '坚持不懈 · 铜章', description: '连续学习3天', icon: '🥉', category: 'social', criteria: { type: 'learning_streak', target: 3 }, points: 50, rarity: 'common' },
  { id: 'learning_streak_silver', title: '坚持不懈 · 银章', description: '连续学习7天', icon: '🥈', category: 'social', criteria: { type: 'learning_streak', target: 7 }, points: 100, rarity: 'rare' },
  { id: 'learning_streak_gold', title: '坚持不懈 · 金章', description: '连续学习30天', icon: '🥇', category: 'social', criteria: { type: 'learning_streak', target: 30 }, points: 200, rarity: 'epic' },

  // quizzes_completed tiers
  { id: 'quizzes_completed_bronze', title: '测验达人 · 铜章', description: '完成1次测验', icon: '🥉', category: 'quiz', criteria: { type: 'quizzes_completed', target: 1 }, points: 50, rarity: 'common' },
  { id: 'quizzes_completed_silver', title: '测验达人 · 银章', description: '完成10次测验', icon: '🥈', category: 'quiz', criteria: { type: 'quizzes_completed', target: 10 }, points: 100, rarity: 'rare' },
  { id: 'quizzes_completed_gold', title: '测验达人 · 金章', description: '完成50次测验', icon: '🥇', category: 'quiz', criteria: { type: 'quizzes_completed', target: 50 }, points: 200, rarity: 'epic' },

  // perfect_scores tiers
  { id: 'perfect_scores_bronze', title: '满分大师 · 铜章', description: '获得1次满分', icon: '🥉', category: 'quiz', criteria: { type: 'perfect_scores', target: 1 }, points: 50, rarity: 'common' },
  { id: 'perfect_scores_silver', title: '满分大师 · 银章', description: '获得5次满分', icon: '🥈', category: 'quiz', criteria: { type: 'perfect_scores', target: 5 }, points: 100, rarity: 'rare' },
  { id: 'perfect_scores_gold', title: '满分大师 · 金章', description: '获得20次满分', icon: '🥇', category: 'quiz', criteria: { type: 'perfect_scores', target: 20 }, points: 200, rarity: 'epic' },

  // quiz_average tiers
  { id: 'quiz_average_bronze', title: '优秀学员 · 铜章', description: '平均分达到70分', icon: '🥉', category: 'quiz', criteria: { type: 'quiz_average', target: 70 }, points: 50, rarity: 'common' },
  { id: 'quiz_average_silver', title: '优秀学员 · 银章', description: '平均分达到85分', icon: '🥈', category: 'quiz', criteria: { type: 'quiz_average', target: 85 }, points: 100, rarity: 'rare' },
  { id: 'quiz_average_gold', title: '优秀学员 · 金章', description: '平均分达到95分', icon: '🥇', category: 'quiz', criteria: { type: 'quiz_average', target: 95 }, points: 200, rarity: 'epic' },

  // experiments_completed tiers
  { id: 'experiments_completed_bronze', title: '实验专家 · 铜章', description: '完成1个实验', icon: '🥉', category: 'experiment', criteria: { type: 'experiments_completed', target: 1 }, points: 50, rarity: 'common' },
  { id: 'experiments_completed_silver', title: '实验专家 · 银章', description: '完成5个实验', icon: '🥈', category: 'experiment', criteria: { type: 'experiments_completed', target: 5 }, points: 100, rarity: 'rare' },
  { id: 'experiments_completed_gold', title: '实验专家 · 金章', description: '完成所有实验', icon: '🥇', category: 'experiment', criteria: { type: 'experiments_completed', target: 8 }, points: 200, rarity: 'epic' },

  // experiment_time tiers
  { id: 'experiment_time_bronze', title: '实验研究员 · 铜章', description: '实验时长达到1小时', icon: '🥉', category: 'experiment', criteria: { type: 'experiment_time', target: 3600 }, points: 50, rarity: 'common' },
  { id: 'experiment_time_silver', title: '实验研究员 · 银章', description: '实验时长达到5小时', icon: '🥈', category: 'experiment', criteria: { type: 'experiment_time', target: 18000 }, points: 100, rarity: 'rare' },
  { id: 'experiment_time_gold', title: '实验研究员 · 金章', description: '实验时长达到10小时', icon: '🥇', category: 'experiment', criteria: { type: 'experiment_time', target: 36000 }, points: 200, rarity: 'epic' },

  // total_points tiers
  { id: 'total_points_bronze', title: '积分收集者 · 铜章', description: '累计获得500积分', icon: '🥉', category: 'progress', criteria: { type: 'total_points', target: 500 }, points: 50, rarity: 'common' },
  { id: 'total_points_silver', title: '积分收集者 · 银章', description: '累计获得2000积分', icon: '🥈', category: 'progress', criteria: { type: 'total_points', target: 2000 }, points: 100, rarity: 'rare' },
  { id: 'total_points_gold', title: '积分收集者 · 金章', description: '累计获得5000积分', icon: '🥇', category: 'progress', criteria: { type: 'total_points', target: 5000 }, points: 200, rarity: 'epic' },

  // achievements_unlocked tiers
  { id: 'achievements_unlocked_bronze', title: '成就猎人 · 铜章', description: '解锁5个成就', icon: '🥉', category: 'progress', criteria: { type: 'achievements_unlocked', target: 5 }, points: 50, rarity: 'common' },
  { id: 'achievements_unlocked_silver', title: '成就猎人 · 银章', description: '解锁15个成就', icon: '🥈', category: 'progress', criteria: { type: 'achievements_unlocked', target: 15 }, points: 100, rarity: 'rare' },
  { id: 'achievements_unlocked_gold', title: '成就猎人 · 金章', description: '解锁30个成就', icon: '🥇', category: 'progress', criteria: { type: 'achievements_unlocked', target: 30 }, points: 200, rarity: 'epic' },

  // Special achievements
  { id: 'first_quiz_special', title: '初试身手', description: '完成第一次测验', icon: '🎯', category: 'quiz', criteria: { type: 'quizzes_completed', target: 1 }, points: 50, rarity: 'common' },
  { id: 'first_module_special', title: '学习起步', description: '完成第一个学习模块', icon: '📚', category: 'progress', criteria: { type: 'modules_completed', target: 1 }, points: 50, rarity: 'common' },
  { id: 'first_experiment_special', title: '实验新手', description: '完成第一个实验', icon: '🔬', category: 'experiment', criteria: { type: 'experiments_completed', target: 1 }, points: 50, rarity: 'common' },
];

// V2 original achievements (kept as-is)
const ACHIEVEMENTS_V2_ORIGINAL: Achievement[] = [
  // === 账号入门 ===
  // 注册与首次登录流程会持久化 first_login。将它纳入统一目录，避免
  // 学情分析按数据库记录显示 1 项，而勋章墙因目录缺项显示 0 项。
  // 该记录只确认账户生命周期事件，不代表学习投入或任务完成，因此
  // 与 auth.ts 的落库语义保持一致，不发放学习积分。
  {
    id: 'first_login',
    title: '初次登录',
    description: '完成账号注册或首次登录',
    icon: '🎯',
    category: 'progress',
    criteria: { type: 'achievements_unlocked', target: 1 },
    points: 0,
    rarity: 'common',
  },
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

// Unified list: V2 originals + legacy flat entries (deduplicated by id)
const _v2Ids = new Set(ACHIEVEMENTS_V2_ORIGINAL.map(a => a.id));
const _mergedLegacy = ACHIEVEMENTS_LEGACY_FLAT.filter(a => !_v2Ids.has(a.id));

export const ALL_ACHIEVEMENTS: Achievement[] = [...ACHIEVEMENTS_V2_ORIGINAL, ..._mergedLegacy];

// Backward-compatible alias: ACHIEVEMENTS_V2 now points to the unified list
export { ALL_ACHIEVEMENTS as ACHIEVEMENTS_V2 };

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
  const progress = criteriaTarget > 0 ? Math.min(100, (current / criteriaTarget) * 100) : 0;
  const unlocked = criteriaTarget > 0 && current >= criteriaTarget;

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
  const categoryAchievements = ACHIEVEMENTS_V2_ORIGINAL.filter(
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
  return ALL_ACHIEVEMENTS.filter(achievement => achievement.category === category);
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
    progressPercentage = criteriaTarget > 0 ? Math.min((current / criteriaTarget) * 100, 100) : 0;
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
