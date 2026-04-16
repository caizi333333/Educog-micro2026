/**
 * Comprehensive test mock utilities for TypeScript tests
 * Provides properly typed mocks for Prisma, JWT payloads, and common patterns
 */

import { jest } from '@jest/globals';

// JWT Payload Types
export interface MockJWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Create standard JWT payload mock
export const createMockJWTPayload = (overrides: Partial<MockJWTPayload> = {}): MockJWTPayload => ({
  userId: 'user123',
  email: 'test@example.com',
  role: 'student',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

// Prisma Mock Types
export type MockPrismaMethod<T = any> = jest.MockedFunction<(...args: any[]) => Promise<T>>;

// Create a properly typed Prisma mock
export const createMockPrismaClient = () => {
  const client = {
    user: {
      findUnique: jest.fn() as MockPrismaMethod,
      findFirst: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    userProgress: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    learningPath: {
      findFirst: jest.fn() as MockPrismaMethod,
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    userActivity: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    achievement: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    userAchievement: {
      findUnique: jest.fn() as MockPrismaMethod,
      findFirst: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    session: {
      create: jest.fn() as MockPrismaMethod,
      findUnique: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      deleteMany: jest.fn() as MockPrismaMethod,
    },
    experiment: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
    },
    userExperiment: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
      groupBy: jest.fn() as MockPrismaMethod,
    },
    userPointsTransaction: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      groupBy: jest.fn() as MockPrismaMethod,
      aggregate: jest.fn() as MockPrismaMethod,
    },
    learningProgress: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      findFirst: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      deleteMany: jest.fn() as MockPrismaMethod,
      updateMany: jest.fn() as MockPrismaMethod,
      createMany: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
      aggregate: jest.fn() as MockPrismaMethod,
      groupBy: jest.fn() as MockPrismaMethod,
    },
    quizAttempt: {
      findUnique: jest.fn() as MockPrismaMethod,
      findMany: jest.fn() as MockPrismaMethod,
      create: jest.fn() as MockPrismaMethod,
      update: jest.fn() as MockPrismaMethod,
      delete: jest.fn() as MockPrismaMethod,
      upsert: jest.fn() as MockPrismaMethod,
      count: jest.fn() as MockPrismaMethod,
      aggregate: jest.fn() as MockPrismaMethod,
    },
    $transaction: jest.fn() as MockPrismaMethod,
    $connect: jest.fn() as MockPrismaMethod,
    $disconnect: jest.fn() as MockPrismaMethod,
  };

  // 让应用代码（src/lib/prisma.ts）在测试环境下能拿到同一个 mock
  // 注意：使用 globalThis，避免 ESM mock/hoist 差异导致路由模块提前 import 时拿到真实 PrismaClient
  (globalThis as any).__mockPrisma = client;

  return client;
};

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashedpassword',
  role: 'student',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUserProgress = (overrides = {}) => ({
  id: 'progress123',
  userId: 'user123',
  modulesCompleted: 2,
  totalTimeSpent: 120,
  averageScore: 85,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockLearningPath = (overrides = {}) => ({
  id: 'path123',
  userId: 'user123',
  name: '个性化学习计划',
  description: '基于测评结果的个性化学习计划',
  modules: '[{"id":1,"name":"基础知识"}]',
  currentModule: 0,
  totalModules: 5,
  status: 'ACTIVE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockUserActivity = (overrides = {}) => ({
  id: 'activity123',
  userId: 'user123',
  action: 'CREATE_LEARNING_PATH' as const,
  details: '{}',
  createdAt: new Date(),
  ...overrides,
});

// Test helper functions
export const setupAuthMock = (mockVerifyToken: jest.MockedFunction<any>, payload?: MockJWTPayload | null) => {
  // 约定：
  // - payload === null：模拟无效 token（verifyToken 返回 null）
  // - payload 为对象：返回指定 payload
  // - payload === undefined：返回默认有效 payload
  if (payload === null) {
    mockVerifyToken.mockResolvedValue(null);
    return;
  }
  if (payload) {
    mockVerifyToken.mockResolvedValue(payload);
    return;
  }
  mockVerifyToken.mockResolvedValue(createMockJWTPayload());
};

export const setupPrismaMock = (mockPrisma: any, entity: string, method: string, result: any) => {
  const entityMock = mockPrisma[entity];
  if (entityMock && entityMock[method] && typeof entityMock[method].mockResolvedValue === 'function') {
    if (result instanceof Error) {
      entityMock[method].mockRejectedValue(result);
    } else {
      entityMock[method].mockResolvedValue(result);
    }
  }
};

// Clear all mocks helper
export const clearAllMocks = (mockPrisma?: ReturnType<typeof createMockPrismaClient>) => {
  jest.clearAllMocks();
  
  // Clear all Prisma mocks if provided and valid
  if (mockPrisma && typeof mockPrisma === 'object') {
    Object.values(mockPrisma).forEach(entity => {
      if (typeof entity === 'object' && entity !== null) {
        Object.values(entity).forEach(method => {
          if (typeof method === 'function' && 'mockClear' in method) {
            (method as jest.MockedFunction<any>).mockClear();
          }
        });
      }
    });
  }
};

// Common test patterns
export const expectUnauthorizedResponse = async (response: Response) => {
  expect(response.status).toBe(401);
  const data = await response.json();
  expect(data.success).toBe(false);
  expect(data.error).toMatch(/未授权|unauthorized|Unauthorized|Invalid token|无效的令牌/i);
};

export const expectSuccessResponse = async (response: Response, expectedData?: any) => {
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
  if (expectedData) {
    expect(data).toMatchObject(expectedData);
  }
  return data;
};

export const expectErrorResponse = async (response: Response, expectedStatus = 500, expectedErrorPattern?: RegExp) => {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.success).toBe(false);
  if (expectedErrorPattern) {
    expect(data.error).toMatch(expectedErrorPattern);
  }
  return data;
};

// NextRequest helper with full compatibility
export const createMockNextRequest = (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | object;
  searchParams?: Record<string, string>;
} = {}) => {
  const { method = 'GET', headers = {}, body, searchParams = {} } = options;
  
  const mockURL = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    mockURL.searchParams.set(key, value);
  });

  const mockHeaders = new Headers(headers);
  
  return {
    url,
    method,
    headers: mockHeaders,
    nextUrl: mockURL,
    cookies: {
      get: jest.fn((name: string) => ({ name, value: 'mock-value' })),
      getAll: jest.fn(() => []),
      set: jest.fn(),
      delete: jest.fn(),
      has: jest.fn(() => false),
      clear: jest.fn(),
      toString: jest.fn(() => ''),
      size: 0,
      [Symbol.iterator]: jest.fn(function* () {})
    },
    json: jest.fn().mockImplementation(() => {
      if (!body) return Promise.resolve({});
      if (typeof body === 'string') {
        try {
          return Promise.resolve(JSON.parse(body));
        } catch (error) {
          return Promise.reject(new SyntaxError('Unexpected token'));
        }
      }
      return Promise.resolve(body);
    }),
    text: jest.fn().mockImplementation(() => {
      return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body || {}));
    }),
    formData: jest.fn(() => Promise.resolve(new FormData())),
    arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(0))),
    blob: jest.fn(() => Promise.resolve(new Blob())),
    bytes: jest.fn(() => Promise.resolve(new Uint8Array())),
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    cache: 'default' as RequestCache,
    credentials: 'same-origin' as RequestCredentials,
    destination: '' as RequestDestination,
    integrity: '',
    keepalive: false,
    mode: 'cors' as RequestMode,
    redirect: 'follow' as RequestRedirect,
    referrer: '',
    referrerPolicy: '' as ReferrerPolicy,
    signal: new AbortController().signal,
    page: undefined,
    ua: undefined,
    ip: '127.0.0.1',
    geo: undefined
  };
};

