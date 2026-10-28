import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('opens the CPU structure puzzle on the unit 2 CPU note', async () => {
    const frame = await openAt('/lesson-notes?unit=2#cpu', 'CPU 结构 · 讲解笔记');
    expect(frame).toHaveAttribute('src', expect.stringContaining('/resources/course/courseware/u2/u2-cpu-structure.html'));
    expect(frame.contentWindow?.location.hash).toBe('#cpu');
    expect(frame.contentWindow?.location.pathname).toBe('/resources/course/courseware/u2/u2-cpu-structure.html');
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
    expect(screen.getByRole('button', { name: /第 2 次课/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /总线结构/ })).toHaveAttribute('aria-selected', 'true');
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
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '指令 ↔ 寻址方式' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
  });

  it('opens the interrupt-source match on unit 5 section ③', async () => {
    const frame = await openAt('/lesson-notes?unit=5#int-3', '第 5 章交互总览 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-overview.html#int-3');
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
    expect(await screen.findByRole('button', { name: '核对' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TMOD 字段 ↔ 含义' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '对照动手练③' })).toBeInTheDocument();
    expect(screen.getByText('M1 M0 = 00')).toBeInTheDocument();
    expect(screen.getByText('GATE = 1')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '中断源 ↔ 请求标志' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'IE 允许位 ↔ 中断源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'TCON 位 ↔ 含义' })).not.toBeInTheDocument();
  });

  it('opens unit 5 #hex-split on the lesson 3 page and keeps the hash', async () => {
    const frame = await openAt('/lesson-notes?unit=5#hex-split', '第 3 次课 · 定时与收口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u5/u5-lesson-3.html#hex-split');
    expect(screen.getByRole('button', { name: /单元 5/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /第 3 次课/ })).toHaveAttribute('aria-selected', 'true');
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
    expect(await screen.findByRole('button', { name: /第 1 次课/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /CPU 结构/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /存储器组织/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /I\/O 接口/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '第 2 章课次' })).not.toHaveClass('overflow-x-auto');
    expect(screen.queryByRole('tablist', { name: '单元 2 讲解笔记' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /第 2 次课/ }));
    const frame = await screen.findByTitle('I/O 接口 · 讲解笔记');
    expect(frame).toHaveAttribute('src', '/resources/course/courseware/u2/u2-io-port.html');
    expect(screen.getByRole('button', { name: /第 2 次课/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /总线结构/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /CPU 结构/ })).not.toBeInTheDocument();
  });

  it('keeps ?note= and lesson hashes on the original chapter 2 page', async () => {
    const memory = await openAt('/lesson-notes?note=u2-memory#pit', '存储器组织 · 讲解笔记');
    expect(memory).toHaveAttribute('src', '/resources/course/courseware/u2/u2-memory.html#pit');
    expect(screen.getByRole('button', { name: /第 1 次课/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('tab', { name: /存储器组织/ })).toHaveAttribute('aria-selected', 'true');

    cleanup();
    window.history.replaceState({}, '', '/lesson-notes?unit=2#u2-lesson-c');
    render(<LessonNotesPage />);
    const clock = await screen.findByTitle('时钟与时序 · 讲解笔记');
    expect(clock).toHaveAttribute('src', '/resources/course/courseware/u2/u2-clock-timing.html#u2-lesson-c');
    expect(screen.getByRole('button', { name: /第 3 次课/ })).toHaveAttribute('aria-pressed', 'true');
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
