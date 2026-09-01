import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminUsersPage from '@/app/admin/users/page';
import AdminKnowledgeGraphPage from '@/app/admin/knowledge-graph/page';
import AdminPage from '@/app/admin/page';
import SettingsPage from '@/app/settings/page';
import { useToast } from '@/hooks/use-toast';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockFetch = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
jest.mock('@/hooks/use-toast', () => ({ useToast: jest.fn() }));

const mockToast = jest.fn();
const users = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'admin',
    name: '管理员',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'student-1',
    email: 'student@example.com',
    username: 'student1',
    name: '目标学生',
    role: 'STUDENT',
    status: 'ACTIVE',
    studentId: 'S001',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function listResponse(data = users): Response {
  return response({ data, pagination: { totalPages: 1 } });
}

describe('管理员用户页面稳健状态', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('accessToken', 'admin-token');
    global.fetch = mockFetch;
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', username: 'admin', name: '管理员', role: 'ADMIN' },
      loading: false,
    });
  });

  it('读取并展示用户，当前登录管理员的删除入口被禁用', async () => {
    mockFetch.mockResolvedValueOnce(listResponse());
    render(<AdminUsersPage />);

    expect(await screen.findByText('目标学生')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveClass('block', 'md:table');
    expect(screen.getByRole('button', { name: '新建用户' })).toHaveClass('w-full', 'sm:w-auto');
    expect(screen.getByRole('button', { name: '删除 管理员' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '删除 目标学生' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '删除 目标学生' })).toHaveClass('flex-1', 'md:flex-none');
  });

  it('筛选变化时取消旧请求，只接收最新结果', async () => {
    let firstSignal: AbortSignal | undefined;
    mockFetch
      .mockImplementationOnce((_url: RequestInfo | URL, init?: RequestInit) => {
        firstSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      })
      .mockResolvedValueOnce(listResponse([users[1]]));

    render(<AdminUsersPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('搜索用户名、邮箱、姓名...'), { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));

    expect(await screen.findByText('目标学生')).toBeInTheDocument();
    expect(firstSignal?.aborted).toBe(true);
    expect(String(mockFetch.mock.calls[1][0])).toContain('search=student%40example.com');
  });

  it('创建响应丢失时使用完全相同请求重放并接收重复回执', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse())
      .mockRejectedValueOnce(new TypeError('network lost'))
      .mockResolvedValueOnce(response({ success: true, duplicate: true, user: { id: 'new-1' } }))
      .mockResolvedValueOnce(listResponse());

    render(<AdminUsersPage />);
    await screen.findByText('目标学生');
    fireEvent.click(screen.getByRole('button', { name: /新建用户/ }));
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '新用户' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '创建结果已确认' })));
    const postCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'POST');
    expect(postCalls).toHaveLength(2);
    expect(postCalls[0][1]?.body).toBe(postCalls[1][1]?.body);
    const posted = JSON.parse(String(postCalls[0][1]?.body));
    expect(posted.requestId).toEqual(expect.any(String));
  });

  it('创建结果无法确认时只保存核对元数据，不保存初始密码', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse())
      .mockRejectedValueOnce(new TypeError('network lost'))
      .mockRejectedValueOnce(new TypeError('network still lost'))
      .mockResolvedValueOnce(listResponse([]));

    render(<AdminUsersPage />);
    await screen.findByText('目标学生');
    fireEvent.click(screen.getByRole('button', { name: /新建用户/ }));
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'pending@example.com' } });
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'pendinguser' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-password' } });
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '待确认用户' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByText('存在一笔待核对的账号创建请求')).toBeInTheDocument();
    const saved = window.sessionStorage.getItem('admin-users:pending-create:v1');
    expect(saved).toContain('pending@example.com');
    expect(saved).not.toContain('secret-password');
  });

  it('删除响应丢失时安全重放，并显示重复删除回执', async () => {
    mockFetch
      .mockResolvedValueOnce(listResponse())
      .mockRejectedValueOnce(new TypeError('network lost'))
      .mockResolvedValueOnce(response({ success: true, duplicate: true }))
      .mockResolvedValueOnce(listResponse([users[0]]));

    render(<AdminUsersPage />);
    await screen.findByText('目标学生');
    fireEvent.click(screen.getByRole('button', { name: '删除 目标学生' }));
    expect(screen.getByText(/将删除 目标学生/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认软删除' }));
    });

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '删除状态已确认' })));
    const deleteCalls = mockFetch.mock.calls.filter((call) => call[1]?.method === 'DELETE');
    expect(deleteCalls).toHaveLength(2);
    expect(deleteCalls[0][0]).toBe(deleteCalls[1][0]);
  });
});

