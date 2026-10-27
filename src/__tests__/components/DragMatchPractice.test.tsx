import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DragMatchPractice } from '@/components/practice/DragMatchPractice';
import { INTERRUPT_SOURCE_FLAG_BOARD } from '@/lib/practice-match';

const mockFetch = global.fetch as jest.Mock;

function placeAll(): void {
  for (const pair of INTERRUPT_SOURCE_FLAG_BOARD.pairs) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(pair.prompt) }));
    fireEvent.click(screen.getByRole('button', { name: `请求标志 ${pair.target}，${pair.targetDetail}，空位` }));
  }
}

describe('DragMatchPractice', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('places every source by tap and shows the server medal message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        correct: true,
        message: '首次对上：+15 积分，解锁勋章「中断标志对上了」+10。',
      }),
    });
    render(
      <DragMatchPractice
        board={INTERRUPT_SOURCE_FLAG_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );

    placeAll();
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('解锁勋章「中断标志对上了」');
    });
    expect(screen.getByText('外部中断 0 → IE0（TCON.1）')).toBeInTheDocument();
    expect(document.querySelector('[data-practice] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(mockFetch).toHaveBeenCalledWith('/api/practice/match', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
    }));
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.boardId).toBe('u5-interrupt-source-flags');
    expect(body.placements).toEqual({
      int0: 'int0',
      t0: 't0',
      int1: 'int1',
      t1: 't1',
      uart: 'uart',
    });
  });

  it('marks a miss without calling the server', async () => {
    render(
      <DragMatchPractice
        board={INTERRUPT_SOURCE_FLAG_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /外部中断 0/ }));
    fireEvent.click(screen.getByRole('button', { name: '请求标志 TF0，TCON.5，空位' }));
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    expect(screen.getByRole('status')).toHaveTextContent('还有 5 处没对上');
    expect(screen.getByRole('status')).toHaveTextContent('IE0 是标志位');
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });

  it('stays a single column of 44px targets when collapsed content is closed', () => {
    render(
      <DragMatchPractice
        board={INTERRUPT_SOURCE_FLAG_BOARD}
        expanded={false}
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '核对' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开练一练：中断源对请求标志' })).toHaveClass('min-h-11');
  });
});
