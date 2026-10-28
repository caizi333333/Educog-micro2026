import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  function revealPractice(): void {
    const opener = screen.queryByRole('button', { name: /^展开练一练/ });
    if (opener) fireEvent.click(opener);
  }

  function chapter2Lesson(name: RegExp): HTMLElement {
    return within(screen.getByRole('group', { name: '第 2 章课次' })).getByRole('button', { name });
  }

  function placeNav(): HTMLElement {
    return screen.getByRole('navigation', { name: '当前位置' });
  }

  it('follows same-page hash changes and browser history without expanding practice', async () => {
    await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    window.history.replaceState({}, '', '/lesson-notes?unit=5#hex-split');
    fireEvent(window, new PopStateEvent('popstate'));
    fireEvent(window, new HashChangeEvent('hashchange'));
    const frame = await screen.findByTitle('第 3 次课 · 定时与收口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-lesson-3.html#hex-split');
    expect(screen.queryByRole('button', { name: '收起练一练' })).not.toBeInTheDocument();
    window.history.replaceState({}, '', '/lesson-notes?unit=5#int-2');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(await screen.findByTitle('第 5 章交互总览 · 讲解笔记')).toBeVisible();
  });

  it('does not reopen a stale explicit note for a shell landmark', async () => {
    await openAt('/lesson-notes?note=u5-overview#int-2', '第 5 章交互总览 · 讲解笔记');
    fireEvent.click(screen.getByRole('button', { name: /单元 4/ }));
    window.history.replaceState({}, '', '/lesson-notes?note=u5-overview#main-content');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('button', { name: /单元 4/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('aligns a loaded deep link but does not interrupt a reader who starts scrolling', async () => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      const frame = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      scroll.mockClear();
      fireEvent.load(frame);
      act(() => { jest.advanceTimersByTime(250); });
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });

      cleanup();
      const nextFrame = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.load(nextFrame);
      scroll.mockClear();
      fireEvent.wheel(window);
      act(() => { jest.advanceTimersByTime(250); });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('cancels pending alignment on iframe %s', async (type) => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      const frame = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.load(frame);
      scroll.mockClear();
      frame.contentWindow?.dispatchEvent(new Event(type));
      act(() => { jest.advanceTimersByTime(250); });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it('stops observing the previous iframe after switching courseware', async () => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      const previous = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.load(previous);
      window.history.replaceState({}, '', '/lesson-notes?unit=4#s-map');
      fireEvent(window, new HashChangeEvent('hashchange'));
      const current = await screen.findByTitle('课堂互动台 · 讲解笔记');
      fireEvent.load(current);
      scroll.mockClear();
      previous.contentWindow?.dispatchEvent(new Event('wheel'));
      act(() => { jest.advanceTimersByTime(250); });
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it('cleans up pending frame listeners after a history change without user input', async () => {
    jest.useFakeTimers();
    try {
      const frame = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.load(frame);
      const remove = jest.spyOn(frame.contentWindow!, 'removeEventListener');
      window.history.replaceState({}, '', '/lesson-notes?unit=5#main-content');
      fireEvent(window, new HashChangeEvent('hashchange'));
      act(() => { jest.advanceTimersByTime(250); });
      expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function), true);
      expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
      remove.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not let an old alignment timer clear a newer request', async () => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      const previous = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.load(previous);
      act(() => { jest.advanceTimersByTime(100); });
      window.history.replaceState({}, '', '/lesson-notes?unit=4#s-map');
      fireEvent(window, new HashChangeEvent('hashchange'));
      const current = await screen.findByTitle<HTMLIFrameElement>('课堂互动台 · 讲解笔记');
      fireEvent.load(current);
      const remove = jest.spyOn(current.contentWindow!, 'removeEventListener');
      scroll.mockClear();
      act(() => { jest.advanceTimersByTime(100); });
      expect(remove).not.toHaveBeenCalled();
      expect(scroll).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(100); });
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function), true);
      remove.mockRestore();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it('cleans up the pending request when its iframe never loads', async () => {
    jest.useFakeTimers();
    try {
      const frame = await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      const remove = jest.spyOn(frame.contentWindow!, 'removeEventListener');
      act(() => { jest.advanceTimersByTime(10_000); });
      expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function), true);
      remove.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not let an old load timeout cancel a newer alignment request', async () => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      await openAt('/lesson-notes?unit=5#gate-win', '第 3 次课 · 定时与收口 · 讲解笔记');
      act(() => { jest.advanceTimersByTime(9_900); });
      window.history.replaceState({}, '', '/lesson-notes?unit=4#s-map');
      fireEvent(window, new HashChangeEvent('hashchange'));
      const current = await screen.findByTitle<HTMLIFrameElement>('课堂互动台 · 讲解笔记');
      fireEvent.load(current);
      const remove = jest.spyOn(current.contentWindow!, 'removeEventListener');
      scroll.mockClear();
      act(() => { jest.advanceTimersByTime(100); });
      expect(remove).not.toHaveBeenCalled();
      expect(scroll).not.toHaveBeenCalled();
      act(() => { jest.advanceTimersByTime(100); });
      expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
      expect(remove).toHaveBeenCalledWith('wheel', expect.any(Function), true);
      remove.mockRestore();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it('cancels pending alignment on input inside a dynamically added srcdoc frame', async () => {
    jest.useFakeTimers();
    const original = HTMLElement.prototype.scrollIntoView;
    const scroll = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      const frame = await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
      frame.contentDocument!.open();
      frame.contentDocument!.write('<!doctype html><html><body></body></html>');
      frame.contentDocument!.close();
      fireEvent.load(frame);
      const nested = frame.contentDocument!.createElement('iframe');
      nested.srcdoc = '<button>课件练习</button>';
      frame.contentDocument!.body.appendChild(nested);
      await act(async () => { await Promise.resolve(); });
      scroll.mockClear();
      nested.contentWindow!.dispatchEvent(new Event('wheel'));
      act(() => { jest.advanceTimersByTime(250); });
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: original });
      jest.useRealTimers();
    }
  });

  it('keeps an explicit note when a foreign courseware hash is supplied', async () => {
    const frame = await openAt('/lesson-notes?note=u5-overview#hex-split', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html');
  });

  it('handles history back to a deep link after the breadcrumb updates the URL', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    fireEvent.click(within(placeNav()).getByRole('button', { name: /第 5 章 · 中断系统与定时器/ }));
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/lesson-notes?unit=5');
    window.history.replaceState({}, '', '/lesson-notes?unit=5#int-2');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() => expect(frame.contentWindow?.location.hash).toBe('#int-2'));
    expect(placeNav()).toHaveTextContent('查询与中断');
  });

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
    const where = placeNav();
    expect(where).toHaveTextContent('第 5 章 · 中断系统与定时器');
    expect(where).toHaveTextContent('第 1 次课 · 中断入门');
    expect(where).toHaveTextContent('查询与中断');
    expect(within(where).getByText('查询与中断')).toHaveAttribute('aria-current', 'page');
    const seam = screen.getByRole('region', { name: '讲解课件' });
    expect(seam).toHaveAttribute('data-tone', 'notes');
    expect(seam).toContainElement(frame);
  });

  it('opens the CPU structure puzzle on the unit 2 CPU note', async () => {
    const frame = await openAt('/lesson-notes?unit=2#cpu', 'CPU 结构 · 讲解笔记');
    expect(frame).toHaveAttribute('src', expect.stringContaining('/resources/course/courseware/u2/u2-cpu-structure.html'));
    expect(frame.contentWindow?.location.hash).toBe('#cpu');
    expect(frame.contentWindow?.location.pathname).toBe('/resources/course/courseware/u2/u2-cpu-structure.html');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'CPU 结构拼图' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '运算器' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '控制器' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '其他寄存器' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '指令 ↔ 寻址方式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '存储区 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the memory-region match on the unit 2 memory note', async () => {
    const frame = await openAt('/lesson-notes?unit=2#memory', '存储器组织 · 讲解笔记');
    expect(frame).toHaveAttribute('src', expect.stringContaining('/resources/course/courseware/u2/u2-memory.html'));
    expect(frame.contentWindow?.location.hash).toBe('#memory');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '存储区 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照地址图' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'CPU 结构拼图' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '总线角色 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the external-bus match on the unit 2 bus note and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?unit=2#bus', '总线结构 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u2/u2-bus.html#bus');
    expect(frame.contentWindow?.location.hash).toBe('#bus');
    expect(screen.getByRole('link', { name: /在新标签单独打开本篇/ })).toHaveAttribute(
      'href',
      '/resources/course/courseware/u2/u2-bus.html#bus',
    );
    expect(chapter2Lesson(/第 2 次课/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /总线结构/ })).toHaveAttribute('aria-selected', 'true');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '总线角色 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照总线结构' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起练一练' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^P0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^RD \/ WR/ })).toBeInTheDocument();
    expect(screen.getByText('高 8 位地址 A15~A8')).toBeInTheDocument();
    expect(document.querySelector('[data-practice="u2-external-bus"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(document.querySelector('[data-practice="u2-external-bus"]')?.textContent).not.toContain('8052');
    expect(document.querySelector('[data-practice="u2-external-bus"]')?.textContent).not.toContain('波特');
    expect(screen.queryByRole('heading', { name: 'CPU 结构拼图' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '存储区 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('mounts the external-bus match collapsed on the bus note without a hash', async () => {
    const frame = await openAt('/lesson-notes?note=u2-bus', '总线结构 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u2/u2-bus.html');
    expect(screen.getByRole('heading', { name: '总线角色 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开练一练：总线角色对含义' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '核对' })).not.toBeInTheDocument();
  });

  it('opens the instruction-team match on the unit 4 panorama and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?unit=4#s-map', '课堂互动台 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u4/u4-classroom.html#s-map');
    expect(frame.contentWindow?.location.hash).toBe('#s-map');
    expect(screen.getByRole('button', { name: /单元 4/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /课堂互动台/ })).toHaveAttribute('aria-selected', 'true');
    const where = placeNav();
    expect(where).toHaveTextContent('第 4 章 · 汇编语言程序设计');
    expect(where).toHaveTextContent('回炉复习');
    expect(where).toHaveTextContent('111 条全景');
    expect(within(where).getByText('111 条全景')).toHaveAttribute('aria-current', 'page');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '指令大类 ↔ 代表指令' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照 111 条全景' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起练一练' })).toBeInTheDocument();
    expect(screen.getByText('数据传送')).toBeInTheDocument();
    expect(screen.getByText('MOV A,Rn')).toBeInTheDocument();
    expect(screen.getByText('MOV C,bit')).toBeInTheDocument();
    expect(document.querySelector('[data-practice="u4-instruction-teams"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByRole('button', { name: /数据传送/ })).toHaveClass('min-h-11');
    expect(screen.queryByRole('heading', { name: '指令 ↔ 寻址方式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
  });

  it('keeps the instruction-team match collapsed on a neighboring unit 4 section', async () => {
    const frame = await openAt('/lesson-notes?unit=4#p-run', '课堂互动台 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u4/u4-classroom.html#p-run');
    expect(screen.getByRole('heading', { name: '指令大类 ↔ 代表指令' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开练一练：指令大类对代表指令' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '核对' })).not.toBeInTheDocument();
  });

  it('opens the addressing match on unit 3 section 寻址方式', async () => {
    const frame = await openAt('/lesson-notes?unit=3#addressing', '第 3 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u3/u3-overview.html#addressing');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '指令 ↔ 寻址方式' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
  });

  it('opens the interrupt-source match on unit 5 section ③', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-3', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-3');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '中断源 ↔ 请求标志' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 向量地址' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the IE enable match on unit 5 section ⑤ and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?note=u5-overview#int-5', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-5');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照课件⑤' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起练一练' })).toBeInTheDocument();
    expect(screen.getByText('EX0')).toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('外部中断 0')).toBeInTheDocument();
    expect(document.querySelector('[data-practice="u5-interrupt-ie-enables"]')?.textContent).not.toContain('EA');
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 向量地址' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the TCON bit match on unit 5 section ④ and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-4', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-4');
    expect(screen.getByRole('link', { name: /在新标签单独打开本篇/ })).toHaveAttribute(
      'href',
      '/resources/course/courseware/u5/u5-overview.html#int-4',
    );
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TCON 位 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照课件④' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起练一练' })).toBeInTheDocument();
    expect(screen.getByText('TR0')).toBeInTheDocument();
    expect(screen.getByText('TF1')).toBeInTheDocument();
    expect(screen.getByText('IT0')).toBeInTheDocument();
    expect(document.querySelector('[data-practice="u5-tcon-control-bits"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByRole('button', { name: /TR0/ })).toHaveClass('min-h-11');
    expect(document.querySelector('[data-practice="u5-tcon-control-bits"]')?.textContent).not.toContain('IE0');
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 向量地址' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the IP priority match on unit 5 section ⑥ and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-6', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-6');
    expect(screen.getByRole('link', { name: /在新标签单独打开本篇/ })).toHaveAttribute(
      'href',
      '/resources/course/courseware/u5/u5-overview.html#int-6',
    );
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照课件⑥' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起练一练' })).toBeInTheDocument();
    expect(screen.getByText('PX0')).toBeInTheDocument();
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.getByText('INT0')).toBeInTheDocument();
    expect(screen.getByText('串口')).toBeInTheDocument();
    expect(document.querySelector('[data-practice="u5-interrupt-priority"] .grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(screen.getByRole('button', { name: /PX0/ })).toHaveClass('min-h-11');
    expect(document.querySelector('[data-practice="u5-interrupt-priority"]')?.textContent).not.toContain('波特');
    expect(document.querySelector('[data-practice="u5-interrupt-priority"]')?.textContent).not.toContain('8052');
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 向量地址' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('keeps the source-flag match on a neighboring interrupt section', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-7', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-7');
    expect(screen.getByRole('heading', { name: '中断源 ↔ 请求标志' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开练一练：中断源对请求标志' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '核对' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).not.toBeInTheDocument();
  });

  it('opens the vector-address match on unit 5 section ② and keeps the deep link', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-2');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '中断源 ↔ 向量地址' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照课件②' })).toBeInTheDocument();
    expect(screen.getByText('外部中断 0')).toBeInTheDocument();
    expect(screen.getByText('0003H')).toBeInTheDocument();
    expect(screen.getByText('0023H')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens the TMOD match on the unit 5 timer practice section', async () => {
    const frame = await openAt('/lesson-notes?unit=5#tmr-hand', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#tmr-hand');
    revealPractice();
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照动手练③' })).toBeInTheDocument();
    expect(screen.getByText('M1 M0 = 00')).toBeInTheDocument();
    expect(screen.getByText('GATE = 1')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('keeps practice collapsed on #int-6 and scrolls the courseware into view', async () => {
    const seen: HTMLElement[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: HTMLElement, options?: ScrollIntoViewOptions) {
        seen.push(this);
        expect(options).toEqual({ block: 'start', behavior: 'auto' });
      },
    });
    try {
      const frame = await openAt('/lesson-notes?unit=5#int-6', '第 5 章交互总览 · 讲解笔记');
      expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-6');
      expect(screen.getByRole('button', { name: '回课次' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '回课次' })).toHaveClass('min-h-11');
      expect(placeNav()).toHaveTextContent('优先级');
      expect(document.querySelector('.lesson-shell__where')).toContainElement(screen.getByRole('button', { name: '回课次' }));
      expect(screen.getByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /展开练一练/ })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: '核对' })).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: '讲解课件' }).closest('.lesson-shell__courseware')).toBeTruthy();
      expect(seen.some((node) => node.classList.contains('lesson-shell__courseware'))).toBe(true);
      expect(document.querySelector('.lesson-shell__column')).toBeTruthy();
      expect(document.querySelector('.lesson-shell__stage.is-practice')).toBeNull();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: original,
      });
    }
  });

  it('returns from #int-6 to the unit 5 lesson entry without history.back', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    try {
      const frame = await openAt('/lesson-notes?unit=5#int-6', '第 5 章交互总览 · 讲解笔记');
      const contentWindow = frame.contentWindow;
      fireEvent.click(screen.getByRole('button', { name: '回课次' }));
      await waitFor(() => {
        expect(frame.contentWindow?.location.hash).toBe('');
      });
      expect(frame.contentWindow).toBe(contentWindow);
      expect(window.location.pathname + window.location.search + window.location.hash).toBe('/lesson-notes?unit=5');
      expect(back).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /展开练一练/ })).toHaveAttribute('aria-expanded', 'false');
      expect(placeNav()).toHaveTextContent('第 5 章 · 中断系统与定时器');
      expect(placeNav()).not.toHaveTextContent('优先级');
    } finally {
      back.mockRestore();
    }
  });

  it('returns from #hex-split to the chapter lesson chooser', async () => {
    await openAt('/lesson-notes?unit=5#hex-split', '第 3 次课 · 定时与收口 · 讲解笔记');
    fireEvent.click(screen.getByRole('button', { name: '回课次' }));
    const overview = await screen.findByTitle('第 5 章交互总览 · 讲解笔记');
    expect(overview).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html');
    expect(screen.getByRole('tab', { name: /第 5 章交互总览/ })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toBe('');
  });

  it('opens unit 5 #hex-split on the lesson 3 page and keeps the hash', async () => {
    const frame = await openAt('/lesson-notes?unit=5#hex-split', '第 3 次课 · 定时与收口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-lesson-3.html#hex-split');
    expect(screen.getByRole('button', { name: /单元 5/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /第 3 次课/ })).toHaveAttribute('aria-selected', 'true');
    const where = placeNav();
    expect(where).toHaveTextContent('第 3 次课 · 定时与收口');
    expect(where).toHaveTextContent('÷256 拆字节');
    expect(within(where).getByText('÷256 拆字节')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /在新标签单独打开本篇/ })).toHaveAttribute(
      'href',
      '/resources/course/courseware/u5/u5-lesson-3.html#hex-split',
    );
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IP 优先级位 ↔ 中断源' })).not.toBeInTheDocument();
  });

  it('keeps #rev-hex on the same lesson 3 note', async () => {
    const frame = await openAt('/lesson-notes?note=u5-lesson-3#rev-hex', '第 3 次课 · 定时与收口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-lesson-3.html#rev-hex');
    expect(screen.getByRole('tab', { name: /第 3 次课/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the same pane from a unit link that only carries the hash', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-2');
  });

  it('keeps an alias note on its own section instead of a foreign hash', async () => {
    const frame = await openAt('/lesson-notes?note=u3-jump#int-2', '第 3 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u3/u3-overview.html#jump');
  });

  it('shows chapter 2 as three lessons and only that lesson’s two pages', async () => {
    window.history.replaceState({}, '', '/lesson-notes?unit=2');
    render(<LessonNotesPage />);
    expect(chapter2Lesson(/第 1 次课/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /CPU 结构/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /存储器组织/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /I\/O 接口/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '第 2 章课次' })).not.toHaveClass('overflow-x-auto');
    expect(screen.queryByRole('tablist', { name: '单元 2 讲解笔记' })).not.toBeInTheDocument();

    fireEvent.click(chapter2Lesson(/第 2 次课/));
    const frame = await screen.findByTitle('I/O 接口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u2/u2-io-port.html');
    expect(chapter2Lesson(/第 2 次课/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /总线结构/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /CPU 结构/ })).not.toBeInTheDocument();
  });

  it('keeps ?note= and lesson hashes on the original chapter 2 page', async () => {
    const memory = await openAt('/lesson-notes?note=u2-memory#pit', '存储器组织 · 讲解笔记');
    expect(memory).toHaveAttribute('src', '/resources/course/courseware/u2/u2-memory.html#pit');
    expect(chapter2Lesson(/第 1 次课/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /存储器组织/ })).toHaveAttribute('aria-selected', 'true');

    cleanup();
    window.history.replaceState({}, '', '/lesson-notes?unit=2#u2-lesson-c');
    render(<LessonNotesPage />);
    const clock = await screen.findByTitle('时钟与时序 · 讲解笔记');
    expect(clock).toHaveAttribute('src', '/resources/course/courseware/u2/u2-clock-timing.html#u2-lesson-c');
    expect(chapter2Lesson(/第 3 次课/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns from #hex-split to that lesson, then from the chapter crumb to the door', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    try {
      const frame = await openAt('/lesson-notes?unit=5#hex-split', '第 3 次课 · 定时与收口 · 讲解笔记');
      fireEvent.click(within(placeNav()).getByRole('button', { name: /第 3 次课 · 定时与收口/ }));
      await waitFor(() => {
        expect(frame.contentWindow?.location.hash).toBe('');
      });
      expect(window.location.pathname + window.location.search + window.location.hash).toBe('/lesson-notes?note=u5-lesson-3');
      expect(placeNav()).not.toHaveTextContent('÷256 拆字节');
      expect(within(placeNav()).getByText('第 3 次课 · 定时与收口')).toHaveAttribute('aria-current', 'page');

      fireEvent.click(within(placeNav()).getByRole('button', { name: /第 5 章 · 中断系统与定时器/ }));
      const overview = await screen.findByTitle('第 5 章交互总览 · 讲解笔记');
      expect(overview).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html');
      expect(window.location.pathname + window.location.search + window.location.hash).toBe('/lesson-notes?unit=5');
      expect(placeNav()).not.toHaveTextContent('第 3 次课');
      expect(screen.getByRole('button', { name: '回课次' })).toBeInTheDocument();
      expect(back).not.toHaveBeenCalled();
    } finally {
      back.mockRestore();
    }
  });

  it('follows a cross-chapter open onto the new chapter, lesson, and section', async () => {
    await openAt('/lesson-notes?unit=5#int-2', '第 5 章交互总览 · 讲解笔记');
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'lesson-note:open', file: 'u4-classroom', hash: '#s-map' },
    }));
    const frame = await screen.findByTitle('课堂互动台 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u4/u4-classroom.html#s-map');
    const where = placeNav();
    expect(where).toHaveTextContent('第 4 章 · 汇编语言程序设计');
    expect(where).toHaveTextContent('回炉复习');
    expect(where).toHaveTextContent('111 条全景');
    expect(where).not.toHaveTextContent('查询与中断');
  });

  it('keeps the unit 2 place readable from the chapter down to the page', async () => {
    await openAt('/lesson-notes?unit=2#bus', '总线结构 · 讲解笔记');
    const where = placeNav();
    expect(where).toHaveTextContent('第 2 章 · 硬件结构');
    expect(where).toHaveTextContent('第 2 次课 · 口和总线');
    expect(within(where).getByText('总线结构')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(where).getByRole('button', { name: /第 2 次课 · 口和总线/ }));
    const page = await screen.findByTitle('I/O 接口 · 讲解笔记');
    expect(page).toHaveAttribute('src', expect.stringContaining('/u2/u2-io-port.html'));
    expect(window.location.hash).toBe('#u2-lesson-b');
    expect(chapter2Lesson(/第 2 次课/)).toHaveAttribute('aria-pressed', 'true');
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
