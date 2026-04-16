/**
 * Learning Completion Criteria System
 * 
 * 学习完成度计算系统，综合考虑多个维度：
 * 1. 阅读进度 (30%)
 * 2. 学习时长 (30%)
 * 3. 互动行为 (20%)
 * 4. 测验成绩 (20%)
 */

export interface LearningMetrics {
  readingProgress: number;     // 0-100 阅读进度
  timeSpentMinutes: number;    // 学习时长（分钟）
  interactions: {
    notes: number;             // 笔记数量
    highlights: number;        // 高亮标记数量
    codeExecutions: number;    // 代码运行次数
    questions: number;         // 提问次数
  };
  quizScore?: number;          // 相关测验分数 0-100
  requiredTimeMinutes: number; // 建议学习时长
}

// Renamed to avoid conflict
export interface BasicCompletionCriteria {
  minReadingProgress: number;    // 最低阅读进度要求
  minTimeSpentMinutes: number;   // 最低学习时长要求
  minInteractions: number;       // 最低互动次数要求
  minQuizScore?: number;         // 最低测验分数要求
}

// 默认完成标准
export const DEFAULT_COMPLETION_CRITERIA: BasicCompletionCriteria = {
  minReadingProgress: 90,       // 至少阅读90%内容
  minTimeSpentMinutes: 5,       // 至少学习5分钟
  minInteractions: 2,            // 至少2次互动（笔记、高亮、代码运行等）
  minQuizScore: 60,              // 测验至少及格（如果有测验）
};

// 不同类型内容的权重配置
export const CONTENT_TYPE_WEIGHTS = {
  theory: {
    reading: 0.4,      // 理论内容重视阅读
    time: 0.3,
    interaction: 0.2,
    quiz: 0.1,
  },
  practice: {
    reading: 0.2,      // 实践内容重视互动
    time: 0.2,
    interaction: 0.4,
    quiz: 0.2,
  },
  mixed: {
    reading: 0.3,      // 混合内容平衡各项
    time: 0.3,
    interaction: 0.2,
    quiz: 0.2,
  },
};

/**
 * 计算学习完成度
 * @param metrics 学习指标
 * @param contentType 内容类型
 * @param criteria 完成标准
 * @returns 完成度百分比和详细信息
 */
export function calculateLearningCompletion(
  metrics: LearningMetrics,
  contentType: 'theory' | 'practice' | 'mixed' = 'mixed',
  criteria: BasicCompletionCriteria = DEFAULT_COMPLETION_CRITERIA
): {
  completionPercentage: number;
  isCompleted: boolean;
  details: {
    readingScore: number;
    timeScore: number;
    interactionScore: number;
    quizScore: number;
  };
  suggestions: string[];
} {
  const weights = CONTENT_TYPE_WEIGHTS[contentType];
  
  // 1. 计算阅读进度得分 (0-100)
  const readingScore = Math.min(100, (metrics.readingProgress / criteria.minReadingProgress) * 100);
  
  // 2. 计算学习时长得分 (0-100)
  const timeScore = Math.min(100, (metrics.timeSpentMinutes / criteria.minTimeSpentMinutes) * 100);
  
  // 3. 计算互动行为得分 (0-100)
  const totalInteractions = Object.values(metrics.interactions).reduce((sum, count) => sum + count, 0);
  const interactionScore = Math.min(100, (totalInteractions / criteria.minInteractions) * 100);
  
  // 4. 计算测验得分 (0-100)
  let quizScore = 100; // 默认满分（如果没有测验）
  if (metrics.quizScore !== undefined && criteria.minQuizScore !== undefined) {
    quizScore = Math.min(100, (metrics.quizScore / criteria.minQuizScore) * 100);
  }
  
  // 5. 计算加权总分
  const weightedScore = 
    readingScore * weights.reading +
    timeScore * weights.time +
    interactionScore * weights.interaction +
    quizScore * weights.quiz;
  
  // 6. 判断是否完成（必须满足所有最低要求）
  const isCompleted = 
    metrics.readingProgress >= criteria.minReadingProgress &&
    metrics.timeSpentMinutes >= criteria.minTimeSpentMinutes &&
    totalInteractions >= criteria.minInteractions &&
    (metrics.quizScore === undefined || criteria.minQuizScore === undefined || 
     metrics.quizScore >= criteria.minQuizScore);
  
  // 7. 生成学习建议
  const suggestions: string[] = [];
  
  if (readingScore < 100) {
    const remaining = criteria.minReadingProgress - metrics.readingProgress;
    suggestions.push(`继续阅读剩余的 ${Math.round(remaining)}% 内容`);
  }
  
  if (timeScore < 100) {
    const remaining = criteria.minTimeSpentMinutes - metrics.timeSpentMinutes;
    suggestions.push(`再学习 ${Math.round(remaining)} 分钟`);
  }
  
  if (interactionScore < 100) {
    const remaining = criteria.minInteractions - totalInteractions;
    if (remaining > 0) {
      suggestions.push(`增加 ${remaining} 次互动（如做笔记、标记重点或运行代码）`);
    }
  }
  
  if (quizScore < 100 && metrics.quizScore !== undefined && criteria.minQuizScore !== undefined) {
    if (metrics.quizScore < criteria.minQuizScore) {
      suggestions.push(`测验分数需要达到 ${criteria.minQuizScore} 分以上`);
    }
  }
  
  return {
    completionPercentage: Math.round(weightedScore),
    isCompleted,
    details: {
      readingScore: Math.round(readingScore),
      timeScore: Math.round(timeScore),
      interactionScore: Math.round(interactionScore),
      quizScore: Math.round(quizScore),
    },
    suggestions,
  };
}

