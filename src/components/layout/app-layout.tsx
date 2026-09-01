
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
  ClipboardList,
  Target,
  Trophy,
  ShieldCheck,
  GitBranch,
  Users,
  Shield,
  ChevronRight,
  LayoutDashboard,
  Sparkles,
  GraduationCap,
  FileText,
  ListChecks,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { getMostSpecificRouteMatch } from '@/lib/role-access';

// Navigation groups. Personal learning records are student-only; teachers get
// task review at the same visual position so the next action matches the role.
const sharedLearningItems = [
  { href: '/hyper', label: '总览工作台', icon: Sparkles },
  { href: '/knowledge-graph', label: '知识图谱', icon: Share2 },
  { href: '/simulation', label: '实验仿真', icon: Cpu },
  { href: '/quiz', label: '在线测评', icon: ClipboardCheck },
];

const studentPersonalLearningItems = [
  { href: '/weak-nodes', label: '薄弱节点', icon: Target },
  { href: '/learning-path', label: '个性化学习', icon: GitBranch },
];

const sharedAnalysisItems = [
  { href: '/analytics', label: '学情分析', icon: BarChart4 },
  { href: '/ai-assistant', label: 'AI 助教', icon: Bot },
];

const studentPersonalAnalysisItems = [
  { href: '/achievements', label: '成就徽章', icon: Trophy },
  { href: '/obe', label: '毕业要求达成', icon: GraduationCap },
];

const adminItems = [
  { href: '/teacher', label: '教学仪表板', icon: LayoutDashboard },
  { href: '/obe/teacher', label: '达成度看板', icon: GraduationCap },
  { href: '/obe/teacher/objectives', label: '课程目标配置', icon: ListChecks },
  { href: '/obe/teacher/cqi', label: '持续改进', icon: FileText },
  { href: '/obe/admin', label: 'OBE 汇总', icon: BarChart4 },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin', label: '系统管理', icon: Shield },
];

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type LayoutUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type LogoutHandler = ReturnType<typeof useAuth>['logout'];

const PRIMARY_NAVIGATION_ID = 'app-primary-navigation';

function SkipToContentLink(): React.JSX.Element {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-[100] inline-flex min-h-11 -translate-y-20 items-center rounded-md bg-cyan-200 px-4 text-sm font-semibold text-[#001014] shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-50 focus:ring-offset-2 focus:ring-offset-[#070a0d]"
    >
      跳到主要内容
    </a>
  );
}

export const getVisibleLearningItems = (role?: string): NavigationItem[] => {
  if (role === 'STUDENT') {
    return [
      sharedLearningItems[0]!,
      { href: '/tasks', label: '我的任务', icon: ClipboardList },
      ...sharedLearningItems.slice(1),
      ...studentPersonalLearningItems,
    ];
  }

  if (role === 'TEACHER' || role === 'ADMIN') {
    return [
      sharedLearningItems[0]!,
      { href: '/teacher/pushed', label: '任务回查', icon: ClipboardList },
      ...sharedLearningItems.slice(1),
    ];
  }

  return sharedLearningItems;
};

export const getVisibleAnalysisItems = (role?: string): NavigationItem[] => {
  if (role === 'STUDENT') {
    return [sharedAnalysisItems[0]!, ...studentPersonalAnalysisItems, sharedAnalysisItems[1]!];
  }
  return sharedAnalysisItems;
};

const getVisibleAdminItems = (role?: string): NavigationItem[] => {
  if (role !== 'TEACHER' && role !== 'ADMIN') return [];

  return adminItems.filter((item) => {
    const adminOnly = item.href === '/admin'
      || item.href === '/obe/admin'
      || item.href === '/admin/users';
    return !adminOnly || role === 'ADMIN';
  });
};

// All menu items flattened for title lookup
const getAllMenuItems = (role?: string): NavigationItem[] => {
  const items: NavigationItem[] = [
    { href: '/', label: '课程内容', icon: BookOpen },
    ...getVisibleLearningItems(role),
    ...getVisibleAnalysisItems(role),
  ];
  items.push(...getVisibleAdminItems(role));
  return items;
};

// Static page title mapping
const staticPageTitles: Record<string, string> = {
  '/profile': '个人资料',
  '/settings': '设置',
  '/privacy': '隐私政策',
  '/learning-path': '个性化学习',
  '/certificate': '学习证明',
  '/obe/teacher/objectives': '课程目标配置',
  '/obe/teacher/cqi': '持续改进',
  '/obe/admin': 'OBE 汇总',
};

