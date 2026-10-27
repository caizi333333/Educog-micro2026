import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DragMatchPractice } from '@/components/practice/DragMatchPractice';
import { ADDRESSING_MODE_BOARD, CPU_STRUCTURE_BOARD, INTERRUPT_IE_ENABLE_BOARD, INTERRUPT_SOURCE_FLAG_BOARD, MEMORY_REGION_BOARD, type MatchBoard } from '@/lib/practice-match';

const mockFetch = global.fetch as jest.Mock;

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
    expect(screen.getByText(/连对三次/)).toBeInTheDocument();
    expect(screen.getByText(/今天练过了/)).toBeInTheDocument();
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

  it('places every IE enable bit and posts that board', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        correct: true,
        message: '首次对上：+15 积分，解锁勋章「允许位对上了」+10。',
      }),
    });
    render(
      <DragMatchPractice
        board={INTERRUPT_IE_ENABLE_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );

    expect(document.querySelector('[data-practice="u5-interrupt-ie-enables"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByRole('button', { name: /EX0/ })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '中断源 外部中断 0，INT0 · P3.2 引脚，空位' })).toHaveClass('min-h-11');

    placeAll(INTERRUPT_IE_ENABLE_BOARD);
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('解锁勋章「允许位对上了」');
    });
    expect(screen.getByText('EX0 → 外部中断 0（INT0 · P3.2 引脚）')).toBeInTheDocument();
    expect(screen.getByText('ES → 串行口（串口 · 收完或发完一帧）')).toBeInTheDocument();
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.boardId).toBe('u5-interrupt-ie-enables');
    expect(body.placements).toEqual({
      ex0: 'ex0',
      et0: 'et0',
      ex1: 'ex1',
      et1: 'et1',
      es: 'es',
    });
  });

  it('marks a swapped IE bit without calling the server or listing the mapping', async () => {
    render(
      <DragMatchPractice
        board={INTERRUPT_IE_ENABLE_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /EX0/ }));
    fireEvent.click(screen.getByRole('button', { name: '中断源 定时器 T0，T0 溢出，空位' }));
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    expect(screen.getByRole('status')).toHaveTextContent('还有 5 处没对上');
    expect(screen.getByRole('status')).toHaveTextContent('总开关');
    expect(screen.getByRole('status')).not.toHaveTextContent('EX0');
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });

  it('places every addressing instruction and posts that board', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        correct: true,
        message: '首次对上：+15 积分，解锁勋章「寻址方式对上了」+10。',
      }),
    });
    render(
      <DragMatchPractice
        board={ADDRESSING_MODE_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );

    placeAll(ADDRESSING_MODE_BOARD);
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('解锁勋章「寻址方式对上了」');
    });
    expect(screen.getByText('MOV A,#30H → 立即寻址（常数跟在操作码后面）')).toBeInTheDocument();
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.boardId).toBe('u3-addressing-modes');
    expect(body.placements.imm).toBe('imm');
    expect(body.placements.idx).toBe('idx');
  });

  it('drops one CPU fragment, then places the rest by tap and posts that board', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        correct: true,
        message: '首次对上：+15 积分，解锁勋章「CPU 结构归位」+10。',
      }),
    });
    render(
      <DragMatchPractice
        board={CPU_STRUCTURE_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );

    const alu = screen.getByRole('button', { name: /^ALU/ });
    const aluSlot = screen.getByRole('button', { name: '结构位置 做算术与逻辑，运算器 · 8 位，还带位处理，空位' });
    expect(alu).toHaveClass('min-h-11');
    expect(aluSlot).toHaveClass('min-h-11');
    expect(screen.getByRole('region', { name: '运算器' })).toBeInTheDocument();
    expect(document.querySelector('[data-layout="puzzle"] .grid')).toHaveClass('grid-cols-2');
    fireEvent.dragStart(alu, { dataTransfer: { setData: jest.fn(), effectAllowed: 'move' } });
    fireEvent.drop(aluSlot, { dataTransfer: { getData: () => 'alu' } });
    expect(screen.getByRole('button', { name: '结构位置 做算术与逻辑，运算器 · 8 位，还带位处理，已放入 ALU' })).toBeInTheDocument();

    for (const pair of CPU_STRUCTURE_BOARD.pairs) {
      if (pair.id === 'alu') continue;
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${escapeRegExp(pair.prompt)}`) }));
      fireEvent.click(screen.getByRole('button', {
        name: `${CPU_STRUCTURE_BOARD.shell.slotName} ${pair.target}，${pair.targetDetail}，空位`,
      }));
    }
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('解锁勋章「CPU 结构归位」');
    });
    expect(screen.getByText('ALU → 做算术与逻辑（运算器 · 8 位，还带位处理）')).toBeInTheDocument();
    expect(screen.getByText('PC → 记下一条指令地址（其他寄存器 · 16 位，复位 0000H）')).toBeInTheDocument();
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.boardId).toBe('u2-cpu-structure');
    expect(body.placements).toEqual({
      alu: 'alu',
      acc: 'acc',
      ir: 'ir',
      id: 'id',
      pc: 'pc',
      dptr: 'dptr',
    });
  });

  it('does not score a CPU block left in the wrong group', async () => {
    render(
      <DragMatchPractice
        board={CPU_STRUCTURE_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /ALU/ }));
    fireEvent.click(screen.getByRole('button', { name: '结构位置 先收下当前指令，控制器 · 操作码再送去译码，空位' }));
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    expect(screen.getByRole('status')).toHaveTextContent('还有 6 处没对上');
    expect(screen.getByRole('status')).toHaveTextContent('0000H');
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
  });

  it('keeps the memory-region board as a tappable two-column match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        correct: true,
        message: '首次对上：+15 积分，解锁勋章「存储区分清了」+10。',
      }),
    });
    render(
      <DragMatchPractice
        board={MEMORY_REGION_BOARD}
        expanded
        onExpandedChange={jest.fn()}
        onOpenSection={jest.fn()}
      />,
    );

    expect(document.querySelector('[data-layout="puzzle"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-practice="u2-memory-regions"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByRole('button', { name: /工作寄存器区/ })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: '含义 20H ~ 2FH，16 B，位地址 00H~7FH，空位' })).toHaveClass('min-h-11');

    placeAll(MEMORY_REGION_BOARD);
    fireEvent.click(screen.getByRole('button', { name: '核对' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('解锁勋章「存储区分清了」');
    });
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.boardId).toBe('u2-memory-regions');
    expect(body.placements.bit).toBe('bit');
    expect(body.placements.xram).toBe('xram');
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function placeAll(board: MatchBoard = INTERRUPT_SOURCE_FLAG_BOARD): void {
  for (const pair of board.pairs) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(escapeRegExp(pair.prompt)) }));
    fireEvent.click(screen.getByRole('button', {
      name: `${board.shell.slotName} ${pair.target}，${pair.targetDetail}，空位`,
    }));
  }
}
