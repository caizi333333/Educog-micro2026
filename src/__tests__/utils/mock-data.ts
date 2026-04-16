/**
 * 测试用Mock数据
 * 提供统一的测试数据，确保测试的一致性
 */

import type { AchievementCategory } from '@/types/global';

// 用户相关Mock数据
export const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'student' as const,
  avatar: null,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

export const mockTeacher = {
  id: 'test-teacher-id',
  username: 'testteacher',
  email: 'teacher@example.com',
  role: 'teacher' as const,
  avatar: null,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

// 成就系统Mock数据
export const mockAchievement = {
  id: 'test-achievement',
  title: 'Test Achievement',
  description: 'Test achievement description',
  icon: 'trophy',
  points: 100,
  rarity: 'common' as const,
  category: 'quiz' as AchievementCategory,
  tier: 'bronze' as const,
  hidden: false,
  criteria: {
    type: 'quizzesCompleted',
    target: 5,
    timeframe: null
  }
};

export const mockHiddenAchievement = {
  id: 'test-hidden-achievement',
  title: 'Hidden Achievement',
  description: 'Secret achievement description',
  icon: 'star',
  points: 200,
  rarity: 'rare' as const,
  category: 'progress' as AchievementCategory,
  tier: 'silver' as const,
  hidden: true,
  criteria: {
    type: 'studyTimeMinutes',
    target: 100,
    timeframe: null
  }
};

export const mockUserProgress = {
  userId: 'test-user-id',
  achievementId: 'test-achievement',
  progress: 3,
  target: 5,
  unlocked: false,
  unlockedAt: null,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

export const mockUserStats = {
  userId: 'test-user-id',
  totalPoints: 500,
  level: 5,
  experiencePoints: 1250,
  quizzesCompleted: 15,
  studyTimeMinutes: 300,
  loginStreak: 7,
  achievementsUnlocked: 8,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

// 知识图谱Mock数据
export const mockKnowledgeNode = {
  id: 'test-node-1',
  title: 'Test Node',
  description: 'Test node description',
  type: 'concept' as const,
  difficulty: 'beginner' as const,
  estimatedTime: 30,
  prerequisites: [],
  position: { x: 100, y: 100 },
  status: 'available' as const,
  content: {
    text: 'Test content',
    resources: []
  }
};

export const mockLearningPath = {
  id: 'test-path-1',
  title: 'Test Learning Path',
  description: 'Test learning path description',
  difficulty: 'beginner' as const,
  estimatedTime: 120,
  nodes: ['test-node-1'],
  prerequisites: [],
  tags: ['test', 'beginner'],
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

export const mockUserNodeProgress = {
  userId: 'test-user-id',
  nodeId: 'test-node-1',
  status: 'in_progress' as const,
  progress: 0.6,
  timeSpent: 18,
  lastAccessed: new Date('2024-01-01').toISOString(),
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

// 测验Mock数据
export const mockQuiz = {
  id: 'test-quiz-1',
  title: 'Test Quiz',
  description: 'Test quiz description',
  difficulty: 'medium' as const,
  timeLimit: 600, // 10 minutes
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice' as const,
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      points: 10
    },
    {
      id: 'q2',
      type: 'true_false' as const,
      question: 'The sky is blue.',
      correctAnswer: true,
      points: 5
    }
  ],
  totalPoints: 15,
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

export const mockQuizResult = {
  id: 'test-result-1',
  userId: 'test-user-id',
  quizId: 'test-quiz-1',
  score: 12,
  totalPoints: 15,
  percentage: 80,
  timeSpent: 480,
  answers: [
    { questionId: 'q1', answer: 1, correct: true, points: 10 },
    { questionId: 'q2', answer: true, correct: true, points: 5 }
  ],
  completedAt: new Date('2024-01-01').toISOString(),
  createdAt: new Date('2024-01-01').toISOString()
};

// 仿真引擎Mock数据
export const mockSimulationConfig = {
  id: 'test-simulation-1',
  name: 'Test Simulation',
  type: 'physics' as const,
  parameters: {
    gravity: 9.8,
    friction: 0.1,
    timeStep: 0.016
  },
  initialState: {
    objects: [
      {
        id: 'obj1',
        type: 'sphere',
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        mass: 1.0
      }
    ]
  }
};

export const mockSimulationResult = {
  id: 'test-result-1',
  simulationId: 'test-simulation-1',
  userId: 'test-user-id',
  startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
  endTime: new Date('2024-01-01T10:05:00Z').toISOString(),
  duration: 300000, // 5 minutes in milliseconds
  finalState: {
    objects: [
      {
        id: 'obj1',
        type: 'sphere',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        mass: 1.0
      }
    ]
  },
  metrics: {
    accuracy: 0.95,
    efficiency: 0.87,
    completionRate: 1.0
  }
};

// API响应Mock数据
export const mockApiResponse = {
  success: {
    success: true,
    data: mockUser,
    message: 'Operation successful'
  },
  error: {
    success: false,
    error: 'Something went wrong',
    message: 'An error occurred'
  },
  validationError: {
    success: false,
    error: 'Validation failed',
    details: {
      email: ['Email is required'],
      password: ['Password must be at least 8 characters']
    }
  }
};

// 分页Mock数据
export const mockPaginatedResponse = {
  data: [mockUser, mockTeacher],
  pagination: {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  }
};

// 导出所有Mock数据的集合
export const mockData = {
  users: {
    student: mockUser,
    teacher: mockTeacher
  },
  achievements: {
    regular: mockAchievement,
    hidden: mockHiddenAchievement,
    progress: mockUserProgress,
    stats: mockUserStats
  },
  knowledgeGraph: {
    node: mockKnowledgeNode,
    path: mockLearningPath,
    progress: mockUserNodeProgress
  },
  quiz: {
    quiz: mockQuiz,
    result: mockQuizResult
  },
  simulation: {
    config: mockSimulationConfig,
    result: mockSimulationResult
  },
  api: {
    success: mockApiResponse.success,
    error: mockApiResponse.error,
    validationError: mockApiResponse.validationError,
    paginated: mockPaginatedResponse
  }
};