
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  BookOpen,
  Share2,
  Bot,
  BarChart4,
  Cpu,
  User,
  Settings,
  LogOut,
  ClipboardCheck,
  Trophy,
  ShieldCheck,
  GitBranch,
  Users,
  Shield,
  ChevronRight,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { AchievementNotification } from '@/components/ui/achievement-notification';
import { useAchievementNotifications } from '@/hooks/use-achievement-notifications';
import { useAchievementCheck } from '@/hooks/use-achievement-check';

// Navigation groups
const learningItems = [
  { href: '/hyper', label: '总览工作台', icon: Sparkles },
  { href: '/knowledge-graph', label: '知识图谱', icon: Share2 },
  { href: '/simulation', label: '实验仿真', icon: Cpu },
  { href: '/quiz', label: '在线测评', icon: ClipboardCheck },
  { href: '/learning-path', label: '个性教学', icon: GitBranch },
];

const analysisItems = [
  { href: '/analytics', label: '学情分析', icon: BarChart4 },
  { href: '/achievements', label: '成就徽章', icon: Trophy },
  { href: '/ai-assistant', label: 'AI 助教', icon: Bot },
];

const adminItems = [
  { href: '/teacher', label: '教学仪表板', icon: LayoutDashboard },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin', label: '系统管理', icon: Shield },
];

// All menu items flattened for title lookup
const getAllMenuItems = (role?: string) => {
  const items = [
    { href: '/', label: '课程内容', icon: BookOpen },
    ...learningItems,
    ...analysisItems,
  ];
  if (role === 'TEACHER' || role === 'ADMIN') {
    items.push({ href: '/teacher', label: '教学仪表板', icon: LayoutDashboard });
    items.push({ href: '/admin/users', label: '用户管理', icon: Users });
  }
  if (role === 'ADMIN') {
    items.push({ href: '/admin', label: '系统管理', icon: Shield });
  }
  return items;
};

// Static page title mapping
const staticPageTitles: Record<string, string> = {
  '/profile': '个人资料',
  '/settings': '设置',
  '/privacy': '隐私政策',
  '/learning-path': '个性教学',
  '/certificate': '学习证明',
};

const getRoleName = (role?: string) => {
  switch (role) {
    case 'ADMIN': return '管理员';
    case 'TEACHER': return '教师';
    case 'STUDENT': return '学生';
    case 'GUEST': return '访客';
    default: return '用户';
  }
};

const getRoleBadgeVariant = (role?: string): 'default' | 'secondary' | 'outline' => {
  switch (role) {
    case 'ADMIN': return 'default';
    case 'TEACHER': return 'secondary';
    default: return 'outline';
  }
};

const getInitial = (name?: string) => {
  if (!name) return 'U';
  return name.charAt(0).toUpperCase();
};

function NavItem({ item, pathname }: { item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }; pathname: string | null }) {
  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={!!isActive}
        tooltip={item.label}
        className={
          isActive
            ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]'
            : 'text-muted-foreground hover:bg-muted/55 hover:text-foreground hover:translate-x-0.5 transition-all duration-150'
        }
      >
        {/* 关闭 prefetch 避免 dev 环境频繁出现 _rsc 预取被中断（ERR_ABORTED） */}
        <Link href={item.href} prefetch={false}>
          <Icon className={isActive ? 'text-primary' : ''} />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const menuItems = getAllMenuItems(user?.role);
  let currentPageTitle = '';
  const currentPage = menuItems.find((item) => item.href === pathname);

  if (currentPage) {
    currentPageTitle = currentPage.label;
  } else {
    for (const path in staticPageTitles) {
      if (pathname?.startsWith(path)) {
        currentPageTitle = staticPageTitles[path];
        break;
      }
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-white/[0.07] bg-background/[0.72] px-4 sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>芯智育才</span>
        {currentPageTitle && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{currentPageTitle}</span>
          </>
        )}
      </div>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitial(user?.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>个人资料</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>设置</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>退出登录</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { currentAchievement, clearCurrent } = useAchievementNotifications();

  useAchievementCheck();

  // Public pages don't show sidebar. The course home is public for visitors,
  // but keeps the full app chrome once a user is signed in.
  const publicPaths = ['/login', '/register', '/welcome', '/privacy', '/terms', '/clear-auth'];
  const publicCoursePaths = ['/'];
  const isPublicPath = publicPaths.includes(pathname || '');
  const isPublicCoursePath = publicCoursePaths.includes(pathname || '');
  const renderPublicShell = isPublicPath || (isPublicCoursePath && !user);

  React.useEffect(() => {
    if (!loading && !user && !isPublicPath && !isPublicCoursePath) {
      const from = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${from}`);
    }
  }, [isPublicCoursePath, isPublicPath, loading, pathname, router, user]);

  if (renderPublicShell) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070a0d] text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="mt-4 text-sm">正在进入登录页...</p>
        </div>
      </div>
    );
  }

  const showAdmin = user.role === 'TEACHER' || user.role === 'ADMIN';

  return (
    <SidebarProvider>
      <Sidebar className="sidebar-gradient border-r border-white/[0.07]">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md">
              <Cpu className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <span className="block text-lg font-bold tracking-tight text-foreground">
                芯智育才
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                8051 Lab
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Home */}
          <SidebarGroup>
            <SidebarMenu>
              <NavItem item={{ href: '/', label: '课程内容', icon: BookOpen }} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroup>

          <Separator className="mx-3 w-auto" />

          {/* Learning group */}
          <SidebarGroup>
            <SidebarGroupLabel>学习</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {learningItems.map((item) => (
                  <NavItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="mx-3 w-auto" />

          {/* Analysis group */}
          <SidebarGroup>
            <SidebarGroupLabel>分析</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {analysisItems.map((item) => (
                  <NavItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin group - only for TEACHER/ADMIN */}
          {showAdmin && (
            <>
              <Separator className="mx-3 w-auto" />
              <SidebarGroup>
                <SidebarGroupLabel>管理</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems
                      .filter((item) => {
                        // System admin only for ADMIN role
                        if (item.href === '/admin') return user.role === 'ADMIN';
                        // Teacher dashboard & user management for TEACHER/ADMIN
                        return true;
                      })
                      .map((item) => (
                        <NavItem key={item.href} item={item} pathname={pathname} />
                      ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-white/[0.06] p-2">
          {loading ? (
            <div className="flex items-center gap-2 p-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2.5 p-2 h-auto hover:bg-muted/60">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold ring-1 ring-primary/20">
                      {getInitial(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start gap-0.5 group-data-[collapsible=icon]:hidden min-w-0">
                    <span className="font-semibold text-sm truncate max-w-full">{user.name}</span>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] px-1.5 py-0 h-4">
                      {getRoleName(user.role)}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-52">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>个人资料</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>设置</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/privacy">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>隐私政策</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="edu-shell">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>

      {/* Achievement Notifications */}
      <AchievementNotification
        achievement={currentAchievement}
        onClose={clearCurrent}
      />
    </SidebarProvider>
  );
}
