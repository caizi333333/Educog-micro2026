import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import WelcomePage from '@/app/welcome/page';
import RegisterPage from '@/app/register/page';
import JoinClassPage from '@/app/classes/join/page';
import PrivacyPolicyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import FeatureRemovedPage from '@/app/oscilloscope/page';
import { useToast } from '@/hooks/use-toast';
import { getStoredAccessToken } from '@/lib/auth-storage';

jest.mock('next/link', () => function MockLink({
  children,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
});
jest.mock('next/navigation', () => ({ useSearchParams: jest.fn() }));
jest.mock('@/hooks/use-toast', () => ({ useToast: jest.fn() }));
jest.mock('@/components/shared/LabScene', () => ({ LabScene: () => <aside data-testid="lab-scene" /> }));
jest.mock('@/lib/auth-storage', () => ({
  clearStoredAuth: jest.fn(),
  getStoredAccessToken: jest.fn(),
  storeAuth: jest.fn(),
}));
jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const MockIcon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return new Proxy({ __esModule: true }, {
    get: (target, property) => property in target ? target[property as keyof typeof target] : MockIcon,
  });
});

global.fetch = jest.fn();

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('public and account pages mobile contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/welcome');
    mockUseSearchParams.mockReturnValue({ get: () => null } as unknown as ReturnType<typeof useSearchParams>);
    mockGetStoredAccessToken.mockReturnValue('student-token');
    mockUseToast.mockReturnValue({ toast: jest.fn(), dismiss: jest.fn(), toasts: [] });
  });

  it('uses semantic, keyboard-visible and touch-sized navigation on the welcome page', () => {
    const { container } = render(<WelcomePage />);
    const page = container.firstElementChild;

    expect(page).toHaveClass('min-h-[100dvh]', 'overflow-x-hidden');
    const navigation = screen.getByRole('navigation');
    for (const link of within(navigation).getAllByRole('link')) {
      expect(link).toHaveClass('min-h-11', 'focus-visible:ring-2');
    }
    for (const link of [
      screen.getByRole('link', { name: '隐私政策' }),
      screen.getByRole('link', { name: '使用条款' }),
    ]) {
      expect(link).toHaveClass('min-h-11', 'focus-visible:ring-2');
    }
    expect(screen.getAllByRole('link', { name: /教师端登录|教师与管理员登录|学生注册|创建学生账号/ }).length).toBeGreaterThan(2);
    expect(screen.getByRole('heading', { name: /3.1 寻址方式.*教学闭环样板/ })).toBeInTheDocument();
    expect(screen.getByText('非成效数据')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看公开课程' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '教师端登录' })).toHaveAttribute('href', '/login?role=teacher');
  });

  it('keeps registration controls touch-sized and focuses the first invalid field', () => {
    const { container } = render(<RegisterPage />);

    expect(container.firstElementChild).toHaveClass('min-h-[100dvh]', 'overflow-x-hidden');
    expect(screen.getByRole('link', { name: '返回登录' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.getByRole('link', { name: '立即登录' })).toHaveClass('min-h-11', 'focus-visible:ring-2');

    const submit = screen.getByRole('button', { name: '注册' });
    expect(submit).toHaveClass('min-h-11', 'focus-visible:ring-2');
    fireEvent.click(submit);

    const email = screen.getByLabelText('邮箱 *');
    expect(email).toHaveFocus();
    expect(email).toHaveClass('min-h-11');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'register-form-error');
    expect(screen.getByRole('alert')).toHaveTextContent('请输入邮箱');
  });

  it('locks registration inputs and exposes a stable loading label during submission', async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    mockFetch.mockImplementation(() => new Promise<Response>((resolve) => { finishRequest = resolve; }));
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('邮箱 *'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('用户名 *'), { target: { value: 'student' } });
    fireEvent.change(screen.getByLabelText('密码 *'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('确认密码 *'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    const pendingSubmit = screen.getByRole('button', { name: '正在创建账号…' });
    expect(pendingSubmit).toBeDisabled();
    expect(pendingSubmit).toHaveAttribute('aria-busy', 'true');
    expect(pendingSubmit.closest('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('邮箱 *')).toBeDisabled();
    expect(screen.getByLabelText('班级邀请码')).toBeDisabled();

    await act(async () => {
      finishRequest?.({
        ok: false,
        status: 409,
        json: async () => ({ error: '用户名已存在' }),
      } as Response);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('用户名已存在');
    expect(screen.getByRole('button', { name: '注册' })).toBeEnabled();
  });

  it('keeps password guidance associated with the mobile registration input', () => {
    render(<RegisterPage />);

    const password = screen.getByLabelText('密码 *');
    expect(password).toHaveAttribute('aria-describedby', 'register-password-help');
    expect(screen.getByText(/按 UTF-8 计算不超过 72 字节/)).toBeInTheDocument();
  });

  it('keeps public policy pages readable and keyboard-visible on narrow screens', () => {
    const privacy = render(<PrivacyPolicyPage />);

    expect(privacy.container.firstElementChild).toHaveClass('min-h-[100dvh]', 'overflow-x-hidden');
    expect(screen.getByRole('link', { name: '← 返回平台介绍' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.getByRole('main').querySelector('.break-words')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. 教学管理与研究导出' })).toBeInTheDocument();
    expect(screen.getByText('研究匿名模式：')).toBeInTheDocument();
    expect(screen.getByText(/当前未启用180日自动滚动删除/)).toBeInTheDocument();
    expect(screen.getByText(/7个工作日内告知受理结果/)).toBeInTheDocument();
    expect(screen.getByText(/问题和为保持语境所必需的对话片段/)).toBeInTheDocument();
    privacy.unmount();

    const terms = render(<TermsPage />);
    expect(terms.container.firstElementChild).toHaveClass('min-h-[100dvh]', 'overflow-x-hidden');
    expect(screen.getByRole('link', { name: '← 返回平台介绍' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.getByRole('main').querySelector('.break-words')).toBeInTheDocument();
  });

  it('keeps both retired-feature recovery actions touch-sized and keyboard-visible', () => {
    const { container } = render(<FeatureRemovedPage />);

    expect(container.firstElementChild).toHaveClass('min-h-[calc(100dvh-3.5rem)]', 'overflow-x-hidden');
    expect(screen.getByRole('link', { name: '返回课程内容' })).toHaveClass('min-h-12', 'focus-visible:ring-2');
    expect(screen.getByRole('link', { name: '进入实验仿真' })).toHaveClass('min-h-12', 'focus-visible:ring-2');
  });

  it('preserves the invite, query and fragment when an expired student login is recovered', async () => {
    window.history.replaceState({}, '', '/classes/join?code=ABC12345&source=teacher#invite');
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => key === 'code' ? 'ABC12345' : null,
    } as unknown as ReturnType<typeof useSearchParams>);
    mockGetStoredAccessToken.mockReturnValue(null);
    render(<JoinClassPage />);

    expect(await screen.findByDisplayValue('ABC12345')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入班级' }));

    expect(await screen.findByRole('link', { name: '重新登录并保留邀请码' })).toHaveAttribute(
      'href',
      '/login?role=student&from=%2Fclasses%2Fjoin%3Fcode%3DABC12345%26source%3Dteacher%23invite',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('offers a student-account recovery path after a role denial without replaying a rapid click', async () => {
    window.history.replaceState({}, '', '/classes/join?code=ABC12345&source=teacher#invite');
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => key === 'code' ? 'ABC12345' : null,
    } as unknown as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValueOnce(response({ error: '只有学生账号可以加入班级' }, 403));
    render(<JoinClassPage />);

    expect(await screen.findByDisplayValue('ABC12345')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: '加入班级' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByRole('link', { name: '切换学生账号并保留邀请码' })).toHaveAttribute(
      'href',
      '/login?role=student&from=%2Fclasses%2Fjoin%3Fcode%3DABC12345%26source%3Dteacher%23invite&reason=student-role',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('announces the in-flight class join and disables repeated input', async () => {
    let finishRequest: ((value: Response) => void) | undefined;
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => key === 'code' ? 'ABC12345' : null,
    } as unknown as ReturnType<typeof useSearchParams>);
    mockFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRequest = resolve; }));
    render(<JoinClassPage />);

    const input = await screen.findByDisplayValue('ABC12345');
    fireEvent.click(screen.getByRole('button', { name: '加入班级' }));

    const pending = await screen.findByRole('button', { name: '正在加入…' });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute('aria-busy', 'true');
    expect(input).toBeDisabled();

    await act(async () => {
      finishRequest?.(response({
        success: true,
        classEnrollment: { classGroup: { name: '样板班' } },
      }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('已加入「样板班」');
  });

  it('locks an uncertain class join until the student explicitly verifies it did not succeed', async () => {
    window.history.replaceState({}, '', '/classes/join?code=ABC12345#invite');
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => key === 'code' ? 'ABC12345' : null,
    } as unknown as ReturnType<typeof useSearchParams>);
    mockFetch.mockRejectedValueOnce(new TypeError('network lost'));
    render(<JoinClassPage />);

    const input = await screen.findByDisplayValue('ABC12345');
    fireEvent.click(screen.getByRole('button', { name: '加入班级' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('加入结果暂未确认');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '加入结果待核对' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '先去“我的任务”核对' })).toHaveClass('min-h-11');
    const unlock = screen.getByRole('button', { name: '已确认未加入，允许重试' });
    expect(unlock).toHaveClass('min-h-11');

    fireEvent.click(unlock);
    await waitFor(() => expect(input).toBeEnabled());
    await waitFor(() => expect(input).toHaveFocus());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps post-join destinations touch-sized', async () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => key === 'code' ? 'ABC12345' : null,
    } as unknown as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValueOnce(response({
      success: true,
      classEnrollment: { classGroup: { name: '样板班', courseName: '单片机原理', semester: '2026秋' } },
    }));
    render(<JoinClassPage />);

    expect(await screen.findByDisplayValue('ABC12345')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加入班级' }));

    expect(await screen.findByRole('link', { name: '查看我的任务' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.getByRole('link', { name: '返回课程' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
  });
});
