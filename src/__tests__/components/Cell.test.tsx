import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import {
  Cell,
  CellGrid,
  CellSkeleton,
  CellSwitch,
  CellSwitchItem,
  CoursewareSeam,
  SurfaceKicker,
  cellSurfaceClass,
} from '@/components/shared/Cell';

describe('student cell primitives', () => {
  it('keeps geometry on the shared class and leaves the hue to data-tone', () => {
    expect(cellSurfaceClass({ interactive: true, compact: true })).toContain('edu-cell');
    expect(cellSurfaceClass({ interactive: true, compact: true })).toContain('edu-cell--compact');
    expect(cellSurfaceClass()).not.toContain('edu-cell-enter');

    render(
      <Cell tone="task" enter>
        任务格
      </Cell>,
    );
    const cell = screen.getByText('任务格');
    expect(cell).toHaveAttribute('data-tone', 'task');
    expect(cell).toHaveClass('edu-cell-enter');
  });

  it('reserves skeleton height behind one status, and wraps unit choices', () => {
    render(
      <div>
        <CellGrid>
          <CellSkeleton label="正在读取任务" tone="task" count={2} />
        </CellGrid>
        <CellSwitch label="选择单元">
          <CellSwitchItem pressed tone="notes">单元 5</CellSwitchItem>
          <CellSwitchItem pressed={false} tone="notes">单元 2</CellSwitchItem>
        </CellSwitch>
        <SurfaceKicker tone="course">Course Structure</SurfaceKicker>
        <CoursewareSeam ready={false} label="这一篇正在打开，版面高度保持不变。">
          <p>课件正文</p>
        </CoursewareSeam>
      </div>,
    );

    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(2);
    expect(statuses.some((node) => node.textContent?.includes('正在读取任务'))).toBe(true);
    expect(screen.getByRole('group', { name: '选择单元' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '单元 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '单元 5' })).toHaveAttribute('data-tone', 'notes');
    expect(screen.getByText('Course Structure').closest('[data-tone="course"]')).toHaveClass('edu-surface-kicker');
    const seam = screen.getByRole('region', { name: '讲解课件' });
    expect(seam).toHaveAttribute('aria-busy', 'true');
    expect(seam).toHaveAttribute('data-tone', 'notes');
    expect(seam).toHaveTextContent('课件正文');
  });

  it('reads motion from the shared tokens and the existing reduced-motion switch', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain('--cell-duration: 180ms');
    expect(css).toContain('--junction-course:');
    expect(css).toContain('--junction-task:');
    expect(css).toContain('--junction-notes:');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).not.toContain('framer-motion');
  });
});
