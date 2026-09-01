import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/knowledge-nodes/route';
import { DELETE, PATCH } from '@/app/api/admin/knowledge-nodes/[id]/route';
import { POST as SeedPOST } from '@/app/api/admin/seed-knowledge/route';
import { POST as ReconcilePOST } from '@/app/api/admin/reconcile/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidateKnowledgeCache } from '@/lib/knowledge-source';
import { knowledgePoints } from '@/lib/knowledge-points';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    knowledgeNode: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userActivity: { create: jest.fn(), findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    userPointsTransaction: { aggregate: jest.fn() },
    userAchievement: { count: jest.fn() },
    achievementAuditLog: { create: jest.fn() },
  },
}));

jest.mock('@/lib/knowledge-source', () => {
  const actual = jest.requireActual('@/lib/knowledge-source');
  return { ...actual, invalidateKnowledgeCache: jest.fn() };
});

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockInvalidateKnowledgeCache = invalidateKnowledgeCache as jest.MockedFunction<typeof invalidateKnowledgeCache>;

const teacherPayload = {
  userId: 'teacher-1',
  email: 'teacher@example.com',
  role: 'TEACHER',
  iat: 1,
  exp: 9999999999,
};

function request(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      authorization: 'Bearer teacher-token',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function node(overrides: Record<string, unknown> = {}) {
  return {
    id: '3.1.9',
    name: '新增寻址练习',
    level: 3,
    chapter: 3,
    description: null,
    graphNodeId: null,
    parentId: '3.1',
    resources: null,
    prerequisites: ['3.1.1'],
    appliedIn: ['exp02'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('管理员知识节点写接口', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue(teacherPayload);
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return (operation as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }
      return Promise.all(operation as Promise<unknown>[]);
    });
  });

  it('创建时应拒绝与编号层级不一致的父节点', async () => {
    const response = await POST(request('http://localhost/api/admin/knowledge-nodes', 'POST', {
      id: '3.1.9', name: '新增寻址练习', level: 3, chapter: 3, parentId: null,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: '父节点必须是 3.1' });
    expect(mockPrisma.knowledgeNode.create).not.toHaveBeenCalled();
  });

  it('创建时应拒绝不存在的父节点或前置节点', async () => {
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([{ id: '3.1' }]);
    const response = await POST(request('http://localhost/api/admin/knowledge-nodes', 'POST', {
      id: '3.1.9',
      name: '新增寻址练习',
      level: 3,
      chapter: 3,
      parentId: '3.1',
      prerequisites: ['3.1.1'],
      appliedIn: ['exp02'],
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: '引用的节点不存在：3.1.1' });
  });

  it('相同节点创建请求应返回重复回执而不再次写入', async () => {
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([{ id: '3.1' }, { id: '3.1.1' }]);
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(node());

    const response = await POST(request('http://localhost/api/admin/knowledge-nodes', 'POST', {
      id: '3.1.9',
      name: '新增寻址练习',
      level: 3,
      chapter: 3,
      parentId: '3.1',
      prerequisites: ['3.1.1'],
      appliedIn: ['exp02'],
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicate: true });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('创建节点与操作记录应在同一事务内完成', async () => {
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([{ id: '3.1' }, { id: '3.1.1' }]);
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.knowledgeNode.create as jest.Mock).mockResolvedValueOnce(node());
    (mockPrisma.userActivity.create as jest.Mock).mockResolvedValueOnce({});

    const response = await POST(request('http://localhost/api/admin/knowledge-nodes', 'POST', {
      id: '3.1.9',
      name: '新增寻址练习',
      level: 3,
      chapter: 3,
      parentId: '3.1',
      prerequisites: ['3.1.1'],
      appliedIn: ['exp02'],
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, duplicate: false });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'KNOWLEDGE_NODE_CREATE' }),
    }));
    expect(mockInvalidateKnowledgeCache).toHaveBeenCalledTimes(1);
  });

  it('更新未提交 parentId 时必须保留原父节点', async () => {
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(node());
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([{ id: '3.1' }, { id: '3.1.1' }]);
    (mockPrisma.knowledgeNode.update as jest.Mock).mockResolvedValueOnce(node({ name: '更新后的寻址练习' }));
    (mockPrisma.userActivity.create as jest.Mock).mockResolvedValueOnce({});

    const response = await PATCH(
      request('http://localhost/api/admin/knowledge-nodes/3.1.9', 'PATCH', { name: '更新后的寻址练习' }),
      { params: Promise.resolve({ id: '3.1.9' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicate: false });
    expect(mockPrisma.knowledgeNode.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '3.1.9' },
      data: { name: '更新后的寻址练习' },
    }));
  });

  it('重复更新相同内容应直接返回确认回执', async () => {
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(node());
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([{ id: '3.1' }, { id: '3.1.1' }]);

    const response = await PATCH(
      request('http://localhost/api/admin/knowledge-nodes/3.1.9', 'PATCH', { name: '新增寻址练习' }),
      { params: Promise.resolve({ id: '3.1.9' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicate: true });
    expect(mockPrisma.knowledgeNode.update).not.toHaveBeenCalled();
  });

  it('重复删除不存在节点应返回重复回执', async () => {
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const response = await DELETE(
      request('http://localhost/api/admin/knowledge-nodes/3.1.9', 'DELETE'),
      { params: Promise.resolve({ id: '3.1.9' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicate: true, deleted: '3.1.9' });
    expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
  });

  it('存在下级节点时应拒绝删除', async () => {
    (mockPrisma.knowledgeNode.findUnique as jest.Mock).mockResolvedValueOnce(node());
    (mockPrisma.knowledgeNode.count as jest.Mock).mockResolvedValueOnce(2);

    const response = await DELETE(
      request('http://localhost/api/admin/knowledge-nodes/3.1.9', 'DELETE'),
      { params: Promise.resolve({ id: '3.1.9' }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('2 个下级节点') });
    expect(mockPrisma.knowledgeNode.delete).not.toHaveBeenCalled();
  });
});

describe('静态知识库同步接口', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it('教师不能执行覆盖式静态同步', async () => {
    mockVerifyToken.mockResolvedValue(teacherPayload);
    const response = await SeedPOST(request('http://localhost/api/admin/seed-knowledge', 'POST', {
      requestId: 'seed_teacher_001',
    }));

    expect(response.status).toBe(403);
    expect(mockPrisma.knowledgeNode.upsert).not.toHaveBeenCalled();
  });

  it('相同 requestId 应返回既有回执而不再次覆盖节点', async () => {
    mockVerifyToken.mockResolvedValue({ ...teacherPayload, userId: 'admin-1', role: 'ADMIN' });
    (mockPrisma.userActivity.findFirst as jest.Mock).mockResolvedValueOnce({
      details: JSON.stringify({ requestId: 'seed_retry_001', inserted: 2, updated: 271, total: 273 }),
    });
    const response = await SeedPOST(request('http://localhost/api/admin/seed-knowledge', 'POST', {
      requestId: 'seed_retry_001',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, duplicate: true, inserted: 2, updated: 271 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('全部节点与操作回执必须在同一事务中提交', async () => {
    mockVerifyToken.mockResolvedValue({ ...teacherPayload, userId: 'admin-1', role: 'ADMIN' });
    (mockPrisma.userActivity.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (mockPrisma.knowledgeNode.findMany as jest.Mock).mockResolvedValueOnce([]);
    const response = await SeedPOST(request('http://localhost/api/admin/seed-knowledge', 'POST', {
      requestId: 'seed_atomic_001',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      duplicate: false,
      inserted: knowledgePoints.length,
      updated: 0,
      total: knowledgePoints.length,
    });
    expect(mockPrisma.knowledgeNode.upsert).toHaveBeenCalledTimes(knowledgePoints.length);
    expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'SEED_KNOWLEDGE' }),
    }));
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockInvalidateKnowledgeCache).toHaveBeenCalledTimes(1);
  });
});

describe('管理员积分校准接口', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ ...teacherPayload, userId: 'admin-1', role: 'ADMIN' });
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') return (operation as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      return Promise.all(operation as Promise<unknown>[]);
    });
  });

  it('空请求不能静默触发批量校准', async () => {
    const response = await ReconcilePOST(request('http://localhost/api/admin/reconcile', 'POST', {}));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('confirm=RECONCILE_BATCH') });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('单用户校准应在可串行化事务内修正并记录操作者', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ totalPoints: 100, status: 'ACTIVE' });
    (mockPrisma.userPointsTransaction.aggregate as jest.Mock).mockResolvedValueOnce({ _sum: { points: 80 } });
    (mockPrisma.userAchievement.count as jest.Mock).mockResolvedValueOnce(2);
    const response = await ReconcilePOST(request('http://localhost/api/admin/reconcile', 'POST', { userId: 'student-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      scope: 'user',
      result: { found: true, pointsFixed: true, pointsDiff: -20 },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: 'student-1' }, data: { totalPoints: 80 } });
    expect(mockPrisma.achievementAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ performedBy: 'admin-1' }),
    }));
  });

  it('批量校准必须分页返回剩余状态，不能把上限冒充全部完成', async () => {
    (mockPrisma.user.findMany as jest.Mock).mockResolvedValueOnce([{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }]);
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ totalPoints: 0, status: 'ACTIVE' })
      .mockResolvedValueOnce({ totalPoints: 0, status: 'ACTIVE' });
    (mockPrisma.userPointsTransaction.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { points: 0 } })
      .mockResolvedValueOnce({ _sum: { points: 0 } });
    (mockPrisma.userAchievement.count as jest.Mock).mockResolvedValue(0);
    const response = await ReconcilePOST(request('http://localhost/api/admin/reconcile', 'POST', {
      confirm: 'RECONCILE_BATCH', limit: 2,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      scope: 'batch',
      summary: { total: 2, fixed: 0, hasMore: true, nextCursor: 'user-2' },
    });
  });
});
