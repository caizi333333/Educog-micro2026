import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user/stats/route';
import { verifyToken } from '@/lib/auth';
import { createMockNextRequest } from '../utils/test-mocks';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

describe('API Routes Simple Tests - /api/user/stats', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

  beforeEach(() => {
    jest.clearAllMocks();
    const prisma = (globalThis as any).__mockPrisma;
    prisma.learningProgress.findMany.mockResolvedValue([]);
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.userExperiment.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ lastLoginAt: new Date(), createdAt: new Date() });
  });

  it('should return stats with valid token', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user123', email: 'x@y.com' } as any);

    const req = createMockNextRequest('http://localhost:3000/api/user/stats', {
      headers: { authorization: 'Bearer valid-token' },
    }) as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('stats');
  });
});

