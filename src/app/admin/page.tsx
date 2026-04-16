'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, BarChart3, Settings } from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalExperiments: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeUsers: 0, totalExperiments: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/users?page=1&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats((prev) => ({ ...prev, totalUsers: data.pagination?.total || 0 }));
        }
      } catch {
        // ignore
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: '用户管理',
      description: `共 ${stats.totalUsers} 名注册用户`,
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-500',
    },
    {
      title: '课程内容',
      description: '13 个实验项目',
      icon: BookOpen,
      href: '/simulation',
      color: 'text-green-500',
    },
    {
      title: '数据统计',
      description: '学情分析与报表',
      icon: BarChart3,
      href: '/analytics',
      color: 'text-purple-500',
    },
    {
      title: '系统设置',
      description: '平台配置与维护',
      icon: Settings,
      href: '/settings',
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">系统管理</h1>
        <p className="text-muted-foreground">芯智育才平台管理后台</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
