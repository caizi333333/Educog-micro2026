import bcrypt from 'bcryptjs';
import { GET, POST } from '@/app/api/init/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('bcryptjs');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const originalEnv = { ...process.env };
const INIT_SECRET = 'test-init-secret-2026';

function request(method: 'GET' | 'POST' = 'GET', secret?: string) {
  return new Request('http://localhost:3000/api/init', {
    method,
    headers: secret ? { 'x-init-secret': secret } : undefined,
  });
}

describe('/api/init', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INIT_SECRET = INIT_SECRET;
    process.env.INIT_ADMIN_PASSWORD = 'admin-secure-2026';
    process.env.INIT_TEACHER_PASSWORD = 'teacher-secure-2026';
    process.env.INIT_STUDENT_PASSWORD = 'student-secure-2026';
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('未配置足够强的初始化密钥时关闭入口', async () => {
    delete process.env.INIT_SECRET;
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: '初始化入口未配置' });
  });

  it('缺少或错误密钥时拒绝访问', async () => {
    const missing = await GET(request());
    const incorrect = await GET(request('GET', 'wrong-secret'));
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
  });

  it('GET 只返回初始化状态，不创建账号', async () => {
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'admin-1' });
    (mockPrisma.user.count as jest.Mock).mockResolvedValue(5);

    const response = await GET(request('GET', INIT_SECRET));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ initialized: true, users: 5, message: '数据库已初始化' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('POST 在账号密码未配置时拒绝初始化', async () => {
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    delete process.env.INIT_TEACHER_PASSWORD;

    const response = await POST(request('POST', INIT_SECRET));

    expect(response.status).toBe(503);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('POST 原子创建三类账号且响应不返回密码', async () => {
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.user.create as jest.Mock).mockResolvedValue({});
    (mockBcrypt.hash as jest.Mock).mockImplementation(async (password: string) => `hashed_${password}`);

    const response = await POST(request('POST', INIT_SECRET));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockBcrypt.hash).toHaveBeenCalledTimes(3);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(3);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(data)).not.toContain('secure-2026');
    expect(data.users).toEqual([
      { username: 'admin', role: '管理员' },
      { username: 'teacher', role: '教师' },
      { username: 'student', role: '学生' },
    ]);
  });

  it('已经初始化时重复 POST 不创建账号', async () => {
    (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'admin-1' });

    const response = await POST(request('POST', INIT_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message: '数据库已初始化' });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('系统异常仅返回稳定错误，不暴露内部信息', async () => {
    (mockPrisma.user.findFirst as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(request('POST', INIT_SECRET));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: '初始化失败' });
    expect(data.details).toBeUndefined();
  });
});
