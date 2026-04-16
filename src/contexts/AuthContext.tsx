'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST';
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
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // 服务端和客户端都初始化为false，避免Hydration不匹配
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 从 localStorage 获取用户信息
  const loadUserFromStorage = useCallback(() => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      
      if (accessToken && userStr) {
        const decoded: any = jwtDecode(accessToken);
        const now = Date.now() / 1000;
        
        // 检查 token 是否过期
        if (decoded.exp && decoded.exp > now) {
          const userData = JSON.parse(userStr);
          setUser(userData);
          return true;
        } else {
          // Token 过期，清理存储
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Failed to load user from storage:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
    return false;
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        throw new Error('Failed to refresh user');
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // Don't automatically logout on refresh failure
      // The user might just be offline temporarily
    }
  }, []);

  // 登录
  const login = useCallback(async (emailOrUsername: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emailOrUsername, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data = await response.json();
    
    // 保存到 localStorage
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // 立即设置用户状态
    setUser(data.user);
    
    // 返回登录数据，让调用方处理重定向
    return data;
  }, [router]);

  // 登出
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // 清理本地存储
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    
    // 如果在受保护的页面，重定向到登录页
    const publicPaths = ['/login', '/register', '/', '/api/health'];
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
        const accessToken = localStorage.getItem('accessToken');
        const userStr = localStorage.getItem('user');
        
        if (accessToken && userStr) {
          const decoded: any = jwtDecode(accessToken);
          const now = Date.now() / 1000;
          
          // 检查 token 是否过期
          if (decoded.exp && decoded.exp > now) {
            const userData = JSON.parse(userStr);
            setUser(userData);
            
            // 尝试刷新用户信息
            try {
              const response = await fetch('/api/auth/me', {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              });

              if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
              }
            } catch (error) {
              console.error('Failed to refresh user:', error);
            }
          } else {
            // Token 过期，清理存储
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
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
      if (e.key === 'accessToken' || e.key === 'user') {
        loadUserFromStorage();
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