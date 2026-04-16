// Achievement system with tiered badges

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tiers: {
    bronze: {
      threshold: number;
      description: string;
      points: number;
    };
    silver: {
      threshold: number;
      description: string;
      points: number;
    };
    gold: {
      threshold: number;
      description: string;
      points: number;
    };
    platinum?: {
      threshold: number;
      description: string;
      points: number;
    };
  };
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  // 学习成就
  learning_time: {
    id: 'learning_time',
    name: '学习达人',
    description: '累计学习时长',
    category: '学习',
    tiers: {
      bronze: {
        threshold: 3600, // 1小时
        description: '累计学习1小时',
        points: 50
      },
      silver: {
        threshold: 36000, // 10小时
        description: '累计学习10小时',
        points: 100
      },
      gold: {
        threshold: 360000, // 100小时
        description: '累计学习100小时',
        points: 200
      }
    }
  },
  
  modules_completed: {
    id: 'modules_completed',
    name: '知识探索者',
    description: '完成学习模块',
    category: '学习',
    tiers: {
      bronze: {
        threshold: 1,
        description: '完成1个学习模块',
        points: 50
      },
      silver: {
        threshold: 5,
        description: '完成5个学习模块',
        points: 100
      },
      gold: {
        threshold: 10,
        description: '完成10个学习模块',
        points: 200
      }
    }
  },

  learning_streak: {
    id: 'learning_streak',
    name: '坚持不懈',
    description: '连续学习天数',
    category: '学习',
    tiers: {
      bronze: {
        threshold: 3,
        description: '连续学习3天',
        points: 50
      },
      silver: {
        threshold: 7,
        description: '连续学习7天',
        points: 100
      },
      gold: {
        threshold: 30,
        description: '连续学习30天',
        points: 200
      }
    }
  },

  // 测验成就
  quizzes_completed: {
    id: 'quizzes_completed',
    name: '测验达人',
    description: '完成测验次数',
    category: '测验',
    tiers: {
      bronze: {
        threshold: 1,
        description: '完成1次测验',
        points: 50
      },
      silver: {
        threshold: 10,
        description: '完成10次测验',
        points: 100
      },
      gold: {
        threshold: 50,
        description: '完成50次测验',
        points: 200
      }
    }
  },

  perfect_scores: {
    id: 'perfect_scores',
    name: '满分大师',
    description: '获得满分次数',
    category: '测验',
    tiers: {
      bronze: {
        threshold: 1,
        description: '获得1次满分',
        points: 50
      },
      silver: {
        threshold: 5,
        description: '获得5次满分',
        points: 100
      },
      gold: {
        threshold: 20,
        description: '获得20次满分',
        points: 200
      }
    }
  },

  quiz_average: {
    id: 'quiz_average',
    name: '优秀学员',
    description: '测验平均分',
    category: '测验',
    tiers: {
      bronze: {
        threshold: 70,
        description: '平均分达到70分',
        points: 50
      },
      silver: {
        threshold: 85,
        description: '平均分达到85分',
        points: 100
      },
      gold: {
        threshold: 95,
        description: '平均分达到95分',
        points: 200
      }
    }
  },

  // 实验成就
  experiments_completed: {
    id: 'experiments_completed',
    name: '实验专家',
    description: '完成实验数量',
    category: '实验',
    tiers: {
      bronze: {
        threshold: 1,
        description: '完成1个实验',
        points: 50
      },
      silver: {
        threshold: 5,
        description: '完成5个实验',
        points: 100
      },
      gold: {
        threshold: 8,
        description: '完成所有实验',
        points: 200
      }
    }
  },

  experiment_time: {
    id: 'experiment_time',
    name: '实验研究员',
    description: '实验总时长',
    category: '实验',
    tiers: {
      bronze: {
        threshold: 3600, // 1小时
        description: '实验时长达到1小时',
        points: 50
      },
      silver: {
        threshold: 18000, // 5小时
        description: '实验时长达到5小时',
        points: 100
      },
      gold: {
        threshold: 36000, // 10小时
        description: '实验时长达到10小时',
        points: 200
      }
    }
  },

  // 综合成就
  total_points: {
    id: 'total_points',
    name: '积分收集者',
    description: '累计获得积分',
    category: '综合',
    tiers: {
      bronze: {
        threshold: 500,
        description: '累计获得500积分',
        points: 50
      },
      silver: {
        threshold: 2000,
        description: '累计获得2000积分',
        points: 100
      },
      gold: {
        threshold: 5000,
        description: '累计获得5000积分',
        points: 200
      }
    }
  },

  achievements_unlocked: {
    id: 'achievements_unlocked',
    name: '成就猎人',
    description: '解锁成就数量',
    category: '综合',
    tiers: {
      bronze: {
        threshold: 5,
        description: '解锁5个成就',
        points: 50
      },
      silver: {
        threshold: 15,
        description: '解锁15个成就',
        points: 100
      },
      gold: {
        threshold: 30,
        description: '解锁30个成就',
        points: 200
      }
    }
  }
};

// 获取成就的当前等级
export function getAchievementTier(achievementId: string, currentValue: number): AchievementTier | null {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  if (currentValue >= achievement.tiers.gold.threshold) return 'gold';
  if (currentValue >= achievement.tiers.silver.threshold) return 'silver';
  if (currentValue >= achievement.tiers.bronze.threshold) return 'bronze';
  
  return null;
}

// 计算成就进度百分比
export function calculateAchievementProgress(achievementId: string, currentValue: number): number {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return 0;

  const currentTier = getAchievementTier(achievementId, currentValue);
  
  if (currentTier === 'gold') return 100;
  
  let startThreshold = 0;
  let endThreshold = achievement.tiers.bronze.threshold;
  
  if (currentTier === 'bronze') {
    startThreshold = achievement.tiers.bronze.threshold;
    endThreshold = achievement.tiers.silver.threshold;
  } else if (currentTier === 'silver') {
    startThreshold = achievement.tiers.silver.threshold;
    endThreshold = achievement.tiers.gold.threshold;
  }
  
  const progress = ((currentValue - startThreshold) / (endThreshold - startThreshold)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

// 获取下一个成就等级的阈值
export function getNextTierThreshold(achievementId: string, currentValue: number): number | null {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  const currentTier = getAchievementTier(achievementId, currentValue);
  
  if (!currentTier) return achievement.tiers.bronze.threshold;
  if (currentTier === 'bronze') return achievement.tiers.silver.threshold;
  if (currentTier === 'silver') return achievement.tiers.gold.threshold;
  
  return null; // Already at gold
}