/**
 * 获取学习质量评级
 * @param completionPercentage 完成度百分比
 * @returns 质量评级
 */
export function getLearningQualityRating(completionPercentage: number): {
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  label: string;
  color: string;
} {
  if (completionPercentage >= 90) {
    return { rating: 'excellent', label: '优秀', color: 'text-green-600' };
  } else if (completionPercentage >= 75) {
    return { rating: 'good', label: '良好', color: 'text-blue-600' };
  } else if (completionPercentage >= 60) {
    return { rating: 'fair', label: '合格', color: 'text-yellow-600' };
  } else {
    return { rating: 'poor', label: '需加强', color: 'text-red-600' };
  }
}

/**
 * 计算预计完成时间
 * @param metrics 当前学习指标
 * @param criteria 完成标准
 * @returns 预计还需要的时间（分钟）
 */
export function estimateRemainingTime(
  metrics: LearningMetrics,
  criteria: BasicCompletionCriteria = DEFAULT_COMPLETION_CRITERIA
): number {
  const remainingReading = Math.max(0, criteria.minReadingProgress - metrics.readingProgress);
  const remainingTime = Math.max(0, criteria.minTimeSpentMinutes - metrics.timeSpentMinutes);
  
  // 假设阅读速度：每分钟可以完成10%的内容
  const readingTime = remainingReading / 10;
  
  return Math.ceil(Math.max(readingTime, remainingTime));
}

// Additional types for chapter completion
export interface ChapterCompletionConfig {
  requireQuiz: boolean;
  requireExercises: boolean;
  minQuizScore: number;
  minExerciseCompletion: number;
}

export const DEFAULT_COMPLETION_CONFIG: ChapterCompletionConfig = {
  requireQuiz: true,
  requireExercises: true,
  minQuizScore: 60,
  minExerciseCompletion: 80, // 80% of exercises
};

// Extended completion criteria for the API
export interface CompletionCriteria {
  readingProgress: number;
  minimumTimeSpent: number; // in seconds
  quizCompleted?: boolean;
  quizScore?: number;
  exercisesCompleted?: number;
  totalExercises?: number;
  hasNotes?: boolean;
  hasBookmarks?: boolean;
}

/**
 * Calculate completion percentage based on multiple criteria
 * @param criteria Completion criteria
 * @returns Completion percentage (0-100)
 */
