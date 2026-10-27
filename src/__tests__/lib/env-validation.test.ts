/** @jest-environment node */

describe.each(['@/lib/env', '@/lib/env-check'])('%s validation compatibility', (modulePath) => {
  const originalEnv = process.env;
  let validateEnv: typeof import('@/lib/env').validateEnv;
  let getJwtSecret: typeof import('@/lib/env').getJwtSecret;

  beforeEach(() => {
    // Entirely synthetic settings; do not read local deployment configuration.
    // NODE_ENV is deliberately absent to exercise the runtime default.
    process.env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test',
      JWT_SECRET: 'unit-test-secret-with-more-than-32-characters',
    };
    Reflect.deleteProperty(process.env, 'NODE_ENV');
    jest.isolateModules(() => {
      ({ validateEnv, getJwtSecret } = jest.requireActual(modulePath));
    });
  });

  afterEach(() => { process.env = originalEnv; });

  it('keeps defaults and JWT fallback when optional configuration is absent', () => {
    const env = validateEnv();
    expect(env.NODE_ENV).toBe('development');
    expect(env.NEXTAUTH_SECRET).toBe(process.env.JWT_SECRET);
    expect(env).not.toHaveProperty('JWT_REFRESH_SECRET');
    expect(env).not.toHaveProperty('ZHIPU_API_KEY');
  });

  it('retains the PostgreSQL alias fallback', () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_PRISMA_URL = 'postgresql://test:test@localhost:5432/alias_test';
    expect(validateEnv().DATABASE_URL).toBe(process.env.POSTGRES_PRISMA_URL);
  });

  it('reports field paths and custom messages instead of failing to read Zod errors', () => {
    process.env.DATABASE_URL = 'invalid-database';
    process.env.JWT_SECRET = 'short';
    expect(validateEnv).toThrow(/环境变量配置错误/);
    expect(validateEnv).toThrow(/DATABASE_URL: DATABASE_URL must be a valid PostgreSQL connection string/);
    expect(validateEnv).toThrow(/JWT_SECRET: JWT_SECRET must be at least 32 characters long/);
    expect(validateEnv).toThrow(/- DATABASE_URL/);
  });

  it('keeps unsafe default JWT keys rejected', () => {
    process.env.JWT_SECRET = 'your-secret-key-change-in-production';
    expect(getJwtSecret).toThrow('JWT_SECRET 使用了不安全的默认值');
  });
});
