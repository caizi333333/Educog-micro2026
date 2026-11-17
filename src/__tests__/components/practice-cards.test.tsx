import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { PracticeClient } from '@/app/practice/practice-client';
import { practiceRequest } from '@/lib/practice-cards-client';
import { CLIENT_READ_TIMEOUT_MS } from '@/lib/client-fetch';

jest.mock('@/lib/practice-cards-client', () => ({
  ...jest.requireActual('@/lib/practice-cards-client'),
  practiceRequest: jest.fn(),
}));
jest.mock('@/app/practice/practice.module.css', () => ({}));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));

const request = practiceRequest as jest.Mock;
const question = {
  id: 1,
  type: 'multiple-choice',
  chapter: 2,
  ka: '2.1',
  questionText: '测试单片机题目',
  options: ['正确选项', '错误选项'],
};
const dashboard = {
  name: '测试同学',
  classId: 'class-a',
  classes: [],
  goal: 20,
  today: 0,
  streak: 0,
  xp: 0,
  answered: [],
  due: [],
  wrong: [],
  chapters: [],
  leaderboard: [],
  best: 0,
};
const feedback = {
  questionId: question.id,
  answer: '正确选项',
  correct: true,
  xp: 10,
  correctAnswer: '正确选项',
  explanation: '正确解析',
};

describe('practice card submissions', () => {
  beforeEach(() => {
    request.mockReset();
    mockReplace.mockReset();
    window.scrollTo = jest.fn();
    let nextId = 0;
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => `request-${++nextId}`),
    });
    request.mockImplementation((path: string) => {
      if (path === 'me') return Promise.resolve(dashboard);
      if (path.startsWith('questions?')) return Promise.resolve([question]);
      return Promise.resolve(feedback);
    });
  });

  it('loads a cookie-only session without a local token', async () => {
    localStorage.clear();
    sessionStorage.clear();
    request.mockImplementation(
      jest.requireActual('@/lib/practice-cards-client').practiceRequest,
    );
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => dashboard,
    });
    render(<PracticeClient />);
    await screen.findByRole('heading', { name: '嗨，测试同学。' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/practice/cards/me',
      expect.objectContaining({ credentials: 'same-origin', headers: {} }),
    );
  });

  it('stops loading a stalled cookie-only request and allows a retry', async () => {
    jest.useFakeTimers();
    try {
      localStorage.clear();
      sessionStorage.clear();
      request.mockImplementation(
        jest.requireActual('@/lib/practice-cards-client').practiceRequest,
      );
      (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
      render(<PracticeClient />);
      expect(screen.getByRole('status')).toHaveTextContent(
        '正在打开你的学习地图',
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(CLIENT_READ_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('请求超时');
      expect(screen.getByRole('status')).not.toHaveTextContent('正在打开');
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => dashboard,
      });
      fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
      await screen.findByRole('heading', { name: '嗨，测试同学。' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('redirects a rejected session to login instead of remaining on the loading screen', async () => {
    request.mockImplementation(
      jest.requireActual('@/lib/practice-cards-client').practiceRequest,
    );
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: '未授权' }),
    });
    render(<PracticeClient />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/login?from=%2Fpractice'),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('正在打开');
  });
  it.each([403, 500])(
    'shows recoverable HTTP %i errors without redirecting or spinning',
    async (status) => {
      request.mockImplementation(
        jest.requireActual('@/lib/practice-cards-client').practiceRequest,
      );
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: '暂时无法加载' }),
      });
      render(<PracticeClient />);
      await screen.findByRole('alert');
      expect(screen.getByRole('alert')).toHaveTextContent('暂时无法加载');
      expect(screen.getByRole('status')).not.toHaveTextContent('正在打开');
      expect(mockReplace).not.toHaveBeenCalled();
    },
  );

  it('retries the same card answer and request ID after a lost response', async () => {
    let submitted = false;
    request.mockImplementation((path: string) => {
      if (path === 'me') return Promise.resolve(dashboard);
      if (path.startsWith('questions?')) return Promise.resolve([question]);
      if (!submitted) {
        submitted = true;
        return Promise.reject(new Error('响应丢失，请重试'));
      }
      return Promise.resolve(feedback);
    });
    render(<PracticeClient />);
    fireEvent.click(await screen.findByRole('button', { name: /顺序练习/ }));
    fireEvent.click(await screen.findByRole('button', { name: /正确选项/ }));
    await screen.findByText('响应丢失，请重试');
    fireEvent.click(screen.getByRole('button', { name: /错误选项/ }));
    await screen.findByText('点亮了，真棒！');
    expect(screen.getByText('正确解析')).toBeInTheDocument();
    const submissions = request.mock.calls.filter(
      ([path]) => path === 'answer',
    );
    expect(submissions).toHaveLength(2);
    expect(submissions[1][1]).toEqual(submissions[0][1]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('does not submit an empty queue', async () => {
    request.mockImplementation((path: string) =>
      Promise.resolve(path === 'me' ? dashboard : []),
    );
    render(<PracticeClient />);
    fireEvent.click(await screen.findByRole('button', { name: /顺序练习/ }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'questions?mode=all',
        undefined,
        'class-a',
      ),
    );
    expect(
      request.mock.calls.filter(([path]) => path === 'answer'),
    ).toHaveLength(0);
  });
  it('uses a new request ID for a new answer after a successful session', async () => {
    render(<PracticeClient />);
    fireEvent.click(await screen.findByRole('button', { name: /顺序练习/ }));
    fireEvent.click(await screen.findByRole('button', { name: /正确选项/ }));
    await screen.findByText('点亮了，真棒！');
    fireEvent.click(screen.getByRole('button', { name: /完成练习/ }));
    fireEvent.click(screen.getByRole('button', { name: /回到知识星图/ }));
    fireEvent.click(await screen.findByRole('button', { name: /顺序练习/ }));
    fireEvent.click(await screen.findByRole('button', { name: /正确选项/ }));
    await screen.findByText('点亮了，真棒！');
    const submissions = request.mock.calls.filter(
      ([path]) => path === 'answer',
    );
    expect(submissions).toHaveLength(2);
    expect(submissions[1][1].requestId).not.toBe(submissions[0][1].requestId);
  });
  it('continues daily practice with the server-ranked cards after all cards have been attempted', async () => {
    const older = { ...question, id: 2, questionText: '更早练过的题目' };
    request.mockImplementation((path: string) => {
      if (path === 'me')
        return Promise.resolve({ ...dashboard, today: 20, answered: [1, 2] });
      return Promise.resolve(
        path.includes('daily=1') ? [older, question] : [question, older],
      );
    });
    render(<PracticeClient />);
    fireEvent.click(await screen.findByRole('button', { name: /继续学习/ }));
    await screen.findByRole('heading', { name: '更早练过的题目' });
    expect(request).toHaveBeenCalledWith(
      'questions?mode=all&daily=1',
      undefined,
      'class-a',
    );
  });
});