export function calculateCompletionPercentage(criteria: CompletionCriteria): number {
  let totalWeight = 0;
  let weightedScore = 0;

  // Reading progress (30% weight)
  const readingWeight = 30;
  const readingScore = Math.min(100, (criteria.readingProgress / 90) * 100);
  weightedScore += readingScore * (readingWeight / 100);
  totalWeight += readingWeight;

  // Time spent (30% weight)
  const timeWeight = 30;
  const timeScore = Math.min(100, (criteria.minimumTimeSpent / 300) * 100); // 5 minutes = 300 seconds
  weightedScore += timeScore * (timeWeight / 100);
  totalWeight += timeWeight;

  // Quiz completion (20% weight if quiz exists)
  if (criteria.quizCompleted !== undefined) {
    const quizWeight = 20;
    const quizScore = criteria.quizCompleted && (criteria.quizScore || 0) >= 60 ? 100 : 0;
    weightedScore += quizScore * (quizWeight / 100);
    totalWeight += quizWeight;
  }

  // Exercise completion (20% weight if exercises exist)
  if (criteria.totalExercises && criteria.totalExercises > 0) {
    const exerciseWeight = 20;
    const exerciseScore = Math.min(100, ((criteria.exercisesCompleted || 0) / (criteria.totalExercises * 0.8)) * 100);
    weightedScore += exerciseScore * (exerciseWeight / 100);
    totalWeight += exerciseWeight;
  }

  // Normalize if total weight is not 100
  if (totalWeight > 0 && totalWeight !== 100) {
    weightedScore = weightedScore * (100 / totalWeight);
  }

  return Math.round(weightedScore);
}

/**
 * Check if a chapter is completed based on criteria
 * @param criteria Completion criteria
 * @returns Whether the chapter is completed
 */
export function isChapterCompleted(criteria: CompletionCriteria): boolean {
  // Must have at least 90% reading progress
  if (criteria.readingProgress < 90) return false;

  // Must have spent at least 5 minutes
  if (criteria.minimumTimeSpent < 300) return false;

  // If quiz is required, must be completed with passing score
  if (criteria.quizCompleted !== undefined) {
    if (!criteria.quizCompleted || (criteria.quizScore || 0) < 60) {
      return false;
    }
  }

  // If exercises exist, must complete at least 80%
  if (criteria.totalExercises && criteria.totalExercises > 0) {
    const completionRate = (criteria.exercisesCompleted || 0) / criteria.totalExercises;
    if (completionRate < 0.8) return false;
  }

  return true;
}

/**
 * Get missing requirements for chapter completion
 * @param criteria Completion criteria
 * @returns Array of missing requirement descriptions
 */
export function getMissingRequirements(criteria: CompletionCriteria): string[] {
  const missing: string[] = [];

  if (criteria.readingProgress < 90) {
    missing.push(`还需阅读 ${90 - criteria.readingProgress}% 的内容`);
  }

  if (criteria.minimumTimeSpent < 300) {
    const remainingMinutes = Math.ceil((300 - criteria.minimumTimeSpent) / 60);
    missing.push(`还需学习 ${remainingMinutes} 分钟`);
  }

  if (criteria.quizCompleted !== undefined && (!criteria.quizCompleted || (criteria.quizScore || 0) < 60)) {
    if (!criteria.quizCompleted) {
      missing.push('需要完成章节测验');
    } else if ((criteria.quizScore || 0) < 60) {
      missing.push(`测验分数需要达到 60 分以上（当前：${criteria.quizScore}分）`);
    }
  }

  if (criteria.totalExercises && criteria.totalExercises > 0) {
    const requiredExercises = Math.ceil(criteria.totalExercises * 0.8);
    const completed = criteria.exercisesCompleted || 0;
    if (completed < requiredExercises) {
      missing.push(`还需完成 ${requiredExercises - completed} 道练习题`);
    }
  }

  return missing;
}

/**
 * Format completion status for display
 * @param criteria Completion criteria
 * @returns Formatted status object
 */
export function formatCompletionStatus(criteria: CompletionCriteria): {
  percentage: number;
  isCompleted: boolean;
  statusText: string;
  statusColor: string;
} {
  const percentage = calculateCompletionPercentage(criteria);
  const isCompleted = isChapterCompleted(criteria);

  let statusText: string;
  let statusColor: string;

  if (isCompleted) {
    statusText = '已完成';
    statusColor = 'text-green-600';
  } else if (percentage >= 80) {
    statusText = '即将完成';
    statusColor = 'text-blue-600';
  } else if (percentage >= 50) {
    statusText = '进行中';
    statusColor = 'text-yellow-600';
  } else if (percentage > 0) {
    statusText = '刚开始';
    statusColor = 'text-orange-600';
  } else {
    statusText = '未开始';
    statusColor = 'text-gray-500';
  }

  return {
    percentage,
    isCompleted,
    statusText,
    statusColor,
  };
}