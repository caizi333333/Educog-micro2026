'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClearAuthPage() {
  const router = useRouter();
  
  useEffect(() => {
    // 清除所有认证相关的数据
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    
    // 清除 cookies
    document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    // 重定向到欢迎页
    router.push('/welcome');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>正在清除登录状态...</p>
    </div>
  );
}