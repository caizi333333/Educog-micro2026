import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/contexts/AuthContext';

let mockPathname = '/knowledge-graph';
const mockReplace = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('next/link', () => {
  const ReactRuntime = require('react');
  return ReactRuntime.forwardRef(function MockLink(
    {
      children,
      href,
      onClick,
      prefetch: _prefetch,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean },
    ref: React.ForwardedRef<HTMLAnchorElement>,
  ) {
    return (
      <a
        ref={ref}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  });
});

jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const MockIcon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return new Proxy({ __esModule: true }, {
    get: (target, property) => property in target ? target[property as keyof typeof target] : MockIcon,
  });
});

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/use-achievement-check', () => ({ useAchievementCheck: jest.fn() }));
jest.mock('@/hooks/use-achievement-notifications', () => ({
  useAchievementNotifications: jest.fn(() => ({ currentAchievement: null, clearCurrent: jest.fn() })),
}));
jest.mock('@/components/ui/achievement-notification', () => ({ AchievementNotification: () => null }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

type TestRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

function setAuthenticatedRole(role: TestRole): void {
  mockUseAuth.mockReturnValue({
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      username: role.toLowerCase(),
      name: role === 'STUDENT' ? '测试学生' : role === 'TEACHER' ? '测试教师' : '测试管理员',
      role,
    },
    loading: false,
    login: jest.fn(),
    logout: mockLogout,
    refreshUser: jest.fn(),
    isAuthenticated: true,
  });
}

function setMobileViewport(): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

async function openMobileNavigation(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole('button', { name: '打开主导航菜单' });
  trigger.focus();
  await user.keyboard('{Enter}');
  const dialog = await screen.findByRole('dialog', { name: '主导航菜单' });
  return { dialog, trigger };
}

describe('AppLayout mobile navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMobileViewport();
    setAuthenticatedRole('STUDENT');
    mockPathname = '/knowledge-graph';
    document.cookie = 'sidebar_state=; path=/; max-age=0';
    document.body.style.overflow = 'clip';
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('provides a keyboard skip link to the main teaching content', () => {
    render(<AppLayout><div>课程主体</div></AppLayout>);

    expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('opens as a labelled modal, moves focus inside, traps background focus, and restores state on Escape', async () => {
    const user = userEvent.setup();
    render(
      <AppLayout>
        <button type="button" data-testid="background-action">背景操作</button>
      </AppLayout>,
    );

    const { dialog, trigger } = await openMobileNavigation(user);
    const closeButton = within(dialog).getByRole('button', { name: '关闭主导航菜单' });
    const navigation = within(dialog).getByRole('navigation', { name: '主导航' });

    expect(trigger).toHaveAttribute('aria-controls', 'app-primary-navigation');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(navigation).toHaveAttribute('id', 'app-primary-navigation');
    expect(closeButton).toHaveClass('h-11', 'w-11', 'focus-visible:ring-2');
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.body).toHaveAttribute('data-scroll-locked');

    screen.getByTestId('background-action').focus();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '主导航菜单' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
    expect(document.body.style.overflow).toBe('clip');
  });

  it('marks one current route, closes after link selection, and also closes on an external route change', async () => {
    const user = userEvent.setup();
    const view = render(<AppLayout><div>页面内容</div></AppLayout>);

    let opened = await openMobileNavigation(user);
    let navigation = within(opened.dialog).getByRole('navigation', { name: '主导航' });
    const activeLink = within(navigation).getByRole('link', { name: '知识图谱' });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    await user.click(within(navigation).getByRole('link', { name: '实验仿真' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '主导航菜单' })).not.toBeInTheDocument());
    expect(opened.trigger).toHaveFocus();

    opened = await openMobileNavigation(user);
    mockPathname = '/simulation';
    view.rerender(<AppLayout><div>页面内容</div></AppLayout>);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '主导航菜单' })).not.toBeInTheDocument());

    opened = await openMobileNavigation(user);
    navigation = within(opened.dialog).getByRole('navigation', { name: '主导航' });
    expect(within(navigation).getByRole('link', { name: '实验仿真' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['STUDENT', ['我的任务', '薄弱节点', '成就徽章', '毕业要求达成'], ['任务回查', '教学仪表板', '用户管理']],
    ['TEACHER', ['任务回查', '教学仪表板', '达成度看板', '持续改进'], ['我的任务', '薄弱节点', '成就徽章', '用户管理']],
    ['ADMIN', ['任务回查', '教学仪表板', '达成度看板', '用户管理', '系统管理'], ['我的任务', '薄弱节点', '成就徽章']],
  ] as const)('keeps the %s role navigation internally consistent', async (role, visibleLabels, hiddenLabels) => {
    setAuthenticatedRole(role);
    mockPathname = role === 'STUDENT' ? '/tasks' : '/teacher/pushed';
    const user = userEvent.setup();
    render(<AppLayout><div>页面内容</div></AppLayout>);

    const headerAccountTrigger = await screen.findByRole('button', {
      name: `打开账户菜单，当前角色${role === 'STUDENT' ? '学生' : role === 'TEACHER' ? '教师' : '管理员'}`,
    });
    expect(headerAccountTrigger).toHaveClass('h-11', 'w-11');

    const { dialog } = await openMobileNavigation(user);
    const navigation = within(dialog).getByRole('navigation', { name: '主导航' });
    visibleLabels.forEach((label) => expect(within(navigation).getByRole('link', { name: label })).toBeInTheDocument());
    hiddenLabels.forEach((label) => expect(within(navigation).queryByRole('link', { name: label })).not.toBeInTheDocument());
    expect(within(dialog).getByRole('button', {
      name: `打开账户菜单，当前角色${role === 'STUDENT' ? '学生' : role === 'TEACHER' ? '教师' : '管理员'}`,
    })).toHaveClass('min-h-11');
  });

  it('uses the same account actions in the header and mobile sidebar menus', async () => {
    const user = userEvent.setup();
    render(<AppLayout><div>页面内容</div></AppLayout>);

    const headerAccountTrigger = await screen.findByRole('button', { name: '打开账户菜单，当前角色学生' });
    await user.click(headerAccountTrigger);
    let menu = await screen.findByRole('menu');
    ['个人资料', '设置', '隐私政策', '退出登录'].forEach((label) => {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    const { dialog } = await openMobileNavigation(user);
    await user.click(within(dialog).getByRole('button', { name: '打开账户菜单，当前角色学生' }));
    menu = await screen.findByRole('menu');
    ['个人资料', '设置', '隐私政策', '退出登录'].forEach((label) => {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    });
  });
});
