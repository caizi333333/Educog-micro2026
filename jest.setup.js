// Setup jest-dom matchers
require('@testing-library/jest-dom');

// 强制测试环境标识（避免 .env 等途径把 NODE_ENV 覆盖为 development）
process.env.NODE_ENV = 'test';

// 提供测试环境必需的最小环境变量，避免 env.ts 校验失败
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_32_chars_min_len!!';

// 为应用代码注入一个全局 Prisma mock（避免路由模块在 test 文件 mock 之前被 import）
if (!global.__mockPrisma) {
  const resolved = (value) => jest.fn().mockResolvedValue(value);
  global.__mockPrisma = {
    user: { findUnique: resolved(null), findFirst: resolved(null), findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0) },
    userProgress: { findUnique: resolved(null), findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0) },
    learningPath: { findFirst: resolved(null), findUnique: resolved(null), findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0) },
    learningProgress: { findUnique: resolved(null), findMany: resolved([]), findFirst: resolved(null), create: resolved({}), createMany: resolved({ count: 0 }), update: resolved({}), updateMany: resolved({ count: 0 }), delete: resolved({}), deleteMany: resolved({ count: 0 }), upsert: resolved({}), count: resolved(0), aggregate: resolved({ _avg: { progress: 0 } }), groupBy: resolved([]) },
    quizAttempt: { findFirst: resolved(null), findUnique: resolved(null), findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0), aggregate: resolved({ _avg: { score: 0 } }) },
    userExperiment: { findUnique: resolved(null), findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0), groupBy: resolved([]) },
    userPointsTransaction: { findMany: resolved([]), create: resolved({}), createMany: resolved({ count: 0 }), update: resolved({}), delete: resolved({}), groupBy: resolved([]), aggregate: resolved({}) },
    userAchievement: { findMany: resolved([]), create: resolved({}), update: resolved({}), delete: resolved({}), upsert: resolved({}), count: resolved(0) },
    userActivity: { create: resolved({}), findMany: resolved([]), count: resolved(0), aggregate: resolved({ _count: { _all: 0 } }) },
    achievement: { findMany: resolved([]), findUnique: resolved(null) },
    experiment: { findMany: resolved([]), findUnique: resolved(null) },
    $queryRaw: resolved([]),
    $transaction: jest.fn(async (arg) => {
      if (typeof arg === 'function') return arg(global.__mockPrisma);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    }),
    $connect: resolved(undefined),
    $disconnect: resolved(undefined),
  };
}

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock window.location for JSDOM - only if not already defined
const mockLocation = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  toString: () => 'http://localhost:3000'
};

// Only define location if it doesn't exist or can be configured
try {
  if (typeof global.location === 'undefined') {
    Object.defineProperty(global, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true
    });
  }
} catch (e) {
  // Ignore if location is already defined and can't be overridden
}

// Also mock window.location if window exists and configurable
if (typeof window !== 'undefined') {
  try {
    if (!window.location || Object.getOwnPropertyDescriptor(window, 'location')?.configurable) {
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true
      });
    }
  } catch (e) {
    // Ignore if window.location is already defined and can't be overridden
  }
}

// Mock Request and Response for Next.js API tests
global.Request = jest.fn().mockImplementation((url, options) => ({
  url,
  method: options?.method || 'GET',
  headers: {
    get: jest.fn().mockImplementation((key) => {
      const headers = options?.headers || {};
      return headers[key.toLowerCase()] || headers[key] || null;
    }),
    ...new Map(Object.entries(options?.headers || {}))
  },
  json: jest.fn().mockResolvedValue(options?.body ? JSON.parse(options.body) : {}),
}));

global.Response = jest.fn().mockImplementation((body, options) => ({
  status: options?.status || 200,
  json: jest.fn().mockResolvedValue(body ? JSON.parse(body) : {}),
}));

// Global test helper to create properly mocked functions
global.createJestMockFunction = (returnValue) => {
  const mockFn = jest.fn();
  if (returnValue !== undefined) {
    mockFn.mockResolvedValue(returnValue);
  }
  // Add common mock methods
  mockFn.mockResolvedValue = jest.fn().mockReturnValue(mockFn);
  mockFn.mockRejectedValue = jest.fn().mockReturnValue(mockFn);
  mockFn.mockImplementation = jest.fn().mockReturnValue(mockFn);
  mockFn.mockReturnValue = jest.fn().mockReturnValue(mockFn);
  return mockFn;
};

// Mock NextResponse and NextRequest
const mockNextResponse = {
  json: jest.fn().mockImplementation((data, options) => ({
    status: options?.status || 200,
    json: jest.fn().mockResolvedValue(data),
    data,
  })),
  next: jest.fn().mockImplementation(() => ({
    status: 200,
    headers: new Headers(),
    json: jest.fn().mockResolvedValue({}),
  })),
  redirect: jest.fn().mockImplementation((url, init) => {
    const status = (typeof init === 'number' ? init : init?.status) || 307;
    const headers = new Headers();
    headers.set('location', typeof url === 'string' ? url : url.toString());
    return {
      status,
      headers,
      json: jest.fn().mockResolvedValue({}),
    };
  }),
  rewrite: jest.fn().mockImplementation((url, init) => {
    const status = (typeof init === 'number' ? init : init?.status) || 200;
    const headers = new Headers();
    headers.set('x-middleware-rewrite', typeof url === 'string' ? url : url.toString());
    return {
      status,
      headers,
      json: jest.fn().mockResolvedValue({}),
    };
  }),
};

const mockNextRequest = jest.fn().mockImplementation((url, options) => ({
  url,
  method: options?.method || 'GET',
  headers: {
    get: jest.fn().mockImplementation((key) => {
      const headers = options?.headers || {};
      return headers[key.toLowerCase()] || headers[key] || null;
    }),
    ...new Map(Object.entries(options?.headers || {}))
  },
  text: jest.fn().mockImplementation(() => {
    return Promise.resolve(options?.body || '');
  }),
  json: jest.fn().mockImplementation(() => {
    if (!options?.body) return Promise.resolve({});
    if (typeof options.body === 'string') {
      try {
        return Promise.resolve(JSON.parse(options.body));
      } catch (error) {
        return Promise.reject(new SyntaxError('Unexpected token'));
      }
    }
    return Promise.resolve(options.body);
  }),
}));

jest.mock('next/server', () => ({
  NextResponse: mockNextResponse,
  NextRequest: mockNextRequest,
}));

// 全局 mock Prisma 模块：保证 api route 中 `import { prisma, checkDatabaseConnection }` 不会因为缺失导出导致 500
jest.mock('@/lib/prisma', () => {
  const prismaProxy = new Proxy({}, {
    get(_t, prop) {
      return global.__mockPrisma?.[prop];
    }
  });
  return {
    prisma: prismaProxy,
    checkDatabaseConnection: jest.fn().mockResolvedValue(true),
  };
});

// Suppress console warnings and errors during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Global Prisma mock helper
global.createPrismaMock = () => {
  const createEntityMock = () => ({
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
  });

  return {
    user: createEntityMock(),
    userProgress: createEntityMock(),
    learningPath: createEntityMock(),
    userActivity: createEntityMock(),
    achievement: createEntityMock(),
    userAchievement: createEntityMock(),
    experiment: createEntityMock(),
    learningProgress: createEntityMock(),
    quizAttempt: createEntityMock(),
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
};