const rawKnowledgeNodes = [
  {
    id: '3.1',
    name: '寻址方式',
    level: 2,
    chapter: 3,
    parentId: '3',
    prerequisites: [],
    appliedIn: ['exp02'],
    resources: [],
  },
  {
    id: '3.1.1',
    name: '立即寻址',
    level: 3,
    chapter: 3,
    parentId: '3.1',
    prerequisites: [],
    appliedIn: ['exp02'],
    resources: [],
  },
];

describe('知识图谱维护页面稳健状态', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('accessToken', 'admin-token');
    global.fetch = mockFetch;
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', username: 'admin', name: '管理员', role: 'ADMIN' },
      loading: false,
    });
  });

  it('必须读取原始节点格式，并在编辑时保留父节点', async () => {
    mockFetch.mockResolvedValueOnce(response({ success: true, data: rawKnowledgeNodes, source: 'db' }));
    render(<AdminKnowledgeGraphPage />);

    await screen.findByRole('button', { name: '立即寻址' });
    expect(screen.getByText('数据库权威源')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveClass('block', 'md:table');
    expect(String(mockFetch.mock.calls[0][0])).toBe('/api/knowledge-graph?type=raw');
    fireEvent.click(screen.getByRole('button', { name: '立即寻址' }));

    expect(screen.getByLabelText('父节点 id（留空=顶层）')).toHaveValue('3.1');
  });

  it('父节点与编号层级不一致时应在提交前阻止保存', async () => {
    mockFetch.mockResolvedValueOnce(response({ success: true, data: rawKnowledgeNodes, source: 'db' }));
    render(<AdminKnowledgeGraphPage />);
    fireEvent.click(await screen.findByRole('button', { name: '立即寻址' }));
    fireEvent.change(screen.getByLabelText('父节点 id（留空=顶层）'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(await screen.findByText('父节点必须是 3.1')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('教师可编辑节点但不能执行覆盖式静态同步', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'teacher-1', email: 'teacher@example.com', username: 'teacher', name: '教师', role: 'TEACHER' },
      loading: false,
    });
    mockFetch.mockResolvedValueOnce(response({ success: true, data: rawKnowledgeNodes, source: 'static' }));
    render(<AdminKnowledgeGraphPage />);

    expect(await screen.findByText('请联系系统管理员完成首次导入。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /同步静态课程定义/ })).not.toBeInTheDocument();
  });

  it('管理员执行静态同步前必须看到覆盖范围确认', async () => {
    mockFetch.mockResolvedValueOnce(response({ success: true, data: rawKnowledgeNodes, source: 'db' }));
    render(<AdminKnowledgeGraphPage />);
    await screen.findByRole('button', { name: '立即寻址' });
    fireEvent.click(screen.getByRole('button', { name: /同步静态课程定义/ }));

    expect(screen.getByText('同步静态课程定义到数据库')).toBeInTheDocument();
    expect(screen.getByText(/同编号节点的名称、层级、父节点、资源、前置关系和实验关联会被覆盖/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认覆盖并同步' })).toBeInTheDocument();
  });
});

describe('管理员概览与账户设置稳健状态', () => {
  const mockLogout = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/settings');
    mockFetch.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('accessToken', 'admin-token');
    global.fetch = mockFetch;
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', username: 'admin', name: '管理员', role: 'ADMIN' },
      loading: false,
      logout: mockLogout,
    });
  });

  it('管理员首页必须读取实时数量，不再展示硬编码节点和实验数', async () => {
    mockFetch
      .mockResolvedValueOnce(response({ data: [{ id: 'admin-1' }], pagination: { total: 36 } }))
      .mockResolvedValueOnce(response({ data: [{ id: 'admin-1' }], pagination: { total: 31 } }))
      .mockResolvedValueOnce(response({
        success: true,
        data: { totalNodes: 281, experimentCount: 9 },
        source: 'db',
      }));

    render(<AdminPage />);

    expect(await screen.findByText('共 36 名用户，31 名可用')).toBeInTheDocument();
    expect(screen.getByText('即时运行状态')).toBeInTheDocument();
    expect(screen.getByText('仅用于管理复核，不作为教学成效样本。')).toBeInTheDocument();
    expect(screen.getByText('9 个已关联实验项目')).toBeInTheDocument();
    expect(screen.getByText('281 个节点 · 数据库来源')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/knowledge-graph?type=stats', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('设置页不再提供无效通知开关或伪删除动作', () => {
    render(<SettingsPage />);

    expect(screen.getByText('当前未接入外部邮件发送服务，避免显示无效开关。')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /需管理员核对/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /删除我的账户/ })).not.toBeInTheDocument();
  });

  it('设置页等待认证水合，不先暴露账户操作', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, logout: mockLogout });

    render(<SettingsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在核验账号状态…');
    expect(screen.queryByRole('button', { name: /导出数据/ })).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('设置页登录恢复保留完整查询和页内锚点', async () => {
    window.history.replaceState({}, '', '/settings?panel=security#password');
    mockUseAuth.mockReturnValue({ user: null, loading: false, logout: mockLogout });

    render(<SettingsPage />);

    expect(await screen.findByRole('link', { name: '前往登录' })).toHaveAttribute(
      'href',
      '/login?from=%2Fsettings%3Fpanel%3Dsecurity%23password',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('设置页在窄屏保持完整触控宽度，并把密码错误关联到首个问题输入框', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('button', { name: /导出数据/ })).toHaveClass('min-h-11', 'w-full');
    expect(screen.getByRole('button', { name: /需管理员核对/ })).toHaveClass('min-h-11', 'w-full');
    expect(screen.getByRole('button', { name: '修改密码' })).toHaveClass('min-h-11', 'w-full');

    fireEvent.submit(screen.getByRole('button', { name: '修改密码' }).closest('form') as HTMLFormElement);
    const oldPasswordInput = screen.getByLabelText('当前密码');
    expect(screen.getByRole('alert')).toHaveTextContent('请填写所有密码字段');
    expect(oldPasswordInput).toHaveFocus();
    expect(oldPasswordInput).toHaveAttribute('aria-invalid', 'true');
    expect(oldPasswordInput).toHaveAttribute('aria-describedby', 'password-form-error');

    fireEvent.change(oldPasswordInput, { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different-password' } });
    fireEvent.submit(screen.getByRole('button', { name: '修改密码' }).closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent('两次输入的新密码不一致');
    expect(screen.getByLabelText('确认新密码')).toHaveFocus();
    expect(screen.getByLabelText('确认新密码')).toHaveAttribute('aria-invalid', 'true');
  });

  it('密码修改成功后必须清理旧登录状态', async () => {
    mockFetch.mockResolvedValueOnce(response({ success: true, message: '密码已修改，请重新登录' }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password' } });
    fireEvent.submit(screen.getByRole('button', { name: '修改密码' }).closest('form') as HTMLFormElement);
    fireEvent.submit(screen.getByRole('button', { name: /修改密码|正在修改/ }).closest('form') as HTMLFormElement);

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ oldPassword: 'old-password', newPassword: 'new-password' }),
    }));
  });

  it('密码修改响应丢失时不自动重放，并退出到可恢复状态', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('network lost'));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password' } });
    fireEvent.submit(screen.getByRole('button', { name: '修改密码' }).closest('form') as HTMLFormElement);

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '修改结果暂时无法确认' }));
  });

  it('数据导出重复点击仍只读取一次，任一来源失败时不得生成不完整文件', async () => {
    mockFetch
      .mockResolvedValueOnce(response({ user: { id: 'admin-1' } }))
      .mockResolvedValueOnce(response({ error: 'stats unavailable' }, 503))
      .mockResolvedValueOnce(response({ progress: [] }))
      .mockResolvedValueOnce(response({ activities: [] }));
    render(<SettingsPage />);
    const exportButton = screen.getByRole('button', { name: /导出数据/ });
    fireEvent.click(exportButton);
    fireEvent.click(exportButton);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '导出失败',
      description: '数据读取失败（503）',
    })));
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('数据导出遇到401时清理旧状态并保留完整返回位置', async () => {
    window.history.replaceState({}, '', '/settings?panel=data#export');
    mockFetch
      .mockResolvedValueOnce(response({ error: '令牌无效' }, 401))
      .mockResolvedValueOnce(response({ stats: {} }))
      .mockResolvedValueOnce(response({ progress: [] }))
      .mockResolvedValueOnce(response({ activities: [] }));

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: /导出数据/ }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/login?from=%2Fsettings%3Fpanel%3Ddata%23export');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
