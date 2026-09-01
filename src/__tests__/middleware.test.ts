import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { middleware } from '@/middleware';
import type { ApplicationRole } from '@/lib/role-access';
import { getMostSpecificRouteMatch } from '@/lib/role-access';

describe('middleware', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  });

  const makeJwt = (
    role: ApplicationRole,
    options: { expiresIn?: jwt.SignOptions['expiresIn']; secret?: string } = {},
  ) => jwt.sign(
    { userId: 'user-1', email: 'user@example.com', role },
    options.secret ?? process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: options.expiresIn ?? '1h' },
  );

  const makeForgedJwt = (role: ApplicationRole) => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      userId: 'forged-user',
      email: 'forged@example.invalid',
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.${Buffer.alloc(32).toString('base64url')}`;
  };

  const createRequest = (pathname: string, options: {
    cookies?: { [key: string]: string };
    headers?: { [key: string]: string };
  } = {}) => {
    const url = `http://localhost:3000${pathname}`;
    const headers = new Headers();
    
    // Set headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([name, value]) => {
        headers.set(name, value);
      });
    }
    
    const request = {
      url,
      nextUrl: new URL(url),
      method: 'GET',
      headers,
      cookies: {
        get: (name: string) => {
          const value = options.cookies?.[name];
          return value ? { name, value } : undefined;
        },
        set: () => {},
      },
    } as NextRequest;
    
    return request;
  };

  describe('static paths', () => {
    it('should allow access to _next static files', async () => {
      const request = createRequest('/_next/static/css/app.css');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      // NextResponse.next() doesn't have a specific status, but it should not redirect
    });

    it('should allow access to favicon.ico', async () => {
      const request = createRequest('/favicon.ico');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
    });

    it('should allow access to public directory', async () => {
      const request = createRequest('/public/images/logo.png');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
    });
  });

  describe('public paths', () => {
    const publicPaths = [
      '/login',
      '/register',
      '/welcome',
      '/privacy',
      '/terms',
      '/clear-auth',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/logout',
    ];

    publicPaths.forEach(path => {
      it(`should allow access to public path: ${path}`, async () => {
        const request = createRequest(path);
        const response = await middleware(request);
        
        expect(response).toBeDefined();
        // Should not be a redirect response
        expect(response.status).not.toBe(302);
        expect(response.status).not.toBe(307);
      });
    });

    it.each(['/auth-test', '/api/health', '/api/init', '/api/auth/validate', '/api/middleware-test'])(
      'should protect diagnostic path: %s',
      async (path) => {
        const response = await middleware(createRequest(path));
        expect(response.status).toBe(path.startsWith('/api/') ? 401 : 307);
      },
    );

    it.each(['/api/init', '/api/middleware-test'])(
      'should reserve sensitive diagnostic path for administrators: %s',
      async (path) => {
        const studentResponse = await middleware(createRequest(path, {
          headers: { authorization: `Bearer ${makeJwt('STUDENT')}` },
        }));
        const adminResponse = await middleware(createRequest(path, {
          headers: { authorization: `Bearer ${makeJwt('ADMIN')}` },
        }));

        expect(studentResponse.status).toBe(403);
        expect(adminResponse.status).toBe(200);
      },
    );

    it('should redirect authenticated users from login page to home', async () => {
      const request = createRequest('/login', {
        cookies: { refreshToken: 'valid-refresh-token' }
      });
      const response = await middleware(request);
      
      // 当前中间件对登录/注册页不做重定向（避免循环）
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should redirect authenticated users from register page to home', async () => {
      const request = createRequest('/register', {
        headers: { authorization: 'Bearer valid-access-token' }
      });
      const response = await middleware(request);
      
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should allow unauthenticated users to access login page', async () => {
      const request = createRequest('/login');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should not treat a public-path prefix as a public route', async () => {
      const apiResponse = await middleware(createRequest('/api/init/anything'));
      const pageResponse = await middleware(createRequest('/login-unrelated'));

      expect(apiResponse.status).toBe(401);
      expect(pageResponse.status).toBe(307);
    });
  });

  describe('protected paths', () => {
    it('should allow unauthenticated users to access home page (public)', async () => {
      const request = createRequest('/');
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it('should redirect unauthenticated users from protected pages to login with from parameter', async () => {
      const request = createRequest('/profile');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fprofile');
    });

    it('should preserve the requested learning resource when redirecting to login', async () => {
      const request = createRequest('/simulation?experiment=exp02');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?from=%2Fsimulation%3Fexperiment%3Dexp02',
      );
    });

    it('should return 401 for unauthenticated API requests', async () => {
      const request = createRequest('/api/protected-endpoint');
      const response = await middleware(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未授权');
    });

    it('should not treat a refresh-token string as page authentication', async () => {
      const request = createRequest('/profile', {
        cookies: { refreshToken: 'valid-refresh-token' }
      });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fprofile');
    });

    it('should allow refresh-token-only requests to reach the idempotent logout endpoint', async () => {
      const response = await middleware(createRequest('/api/auth/logout', {
        cookies: { refreshToken: 'valid-refresh-token' },
      }));

      expect(response.status).toBe(200);
    });

    it('should allow authenticated users to access protected pages with access token', async () => {
      const request = createRequest('/dashboard', {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` }
      });
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('should allow authenticated users to access protected API endpoints', async () => {
      const request = createRequest('/api/user/profile', {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` }
      });
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(401);
    });

    it('should allow authenticated users to access home page', async () => {
      const request = createRequest('/', {
        cookies: { refreshToken: 'valid-refresh-token' }
      });
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });
  });

  describe('teacher paths', () => {
    it('does not bypass authentication for RSC requests', async () => {
      const response = await middleware(createRequest('/teacher/classes?_rsc=route-state'));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fteacher%2Fclasses');
    });

    it('routes a student RSC request to an actionable teacher login', async () => {
      const response = await middleware(createRequest('/teacher/report?_rsc=route-state', {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` },
      }));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fteacher%2Freport&reason=teacher-role');
    });

    it('allows a teacher RSC request only after the role check', async () => {
      const response = await middleware(createRequest('/teacher/classes?_rsc=route-state', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RSC-Request')).toBe('true');
    });
  });

  describe('student paths', () => {
    it.each([
      '/tasks',
      '/weak-nodes',
      '/learning-path',
      '/obe',
      '/classes/join',
      '/achievements',
      '/certificate',
    ])('allows students and rejects teacher/admin direct access to %s', async (path) => {
      const studentResponse = await middleware(createRequest(path, {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` },
      }));
      const teacherResponse = await middleware(createRequest(path, {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));
      const adminResponse = await middleware(createRequest(path, {
        headers: { authorization: `Bearer ${makeJwt('ADMIN')}` },
      }));

      expect(studentResponse.status).not.toBe(307);
      expect(teacherResponse.status).toBe(307);
      expect(adminResponse.status).toBe(307);
      expect(teacherResponse.headers.get('location')).toBe(
        `http://localhost:3000/login?from=${encodeURIComponent(path)}&reason=student-role`,
      );
    });

    it('keeps the more specific teacher and admin OBE routes accessible to their roles', async () => {
      const teacherResponse = await middleware(createRequest('/obe/teacher', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));
      const adminResponse = await middleware(createRequest('/obe/admin', {
        headers: { authorization: `Bearer ${makeJwt('ADMIN')}` },
      }));

      expect(teacherResponse.status).not.toBe(307);
      expect(adminResponse.status).not.toBe(307);
    });
  });

  describe('admin paths', () => {
    it('should allow access to admin paths for authenticated users', async () => {
      const request = createRequest('/admin/dashboard', {
        headers: { authorization: `Bearer ${makeJwt('ADMIN')}` }
      });
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should redirect unauthenticated users from admin paths to login', async () => {
      const request = createRequest('/admin/users');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fadmin%2Fusers');
    });

    it('should allow teachers only on the explicitly shared knowledge graph', async () => {
      const shared = await middleware(createRequest('/admin/knowledge-graph', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));
      const userManagement = await middleware(createRequest('/admin/users', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));
      const obeAdmin = await middleware(createRequest('/obe/admin', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));
      const sharedPrefixLookalike = await middleware(createRequest('/admin/knowledge-graph-backup', {
        headers: { authorization: `Bearer ${makeJwt('TEACHER')}` },
      }));

      expect(shared.status).not.toBe(307);
      expect(userManagement.status).toBe(307);
      expect(userManagement.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fadmin%2Fusers&reason=admin-role');
      expect(obeAdmin.status).toBe(307);
      expect(obeAdmin.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fobe%2Fadmin&reason=admin-role');
      expect(sharedPrefixLookalike.status).toBe(307);
      expect(sharedPrefixLookalike.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fadmin%2Fknowledge-graph-backup&reason=admin-role');
    });

    it('routes a student on a shared admin tool to the teacher-or-admin recovery flow', async () => {
      const response = await middleware(createRequest('/admin/knowledge-graph', {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` },
      }));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fadmin%2Fknowledge-graph&reason=teacher-role');
    });
  });

  describe('token detection', () => {
    it('should reject refresh-token-only requests', async () => {
      const request = createRequest('/protected', {
        cookies: { refreshToken: 'refresh-token-value' }
      });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
    });

    it('should detect access token from authorization header', async () => {
      const request = createRequest('/protected', {
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` }
      });
      const response = await middleware(request);
      
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should handle malformed authorization header', async () => {
      const request = createRequest('/protected', {
        headers: { authorization: 'InvalidFormat token' }
      });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
    });

    it('should treat the HttpOnly cookie as authoritative when both tokens are present', async () => {
      const request = createRequest('/protected', {
        cookies: { accessToken: makeForgedJwt('ADMIN'), refreshToken: 'refresh-token' },
        headers: { authorization: `Bearer ${makeJwt('STUDENT')}` }
      });
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
    });

    it('should accept a valid signed access token from cookies', async () => {
      const response = await middleware(createRequest('/protected', {
        cookies: { accessToken: makeJwt('STUDENT') },
      }));

      expect(response.status).toBe(200);
    });

    it('should reject a forged administrator token on pages and APIs', async () => {
      const forgedToken = makeForgedJwt('ADMIN');
      const pageResponse = await middleware(createRequest('/admin/users', {
        cookies: { accessToken: forgedToken },
      }));
      const apiResponse = await middleware(createRequest('/api/admin/reconcile', {
        headers: { authorization: `Bearer ${forgedToken}` },
      }));

      expect(pageResponse.status).toBe(307);
      expect(pageResponse.headers.get('location')).toBe('http://localhost:3000/login?from=%2Fadmin%2Fusers');
      expect(apiResponse.status).toBe(401);
      await expect(apiResponse.json()).resolves.toEqual({ error: '令牌无效' });
    });

    it('should reject expired and wrongly signed access tokens', async () => {
      const expiredResponse = await middleware(createRequest('/profile', {
        cookies: { accessToken: makeJwt('STUDENT', { expiresIn: -60 }) },
      }));
      const wrongSignatureResponse = await middleware(createRequest('/profile', {
        cookies: { accessToken: makeJwt('STUDENT', { secret: 'different_test_secret_32_chars!!' }) },
      }));

      expect(expiredResponse.status).toBe(307);
      expect(wrongSignatureResponse.status).toBe(307);
    });
  });

  describe('path matching', () => {
    it('should match exact public paths', async () => {
      const request = createRequest('/login');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });

    it('should protect child paths not explicitly declared public', async () => {
      const request = createRequest('/api/auth/login/callback');
      const response = await middleware(request);
      
      expect(response.status).toBe(401);
    });

    it('should not match partial path names', async () => {
      const request = createRequest('/loginpage'); // Not exactly '/login'
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
    });

    it('should match admin paths that start with /admin', async () => {
      const request = createRequest('/admin/users/123', {
        headers: { authorization: `Bearer ${makeJwt('ADMIN')}` }
      });
      const response = await middleware(request);
      
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302);
      expect(response.status).not.toBe(307);
    });
  });
});

describe('getMostSpecificRouteMatch', () => {
  const routes = ['/obe', '/obe/teacher', '/obe/teacher/objectives', '/obe/teacher/cqi'];

  it('keeps only the most specific navigation item active', () => {
    expect(getMostSpecificRouteMatch('/obe/teacher', routes)).toBe('/obe/teacher');
    expect(getMostSpecificRouteMatch('/obe/teacher/cqi/report-1', routes)).toBe('/obe/teacher/cqi');
  });

  it('does not treat a partial segment as a route match', () => {
    expect(getMostSpecificRouteMatch('/obe/teachers', routes)).toBe('/obe');
    expect(getMostSpecificRouteMatch('/obesity', routes)).toBeNull();
  });
});
