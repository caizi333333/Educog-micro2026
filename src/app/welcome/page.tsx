'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, BookOpen, Trophy, BarChart4, Cpu, Users, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  const handleLogin = () => {
    console.log('登录按钮被点击，准备跳转到 /login');
    console.log('当前路径:', window.location.pathname);
    console.log('Router对象:', router);
    
    // 尝试多种跳转方式
    try {
      router.push('/login');
      console.log('router.push 调用成功');
    } catch (error) {
      console.error('router.push 失败:', error);
      // 备用方案：直接使用 window.location
      window.location.href = '/login';
    }
  };

  const handleRegister = () => {
    console.log('注册按钮被点击，准备跳转到 /register');
    console.log('当前路径:', window.location.pathname);
    console.log('Router对象:', router);
    
    // 尝试多种跳转方式
    try {
      router.push('/register');
      console.log('router.push 调用成功');
    } catch (error) {
      console.error('router.push 失败:', error);
      // 备用方案：直接使用 window.location
      window.location.href = '/register';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20" suppressHydrationWarning>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            芯智育才 - 8051微处理器学习平台
          </h1>
          <p className="text-xl text-muted-foreground">
            通过互动仿真、AI助教和个性化学习路径，轻松掌握8051微处理器知识
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={handleLogin}>
              立即登录 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={handleRegister}>
              注册账号
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">平台特色功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Cpu className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">实验仿真</h3>
              <p className="text-muted-foreground">
                在线仿真8051微处理器，支持汇编代码编写、调试和外设交互
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI智能助教</h3>
              <p className="text-muted-foreground">
                24小时在线答疑，根据您的学习进度提供个性化指导
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart4 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">学情分析</h3>
              <p className="text-muted-foreground">
                实时跟踪学习进度，智能分析薄弱知识点，生成个性化学习报告
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">成就系统</h3>
              <p className="text-muted-foreground">
                完成学习任务获得成就徽章，让学习过程充满动力和乐趣
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">多角色支持</h3>
              <p className="text-muted-foreground">
                支持学生、教师、管理员等多种角色，满足不同教学需求
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">进度保存</h3>
              <p className="text-muted-foreground">
                自动保存学习进度，随时随地继续学习，数据永不丢失
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-12 text-center space-y-6">
            <h2 className="text-3xl font-bold">准备开始您的学习之旅？</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              立即注册账号，解锁所有功能，开启专属于您的8051微处理器学习路径
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" variant="default" onClick={handleRegister}>
                免费注册
              </Button>
              <Button size="lg" variant="outline" onClick={handleLogin}>
                已有账号？立即登录
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 芯智育才 - 专业的8051微处理器在线学习平台</p>
            <p className="mt-2">
              <Link href="/privacy" className="hover:text-primary">隐私政策</Link>
              {' | '}
              <Link href="/terms" className="hover:text-primary">使用条款</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}