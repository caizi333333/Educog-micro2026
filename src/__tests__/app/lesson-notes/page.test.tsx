import React from 'react';
import { render, screen } from '@testing-library/react';
import LessonNotesPage from '@/app/lesson-notes/page';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useLearningPresence', () => ({ useLearningPresence: jest.fn() }));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { ExternalLink: Icon, NotebookPen: Icon, Share2: Icon };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LessonNotesPage deep link', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'TEST0872001', email: 'student@example.com', name: '学生', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
  });

  async function openAt(url: string, title: string): Promise<HTMLIFrameElement> {
    window.history.replaceState({}, '', url);
    render(<LessonNotesPage />);
    return await screen.findByTitle(title) as HTMLIFrameElement;
  }

  it('puts #int-2 on the unit 5 overview iframe lesson notes actually show', async () => {
    const frame = await openAt(
      '/lesson-notes?note=u5-overview#int-2',
      '第 5 章交互总览 · 讲解笔记',
    );

    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-2');
    expect(screen.getByRole('link', { name: /在新标签单独打开本篇/ })).toHaveAttribute(
      'href',
      '/resources/course/courseware/u5/u5-overview.html#int-2',
    );
    expect(screen.getByRole('button', { name: /单元 5/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /单元 5/ })).toHaveAttribute('data-tone', 'notes');
    expect(screen.getByRole('tab', { name: /第 5 章交互总览/ })).toHaveAttribute('data-tone', 'course');
    const seam = screen.getByRole('region', { name: '讲解课件' });
    expect(seam).toHaveAttribute('data-tone', 'notes');
    expect(seam).toContainElement(frame);
  });

  it('opens the interrupt-source match on unit 5 section ③', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-3', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-3');
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '中断源 ↔ 请求标志' })).toBeInTheDocument();
  });

  it('opens the same pane from a unit link that only carries the hash', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-2');
  });

  it('keeps an alias note on its own section instead of a foreign hash', async () => {
    const frame = await openAt('/lesson-notes?note=u3-jump#int-2', '第 3 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u3/u3-overview.html#jump');
  });
});
