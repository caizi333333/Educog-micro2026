'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { processAchievementResponse } from './use-achievement-notifications';

export function useAchievementCheck() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // 如果用户未登录，不执行检查
    if (!user) return;

    // 公开页面不检查成就
    const publicPaths = ['/login', '/register', '/welcome', '/privacy', '/terms', '/clear-auth', '/'];
    const isPublicPath = publicPaths.some(path => pathname === path || pathname?.startsWith(path));
    if (isPublicPath) return;

    // Check achievements on app load
    const checkAchievements = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const response = await fetch('/api/achievements/check', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          processAchievementResponse(data);
        }
      } catch (error) {
        console.error('Failed to check achievements:', error);
      }
    };

    // Check immediately
    checkAchievements();

    // Check periodically (every 5 minutes)
    const interval = setInterval(checkAchievements, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, pathname]);
}