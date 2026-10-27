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

  it('scrolls the pressed unit chip into the strip when a narrow deep link opens unit 5', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const scrollWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    const clientWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const rect = (left: number, width: number): DOMRect => ({
      x: left,
      y: 0,
      left,
      top: 0,
      width,
      height: 44,
      right: left + width,
      bottom: 44,
      toJSON: () => ({}),
    });

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('max-width: 639px'),
      media: String(query),
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
    HTMLElement.prototype.getBoundingClientRect = function rectFor(this: HTMLElement): DOMRect {
      if (this.getAttribute('aria-label') === '选择单元') return rect(0, 320);
      if (this.getAttribute('aria-pressed') === 'true') {
        const scrolled = this.parentElement?.scrollLeft ?? 0;
        return rect(640 - scrolled, 160);
      }
      return rect(0, 40);
    };
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.getAttribute('aria-label') === '选择单元' ? 980 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.getAttribute('aria-label') === '选择单元' ? 320 : 0;
      },
    });

    try {
      window.history.replaceState({}, '', '/lesson-notes?unit=5#int-2');
      render(<LessonNotesPage />);
      await screen.findByTitle('第 5 章交互总览 · 讲解笔记');
      const strip = screen.getByRole('group', { name: '选择单元' });
      expect(strip.scrollLeft).toBe(492);
      expect(screen.getByRole('button', { name: /单元 5/ })).toHaveAttribute('aria-pressed', 'true');
    } finally {
      window.matchMedia = originalMatchMedia;
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      if (scrollWidthDesc) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidthDesc);
      if (clientWidthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidthDesc);
    }
  });
});
