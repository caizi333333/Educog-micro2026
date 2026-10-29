import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeacherDailyPulsePage from '@/app/teacher/daily/page';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

const pulse = {
  dateKey: '2026-10-29',
  timeZone: 'Asia/Shanghai',
  asOf: '2026-10-28T16:30:00.000Z',
  windowStart: '2026-10-28T16:00:00.000Z',
  windowEnd: '2026-10-29T16:00:00.000Z',
  classes: [
    {
      code: '0872-001',
      label: '智工 0872-001',
      availability: 'visible',
      classId: 'c1',
      rosterCount: 2,
      loggedInCount: 1,
      studiedCount: 1,
      omittedActiveCount: 0,
      students: [{
        id: 'real',
        name: '正式甲',
        username: 'S001',
        studentId: 'S001',
        loggedIn: true,
        studied: true,
        lastLoginAt: '2026-10-28T16:10:00.000Z',
        lastStudyAt: '2026-10-28T16:20:00.000Z',
        durationSeconds: 180,
      }],
    },
    {
      code: '0872-002',
      label: '智工 0872-002',
      availability: 'out-of-scope',
      classId: null,
      rosterCount: 0,
      loggedInCount: 0,
      studiedCount: 0,
      omittedActiveCount: 0,
      students: [],
    },
    {
      code: '3084-001',
      label: '3084-001',
      availability: 'visible',
      classId: 'c3',
      rosterCount: 1,
      loggedInCount: 0,
      studiedCount: 0,
      omittedActiveCount: 0,
      students: [],
    },
    {
      code: '3084-002',
      label: '3084-002',
      availability: 'missing',
      classId: null,
      rosterCount: 0,
      loggedInCount: 0,
      studiedCount: 0,
      omittedActiveCount: 0,
      students: [],
    },
  ],
  demo: {
    count: 1,
    omittedCount: 0,
    students: [{
      id: 'smoke',
      classCode: '0872-001',
      classLabel: '智工 0872-001',
      name: '自测甲',
      username: 'TEST0872001',
      studentId: 'TEST0872001',
      loggedIn: true,
      studied: false,
      lastLoginAt: '2026-10-28T16:12:00.000Z',
      lastStudyAt: null,
      durationSeconds: 0,
    }],
  },
};

describe('teacher daily pulse page', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the four official classes and keeps demo accounts folded', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => pulse,
    } as Response);
    const user = userEvent.setup();
    render(<TeacherDailyPulsePage />);

    expect(await screen.findByRole('heading', { name: '智工 0872-001' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今日动态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '智工 0872-002' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3084-001' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3084-002' })).toBeInTheDocument();
    expect(screen.getByText('今日登录 1 人 · 今日学习 1 人 · 正式在籍 2 人')).toBeInTheDocument();
    expect(screen.getByText('正式甲')).toBeInTheDocument();
    expect(screen.getByText('不在当前账号的教学范围。')).toBeInTheDocument();
    expect(screen.getByText('尚未建立这个班级。')).toBeInTheDocument();
    expect(screen.getByText('今日还没有人登录或学习。')).toBeInTheDocument();

    const official = screen.getByRole('heading', { name: '智工 0872-001' }).closest('section');
    expect(official).not.toBeNull();
    expect(within(official as HTMLElement).queryByText('自测甲')).not.toBeInTheDocument();

    const fold = screen.getByText('演示与自测账号 1 个，不计入上面的人数').closest('details');
    expect(fold).not.toBeNull();
    expect(fold).not.toHaveAttribute('open');
    expect(within(fold as HTMLElement).getByText('自测甲')).toBeInTheDocument();
    await user.click(screen.getByText('演示与自测账号 1 个，不计入上面的人数'));
    expect(fold).toHaveAttribute('open');
  });

  it('refuses a student response without rendering classmate rows', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: '权限不足' }),
    } as Response);
    render(<TeacherDailyPulsePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('当前账号不能查看今日动态');
    await waitFor(() => expect(screen.queryByRole('heading', { name: '智工 0872-001' })).not.toBeInTheDocument());
  });
});
