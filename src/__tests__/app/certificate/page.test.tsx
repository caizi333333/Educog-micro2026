import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CertificatePage from '@/app/certificate/page';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: jest.fn(),
}));

const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = jest.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const persistedCertificate = {
  id: 'cert-db-001',
  type: 'COURSE_COMPLETION',
  name: '微控制器应用技术课程结业证书',
  description: '完成课程学习与考核',
  courseScore: 88.5,
  examScore: 86,
  totalScore: 87.2,
  certificateNo: 'EDUCOG-MCU-2025-S001',
  issuedAt: '2025-07-01T02:30:00.000Z',
  expiresAt: null,
  awardScope: '《微控制器应用技术》课程',
  criteria: '完成课程学习与考核，并由教师复核后颁发',
};

const certificateResponseMeta = {
  dataProvenance: {
    mode: 'DEMO' as const,
    label: '演示数据',
    note: '当前为竞赛功能演示环境，不用于证明教学成效。',
  },
  asOf: '2026-08-25T07:12:59.892Z',
};

describe('CertificatePage persisted-record boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/certificate');
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'student', email: 'student@example.com', name: '测试学生', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockGetStoredAccessToken.mockReturnValue('student-token');
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: mockFetch,
    });
  });

  it('does not generate a certificate for an empty student account', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      ...certificateResponseMeta,
      profile: { name: '无证书账号', role: 'STUDENT' },
      certificates: [],
    }));

    render(<CertificatePage />);

    expect(await screen.findByRole('heading', { name: '尚未获得学习证明' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(/当前学生账号没有服务端已颁发的证书记录/)).toBeInTheDocument();
    expect(screen.queryByText(/兹确认/)).not.toBeInTheDocument();
    expect(screen.queryByText(/表现优异/)).not.toBeInTheDocument();
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
  });

  it.each([
    ['TEACHER', '/teacher', '返回教学仪表板'],
    ['ADMIN', '/admin', '返回管理端'],
  ] as const)('does not request or synthesize certificates for a %s direct URL', (role, destination, action) => {
    mockUseAuth.mockReturnValue({
      user: { id: `${role.toLowerCase()}-1`, username: role.toLowerCase(), email: `${role.toLowerCase()}@example.com`, name: role, role },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<CertificatePage />);

    expect(screen.getByRole('heading', { name: '该页仅展示学生个人证书' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', destination);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('renders only persisted certificate identity, issue date, scope and criteria', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      success: true,
      ...certificateResponseMeta,
      profile: { name: '测试学生', role: 'STUDENT' },
      certificates: [persistedCertificate],
    }));

    render(<CertificatePage />);

    expect(await screen.findByRole('heading', { name: persistedCertificate.name }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(persistedCertificate.certificateNo)).toBeInTheDocument();
    expect(screen.getByText(persistedCertificate.id)).toBeInTheDocument();
    expect(screen.getByText(persistedCertificate.awardScope)).toBeInTheDocument();
    expect(screen.getByText(persistedCertificate.criteria)).toBeInTheDocument();
    expect(screen.getByText('2025年7月1日')).toBeInTheDocument();
    expect(screen.getByText('87.2')).toBeInTheDocument();
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
  });

  it('shows a retryable error without generating a certificate, then renders the confirmed response', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ message: '证书服务暂不可用' }, 503))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        ...certificateResponseMeta,
        profile: { name: '测试学生', role: 'STUDENT' },
        certificates: [persistedCertificate],
      }));

    render(<CertificatePage />);

    expect(await screen.findByRole('heading', { name: '证书记录暂不可用' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByText(/兹确认/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新读取' }));

    expect(await screen.findByRole('heading', { name: persistedCertificate.name }, { timeout: 10_000 })).toBeInTheDocument();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it('offers a scoped login recovery without calling the API when the token is missing', async () => {
    mockGetStoredAccessToken.mockReturnValue(null);

    render(<CertificatePage />);

    expect(await screen.findByRole('heading', { name: '证书记录暂不可用' }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Fcertificate');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the full certificate URL and asks for a student account after a 403', async () => {
    window.history.replaceState({}, '', '/certificate?source=profile#cert-db-001');
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: '无权读取证书' }, 403));

    render(<CertificatePage />);

    expect(await screen.findByRole('heading', { name: '证书记录暂不可用' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '切换学生账号' })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/certificate?source=profile#cert-db-001')}&reason=student-role`,
    );
  });

  it('does not render certificate data while authentication is hydrating', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(<CertificatePage />);

    expect(screen.getByText('正在核对服务端证书记录')).toBeInTheDocument();
    expect(screen.queryByText('尚未获得学习证明')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
