// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User Types
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  avatar?: string;
  studentId?: string;
  teacherId?: string;
  class?: string;
  grade?: string;
  major?: string;
  department?: string;
  title?: string;
}

// Learning Progress Types
export interface LearningProgressData {
  moduleId: string;
  chapterId: string;
  progress: number;
  timeSpent: number;
  lastAccessed: Date;
  isCompleted: boolean;
  notes?: string;
  bookmarks?: string[];
}

// Achievement Types
export interface Achievement {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  unlockedAt: Date;
  progress: number;
  dateUnlocked?: Date; // For backward compatibility
}

// Quiz Types
export interface QuizAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
}

export interface QuizSubmission {
  quizId: string;
  moduleId: string;
  chapterId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  answers: QuizAnswer[];
  weakAreas?: string[];
  scoresByKA?: Record<string, number>;
}

// Experiment Types
export interface ExperimentData {
  title: string;
  goal: string;
  steps: string[];
  code: string;
  expectedOutput?: string;
  analysis?: string;
}

export interface ExperimentResult {
  output: string;
  success: boolean;
  error?: string;
  executionTime?: number;
}

// AI Chat Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatContext {
  moduleId?: string;
  chapterId?: string;
  questionType?: string;
  difficulty?: string;
  topic?: string;
}

// Stats Types
export interface UserStats {
  totalTimeSpent: number;
  completedChapters: number;
  totalChapters: number;
  averageQuizScore: number;
  experimentsCompleted: number;
  achievementsUnlocked: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
}

export interface LearningMetrics {
  readingProgress: number;
  timeSpentMinutes: number;
  interactions: {
    notes: number;
    highlights: number;
    codeExecutions: number;
    questions: number;
  };
  requiredTimeMinutes?: number;
  totalExercises?: number;
  completedExercises?: number;
  quizScores?: number[];
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

// Form Types
export interface LoginFormData {
  emailOrUsername: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  name?: string;
  role: 'STUDENT' | 'TEACHER';
  studentId?: string;
  teacherId?: string;
  class?: string;
  grade?: string;
  major?: string;
  department?: string;
  title?: string;
}

// Module Content Types
export interface ModuleSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'theory' | 'example' | 'exercise' | 'summary';
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  sections: ModuleSection[];
  estimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
  learningObjectives?: string[];
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ComponentType;
  children?: NavigationItem[];
  badge?: string | number;
  disabled?: boolean;
}

// Error Types
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API Client Types
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface PendingRequest<T = unknown> {
  promise: Promise<ApiResponse<T>>;
  controller: AbortController;
}

export interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retry?: number;
  dedupe?: boolean;
  cacheTime?: number;
}

// Security Types
export interface SensitiveDataMask {
  [key: string]: unknown;
}

// Performance Types
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  timestamp: number;
}

// Achievement Progress Types
export interface AchievementProgress {
  achievementId: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: Date;
}

// Learning Progress Extended Types
export interface LearningProgressEntry {
  id: string;
  userId: string;
  moduleId: string;
  chapterId?: string;
  progress: number;
  timeSpent: number;
  completedAt?: Date;
  lastAccessed: Date;
  metadata?: Record<string, unknown>;
}

// Database Utility Types
export interface BatchOperationResult<T = unknown> {
  success: boolean;
  results: T[];
  errors?: Error[];
}

export interface DatabaseRelations {
  [key: string]: boolean | DatabaseRelations;
}