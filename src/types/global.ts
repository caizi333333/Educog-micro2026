// 全局类型定义文件

// 用户相关类型
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// 实验相关类型
export interface Experiment {
  id: string;
  title: string;
  description: string;
  type: 'cognitive' | 'memory' | 'attention' | 'perception';
  difficulty: 'easy' | 'medium' | 'hard';
  duration: number; // 分钟
  instructions: string;
  parameters: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// 实验结果类型
export interface ExperimentResult {
  id: string;
  userId: string;
  experimentId: string;
  score: number;
  accuracy: number;
  reactionTime: number;
  completedAt: Date;
  data: Record<string, unknown>;
}

// 测验相关类型
export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimit?: number; // 分钟
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface QuizResult {
  id: string;
  userId: string;
  quizId: string;
  score: number;
  totalPoints: number;
  answers: Record<string, string | string[]>;
  timeSpent: number; // 秒
  completedAt: Date;
}

// 学习进度类型
export interface LearningProgress {
  userId: string;
  topic: string;
  mastery: number; // 0-100
  timeSpent: number; // 分钟
  lastAccessed: Date;
  completedActivities: string[];
}

// 知识点掌握度类型
export interface KnowledgeMasteryData {
  topic: string;
  mastery: number;
  details: Record<string, number>;
}

// 成就系统相关类型定义
export type AchievementCategory = 'experiment' | 'quiz' | 'progress' | 'social' | 'learning' | 'practice' | 'special' | 'hidden' | 'milestone';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// 成就系统类型
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  criteria: Record<string, unknown>;
  points: number;
  rarity: AchievementRarity;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  hidden?: boolean;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  progress: number; // 0-100
}

// 用户进度数据类型
export interface UserProgressData {
  totalExperiments: number;
  completedQuizzes: number;
  averageScore: number;
  timeSpent: number;
  achievements: UserAchievement[];
  weeklyProgress: Array<{
    week: string;
    experiments: number;
    quizzes: number;
    timeSpent: number;
  }>;
  knowledgeMastery: KnowledgeMasteryData[];
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页类型
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 图表数据类型
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  category?: string;
}

// 通用组件属性类型
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// 表单相关类型
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
}

export interface FormData {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// 通知类型
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// 主题类型
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

// 导出所有类型的联合类型
export type EntityType = 'user' | 'experiment' | 'quiz' | 'result' | 'achievement';
export type SortOrder = 'asc' | 'desc';
export type UserRole = 'student' | 'teacher' | 'admin';
export type ExperimentType = 'cognitive' | 'memory' | 'attention' | 'perception';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
export type NotificationType = 'success' | 'error' | 'warning' | 'info';