// Standard Request Mock 创建器
export const createMockRequest = (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | object;
} = {}) => {
  const { method = 'GET', headers = {}, body } = options;
  
  const mockHeaders = new Headers(headers);
  
  return {
    url,
    method,
    headers: mockHeaders,
    json: jest.fn().mockImplementation(() => {
      if (!body) return Promise.resolve({});
      if (typeof body === 'string') {
        try {
          return Promise.resolve(JSON.parse(body));
        } catch (error) {
          return Promise.reject(new SyntaxError('Unexpected token'));
        }
      }
      return Promise.resolve(body);
    }),
    text: jest.fn(() => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body || {}))),
    formData: jest.fn(() => Promise.resolve(new FormData())),
    arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(0))),
    blob: jest.fn(() => Promise.resolve(new Blob())),
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    cache: 'default' as RequestCache,
    credentials: 'same-origin' as RequestCredentials,
    destination: '' as RequestDestination,
    integrity: '',
    keepalive: false,
    mode: 'cors' as RequestMode,
    redirect: 'follow' as RequestRedirect,
    referrer: '',
    referrerPolicy: '' as ReferrerPolicy,
    signal: new AbortController().signal
  };
};

// Global prisma mock for easier access
export let mockPrisma: ReturnType<typeof createMockPrismaClient>;

// Setup global prisma mock
export const setupGlobalPrismaMock = () => {
  mockPrisma = createMockPrismaClient();
  (global as any).prisma = mockPrisma;
  return mockPrisma;
};