const getRoleName = (role?: string): string => {
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

const getInitial = (name?: string): string => {
  if (!name) return 'U';
  return name.charAt(0).toUpperCase();
};

function NavItem({ item, activeHref }: { item: NavigationItem; activeHref: string | null }): React.JSX.Element {
  const isActive = activeHref === item.href;
  const Icon = item.icon;
  const linkRef = React.useRef<HTMLAnchorElement>(null);
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isActive && (!isMobile || openMobile)) {
      linkRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isActive, isMobile, openMobile]);

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
        <Link
          ref={linkRef}
          href={item.href}
          prefetch={false}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <Icon className={isActive ? 'text-primary' : ''} />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function MobileNavigationRouteSync({ pathname }: { pathname: string | null }): null {
  const { isMobile, setOpenMobile } = useSidebar();
  const previousPathnameRef = React.useRef(pathname);

  React.useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    if (isMobile) setOpenMobile(false);
  }, [isMobile, pathname, setOpenMobile]);

  return null;
}

function MobileNavigationFocusManager({
  triggerRef,
}: {
  triggerRef: React.RefObject<HTMLButtonElement>;
}): null {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!isMobile && openMobile) {
      setOpenMobile(false);
      wasOpenRef.current = false;
      return;
    }
    if (isMobile && wasOpenRef.current && !openMobile) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = Boolean(isMobile && openMobile);
  }, [isMobile, openMobile, setOpenMobile, triggerRef]);

  return null;
}

function MobileSidebarCloseButton(): React.JSX.Element | null {
  const { isMobile, setOpenMobile } = useSidebar();
  if (!isMobile) return null;

  return (
    <button
      type="button"
      aria-label="关闭主导航菜单"
      onClick={() => setOpenMobile(false)}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <X className="h-5 w-5" />
    </button>
  );
}

function AccountMenuActions({ logout }: { logout: LogoutHandler }): React.JSX.Element {
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobileNavigation = (): void => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <DropdownMenuItem asChild>
        <Link href="/profile" onClick={closeMobileNavigation}>
          <User className="mr-2 h-4 w-4" />
          <span>个人资料</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/settings" onClick={closeMobileNavigation}>
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/privacy" onClick={closeMobileNavigation}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          <span>隐私政策</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          closeMobileNavigation();
          void logout();
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        <span>退出登录</span>
      </DropdownMenuItem>
    </>
  );
}

function AccountMenuIdentity({ user }: { user: LayoutUser }): React.JSX.Element {
  return (
    <DropdownMenuLabel>
      <div className="min-w-0">
        <p className="truncate font-medium">{user.name}</p>
        <p className="break-all text-xs text-muted-foreground">{user.email}</p>
      </div>
    </DropdownMenuLabel>
  );
}

