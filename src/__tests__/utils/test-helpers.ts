/**
 * 测试辅助函数
 * 提供通用的测试工具和辅助方法
 */

import { jest } from '@jest/globals';
import { waitFor, fireEvent } from '@testing-library/react';
import { mockData } from './mock-data';

// API Mock辅助函数
export const createMockApiResponse = <T>(data: T, success = true) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : data,
  message: success ? 'Success' : 'Error'
});

export const createMockPaginatedResponse = <T>(data: T[], page = 1, limit = 10) => ({
  data,
  pagination: {
    page,
    limit,
    total: data.length,
    totalPages: Math.ceil(data.length / limit),
    hasNext: page * limit < data.length,
    hasPrev: page > 1
  }
});

// Mock函数创建辅助
export const createMockFunction = <T = unknown>(returnValue?: T) => {
  return jest.fn().mockReturnValue(returnValue);
};

// 异步操作测试辅助
export const waitForAsync = async (callback: () => void | Promise<void>, timeout = 5000) => {
  await waitFor(callback, { timeout });
};

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// 时间相关测试辅助
export const mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
  return mockDate;
};

export const restoreDate = () => {
  (global.Date as any).mockRestore?.();
};

// localStorage测试辅助
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store() {
      return { ...store };
    }
  };
};

// fetch Mock辅助
export const mockFetch = (mockData: unknown) => {
  const mockResponse: Partial<Response> = {
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockData),
    text: () => Promise.resolve(JSON.stringify(mockData)),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn() as unknown as () => Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData())
  };

  global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));
};

// 错误测试辅助
export const expectToThrow = async (fn: () => Promise<unknown>, expectedError?: string | RegExp) => {
  await expect(fn).rejects.toThrow(expectedError);
};

// 性能测试辅助
export const measureExecutionTime = async <T>(fn: () => Promise<T>) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return {
    result,
    executionTime: end - start
  };
};

// 内存使用测试辅助
export const getMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage();
  }
  return null;
};

// 随机数据生成辅助
export const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateRandomNumber = (min = 0, max = 100) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateRandomEmail = () => {
  return `${generateRandomString(8)}@example.com`;
};

// 测试数据工厂
export const createTestUser = (overrides: Partial<typeof mockData.users.student> = {}) => {
  return {
    ...mockData.users.student,
    id: generateRandomString(12),
    email: generateRandomEmail(),
    ...overrides
  };
};

export const createTestAchievement = (overrides: Partial<typeof mockData.achievements.regular> = {}) => {
  return {
    ...mockData.achievements.regular,
    id: generateRandomString(12),
    ...overrides
  };
};

export const createTestQuiz = (overrides: Partial<typeof mockData.quiz.quiz> = {}) => {
  return {
    ...mockData.quiz.quiz,
    id: generateRandomString(12),
    ...overrides
  };
};

// 组件测试辅助
export const createMockProps = <T extends Record<string, unknown>>(baseProps: T, overrides: Partial<T> = {} as Partial<T>): T => ({
  ...baseProps,
  ...overrides
});

// 事件模拟辅助
export const createMockEvent = <T extends Event = Event>(type: string, properties: Partial<T> = {}): T & { type: string; preventDefault: jest.Mock; stopPropagation: jest.Mock } => ({
  type,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: { value: '' },
  currentTarget: { value: '' },
  ...properties
} as unknown as T & { type: string; preventDefault: jest.Mock; stopPropagation: jest.Mock });

// 表单测试辅助
export const fillForm = (container: HTMLElement, formData: Record<string, string | number | boolean>) => {
  Object.entries(formData).forEach(([name, value]) => {
    const input = container.querySelector(`[name="${name}"]`) as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value: String(value) } });
    }
  });
};

// 路由测试辅助
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/'
};

// 环境变量Mock辅助
export const mockEnvVars = (vars: Record<string, string>) => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, ...vars };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
};

// 控制台输出捕获辅助
export const captureConsole = () => {
  const originalConsole = { ...console };
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  console.log = jest.fn((...args) => {
    logs.push(args.join(' '));
  });
  
  console.error = jest.fn((...args) => {
    errors.push(args.join(' '));
  });
  
  console.warn = jest.fn((...args) => {
    warns.push(args.join(' '));
  });
  
  return {
    logs,
    errors,
    warns,
    restore: () => {
      Object.assign(console, originalConsole);
    }
  };
};

// 测试套件辅助
export const describeIf = (condition: boolean, name: string, fn: () => void) => {
  if (condition) {
    describe(name, fn);
  } else {
    describe.skip(name, fn);
  }
};

export const itIf = (condition: boolean, name: string, fn: () => void) => {
  if (condition) {
    it(name, fn);
  } else {
    it.skip(name, fn);
  }
};

// 清理辅助
export const cleanup = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  restoreDate();
};

// Prisma Mock辅助函数
export const createMockPrismaClient = () => {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    userAchievement: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    session: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    quiz: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    quizAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    learningProgress: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    experiment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback({})),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
};

export const setupPrismaMock = (mockPrisma: any, model: string, method: string, returnValue: any) => {
  if (mockPrisma[model] && mockPrisma[model][method]) {
    mockPrisma[model][method].mockResolvedValue(returnValue);
  }
};

// 导出常用的测试工具集合
export const testUtils = {
  createMockApiResponse,
  createMockPaginatedResponse,
  createMockFunction,
  waitForAsync,
  flushPromises,
  mockDate,
  restoreDate,
  mockLocalStorage,
  mockFetch,
  expectToThrow,
  measureExecutionTime,
  getMemoryUsage,
  generateRandomString,
  generateRandomNumber,
  generateRandomEmail,
  createTestUser,
  createTestAchievement,
  createTestQuiz,
  createMockProps,
  createMockEvent,
  fillForm,
  mockRouter,
  mockEnvVars,
  captureConsole,
  describeIf,
  itIf,
  cleanup,
  createMockPrismaClient,
  setupPrismaMock
};