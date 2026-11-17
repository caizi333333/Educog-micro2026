import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PracticeClient } from '@/app/practice/practice-client';
import { practiceRequest } from '@/lib/practice-cards-client';

jest.mock('@/lib/practice-cards-client', () => ({
  practiceRequest: jest.fn(),
}));
jest.mock('@/app/practice/practice.module.css', () => ({}));
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => null }));

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