function SidebarAccountMenu({ user, logout }: { user: LayoutUser; logout: LogoutHandler }): React.JSX.Element {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`打开账户菜单，当前角色${getRoleName(user.role)}`}
          className="h-auto min-h-11 w-full justify-start gap-2.5 p-2 hover:bg-muted/60"
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary ring-1 ring-primary/20">
              {getInitial(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col items-start gap-0.5 group-data-[collapsible=icon]:hidden">
            <span className="max-w-full truncate text-sm font-semibold">{user.name}</span>
            <Badge variant={getRoleBadgeVariant(user.role)} className="h-4 px-1.5 py-0 text-[10px]">
              {getRoleName(user.role)}
            </Badge>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isMobile ? 'top' : 'right'} align={isMobile ? 'start' : 'end'} className="w-52">
        <AccountMenuIdentity user={user} />
        <DropdownMenuSeparator />
        <AccountMenuActions logout={logout} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header({
  navigationTriggerRef,
}: {
  navigationTriggerRef: React.RefObject<HTMLButtonElement>;
}): React.JSX.Element {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isMobile, openMobile, state: sidebarState } = useSidebar();

  const menuItems = getAllMenuItems(user?.role);
  let currentPageTitle = '';
  const currentMenuPath = getMostSpecificRouteMatch(pathname, menuItems.map((item) => item.href));
  const currentPage = menuItems.find((item) => item.href === currentMenuPath);

  if (currentPage) {
    currentPageTitle = currentPage.label;
  } else {
    const titlePath = getMostSpecificRouteMatch(pathname, Object.keys(staticPageTitles));
    if (titlePath) currentPageTitle = staticPageTitles[titlePath];
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-3 border-b border-white/[0.07] bg-background/[0.72] px-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all">
      <SidebarTrigger
        ref={navigationTriggerRef}
        aria-controls={PRIMARY_NAVIGATION_ID}
        aria-expanded={isMobile ? openMobile : sidebarState === 'expanded'}
        aria-haspopup={isMobile ? 'dialog' : undefined}
        aria-label={isMobile
          ? openMobile ? '关闭主导航菜单' : '打开主导航菜单'
          : sidebarState === 'expanded' ? '收起侧边栏' : '展开侧边栏'}
      />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground">
        <span className="shrink-0">芯智育才</span>
        {currentPageTitle && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate font-medium text-foreground">{currentPageTitle}</span>
          </>
        )}
      </div>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`打开账户菜单，当前角色${getRoleName(user?.role)}`}
            className="h-11 w-11 rounded-full"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar ?? undefined} alt={user?.name ?? ''} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitial(user?.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {user && <AccountMenuIdentity user={user} />}
          <DropdownMenuSeparator />
          <AccountMenuActions logout={logout} />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();

  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { currentAchievement, clearCurrent } = useAchievementNotifications();
  const navigationTriggerRef = React.useRef<HTMLButtonElement>(null);

  useAchievementCheck();

  // Public pages don't show sidebar. The course home is public for visitors,
  // but keeps the full app chrome once a user is signed in.
  const publicPaths = ['/login', '/register', '/welcome', '/privacy', '/terms', '/clear-auth'];
  const publicCoursePaths = ['/'];
  const isPublicPath = publicPaths.includes(pathname ?? '');
  const isPublicCoursePath = publicCoursePaths.includes(pathname ?? '');
  const renderPublicShell = isPublicPath || (isPublicCoursePath && !user);

  React.useEffect(() => {
    if (!loading && !user && !isPublicPath && !isPublicCoursePath) {
      const requestedLocation = pathname
        ? `${pathname}${window.location.search}${window.location.hash}`
        : '';
      const from = requestedLocation ? `?from=${encodeURIComponent(requestedLocation)}` : '';
      router.replace(`/login${from}`);
    }
  }, [isPublicCoursePath, isPublicPath, loading, pathname, router, user]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  if (renderPublicShell) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="edu-shell flex items-center justify-center min-h-screen">
        <div className="text-center animate-fade-in">
          <div className="chip-mark mx-auto flex h-14 w-14 items-center justify-center rounded-xl">
            <Cpu className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">正在加载工作台...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="edu-shell flex min-h-screen items-center justify-center text-slate-300">
        <div className="text-center animate-fade-in">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="mt-4 text-sm">正在进入登录页...</p>
        </div>
      </div>
    );
  }

  const showAdmin = user.role === 'TEACHER' || user.role === 'ADMIN';
  const visibleLearningItems = getVisibleLearningItems(user.role);
  const visibleAnalysisItems = getVisibleAnalysisItems(user.role);
  const visibleAdminItems = getVisibleAdminItems(user.role);
  const visibleNavigationItems = [
    { href: '/', label: '课程内容', icon: BookOpen },
    ...visibleLearningItems,
    ...visibleAnalysisItems,
    ...visibleAdminItems,
  ];
  const activeHref = getMostSpecificRouteMatch(
    pathname,
    visibleNavigationItems.map((item) => item.href),
  );

  return (
    <SidebarProvider>
      <SkipToContentLink />
      <MobileNavigationRouteSync pathname={pathname} />
      <MobileNavigationFocusManager triggerRef={navigationTriggerRef} />
      <Sidebar className="sidebar-gradient border-r border-white/[0.07]">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="chip-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <Cpu className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-lg font-bold tracking-tight text-foreground">
                  芯智育才
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  8051 Lab
                </span>
              </div>
            </div>
            <MobileSidebarCloseButton />
          </div>
        </SidebarHeader>

        <SidebarContent id={PRIMARY_NAVIGATION_ID} role="navigation" aria-label="主导航">
          {/* Home */}
          <SidebarGroup>
            <SidebarMenu>
              <NavItem item={{ href: '/', label: '课程内容', icon: BookOpen }} activeHref={activeHref} />
            </SidebarMenu>
          </SidebarGroup>

          <Separator className="mx-3 w-auto" />

          {/* Learning group */}
          <SidebarGroup>
            <SidebarGroupLabel>{showAdmin ? '教学资源' : '学习'}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleLearningItems.map((item) => (
                  <NavItem key={item.href} item={item} activeHref={activeHref} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <Separator className="mx-3 w-auto" />

          {/* Analysis group */}
          <SidebarGroup>
            <SidebarGroupLabel>{showAdmin ? '教学分析' : '分析'}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAnalysisItems.map((item) => (
                  <NavItem key={item.href} item={item} activeHref={activeHref} />
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
                    {visibleAdminItems.map((item) => (
                      <NavItem key={item.href} item={item} activeHref={activeHref} />
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
            <SidebarAccountMenu user={user} logout={logout} />
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="edu-shell">
        <Header navigationTriggerRef={navigationTriggerRef} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none sm:p-6">{children}</main>
      </SidebarInset>

      {/* Achievement Notifications */}
      <AchievementNotification
        achievement={currentAchievement}
        onClose={clearCurrent}
      />
    </SidebarProvider>
  );
}
