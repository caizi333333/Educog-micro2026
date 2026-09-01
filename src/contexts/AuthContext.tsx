'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  clearStoredAuth,
  getStoredAccessToken,
  getStoredAuthMode,
  getStoredUser,
  storeAuth,
} from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
} from '@/lib/client-fetch';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST';
  avatar?: string;
  studentId?: string;
  teacherId?: string;
  class?: string;
  grade?: string;
  major?: string;
  department?: string;
  title?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearAuthState() {
  clearStoredAuth();
}

function isDefinitiveAuthFailure(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // 本地只缓存非敏感用户摘要，最终身份以 /api/auth/me 为准。
  const loadUserFromStorage = useCallback(() => {
    try {
      const userStr = getStoredUser();
      if (getStoredAccessToken() && userStr) {
        setUser(JSON.parse(userStr) as User);
        return true;
      }
      setUser(null);
    } catch (error) {
      console.error('Failed to load user from storage:', error);
      clearStoredAuth();
      setUser(null);
    }
    return false;
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    try {
      const accessToken = getStoredAccessToken();

      const response = await fetchClientRequest('/api/auth/me', {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : undefined,
        cache: 'no-store',
      }, CLIENT_READ_TIMEOUT_MS);

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        const mode = getStoredAuthMode() ?? 'session';
        storeAuth('', data.user, mode);
      } else if (isDefinitiveAuthFailure(response.status)) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        clearAuthState();
        setUser(null);
      } else {
        throw new Error(`Failed to refresh user: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // Don't automatically logout on refresh failure
      // The user might just be offline temporarily
    }
  }, []);

  // 登录
  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const response = await fetchClientRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailOrUsername, password }),
    }, CLIENT_WRITE_TIMEOUT_MS);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data = await response.json();
    
    storeAuth('', data.user, 'persistent');
    
    // 立即设置用户状态
    setUser(data.user);
    
  }, []);

  // 登出
  const logout = useCallback(async () => {
    const accessToken = getStoredAccessToken();
    try {
      await fetchClientRequest('/api/auth/logout', {
        method: 'POST',
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : undefined,
      }, CLIENT_WRITE_TIMEOUT_MS);
    } catch (error) {
      console.error('Logout error:', error);
    }

    // 清理本地存储
    clearAuthState();
    setUser(null);
    
    // 如果在受保护的页面，重定向到登录页
    const publicPaths = ['/login', '/register', '/welcome', '/privacy', '/terms', '/clear-auth'];
    const isPublicPath = publicPaths.some(path => pathname === path || pathname?.startsWith(path));
    
    if (!isPublicPath) {
      router.push('/login');
    }
  }, [router, pathname]);

  // 客户端初始化时加载用户信息
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') {
      return;
    }

    const initAuth = async () => {
      setLoading(true); // 开始加载时设置loading为true
      try {
        const accessToken = getStoredAccessToken();
        const userStr = getStoredUser();
        if (userStr) {
          try {
            setUser(JSON.parse(userStr) as User);
          } catch {
            clearStoredAuth();
          }
        }

        // 即使本地标记缺失也请求一次，以便从 HttpOnly cookie 恢复有效会话。
        const response = await fetchClientRequest('/api/auth/me', {
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : undefined,
          cache: 'no-store',
        }, CLIENT_READ_TIMEOUT_MS);

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          const mode = getStoredAuthMode() ?? 'session';
          storeAuth('', data.user, mode);
        } else if (isDefinitiveAuthFailure(response.status)) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
          clearAuthState();
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
        // 网络短暂故障不应清掉本地摘要，避免用户被误登出。
      } finally {
        // 无论成功还是失败，都要设置loading为false
        setLoading(false);
      }
    };
    
    initAuth();
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 监听存储变化（用于多标签页同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken' || e.key === 'authSession' || e.key === 'user') {
        if (e.key === 'accessToken' || e.key === 'authSession') {
          loadUserFromStorage();
        } else if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            clearStoredAuth();
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadUserFromStorage]);

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
