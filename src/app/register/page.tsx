'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 注册表单
  const [registerForm, setRegisterForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'STUDENT',
    studentId: ''
  });

  // 处理注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    if (!registerForm.email || !registerForm.username || !registerForm.password) {
      toast({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive'
      });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast({
        title: '错误',
        description: '两次输入的密码不一致',
        variant: 'destructive'
      });
      return;
    }

    if (registerForm.password.length < 6) {
      toast({
        title: '错误',
        description: '密码长度至少6位',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: registerForm.email,
          username: registerForm.username,
          password: registerForm.password,
          name: registerForm.name,
          role: registerForm.role,
          studentId: registerForm.studentId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '注册失败');
      }

      // 保存访问令牌
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // 显示注册成功提示
      toast({
        title: '成功',
        description: '注册成功！'
      });

      // 如果解锁了首次登录成就，显示成就提示
      if (data.firstLoginAchievement) {
        setTimeout(() => {
          toast({
            title: '🎉 恭喜！解锁新成就',
            description: `您已解锁成就："${data.firstLoginAchievement.name}" - ${data.firstLoginAchievement.description}`,
            duration: 5000
          });
        }, 1000);
      }

      // 跳转到主页面
      setTimeout(() => {
        router.push('/simulation');
      }, data.firstLoginAchievement ? 1500 : 500);
    } catch (error: any) {
      toast({
        title: '注册失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <CardTitle className="text-2xl font-bold">注册账号</CardTitle>
            <div className="w-4" /> {/* 占位符保持居中 */}
          </div>
          <CardDescription className="text-center">
            加入芯智育才 - 8051微控制器仿真教育平台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">邮箱 *</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="请输入邮箱"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-username">用户名 *</Label>
              <Input
                id="register-username"
                type="text"
                placeholder="请输入用户名"
                value={registerForm.username}
                onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">密码 *</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="请输入密码（至少6位）"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-confirm-password">确认密码 *</Label>
              <Input
                id="register-confirm-password"
                type="password"
                placeholder="请再次输入密码"
                value={registerForm.confirmPassword}
                onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-name">姓名</Label>
              <Input
                id="register-name"
                type="text"
                placeholder="请输入真实姓名"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-studentId">学号</Label>
              <Input
                id="register-studentId"
                type="text"
                placeholder="请输入学号"
                value={registerForm.studentId}
                onChange={(e) => setRegisterForm({ ...registerForm, studentId: e.target.value })}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              注册
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              已有账号？{' '}
              <Link href="/login" className="text-primary hover:underline">
                立即登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}